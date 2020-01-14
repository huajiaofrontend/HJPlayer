import Logger from '../Utils/Logger';
import SpeedChecker from '../Utils/networkSpeedChecker';
import LoaderStatus from '../Loaders/LoaderStatus';
import Errors from '../Errors/index';
import Events from '../Events/index';
import FetchStreamLoader from '../Loaders/FetchStreamLoader';
import MozChunkedLoader from '../Loaders/XHRMozChunkedLoader';
import MSStreamLoader from '../Loaders/XHRMsStreamLoader';
import RangeLoader from '../Loaders/XHRRangeLoader';
import WebSocketLoader from '../Loaders/WebSocketLoader';
import FragmentLoader from '../Loaders/FragmentLoader';
import RangeSeekHandler from '../Utils/range-seek-handler';
import ParamSeekHandler from '../Utils/param-seek-handler';
import {
    RuntimeException,
    IllegalStateException,
    InvalidArgumentException
} from '../Utils/Exception';
import MediaConfig from '../Interfaces/MediaConfig';
import SeekRange from '../Interfaces/SeekRange';
import ErrorData from '../Interfaces/ErrorData';
import HJPlayerConfig from '../Interfaces/HJPlayerConfig';
import TSManifest from '../Interfaces/TSManifest';
import { TSExtraData } from '../Interfaces/TSExtraData';

class IOController {
    /**
     * 文件标签
     */
    Tag: string

    /**
     * 媒体文件设置
     */
    private _mediaConfig: MediaConfig

    /**
     * 用户设置
     */
    private _config: HJPlayerConfig

    /**
     * 存储的buffer初始大小
     */
    private _stashInitialSize: number

    /**
     * 缓冲池已用大小
     */
    private _stashUsed: number

    /**
     * 存储的buffer尺寸
     */
    private _stashSize: number

    /**
     * 是否允许 LoaderIO 建立缓冲池
     */
    private _enableStash: boolean

    /**
     * 缓冲池的尺寸
     */
    private _bufferSize: number

    /**
     * LoaderIO的缓冲池
     */
    private _stashBuffer: ArrayBuffer

    /**
     * 缓冲池缓冲的Buffer数据流在媒体文件中的位置
     */
    private _stashByteStart: number

    /**
     * 加载器实例
     */
    private _loader:
        | FetchStreamLoader
        | MozChunkedLoader
        | MSStreamLoader
        | RangeLoader
        | WebSocketLoader
        | FragmentLoader
        | null

    // 加载媒体文件的加载器实例
    /**
     * 加载媒体文件的加载器定义类
     */
    private _loaderClass:
        | FetchStreamLoader
        | MozChunkedLoader
        | MSStreamLoader
        | RangeLoader
        | WebSocketLoader
        | FragmentLoader
        | any

    /**
     * 视频 seek 处理函数, 可根据后台服务自己去定义
     */
    private _seekHandler: ParamSeekHandler | RangeSeekHandler | any

    /**
     * 媒体设置里的URL是否为 WebSocket 地址
     */
    private _isWebSocketURL: boolean

    /**
     * 加载文件体积
     */
    private _refTotalLength: number | null

    /**
     * 总体文件大小
     */
    private _totalLength: number | null
    /**
     *  全部请求的标志
     */

    private _fullRequestFlag: boolean

    /**
     * 请求的范围 from xxx, to xxx
     */
    private _currentRange: SeekRange | null

    /**
     * HTTP 301/302跳转后的地址
     */
    private _redirectedURL: string | null

    /**
     * 计算后的网速标准值
     */
    private _speedNormalized: number | null

    /**
     * 网速标准表, 用于把 networkSpeedChecker 估算后得到的网速经计算后得到标准值 _speedNormalized
     */
    private _speedNormalizeList: Array<number>

    /**
     * 是否过早的遇到 EOF
     */
    private _isEarlyEofReconnecting: boolean

    /**
     * 是否暂停
     */
    private _paused: boolean

