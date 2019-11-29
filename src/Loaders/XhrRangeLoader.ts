import EventEmitter from 'eventemitter3';
import Log from '../Utils/Logger';
import SpeedSampler from './SpeedChecker';
import BaseLoader from './BaseLoader';
import { RuntimeException } from '../Utils/Exception';
import UserConfig from '../Interfaces/UserConfig';
import RangeSeekHandler from './RangeSeekHandler';
import SeekRange from '../Interfaces/SeekRange';
// import Headers from '../Interfaces/Headers';
import LoaderStatus from './LoaderStatus';
import MediaConfig from '../Interfaces/MediaConfig';
import LoaderErrors from './LoaderErrors';

class RangeLoader extends BaseLoader {
    Tag: string

    /**
     * use range request to seek
     */
    private seekHandler: RangeSeekHandler

    /**
     * 初始化配置
     */
    private userConfig: UserConfig

    _needStash: boolean

    /**
     * 块数据的大小
     */
    private _currentChunkSizeKB: number

    /**
     * 当前标准速度
     */
    private _currentSpeedNormalized: number

    /**
     * 下载速度为0的次数
     */
    private _zeroSpeedChunkCount: number

    /**
     * xhr
     */
    _xhr: XMLHttpRequest | null

    private _speedSampler: SpeedSampler

    /**
     * 是否阻止请求
     */
    private _requestAbort: boolean

    private _waitForTotalLength: boolean

    /**
     * 是否收到整个数据
     */
    private _totalLengthReceived: boolean

    /**
     * 当前请求url
     */
    private _currentRequestURL: string | null

    private _currentRedirectedURL: string | null

    /**
     * 当前range
     */
    _currentRequestRange: SeekRange | null

    /**
     * 数据的长度
     */
    private _contentLength: number | null

    /**
     * 接受数据长度
     */
    private _receivedLength: number

    /**
     * 最新下载进度, 字节
     */
    private _lastTimeLoaded: number

    /**
     * chunk list
     */
    private _chunkSizeKBList: number[]

    /**
     * 文件总长度
     */
    private _totalLength: number | null

    private _range: SeekRange | null

    private mediaConfig: MediaConfig | null

    eventEmitter: EventEmitter = new EventEmitter()

    /**
     * 是否支持xhr
     */
    static isSupported() {
        try {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', 'https://example.com', true);
            xhr.responseType = 'arraybuffer';
            return xhr.responseType === 'arraybuffer';
        } catch (e) {
            Log.warn('RangeLoader', e.message);
            return false;
        }
    }

    constructor(seekHandler: RangeSeekHandler, userConfig: UserConfig) {
        super('xhr-range-laoder', 'flv');
        this.Tag = 'RangerLoader';

        this.seekHandler = seekHandler;
        this.userConfig = userConfig;
        this._needStash = false;
        this._chunkSizeKBList = [
            128,
            256,
            384,
            512,
            768,
            1024,
            1536,
            2048,
            3072,
            4096,
            5120,
            6144,
            7168,
            8192
        ];
        this._currentChunkSizeKB = 384;
        this._currentSpeedNormalized = 0;
        this._zeroSpeedChunkCount = 0;

        this._xhr = null;
        this._speedSampler = new SpeedSampler();

        this._requestAbort = false;
        this._waitForTotalLength = false;
        this._totalLengthReceived = false;

        this._currentRequestURL = null;
        this._currentRedirectedURL = null;
        this._currentRequestRange = null;
        this._totalLength = null;
        this._contentLength = null;
        this._receivedLength = 0;
        this._lastTimeLoaded = 0;
        this._range = null;
        this.mediaConfig = null;
    }

    destory(): void {
        if(this.isWorking()) {
            this.abort();
        }
        if(this._xhr) {
            this._xhr.onreadystatechange = null;
            this._xhr.onprogress = null;
            this._xhr.onload = null;
            this._xhr.onerror = null;
            this._xhr = null;
        }
        super.destroy();
    }

    get currentSpeed(): number {
        return this._speedSampler.lastSecondKBps;
    }

