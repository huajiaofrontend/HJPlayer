import EventEmitter from 'eventemitter3';
import BaseLoader from './BaseLoader';
import XHRLoader from './XHRLoader';
import logger from '../Utils/Logger';
import ParamSeekHandler from './ParamSeekHandler';
import PlayListLoader from './PlaylistLoader';
import LoaderEvent from './LoaderEvent';
import support from '../Utils/support-helper';
import MediaConfig from '../Interfaces/MediaConfig';
import LoaderStatus from './LoaderStatus';
import LoaderErrors from './LoaderErrors';
import { RuntimeException } from '../Utils/Exception';
import {
    FragLoaderContext,
    LoaderConfiguration,
    LoaderCallbacks,
    SingleLevels,
    LoaderStats,
    ResponseData,
    LoaderResponse,
    ErrorData,
    timeoutData
} from '../Interfaces/Loader';
import Fragment from './Fragment';
import getGlobalObject from '../Utils/getGlobalObject';
import HJPlayerConfig from '../Interfaces/HJPlayerConfig';

const global = getGlobalObject();

class FragmentLoader extends BaseLoader {
    eventEmitter: EventEmitter = new EventEmitter()

    Tag: string = 'FragmentLoader'

    _seekHandler: ParamSeekHandler

    // todo 确认类型
    _config: HJPlayerConfig

    _needStash: boolean

    _requestAbort: boolean

    _contentLength: number | null

    _receivedLength: number

    // 收到数据的长度
    _parser: any

    // todo 确定类型
    _dataSource: any

    // todo 貌似没有用到
    _range: any

    // todo 确定用处
    pl: PlayListLoader | null

    audioCodecSwitch: boolean = false

    levels: SingleLevels[] | null = null

    startFragRequested: boolean = false

    bitrateTest: boolean = false

    // 默认不测试, 当返回的levels的长度大于1时, 进行码率测试后, 测试完后值为false
    stats: LoaderStats | null = null

    stashFrag: Fragment[] = []

    // playlist-loader 获取到的fragments数组, 每次取最新的
    sn: number | 'initSegment' = -1

    // 加载的上一个fragment的sn, 用于查找下一个fragment, sn的序号是连续的
    loading: boolean = false

    masterLevels: SingleLevels[] = []

    // 从master.m3u8文件中获取到的levels; length > 1
    currentFrag: Fragment | null = null

    loader: XHRLoader | null = null

    _pause: boolean = false

    audioCodecSwap: boolean = false

    constructor(seekHandler: ParamSeekHandler, mediaConfig: HJPlayerConfig) {
        super('fragment-loader', 'm3u8');
        this._seekHandler = seekHandler;
        this._config = mediaConfig;
        this._needStash = true;
        this._requestAbort = false;
        this._contentLength = null;
        this._receivedLength = 0;
        this._parser = null;
        this.pl = null;
        this._dataSource = null; // todo 有没有用到
        this._range = null; // todo 确定用处
    }

    /**
     * 判断在当前浏览器环境下是否支持加载相应媒体类型的文件
     * @param mediaType 媒体类型 flv或者m3u8 // todo
     */
    static isSupport(): boolean {
        return support();
    }

    on(eventName: string, callback: EventEmitter.ListenerFn): void {
        this.eventEmitter.on(eventName, callback);
    }

    once(eventName: string, callback: EventEmitter.ListenerFn): void {
        this.eventEmitter.once(eventName, callback);
    }

    off(eventName: string, callback?: EventEmitter.ListenerFn): void {
        this.eventEmitter.off(eventName, callback);
    }

    get onComplete() {
        return this._onComplete;
    }

    set onComplete(callback) {
        this._onComplete = callback;
    }

    destroy() {
        this.abort();
        this.pl && this.pl.abort();
        this.pl = null;
        this.currentFrag = null;
        this.loader = null;
        this.bitrateTest = false;
        this.eventEmitter.removeAllListeners();
        delete this.masterLevels;
        delete this.eventEmitter;
        delete this.stashFrag;
        delete this.levels;
        delete this.stats;
    }

    /**
     * 取消清秀
     */
    abort(): void {
        this._pause = true;
        this._requestAbort = true;
        this.loading = false;
        this._status = LoaderStatus.kComplete;
        this.loader && this.loader.abort();
    }

    /**
     * loader 暂停
     */
    pause(): void {
        this._pause = true;
        this.loading = false;
    }

    /**
     * 恢复
     */
    resume(): void {
        logger.debug(this.Tag, '恢复下载');
        this._pause = false;
        this._requestAbort = false;
        this.loading = false;
        // 下载前一个ts文件, 让bufferd接上
        // if(typeof this.sn === 'number') {
        //     this.sn = Math.max(this.sn - 1, 0);
        // }
        // this.loadNextFrag();
    }