    /**
     * 恢复下载时的续传点
     */
    private _resumeFrom: number

    // 恢复下载时的续传点
    /**
     * 数据透传到IOController的处理函数
     */
    private _onDataArrival: Function | null

    /**
     *  当 seek 结束时上报的函数
     */
    private _onSeeked: Function | null

    /**
     * 发生错误的处理函数
     */
    private _onError: Function | null

    /**
     * 加载完成时透传的函数
     */
    private _onComplete: Function | null

    /**
     * 遇到 HTTP 301/302 网址跳转时处理的函数
     */
    private _onRedirect: Function | null

    /**
     * 当从 EarlyEof 恢复时透传的函数
     */
    private _onRecoveredEarlyEof: Function | null

    /**
     * 当M3U8文档被解析之后向上提交
     */
    private _onManifestParsed: Function | null

    /**
     * 额外的数据, 在flv.js中用于传输segment的索引值
     */
    private _extraData: number | null;

    /**
     * hls 解析的Levels
     */
    private _tsExtraData: TSExtraData | undefined

    /**
     * 网速检查器
     */
    private _speedChecker: SpeedChecker

    constructor(dataSource: MediaConfig, config: HJPlayerConfig, extraData: number) {
        this.Tag = 'IOController';

        this._config = config;
        this._extraData = extraData;

        this._stashInitialSize = 1024 * 384; // default initial size: 384KB
        if(config.stashInitialSize !== undefined && config.stashInitialSize > 0) {
            // apply from config
            this._stashInitialSize = config.stashInitialSize * 1024;
        }

        this._stashUsed = 0;
        this._stashSize = this._stashInitialSize;
        this._bufferSize = 1024 * 1024 * 3; // initial size: 3MB
        this._stashBuffer = new ArrayBuffer(this._bufferSize);
        this._stashByteStart = 0;
        this._enableStash = true;
        if(config.enableStashBuffer === false) {
            this._enableStash = false;
        }

        this._loader = null;
        this._loaderClass = null;
        this._seekHandler = null;
        this._mediaConfig = dataSource;
        this._isWebSocketURL = /wss?:\/\/(.+?)/.test(dataSource.url);
        this._refTotalLength = dataSource.fileSize ? dataSource.fileSize : null;
        this._totalLength = this._refTotalLength;
        this._tsExtraData = undefined;
        this._fullRequestFlag = false;
        this._currentRange = null;
        this._redirectedURL = null;
        this._speedNormalized = 0;
        this._speedChecker = new SpeedChecker();
        this._speedNormalizeList = [64, 128, 256, 384, 512, 768, 1024, 1536, 2048, 3072, 4096];
        this._isEarlyEofReconnecting = false;
        this._paused = false;
        this._resumeFrom = 0;
        this._onDataArrival = null;
        this._onSeeked = null;
        this._onError = null;
        this._onComplete = null;
        this._onRedirect = null;
        this._onRecoveredEarlyEof = null;
        this._onManifestParsed = null;
        this._selectSeekHandler();
        this._selectLoader();
        this._createLoader();
    }

    destroy() {
        if(this._loader!.isWorking()) {
            this._loader!.abort();
        }
        this._loader!.destroy();
        this._loader = null;
        this._loaderClass = null;
        delete this._mediaConfig;
        delete this._stashBuffer;
        this._stashByteStart = 0;
        this._bufferSize = 0;
        this._stashSize = 0;
        this._stashUsed = 0;
        this._currentRange = null;
        delete this._speedChecker;
        this._isEarlyEofReconnecting = false;
        this._onDataArrival = null;
        this._onSeeked = null;
        this._onError = null;
        this._onComplete = null;
        this._onRedirect = null;
        this._onRecoveredEarlyEof = null;
        this._onManifestParsed = null;
        this._extraData = null;
    }

    isWorking() {
        return this._loader && this._loader.isWorking() && !this._paused;
    }

    isPaused() {
        return this._paused;
    }

    get status() {
        return this._loader!.status;
    }