    startLoad(mediaConfig: MediaConfig, seekRange: SeekRange): void {
        this.mediaConfig = mediaConfig;
        this._range = seekRange;
        this._status = LoaderStatus.kConnecting;

        let useRefTotalLength = false;
        if(this.mediaConfig.fileSize !== undefined && this.mediaConfig.fileSize !== 0) {
            useRefTotalLength = true;
            this._totalLength = this.mediaConfig.fileSize;
        }

        if(!this._totalLengthReceived && !useRefTotalLength) {
            this._waitForTotalLength = true;
            this._internalOpen(this.mediaConfig, { from: 0, to: -1 });
        } else {
            this._openSubRange();
        }
    }

    /**
     * 请求子range
     */
    _openSubRange(): void {
        if(!this._range) {
            return;
        }
        const chunkSize = this._currentChunkSizeKB * 1024;
        const from = this._range.from + this._receivedLength;
        let to = from + chunkSize;

        if(this._contentLength != null) {
            if(to - this._range.from >= this._contentLength) {
                to = this._range.from + this._contentLength - 1;
            }
        }

        this._currentRequestRange = { from, to };
        this._internalOpen(this.mediaConfig, this._currentRequestRange);
    }

    /**
     * 请求数据
     */
    _internalOpen(mediaConfig: MediaConfig | null, seekRange: SeekRange): void {
        if(!mediaConfig || !this.mediaConfig) {
            return;
        }
        this._lastTimeLoaded = 0;
        let sourceURL = mediaConfig.url;

        if(this.userConfig.reuseRedirectedURL) {
            if(this._currentRedirectedURL) {
                sourceURL = this._currentRedirectedURL;
            } else if(mediaConfig.redirectedURL !== undefined) {
                sourceURL = mediaConfig.redirectedURL;
            }
        }

        const seekConfig = this.seekHandler.getConfig(sourceURL, seekRange);
        this._currentRequestURL = seekConfig.url;
        this._xhr = new XMLHttpRequest();
        const xhr = this._xhr;
        xhr.open('GET', seekConfig.url, true);
        xhr.responseType = 'arraybuffer';
        xhr.onreadystatechange = this._onReadyStateChange.bind(this);
        xhr.onprogress = this._onProgress.bind(this);
        xhr.onload = this._onLoad.bind(this);
        xhr.onerror = this._onXhrError.bind(this);

        if(mediaConfig.withCredentials) {
            xhr.withCredentials = true;
        }

        if(typeof seekConfig.headers === 'object') {
            const { headers } = seekConfig;
            Object.keys(headers).forEach((key) => {
                xhr.setRequestHeader(key, headers[key]);
            });
        }
        // add additional headers
        if(typeof this.userConfig.headers === 'object') {
            const { headers } = this.userConfig;
            Object.keys(headers).forEach((key) => {
                xhr.setRequestHeader(key, headers[key]);
            });
        }
        xhr.send();
    }

    abort(): void {
        this._requestAbort = true;
        this._internalAbort();
        this._status = LoaderStatus.kComplete;
    }

    _onReadyStateChange(e: Event): void {
        const xhr = <XMLHttpRequest>e.target;

        if(xhr.readyState === 2) {
            if(xhr.responseURL !== undefined) {
                const redirectedURL: string = this.seekHandler.removeURLParameters(xhr.responseURL);
                if(
                    xhr.responseURL !== this._currentRequestURL
                    && redirectedURL !== this._currentRedirectedURL
                ) {
                    this._currentRedirectedURL = redirectedURL;
                    if(this._onURLRedirect) {
                        this._onURLRedirect(redirectedURL);
                    }
                }
            }

            if(xhr.status >= 200 && xhr.status <= 299) {
                if(this._waitForTotalLength) {
                    return;
                }
                this._status = LoaderStatus.kBuffering;
            } else {
                this._status = LoaderStatus.kError;
                if(this._onError) {
                    this._onError(LoaderErrors.HTTP_STATUS_CODE_INVALID, {
                        code: xhr.status,
                        reason: xhr.statusText
                    });
                } else {
                    throw new RuntimeException(
                        `RangeLoader: http code invalid, ${xhr.status} ${xhr.statusText}`
                    );
                }
            }
        }
    }

