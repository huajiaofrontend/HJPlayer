/**
 * playlist-loader
 */
import EventEmitter from 'eventemitter3';
import XHRLoader from './XHRLoader';
import M3U8Parser from '../Parser/M3u8Parser';
import LoaderEvent from './LoaderEvent';
import computeReloadInterval from '../Utils/computeReloadInterval';
import getGlobal from '../Utils/getGlobalObject';
import Level from '../Parser/Level';
import { AudioGroup } from '../Interfaces/Media-playlist';
import {
    PlaylistLevelType,
    SingleLevels,
    XhrLoaderResponse,
    FragLoaderContext,
    LoaderConfiguration,
    LoaderCallbacks,
    XhrLoaderStats,
    ErrorData
} from '../Interfaces/Loader';
import MediaConfig from '../Interfaces/MediaConfig';
import Logger from '../Utils/Logger';

const GlobalEnvironment = getGlobal();

enum PlaylistContextType {
    'MANIFEST' = 'manifest',
    'LEVEL' = 'level',
    'AUDIO_TRACK' = 'audioTrack',
    'SUBTITLE_TRACK' = 'subtitleTrack'
}

export default class PlaylistLoader {
    private _emitter: EventEmitter = new EventEmitter()

    /**
     * 是否中断请求
     */
    private _requestAbort: boolean = false

    /**
     * 拉直播M3U8的定时器
     */
    private timer: number = 0

    /**
     * m3u8地址
     */
    public url: string

    /**
     * 请求m3u8地址的配置
     */
    public dataSource: MediaConfig

    /**
     * m3u8解析返回数据
     */
    private currentPlaylist: Level | null = null

    /**
     * 最新的m3u8文档内容
     */
    private lastestM3U8Content: string = ''

    private Tag: string = 'PlayListLoader';

    constructor(dataSource: MediaConfig) {
        this.dataSource = dataSource;
        this.url = dataSource.url;
    }

    /**
     * 绑定事件
     * @param { String } event
     * @param { Function } listener
     */
    on(event: string, listener: EventEmitter.ListenerFn): void {
        this._emitter.addListener(event, listener);
    }

    /**
     * 取消绑定事件
     * @param { String } event
     * @param { Function } listener
     */
    off(event: string, listener: EventEmitter.ListenerFn): void {
        this._emitter.removeListener(event, listener);
    }

    /**
     * 初始化XHR对象, 加载M3U8文件;
     */
    load() {
        /**
         * 加载m3u8文件配置参数
         */
        const loaderConfig: LoaderConfiguration = {
            maxRetry: 2,
            maxRetryDelay: 1000,
            retryDelay: 1000,
            timeout: 10000
        };
        const loaderCallbacks: LoaderCallbacks<FragLoaderContext> = {
            onSuccess: this.loadSuccess.bind(this),
            onError: this.loadError.bind(this),
            onTimeout: this.loadTimeout.bind(this)
        };

        const context: FragLoaderContext = {
            url: this.url,
            type: PlaylistContextType.MANIFEST,
            level: 0,
            id: null,
            responseType: 'text'
        };

        const xhrLoader = new XHRLoader();

        xhrLoader.load(context, loaderConfig, loaderCallbacks);
    }

    /**
     * 停止，直播暂时没实现暂停
     */
    stop() {}

    /**
     * 加载M3U8文件成功
     */
    loadSuccess(
        response: XhrLoaderResponse,
        stats: XhrLoaderStats,
        context: FragLoaderContext,
        networkDetails:any = null
    ): void {
        if(typeof response.data !== 'string') {
            throw new Error('expected responseType of "text" for PlaylistLoader');
        }
        const string: string = response.data;

        this.lastestM3U8Content = string;

        stats.tload = performance.now();

        if(string.indexOf('#EXTM3U') !== 0) {
            this._handleManifestParsingError(
                response,
                context,
                'no EXTM3U delimiter',
                networkDetails
            );
            return;
        }

        if(string.indexOf('#EXTINF:') > 0 || string.indexOf('#EXT-X-TARGETDURATION:') > 0) {
            this._handleTrackOrLevelPlaylist(response, stats, context, networkDetails);
        } else {
            this._handleMasterPlaylist(response, stats, context, networkDetails);
        }
    }

    /**
     * 取消loader, 清除定时器, 移除自身绑定的事件
     */
    abort() {
        this._requestAbort = true;
        clearInterval(this.timer);
        this._emitter && this._emitter.removeAllListeners();
        delete this._emitter;
        delete this.dataSource;
        delete this.currentPlaylist;
        Logger.info(this.Tag, `${this.Tag} has been abort`);
    }

    /**
     * 销毁功能
     */
    destroy() {
        this.abort();
        Logger.info(this.Tag, `${this.Tag} has been destroy`);
    }