    get extraData() {
        return this._extraData;
    }

    set extraData(data) {
        this._extraData = data;
    }

    // prototype: function onDataArrival(chunks: ArrayBuffer, byteStart: number): number
    get onDataArrival() {
        return this._onDataArrival;
    }

    set onDataArrival(callback) {
        this._onDataArrival = callback;
    }

    get onSeeked() {
        return this._onSeeked;
    }

    set onSeeked(callback) {
        this._onSeeked = callback;
    }

    // prototype: function onError(type: number, info: {code: number, msg: string}): void
    get onError() {
        return this._onError;
    }

    set onError(callback) {
        this._onError = callback;
    }

    get onComplete() {
        return this._onComplete;
    }

    set onComplete(callback) {
        this._onComplete = callback;
    }

    get onRedirect() {
        return this._onRedirect;
    }

    set onRedirect(callback) {
        this._onRedirect = callback;
    }

    get onRecoveredEarlyEof() {
        return this._onRecoveredEarlyEof;
    }

    set onRecoveredEarlyEof(callback) {
        this._onRecoveredEarlyEof = callback;
    }

    get onManifestParsed() {
        return this._onManifestParsed;
    }

    set onManifestParsed(callback) {
        this._onManifestParsed = callback;
    }

    get currentURL() {
        return this._mediaConfig.url;
    }

    get hasRedirect() {
        return this._redirectedURL != null || this._mediaConfig.redirectedURL !== undefined;
    }

    get currentRedirectedURL() {
        return this._redirectedURL || this._mediaConfig.redirectedURL;
    }

    // in KB/s
    get currentSpeed() {
        if(this._loader instanceof RangeLoader) {
            // SpeedSampler is inaccuracy if loader is RangeLoader
            return this._loader.currentSpeed;
        }
        return this._speedChecker.lastSecondKBps;
    }

    get loaderType() {
        return this._loader!.type;
    }

    _selectSeekHandler() {
        const config = this._config;

        if(config.seekType === 'range') {
            this._seekHandler = new RangeSeekHandler(this._config.rangeLoadZeroStart);
        } else if(config.seekType === 'param') {
            const paramStart = config.seekParamStart || 'bstart';
            const paramEnd = config.seekParamEnd || 'bend';

            this._seekHandler = new ParamSeekHandler(paramStart, paramEnd);
        } else if(config.seekType === 'custom') {
            if(typeof config.CustomSeekHandler !== 'function') {
                throw new InvalidArgumentException(
                    'Custom seekType specified in config but invalid CustomSeekHandler!'
                );
            }
            this._seekHandler = new config.CustomSeekHandler();
        } else {
            throw new InvalidArgumentException(`Invalid seekType in config: ${config.seekType}`);
        }
    }

    _selectLoader() {
        if(this._mediaConfig.type === 'flv') {
            if(this._config.customLoader != null) {
                this._loaderClass = this._config.customLoader;
            } else if(this._isWebSocketURL) {
                this._loaderClass = WebSocketLoader;
            } else if(FetchStreamLoader.isSupported()) {
                this._loaderClass = FetchStreamLoader;
            } else if(MozChunkedLoader.isSupported()) {
                this._loaderClass = MozChunkedLoader;
            } else if(RangeLoader.isSupported()) {
                this._loaderClass = RangeLoader;
            } else {
                throw new RuntimeException(
                    "Your browser doesn't support xhr with arraybuffer responseType!"
                );
            }
        } else if(this._mediaConfig.type === 'm3u8') {
            this._loaderClass = FragmentLoader;
        }
    }

    _createLoader() {
        this._loader = new this._loaderClass(this._seekHandler, this._config);
        this._bindLoaderEvents();
    }