    isWorking(): boolean {
        return this._pause === false;
    }

    /**
     * 开始下载M3U8文件
     * @param { Object } dataSource
     * @param { Number } range
     */
    open(dataSource: MediaConfig, range: any) {
        // _range _dataSource 用处
        this._dataSource = dataSource;
        this._range = range;

        this.pl = new PlayListLoader(dataSource);
        this.pl.on(LoaderEvent.MANIFEST_PARSED, this.onManifestParsed.bind(this));
        this.pl.on(LoaderEvent.LOAD_COMPLETE, this._loadingM3U8Complete.bind(this));
        this.pl.on(LoaderEvent.LOADING_ERROR, this._loadingM3U8Error.bind(this));
        this.pl.on(LoaderEvent.PARSE_ERROR, this._parseM3U8Error.bind(this));
        this.pl.on(LoaderEvent.LOADIND_TIMEOUT, this._loadingM3U8Timeout.bind(this));
        this.pl.load();
    }

    startLoad(dataSource: MediaConfig, range: any) {
        this.open(dataSource, range);
    }

    /**
     * Fragment-loader 去加载下一个片段;
     */
    loadNextFrag(): void {
        if(this._requestAbort) {
            // 取消请求
            return;
        }

        if(this._pause) {
            // 如果被暂停了也不下载了
            return;
        }

        if(!this.levels) {
            return;
        }

        // 非直播流且已经下载最后一个fragment时不再下载
        if(this.levels[0].details.live === false && this.sn === this.levels[0].details.endSN) {
            this.pl && this.pl.stop && this.pl.stop(); // 取消Playlist-loader
            this.onComplete && this.onComplete(); // 加载完毕事件
            return;
        }

        let frag: Fragment = this.stashFrag[0];

        if(this.sn === 'initSegment') {
            // 第一个TS文件时initSegment
            frag = this.stashFrag[1];
            if(!frag) return;
            this.loadFrag(frag);
        } else {
            for(let i = 0; i < this.stashFrag.length; i++) {
                if(this.stashFrag[i].sn === this.sn + 1) {
                    frag = this.stashFrag[i];
                    break;
                }
            }
            if(!frag) return;
            if(this.sn < frag.sn) {
                this.loadFrag(frag);
            }
        }
    }

    loadFrag(frag: Fragment): void {
        if(this.loading) return;
        this.loading = true;
        this._status = LoaderStatus.kConnecting;
        this.currentFrag = frag;
        this.sn = frag.sn;
        const loaderContext: FragLoaderContext = {
            url: <string>frag.url,
            frag,
            responseType: 'arraybuffer',
            progressData: false
        };

        if(this.bitrateTest) {
            // 当处于码率测试时给frag的url加随机参数, 防止缓存, 让码率测试不准
            if(frag.url!.indexOf('?') > -1) {
                frag.url += `&r=${Math.random()}`;
            } else {
                frag.url += `?r=${Math.random()}`;
            }
        }

        const start = frag.byteRangeStartOffset;
        const end = frag.byteRangeEndOffset;

        if(Number.isFinite(start) && Number.isFinite(end)) {
            loaderContext.rangeStart = start;
            loaderContext.rangeEnd = end;
        }

        const loaderConfig: LoaderConfiguration = {
            timeout: 10000,
            maxRetry: 1,
            retryDelay: 200,
            maxRetryDelay: 200
        };

        const loaderCallbacks: LoaderCallbacks<FragLoaderContext> = {
            onSuccess: this._loadsuccess.bind(this),
            onError: this._loaderror.bind(this),
            onTimeout: this._loadtimeout.bind(this),
            onProgress: this._loadprogress.bind(this)
        };

        this.loader = null;

        this.loader = new XHRLoader();

        this.loader.load(loaderContext, loaderConfig, loaderCallbacks);
    }

    seek(milliseconds: number): void {
        const frag = this.currentFrag;
        const tolerance = this._config.maxFragLookUpTolerance;

        if(!this.currentFrag || !frag || !this.loader || !this.levels) {
            return;
        }

        const DoseTheFragIsDownLoading = this.status === LoaderStatus.kConnecting
        && milliseconds >= (frag.start + tolerance) * 1000
        && milliseconds <= (frag.start + frag.duration - tolerance) * 1000;

        if(!DoseTheFragIsDownLoading) {
            this.loader.abort();
            let fragmentIndex = 0;
            const fragments = this.stashFrag || [];
            for(let i = 0; i < fragments.length; i++) {
                if(
                    milliseconds >= fragments[i].start * 1000
                    && milliseconds <= (fragments[i].start + fragments[i].duration) * 1000
                ) {
                    fragmentIndex = i;
                    break;
                }
            }
            fragmentIndex = Math.max(fragmentIndex - 1, 0);
            this.currentFrag = fragments[fragmentIndex];
            this.sn = fragments[fragmentIndex].sn;
            this.loadFrag(fragments[fragmentIndex]);
        }
    }

