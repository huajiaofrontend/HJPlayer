import MediaConfig from '../Interfaces/MediaConfig';
import ErrorData from '../Interfaces/ErrorData';
import HJPlayerConfig from '../Interfaces/HJPlayerConfig';
import { TSExtraData } from '../Interfaces/TSExtraData';
declare class IOController {
    /**
     * 文件标签
     */
    Tag: string;
    /**
     * 媒体文件设置
     */
    private _mediaConfig;
    /**
     * 用户设置
     */
    private _config;
    /**
     * 存储的buffer初始大小
     */
    private _stashInitialSize;
    /**
     * 缓冲池已用大小
     */
    private _stashUsed;
    /**
     * 存储的buffer尺寸
     */
    private _stashSize;
    /**
     * 是否允许 LoaderIO 建立缓冲池
     */
    private _enableStash;
    /**
     * 缓冲池的尺寸
     */
    private _bufferSize;
    /**
     * LoaderIO的缓冲池
     */
    private _stashBuffer;
    /**
     * 缓冲池缓冲的Buffer数据流在媒体文件中的位置
     */
    private _stashByteStart;
    /**
     * 加载器实例
     */
    private _loader;
    /**
     * 加载媒体文件的加载器定义类
     */
    private _loaderClass;
    /**
     * 视频 seek 处理函数, 可根据后台服务自己去定义
     */
    private _seekHandler;
    /**
     * 媒体设置里的URL是否为 WebSocket 地址
     */
    private _isWebSocketURL;
    /**
     * 加载文件体积
     */
    private _refTotalLength;
    /**
     * 总体文件大小
     */
    private _totalLength;
    /**
     *  全部请求的标志
     */
    private _fullRequestFlag;
    /**
     * 请求的范围 from xxx, to xxx
     */
    private _currentRange;
    /**
     * HTTP 301/302跳转后的地址
     */
    private _redirectedURL;
    /**
     * 计算后的网速标准值
     */
    private _speedNormalized;
    /**
     * 网速标准表, 用于把 networkSpeedChecker 估算后得到的网速经计算后得到标准值 _speedNormalized
     */
    private _speedNormalizeList;
    /**
     * 是否过早的遇到 EOF
     */
    private _isEarlyEofReconnecting;
    /**
     * 是否暂停
     */
    private _paused;
    /**
     * 恢复下载时的续传点
     */
    private _resumeFrom;
    /**
     * 数据透传到IOController的处理函数
     */
    private _onDataArrival;
    /**
     *  当 seek 结束时上报的函数
     */
    private _onSeeked;
    /**
     * 发生错误的处理函数
     */
    private _onError;
    /**
     * 加载完成时透传的函数
     */
    private _onComplete;
    /**
     * 遇到 HTTP 301/302 网址跳转时处理的函数
     */
    private _onRedirect;
    /**
     * 当从 EarlyEof 恢复时透传的函数
     */
    private _onRecoveredEarlyEof;
    /**
     * 当M3U8文档被解析之后向上提交
     */
    private _onManifestParsed;
    /**
     * 额外的数据, 在flv.js中用于传输segment的索引值
     */
    private _extraData;
    /**
     * hls 解析的Levels
     */
    private _tsExtraData;
    /**
     * 网速检查器
     */
    private _speedChecker;
    constructor(dataSource: MediaConfig, config: HJPlayerConfig, extraData: number);
    destroy(): void;
    isWorking(): boolean | null;
    isPaused(): boolean;
    readonly status: number;
    extraData: number | null;
    onDataArrival: Function | null;
    onSeeked: Function | null;
    onError: Function | null;
    onComplete: Function | null;
    onRedirect: Function | null;
    onRecoveredEarlyEof: Function | null;
    onManifestParsed: Function | null;
    readonly currentURL: string;
    readonly hasRedirect: boolean;
    readonly currentRedirectedURL: string | undefined;
    readonly currentSpeed: number;
    readonly loaderType: string;
    _selectSeekHandler(): void;
    _selectLoader(): void;
    _createLoader(): void;
    _bindLoaderEvents(): void;
    /**
     * 从选择的点开始加载
     * @param optionalFrom 开始加载的点
     */
    open(optionalFrom?: number): void;
    abort(): void;
    pause(): void;
    resume(): void;
    seek(bytes: number): void;
    /**
     * hls流处理seek, 查找相应的ts文件, 然后下载
     */
    tsSeek(milliseconds: number): void;
    /**
     * 加载下一个片段
     */
    loadNextFrag(): void;
    /**
     * When seeking request is from media seeking, unconsumed stash data should be dropped
     * However, stash data shouldn't be dropped if seeking requested from http reconnection
     *
     * @dropUnconsumed: Ignore and discard all unconsumed data in stash buffer
     */
    _internalSeek(bytes: number, dropUnconsumed?: boolean): void;
    /**
     * 扩冲数据池
     * @param expectedBytes 期望的数据池大小
     */
    _expandBuffer(expectedBytes: number): void;
    /**
     * 标准化网速值, 使之等于标准1M, 2M, 4M 10M等带宽的网速最大值
     * @param input speedChecker返回的网速值
     */
    _normalizeSpeed(input: number): number | undefined;
    _adjustStashSize(normalized: number): void;
    /**
     * 向上发送数据块, 并返回已经解析处理的数据的长度
     * @param chunks 发送的数据内容
     * @param byteStart 数据内容在总的数据中的索引值
     * @param extraData 额外的数据
     */
    _dispatchChunks(chunks: ArrayBuffer, byteStart: number, extraData?: TSExtraData): number;
    /**
     * 发生 301/302 地址跳转后的处理函数
     * @param redirectedURL 跳转的地址
     */
    _onURLRedirect(redirectedURL: string): void;
    /**
     * 当在response header 中获知请求文件大小后处理的函数
     * @param contentLength 在请求头中获知文件的大小
     */
    _onContentLengthKnown(contentLength: number): void;
    /**
     * 收到loader发送过来的数据块的处理函数
     * @param chunk loader接受到的数据块
     * @param byteStart 该数据块在已经收数据流里索引
     * @param receivedLength 收到的长度
     * @param extraData 额外数据
     */
    _onLoaderChunkArrival(chunk: ArrayBuffer, byteStart: number, receivedLength: number, extraData?: TSExtraData): void;
    /**
     * 清空存储的buffer;
     * @param dropUnconsumed 是否丢弃未处理的数据
     */
    _flushStashBuffer(dropUnconsumed?: boolean): number;
    _onLoaderComplete(): void;
    _onLoaderError(type: string, data: ErrorData): void;
}
export default IOController;