    _bindLoaderEvents() {
        if(!this._loader) return;
        if(this._loader.needStashBuffer === false) {
            this._enableStash = false;
        }
        this._loader.onContentLengthKnown = this._onContentLengthKnown.bind(this);
        this._loader.onURLRedirect = this._onURLRedirect.bind(this);
        this._loader.onDataArrival = this._onLoaderChunkArrival.bind(this);
        this._loader.onComplete = this._onLoaderComplete.bind(this);
        this._loader.onError = this._onLoaderError.bind(this);
        if(this._mediaConfig.type === 'm3u8') {
            this._loader.on(Events.MANIFEST_PARSED, (data: TSManifest) => {
                this._onManifestParsed && this._onManifestParsed(data);
            });
        }
    }

    /**
     * 从选择的点开始加载
     * @param optionalFrom 开始加载的点
     */
    open(optionalFrom?: number) {
        this._currentRange = { from: 0, to: -1 };
        if(optionalFrom) {
            this._currentRange.from = optionalFrom;
        }

        this._speedChecker.reset();
        if(!optionalFrom) {
            this._fullRequestFlag = true;
        }

        this._loader && this._loader.startLoad(this._mediaConfig, { ...this._currentRange });
    }

    abort() {
        this._loader!.abort();

        if(this._paused) {
            this._paused = false;
            this._resumeFrom = 0;
        }
    }

    pause() {
        if(this.isWorking()) {
            this._loader!.abort();
            if(this._currentRange) {
                if(this._stashUsed !== 0) {
                    this._resumeFrom = this._stashByteStart;
                    this._currentRange.to = this._stashByteStart - 1;
                } else {
                    this._resumeFrom = this._currentRange.to + 1;
                }
            }

            this._stashUsed = 0;
            this._stashByteStart = 0;
            this._paused = true;
        }
    }

    resume() {
        if(this._paused) {
            this._paused = false;
            const bytes = this._resumeFrom;
            this._resumeFrom = 0;
            this._internalSeek(bytes, true);
        }
    }

    seek(bytes: number) {
        this._paused = false;
        this._stashUsed = 0;
        this._stashByteStart = 0;
        this._internalSeek(bytes, true);
    }

    /**
     * hls流处理seek, 查找相应的ts文件, 然后下载
     */
    tsSeek(milliseconds: number) {
        this._loader instanceof FragmentLoader && this._loader.seek(milliseconds);
    }

    /**
     * 加载下一个片段
     */
    loadNextFrag() {
        this._loader instanceof FragmentLoader && this._loader.loadNextFrag();
    }

    /**
     * When seeking request is from media seeking, unconsumed stash data should be dropped
     * However, stash data shouldn't be dropped if seeking requested from http reconnection
     *
     * @dropUnconsumed: Ignore and discard all unconsumed data in stash buffer
     */
    _internalSeek(bytes: number, dropUnconsumed?: boolean) {
        if(this._loader!.isWorking()) {
            this._loader!.abort();
        }

        if(this._mediaConfig.type === 'flv') {
            this._flushStashBuffer(dropUnconsumed);
            // dispatch & flush stash buffer before seek
            this._loader!.destroy();
            this._loader = null;
            const requestRange = { from: bytes, to: -1 };
            this._currentRange = { from: requestRange.from, to: -1 };
            this._stashSize = this._stashInitialSize;
            this._createLoader();
            this._loader!.startLoad(this._mediaConfig, requestRange);
        } else {
            if(this._loader instanceof FragmentLoader) {
                this._loader.resume();
                this._loader.loadNextFrag();
            }
        }
        this._speedChecker.reset();
        if(this._onSeeked) {
            this._onSeeked();
        }
    }

    /**
     * 扩冲数据池
     * @param expectedBytes 期望的数据池大小
     */
    _expandBuffer(expectedBytes: number) {
        let bufferNewSize = this._stashSize;
        while(bufferNewSize + 1024 * 1024 * 1 < expectedBytes) {
            bufferNewSize *= 2;
        }

        bufferNewSize += 1024 * 1024 * 1; // bufferSize = stashSize + 1MB
        if(bufferNewSize === this._bufferSize) {
            return;
        }

        const newBuffer = new ArrayBuffer(bufferNewSize);

        if(this._stashUsed > 0) {
            // copy existing data into new buffer
            const stashOldArray = new Uint8Array(this._stashBuffer, 0, this._stashUsed);
            const stashNewArray = new Uint8Array(newBuffer, 0, bufferNewSize);
            stashNewArray.set(stashOldArray, 0);
        }

        this._stashBuffer = newBuffer;
        this._bufferSize = bufferNewSize;
    }