    onManifestParsed(data: any): void {
        // todo 确定data的类型
        let aac = false;
        let heaac = false;
        let codec;

        if(!this.pl) {
            return;
        }
        data.levels.forEach((level: { audioCodec: string }) => {
            // detect if we have different kind of audio codecs used amongst playlists
            codec = level.audioCodec;
            if(codec) {
                if(codec.indexOf('mp4a.40.2') !== -1) {
                    aac = true;
                }

                if(codec.indexOf('mp4a.40.5') !== -1) {
                    heaac = true;
                }
            }
        });
        this.audioCodecSwitch = aac && heaac;
        if(this.audioCodecSwitch) {
            logger.log(
                this.Tag,
                'both AAC/HE-AAC audio found in levels; declaring level codec as HE-AAC'
            );
        }

        // 多码率播放, 在config中设置tsAutoLevelChoose为true时, 需先用低码率的playlist下载TS, 测试网速, 再去采用适合网速的playlist
        // 单码率直接使用levels[0];
        if(data.type === 'masterPlaylist' && data.levels.length > 0) {
            if(this._config.tsAutoLevelChoose) {
                this.bitrateTest = true;
            }
            const tempSource = this._dataSource;
            tempSource.url = data.levels[0].url;
            this.masterLevels = data.levels;
            this.pl.dataSource = tempSource;
            this.pl.url = data.levels[0].url;
            this.pl.load();
        } else if(data.type === 'levelPlaylist') {
            // 单码率播放列表, 可直接下载ts文件
            this.levels = data.levels;
            this.stashFrag = data.levels[0].details.fragments;
            this.startFragRequested = false;
            this.loadNextFrag();
            this.eventEmitter.emit(LoaderEvent.MANIFEST_PARSED, data.levels[0]);
        } else {
            const err = { code: -1, reason: 'can not find useful playlist' };
            if(this._onError) {
                this._onError(LoaderEvent.LOADING_ERROR, err);
            } else {
                throw new RuntimeException(err.reason);
            }
        }
    }

    // payload, frag, stats, networkDetails
    onFragLoaded(data: {payload: string | ArrayBuffer, frag: Fragment, stats: LoaderStats, networkDetails: any}): void {
        const payload:ArrayBuffer = <ArrayBuffer>data.payload;
        const { frag } = data;
        const defaultLevel = 0; // 默认为0
        if(!this.levels || !this.pl) {
            return;
        }
        if(frag.type === 'main') {
            const { stats } = data;
            const currentLevel = this.levels[defaultLevel];
            const { details } = currentLevel;
            this.stats = stats;
            if(this.bitrateTest) {
                this.startFragRequested = false;
                stats.tbuffered = global.performance.now();
                stats.tparsed = global.performance.now();
                // window.hls.trigger(Event.FRAG_BUFFERED, { stats: stats, frag: fragCurrent, id: 'main' });
                const tsCodeRate = this._caluCodeRate(payload.byteLength, stats);
                const levelIndex = this._findSuitableLevels(tsCodeRate);
                this.pl.url = this.masterLevels[levelIndex].url;
                this.pl.load();
                this.bitrateTest = false;
            } else if(frag.sn === 'initSegment') {
                stats.tbuffered = global.performance.now();
                stats.tparsed = global.performance.now();
                details.initSegment.data = data.payload;
                this.loadNextFrag();
            } else {
                // Bitrate test frags are not usually buffered so the fragment tracker ignores them. If Hls.js decides to buffer
                // it (and therefore ends up at this line), then the fragment tracker needs to be manually informed.
                if((frag as any).bitrateTest) {
                    (frag as any).bitrateTest = false;
                }
                // time Offset is accurate if level PTS is known, or if playlist is not sliding (not live) and if media is not seeking (this is to overcome potential timestamp drifts between playlists and fragments)
                const accurateTimeOffset = false;
                const initSegmentData = details.initSegment ? details.initSegment.data : [];
                const audioCodec = this._getAudioCodec(currentLevel);

                // transmux the MPEG-TS data to ISO-BMFF segments
                // const demuxer = this.demuxer = this.demuxer || new Demuxer(this.hls, 'main');
                const { videoCodec } = currentLevel;
                const { totalduration } = details;
                const byteStart = this._receivedLength;
                this._receivedLength += payload.byteLength;
                // 下载完之后向上发送
                if(this._onDataArrival) {
                    this._onDataArrival(payload, byteStart, this._receivedLength, {
                        initSegmentData,
                        audioCodec,
                        videoCodec,
                        fragCurrent: frag,
                        totalduration,
                        accurateTimeOffset
                    });
                }
                if(this._requestAbort && this._pause) {
                    this.sn = <number>(this.sn) - 1;
                    this.currentFrag = this.stashFrag[this.sn];
                }
            }
        }
        // this.fragLoadError = 0; 没有用到
    }

