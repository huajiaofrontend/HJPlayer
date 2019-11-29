/**
 * playlist-loader
 */
import EventEmitter from 'eventemitter3';
import { PlaylistLevelType, XhrLoaderResponse, FragLoaderContext, XhrLoaderStats, ErrorData } from '../Interfaces/Loader';
import MediaConfig from '../Interfaces/MediaConfig';
export default class PlaylistLoader {
    private _emitter;
    /**
     * 是否中断请求
     */
    private _requestAbort;
    /**
     * 拉直播M3U8的定时器
     */
    private timer;
    /**
     * m3u8地址
     */
    url: string;
    /**
     * 请求m3u8地址的配置
     */
    dataSource: MediaConfig;
    /**
     * m3u8解析返回数据
     */
    private currentPlaylist;
    /**
     * 最新的m3u8文档内容
     */
    private lastestM3U8Content;
    private Tag;
    constructor(dataSource: MediaConfig);
    /**
     * 绑定事件
     * @param { String } event
     * @param { Function } listener
     */
    on(event: string, listener: EventEmitter.ListenerFn): void;
    /**
     * 取消绑定事件
     * @param { String } event
     * @param { Function } listener
     */
    off(event: string, listener: EventEmitter.ListenerFn): void;
    /**
     * 初始化XHR对象, 加载M3U8文件;
     */
    load(): void;
    /**
     * 停止，直播暂时没实现暂停
     */
    stop(): void;
    /**
     * 加载M3U8文件成功
     */
    loadSuccess(response: XhrLoaderResponse, stats: XhrLoaderStats, context: FragLoaderContext, networkDetails?: any): void;
    /**
     * 取消loader, 清除定时器, 移除自身绑定的事件
     */
    abort(): void;
    /**
     * 销毁功能
     */
    destroy(): void;
    /**
     * 处理下载的M3U8文件(普通M3U8 ts文件列表)
     */
    _handleTrackOrLevelPlaylist(response: XhrLoaderResponse, stats: XhrLoaderStats, context: FragLoaderContext, networkDetails: any): void;
    /**
     * 处理下载的M3U8文件(清晰度选择)
     */
    _handleMasterPlaylist(response: XhrLoaderResponse, stats: XhrLoaderStats, context: FragLoaderContext, networkDetails: any): void;
    /**
     * 处理解析M3U8文件解析错误
     * @param response
     * @param context
     * @param reason
     * @param networkDetails
     * @private
     */
    _handleManifestParsingError(response: XhrLoaderResponse, context: FragLoaderContext, reason: string, networkDetails: any): void;
    _getResponseUrl(response: XhrLoaderResponse, context: FragLoaderContext): string;
    mapContextToLevelType(context: FragLoaderContext): PlaylistLevelType;
    loadError(response: ErrorData, context: FragLoaderContext, xhr: XMLHttpRequest | null): void;
    loadTimeout(stats: XhrLoaderStats, context: FragLoaderContext, xhr: XMLHttpRequest | null): void;
}