    /**
     * 标准化网速值, 使之等于标准1M, 2M, 4M 10M等带宽的网速最大值
     * @param input speedChecker返回的网速值
     */
    _normalizeSpeed(input: number) {
        const list = this._speedNormalizeList;
        const last = list.length - 1;
        let mid = 0;
        let lbound = 0;
        let ubound = last;

        if(input < list[0]) {
            return list[0];
        }

        // binary search
        while(lbound <= ubound) {
            mid = lbound + Math.floor((ubound - lbound) / 2);
            if(mid === last || (input >= list[mid] && input < list[mid + 1])) {
                return list[mid];
            } if(list[mid] < input) {
                lbound = mid + 1;
            } else {
                ubound = mid - 1;
            }
        }
    }

    _adjustStashSize(normalized: number) {
        let stashSizeKB = 0;

        if(this._config.isLive) {
            // live stream: always use single normalized speed for size of stashSizeKB
            stashSizeKB = normalized;
        } else {
            if(normalized < 512) {
                stashSizeKB = normalized;
            } else if(normalized >= 512 && normalized <= 1024) {
                stashSizeKB = Math.floor(normalized * 1.5);
            } else {
                stashSizeKB = normalized * 2;
            }
        }

        if(stashSizeKB > 8192) {
            stashSizeKB = 8192;
        }

        const bufferSize = stashSizeKB * 1024 + 1024 * 1024 * 1; // stashSize + 1MB
        if(this._bufferSize < bufferSize) {
            this._expandBuffer(bufferSize);
        }
        this._stashSize = stashSizeKB * 1024;
    }

    /**
     * 向上发送数据块, 并返回已经解析处理的数据的长度
     * @param chunks 发送的数据内容
     * @param byteStart 数据内容在总的数据中的索引值
     * @param extraData 额外的数据
     */
    _dispatchChunks(chunks: ArrayBuffer, byteStart: number, extraData?: TSExtraData): number {
        this._currentRange && (this._currentRange.to = byteStart + chunks.byteLength - 1);
        if(this._onDataArrival) {
            return this._onDataArrival(chunks, byteStart, extraData);
        }
        return 0;
    }

    /**
     * 发生 301/302 地址跳转后的处理函数
     * @param redirectedURL 跳转的地址
     */
    _onURLRedirect(redirectedURL: string) {
        this._redirectedURL = redirectedURL;
        if(this._onRedirect) {
            this._onRedirect(redirectedURL);
        }
    }

    /**
     * 当在response header 中获知请求文件大小后处理的函数
     * @param contentLength 在请求头中获知文件的大小
     */
    _onContentLengthKnown(contentLength: number) {
        if(contentLength && this._fullRequestFlag) {
            this._totalLength = contentLength;
            this._fullRequestFlag = false;
        }
    }