    _getAudioCodec(currentLevel: any): string {
        // todo 确定类型
        let audioCodec = this._config.defaultAudioCodec || currentLevel.audioCodec;
        if(this.audioCodecSwap) {
            logger.log(this.Tag, 'swapping playlist audio codec');
            if(audioCodec) {
                if(audioCodec.indexOf('mp4a.40.5') !== -1) {
                    audioCodec = 'mp4a.40.2';
                } else {
                    audioCodec = 'mp4a.40.5';
                }
            }
        }
        return audioCodec;
    }

    _loadsuccess(
        response: LoaderResponse,
        stats: LoaderStats,
        context: FragLoaderContext,
        networkDetails: any = null
    ) {
        this.loading = false;
        const payload: string | ArrayBuffer = response.data;
        const { frag } = context;
        this._status = LoaderStatus.kComplete;
        if(frag) {
            this.onFragLoaded({
                payload, frag, stats, networkDetails
            });
        }
    }

    _loaderror(response: ErrorData, context: FragLoaderContext, networkDetails: any = null) {
        this.loading = false;
        this._status = LoaderStatus.kError;

        const err = { code: response.code, reason: response.text };
        if(this._onError) {
            this._onError(LoaderErrors.HTTP_STATUS_CODE_INVALID, err);
        } else {
            throw new RuntimeException(err.reason);
        }
    }

    _loadtimeout(stats: LoaderStats, context: FragLoaderContext, networkDetails: any = null) {
        this.loading = false;
        this._status = LoaderStatus.kError;
        const err = { code: -1, reason: 'fragment request is timeout' };
        if(this._onError) {
            this._onError(LoaderErrors.CONNECTING_TIMEOUT, err);
        } else {
            throw new RuntimeException(err.reason);
        }
    }

    // data will be used for progressive parsing
    _loadprogress(stats: LoaderStats, context: FragLoaderContext, networkDetails: any = null) {
        // jshint ignore:line
        const { frag } = context;
        // this.hls.trigger(Event.FRAG_LOAD_PROGRESS, { frag: frag, stats: stats, networkDetails: networkDetails });
    }

    _loadingM3U8Complete() {}

    _loadingM3U8Error(errData: ResponseData): void {
        this.loading = false;
        this._status = LoaderStatus.kError;
        const err = { code: errData.response.code, reason: errData.response.text };
        if(this._onError) {
            this._onError(LoaderErrors.HTTP_STATUS_CODE_INVALID, err);
        } else {
            throw new RuntimeException(err.reason);
        }
    }

    _loadingM3U8Timeout(errData: timeoutData): void {
        this.loading = false;
        this._status = LoaderStatus.kError;
        const err = { code: -1, reason: errData.stats.text };
        if(this._onError) {
            this._onError(LoaderErrors.CONNECTING_TIMEOUT, err);
        } else {
            throw new RuntimeException(<string>err.reason);
        }
    }

    /**
     * 计算当前网速的码率
     * @param { Number } loadedLength - 已经加载的ts文件的byte长度
     * @param { Object } stats - 请求状态
     * @returns { Number } mySupportCodeRate - 当前网速所满足的最大码率 bit/s
     */
    _caluCodeRate(loadedLength: number, stats: LoaderStats) {
        const loadedBit = loadedLength * 8;
        const takeTime = ((stats.tparsed as number) - stats.trequest) / 1000;
        let mySupportCodeRate = loadedBit / takeTime;
        mySupportCodeRate *= 0.8; // 20%的预留, 带宽不一定是 100%的
        return mySupportCodeRate;
    }

    _parseM3U8Error(errData: LoaderResponse): void {
        this.loading = false;
        this._status = LoaderStatus.kError;
        const err = { code: -1, reason: 'parse playlist error', url: errData.url };
        if(this._onError) {
            this._onError(LoaderErrors.PARSE_PLAYLISTING_ERROR, err);
        } else {
            throw new RuntimeException(err.reason);
        }
    }

    /**
     * 在masterLevels中查找适合当前网速相应码率的level Index
     * @param { Number } codeRate -当前网速所能支持的码率
     * @returns { Number }
     */
    _findSuitableLevels(codeRate: number) {
        const arr = this.masterLevels;
        let index = 0;
        for(let i = arr.length - 1; i > 0; i--) {
            if(arr[i].bitrate < codeRate) {
                index = i;
                break;
            }
        }
        return index;
    }
}

export default FragmentLoader;