    /**
     * 处理下载的M3U8文件(普通M3U8 ts文件列表)
     */
    _handleTrackOrLevelPlaylist(
        response: XhrLoaderResponse,
        stats: XhrLoaderStats,
        context: FragLoaderContext,
        networkDetails: any
    ): void {
        const { id, level, type } = context;
        const url: string = this._getResponseUrl(response, context);
        const levelUrlId: number = Number.isFinite(id as number) ? (id as number) : 0;
        const levelId: number = Number.isFinite(level as number) ? (level as number) : levelUrlId;
        const levelType: PlaylistLevelType = this.mapContextToLevelType(context);
        const levelDetails: Level = M3U8Parser.parseLevelPlaylist(
            response.data as string,
            url,
            levelId,
            levelType,
            levelUrlId
        );
        (levelDetails as any).tload = stats.tload;

        if(type === PlaylistContextType.MANIFEST) {
            const singleLevel = {
                url,
                details: levelDetails
            };

            this._emitter.emit(LoaderEvent.MANIFEST_PARSED, {
                type: 'levelPlaylist',
                levels: [singleLevel],
                audioTracks: [],
                url,
                stats,
                networkDetails
            });
            if(levelDetails.live === true && this._requestAbort === false) {
                const reloadInterval = computeReloadInterval(
                    this.currentPlaylist,
                    levelDetails,
                    stats.trequest
                );
                this.timer = GlobalEnvironment.setTimeout(() => {
                    this.load();
                }, reloadInterval);
            }

            this.currentPlaylist = levelDetails;
        }
    }

    /**
     * 处理下载的M3U8文件(清晰度选择)
     */
    _handleMasterPlaylist(
        response: XhrLoaderResponse,
        stats: XhrLoaderStats,
        context: FragLoaderContext,
        networkDetails: any
    ): void {
        const string: string = response.data as string;

        const url: string = this._getResponseUrl(response, context);
        const levels: SingleLevels[] = M3U8Parser.parseMasterPlaylist(string, url);
        if(!levels.length) {
            this._handleManifestParsingError(
                response,
                context,
                'no level found in manifest',
                networkDetails
            );
            return;
        }

        // multi level playlist, parse level info

        const audioGroups: Array<AudioGroup> = levels.map((level) => ({
            id: level.attrs.AUDIO,
            codec: level.audioCodec
        }));

        const audioTracks = M3U8Parser.parseMasterPlaylistMedia(string, url, 'AUDIO', audioGroups);
        const subtitles = M3U8Parser.parseMasterPlaylistMedia(string, url, 'SUBTITLES');

        if(audioTracks.length) {
            // check if we have found an audio track embedded in main playlist (audio track without URI attribute)
            let embeddedAudioFound = false;
            audioTracks.forEach((audioTrack) => {
                if(!audioTrack.url) {
                    embeddedAudioFound = true;
                }
            });

            // if no embedded audio track defined, but audio codec signaled in quality level,
            // we need to signal this main audio track this could happen with playlists with
            // alt audio rendition in which quality levels (main)
            // contains both audio+video. but with mixed audio track not signaled
            if(embeddedAudioFound === false && levels[0].audioCodec && !levels[0].attrs.AUDIO) {
                Logger.log(this.Tag, 'audio codec signaled in quality level, but no embedded audio track signaled, create one');
                audioTracks.unshift({
                    type: 'main',
                    name: 'main',
                    default: false,
                    autoselect: false,
                    forced: false,
                    id: 0
                });
            }
        }
        levels.sort((a, b) => a.bitrate - b.bitrate);
        this._emitter.emit(LoaderEvent.MANIFEST_PARSED, {
            type: 'masterPlaylist',
            levels,
            audioTracks,
            subtitles,
            url,
            stats,
            networkDetails,
        });
    }

    /**
     * 处理解析M3U8文件解析错误
     * @param response
     * @param context
     * @param reason
     * @param networkDetails
     * @private
     */
    _handleManifestParsingError(
        response: XhrLoaderResponse,
        context: FragLoaderContext,
        reason: string,
        networkDetails: any
    ) {
        this._emitter.emit(LoaderEvent.PARSE_ERROR, {
            url: response.url,
            reason,
            fatal: true,
            networkDetails
        });
    }

    // 获得请求响应的URL
    _getResponseUrl(response: XhrLoaderResponse, context: FragLoaderContext) {
        let { url } = response;
        // responseURL not supported on some browsers (it is used to detect URL redirection)
        // data-uri mode also not supported (but no need to detect redirection)
        if(url === undefined || url.indexOf('data:') === 0) {
            // fallback to initial URL
            ({ url } = context);
        }
        return url;
    }

    mapContextToLevelType(context: FragLoaderContext): PlaylistLevelType {
        const { type } = context;
        switch(type) {
        case PlaylistContextType.AUDIO_TRACK:
            return PlaylistLevelType.AUDIO;
        case PlaylistContextType.SUBTITLE_TRACK:
            return PlaylistLevelType.SUBTITLE;
        default:
            return PlaylistLevelType.MAIN;
        }
    }

    loadError(response: ErrorData, context: FragLoaderContext, xhr: XMLHttpRequest | null): void {
        response.text = 'playlist not found';
        this._emitter.emit(LoaderEvent.LOADING_ERROR, {
            response,
            context,
            xhr
        });
    }

    loadTimeout(
        stats: XhrLoaderStats,
        context: FragLoaderContext,
        xhr: XMLHttpRequest | null
    ): void {
        stats.text = 'download playlist timeout';
        this._emitter.emit(LoaderEvent.LOADIND_TIMEOUT, {
            stats,
            context,
            xhr
        });
    }
}