    /**
     * 收到loader发送过来的数据块的处理函数
     * @param chunk loader接受到的数据块
     * @param byteStart 该数据块在已经收数据流里索引
     * @param receivedLength 收到的长度
     * @param extraData 额外数据
     */
    _onLoaderChunkArrival(
        chunk: ArrayBuffer,
        byteStart: number,
        receivedLength: number,
        extraData?: TSExtraData
    ) {
        if(!this._onDataArrival) {
            throw new IllegalStateException(
                'IOController: No existing consumer (onDataArrival) callback!'
            );
        }
        if(this._paused) {
            return;
        }

        // 当收到数据流时如果处于 EarlyEOF 状态中, 而取消该状态, 通知外部已恢复
        if(this._isEarlyEofReconnecting) {
            this._isEarlyEofReconnecting = false;
            if(this._onRecoveredEarlyEof) {
                this._onRecoveredEarlyEof();
            }
        }
        this._speedChecker.addBytes(new Uint8Array(chunk).length);
        this._tsExtraData = extraData;
        // adjust stash buffer size according to network speed dynamically
        const KBps = this._speedChecker.lastSecondKBps;

        if(KBps !== 0) {
            const normalized = this._normalizeSpeed(KBps);
            if(this._speedNormalized !== normalized) {
                this._speedNormalized = Number(normalized);
                this._adjustStashSize(normalized as number);
            }
        }

        if(this._mediaConfig.type === 'm3u8') {
            this._dispatchChunks(chunk, this._stashByteStart, this._tsExtraData);
            return;
        }

        if(!this._enableStash) {
            // disable stash
            if(this._stashUsed === 0) {
                // dispatch chunk directly to consumer;
                // check ret value (consumed bytes) and stash unconsumed to stashBuffer
                const consumed = this._dispatchChunks(chunk, byteStart, extraData);
                if(consumed < chunk.byteLength) {
                    // unconsumed data remain.
                    const remain = chunk.byteLength - consumed;
                    if(remain > this._bufferSize) {
                        this._expandBuffer(remain);
                    }
                    const stashArray = new Uint8Array(this._stashBuffer, 0, this._bufferSize);
                    stashArray.set(new Uint8Array(chunk, consumed), 0);
                    this._stashUsed += remain;
                    this._stashByteStart = byteStart + consumed;
                }
            } else {
                // else: Merge chunk into stashBuffer, and dispatch stashBuffer to consumer.
                if(this._stashUsed + chunk.byteLength > this._bufferSize) {
                    this._expandBuffer(this._stashUsed + chunk.byteLength);
                }
                const stashArray = new Uint8Array(this._stashBuffer, 0, this._bufferSize);
                stashArray.set(new Uint8Array(chunk), this._stashUsed);
                this._stashUsed += chunk.byteLength;
                const consumed = this._dispatchChunks(
                    this._stashBuffer.slice(0, this._stashUsed),
                    this._stashByteStart,
                    extraData
                );
                if(consumed < this._stashUsed && consumed > 0) {
                    // unconsumed data remain
                    const remainArray = new Uint8Array(this._stashBuffer, consumed);
                    stashArray.set(remainArray, 0);
                }
                this._stashUsed -= consumed;
                this._stashByteStart += consumed;
            }
        } else {
            // enable stash
            if(this._stashUsed === 0 && this._stashByteStart === 0) {
                // seeked? or init chunk?
                // This is the first chunk after seek action
                this._stashByteStart = byteStart;
            }
            if(this._stashUsed + chunk.byteLength <= this._stashSize) {
                // just stash
                const stashArray = new Uint8Array(this._stashBuffer, 0, this._stashSize);
                stashArray.set(new Uint8Array(chunk), this._stashUsed);
                this._stashUsed += chunk.byteLength;
            } else {
                // stashUsed + chunkSize > stashSize, size limit exceeded
                let stashArray = new Uint8Array(this._stashBuffer, 0, this._bufferSize);
                if(this._stashUsed > 0) {
                    // There're stash datas in buffer
                    // dispatch the whole stashBuffer, and stash remain data
                    // then append chunk to stashBuffer (stash)
                    const buffer = this._stashBuffer.slice(0, this._stashUsed);
                    const consumed = this._dispatchChunks(buffer, this._stashByteStart, extraData);
                    if(consumed < buffer.byteLength) {
                        if(consumed > 0) {
                            const remainArray = new Uint8Array(buffer, consumed);
                            stashArray.set(remainArray, 0);
                            this._stashUsed = remainArray.byteLength;
                            this._stashByteStart += consumed;
                        }
                    } else {
                        this._stashUsed = 0;
                        this._stashByteStart += consumed;
                    }
                    if(this._stashUsed + chunk.byteLength > this._bufferSize) {
                        this._expandBuffer(this._stashUsed + chunk.byteLength);
                        stashArray = new Uint8Array(this._stashBuffer, 0, this._bufferSize);
                    }
                    stashArray.set(new Uint8Array(chunk), this._stashUsed);
                    this._stashUsed += chunk.byteLength;
                } else {
                    // stash buffer empty, but chunkSize > stashSize (oh, holy shit)
                    // dispatch chunk directly and stash remain data
                    const consumed = this._dispatchChunks(chunk, byteStart, extraData);
                    if(consumed < chunk.byteLength) {
                        const remain = chunk.byteLength - consumed;
                        if(remain > this._bufferSize) {
                            this._expandBuffer(remain);
                            stashArray = new Uint8Array(this._stashBuffer, 0, this._bufferSize);
                        }
                        stashArray.set(new Uint8Array(chunk, consumed), 0);
                        this._stashUsed += remain;
                        this._stashByteStart = byteStart + consumed;
                    }
                }
            }
        }
    }