    _onProgress(e: ProgressEvent): void {
        if(this._status === LoaderStatus.kError) {
            return;
        }
        // 判断 _range null。
        if(!this._range) {
            return;
        }

        if(this._contentLength === null) {
            let openNextRange: boolean = false;

            if(this._waitForTotalLength) {
                this._waitForTotalLength = false;
                this._totalLengthReceived = true;
                openNextRange = true;

                const { total } = e;
                this._internalAbort();
                if(total != null && total !== 0) {
                    this._totalLength = total;
                }
            }

            if(this._range.to === -1) {
                this._contentLength = <number> this._totalLength - this._range.from;
            } else {
                this._contentLength = this._range.to - this._range.from + 1;
            }

            if(openNextRange) {
                this._openSubRange();
                return;
            }

            if(this._onContentLengthKnown) {
                this._onContentLengthKnown(this._contentLength);
            }
        }

        const delta: number = e.loaded - this._lastTimeLoaded;
        this._lastTimeLoaded = e.loaded;
        this._speedSampler.addBytes(delta);
    }

    _onLoad(e: Event): void {
        if(!this._range || !e.target) {
            return;
        }
        if(this._status === LoaderStatus.kError) {
            return;
        }

        if(this._waitForTotalLength) {
            this._waitForTotalLength = false;
            return;
        }

        this._lastTimeLoaded = 0;
        let KBps: number = this._speedSampler.lastSecondKBps;

        if(KBps === 0) {
            this._zeroSpeedChunkCount++;
            if(this._zeroSpeedChunkCount >= 3) {
                KBps = this._speedSampler.currentKBps;
            }
        }

        if(KBps !== 0) {
            const normalized: number = this._normalizeSpeed(KBps);
            if(this._currentSpeedNormalized !== normalized) {
                this._currentSpeedNormalized = normalized;
                this._currentChunkSizeKB = normalized;
            }
        }

        const chunk = (e.target as XMLHttpRequest).response;
        const byteStart: number = this._range.from + this._receivedLength;
        this._receivedLength += chunk.byteLength;

        let reportComplete = false;
        if(this._contentLength !== null && this._receivedLength < this._contentLength) {
            this._openSubRange();
        } else {
            reportComplete = true;
        }

        if(this._onDataArrival) {
            this._onDataArrival(chunk, byteStart, this._receivedLength);
        }
        if(reportComplete) {
            this._status = LoaderStatus.kComplete;
            if(this._onComplete) {
                this._onComplete(this._range.from, this._range.from + this._receivedLength - 1);
            }
        }
    }

    _onXhrError(e: ProgressEvent): void {
        this._status = LoaderStatus.kError;
        let type: number | string = 0;
        let info: null | { code: number; reason: string };

        if(
            this._contentLength
            && this._receivedLength > 0
            && this._receivedLength < this._contentLength
        ) {
            type = LoaderErrors.EARLY_EOF;
            info = {
                code: -1,
                reason: 'RangeLoder meet Early-Eof'
            };
        } else {
            type = LoaderErrors.EXCEPTION;
            info = { code: -1, reason: `${e.constructor.name} ${e.type}` };
        }

        if(this._onError) {
            this._onError(type, info);
        } else {
            throw new RuntimeException(info.reason);
        }
    }

    _normalizeSpeed(input: number): number {
        const list = this._chunkSizeKBList;
        const last: number = list.length - 1;
        let mid: number = 0;
        let lbound: number = 0;
        let ubound = last;

        if(input < list[0]) {
            return list[0];
        }

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
        return list[0];
    }

    _internalAbort(): void {
        if(this._xhr) {
            this._xhr.onreadystatechange = null;
            this._xhr.onprogress = null;
            this._xhr.onload = null;
            this._xhr.onerror = null;
            this._xhr.abort();
            this._xhr = null;
        }
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
}
export default RangeLoader;
