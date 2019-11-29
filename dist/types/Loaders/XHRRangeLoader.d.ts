import EventEmitter from 'eventemitter3';
import BaseLoader from './BaseLoader';
import UserConfig from '../Interfaces/UserConfig';
import RangeSeekHandler from './RangeSeekHandler';
import SeekRange from '../Interfaces/SeekRange';
import MediaConfig from '../Interfaces/MediaConfig';
declare class RangeLoader extends BaseLoader {
    Tag: string;
    /**
     * use range request to seek
     */
    private seekHandler;
    /**
     * 初始化配置
     */
    private userConfig;
    _needStash: boolean;
    /**
     * 块数据的大小
     */
    private _currentChunkSizeKB;
    /**
     * 当前标准速度
     */
    private _currentSpeedNormalized;
    /**
     * 下载速度为0的次数
     */
    private _zeroSpeedChunkCount;
    /**
     * xhr
     */
    _xhr: XMLHttpRequest | null;
    private _speedSampler;
    /**
     * 是否阻止请求
     */
    private _requestAbort;
    private _waitForTotalLength;
    /**
     * 是否收到整个数据
     */
    private _totalLengthReceived;
    /**
     * 当前请求url
     */
    private _currentRequestURL;
    private _currentRedirectedURL;
    /**
     * 当前range
     */
    _currentRequestRange: SeekRange | null;
    /**
     * 数据的长度
     */
    private _contentLength;
    /**
     * 接受数据长度
     */
    private _receivedLength;
    /**
     * 最新下载进度, 字节
     */
    private _lastTimeLoaded;
    /**
     * chunk list
     */
    private _chunkSizeKBList;
    /**
     * 文件总长度
     */
    private _totalLength;
    private _range;
    private mediaConfig;
    eventEmitter: EventEmitter;
    /**
     * 是否支持xhr
     */
    static isSupported(): boolean;
    constructor(seekHandler: RangeSeekHandler, userConfig: UserConfig);
    destory(): void;
    readonly currentSpeed: number;
    startLoad(mediaConfig: MediaConfig, seekRange: SeekRange): void;
    /**
     * 请求子range
     */
    _openSubRange(): void;
    /**
     * 请求数据
     */
    _internalOpen(mediaConfig: MediaConfig | null, seekRange: SeekRange): void;
    abort(): void;
    _onReadyStateChange(e: Event): void;
    _onProgress(e: ProgressEvent): void;
    _onLoad(e: Event): void;
    _onXhrError(e: ProgressEvent): void;
    _normalizeSpeed(input: number): number;
    _internalAbort(): void;
    on(eventName: string, callback: EventEmitter.ListenerFn): void;
    once(eventName: string, callback: EventEmitter.ListenerFn): void;
    off(eventName: string, callback?: EventEmitter.ListenerFn): void;
}
export default RangeLoader;