    /**
     * 清空存储的buffer;
     * @param dropUnconsumed 是否丢弃未处理的数据
     */
    _flushStashBuffer(dropUnconsumed?: boolean) {
        if(this._stashUsed > 0) {
            const buffer = this._stashBuffer.slice(0, this._stashUsed);
            const consumed = this._dispatchChunks(buffer, this._stashByteStart, this._tsExtraData);
            const remain = buffer.byteLength - consumed;

            if(consumed < buffer.byteLength) {
                if(dropUnconsumed) {
                    Logger.warn(
                        this.Tag,
                        `${remain} bytes unconsumed data remain when flush buffer, dropped`
                    );
                } else {
                    if(consumed > 0) {
                        const stashArray = new Uint8Array(this._stashBuffer, 0, this._bufferSize);
                        const remainArray = new Uint8Array(buffer, consumed);
                        stashArray.set(remainArray, 0);
                        this._stashUsed = remainArray.byteLength;
                        this._stashByteStart += consumed;
                    }
                    return 0;
                }
            }
            this._stashUsed = 0;
            this._stashByteStart = 0;
            return remain;
        }
        return 0;
    }

    _onLoaderComplete() {
        // Force-flush stash buffer, and drop unconsumed data
        this._flushStashBuffer(true);

        if(this._onComplete) {
            this._onComplete(this._extraData);
        }
    }

    _onLoaderError(type: string, data: ErrorData) {
        Logger.error(this.Tag, `Loader error, code = ${data.code}, msg = ${data.reason}`);

        this._flushStashBuffer(false);

        if(this._isEarlyEofReconnecting) {
            // Auto-reconnect for EarlyEof failed, throw UnrecoverableEarlyEof error to upper-layer
            this._isEarlyEofReconnecting = false;
            type = Errors.UNRECOVERABLE_EARLY_EOF;
        }

        switch(type) {
        case Errors.EARLY_EOF: {
            if(!this._config.isLive) {
                // Do internal http reconnect if not live stream
                if(this._totalLength && this._currentRange) {
                    const nextFrom = this._currentRange.to + 1;
                    if(nextFrom < this._totalLength) {
                        Logger.warn(this.Tag, 'Connection lost, trying reconnect...');
                        this._isEarlyEofReconnecting = true;
                        this._internalSeek(nextFrom, false);
                    }
                    return;
                }
                // else: We don't know totalLength, throw UnrecoverableEarlyEof
            }
            // live stream: throw UnrecoverableEarlyEof error to upper-layer
            type = Errors.UNRECOVERABLE_EARLY_EOF;
            break;
        }
        case Errors.UNRECOVERABLE_EARLY_EOF:
        case Errors.CONNECTING_TIMEOUT:
        case Errors.HTTP_STATUS_CODE_INVALID:
        case Errors.EXCEPTION:
            break;
        default:
            break;
        }

        if(this._onError) {
            this._onError(type, data);
        } else {
            throw new RuntimeException(`IOException: ${data.reason}`);
        }
    }
}

export default IOController;
