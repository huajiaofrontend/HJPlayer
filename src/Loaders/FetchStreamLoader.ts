import EventEmitter from 'eventemitter3';
import BaseLoader from './BaseLoader';
import Browser from '../Utils/Browser';
import LoaderStatus from './LoaderStatus';
import LoaderErrors from './LoaderErrors';
import { RuntimeException } from '../Utils/Exception';
import SeekHandler, { SeekConfig } from '../Interfaces/SeekHandler';
import MediaConfig from '../Interfaces/MediaConfig';
import SeekRange from '../Interfaces/SeekRange';
import getGlobal from '../Utils/getGlobalObject';
import HJPlayerConfig from '../Interfaces/HJPlayerConfig';

const GlobalEnvironment = getGlobal();

class FetchStreamLoader extends BaseLoader {
    Tag: string

    eventEmitter: EventEmitter

    private mediaConfig: MediaConfig | null

    /**
     * 初始化回调函数
     */
    private seekHandler: SeekHandler

    /**
     * 初始化配置
     */
    private userConfig: HJPlayerConfig

    private seekRange: SeekRange

    /**
     * 请求是否阻止
     */
    private requestAbort: boolean

    /**
     * 数据长度
     */
    private contentLength: number | null

    /**
     * 接收到的数据长度
     */
    private receivedLength: number

    constructor(seekHandler: SeekHandler, userConfig: HJPlayerConfig) {
        super('FetchStreamLoader', 'flv');
        this.Tag = 'FetchStreamLoader';

        this.eventEmitter = new EventEmitter();
        this.mediaConfig = null;
        this.userConfig = userConfig;
        this.seekHandler = seekHandler;
        this.seekRange = { from: 0, to: 0 };
        this.requestAbort = false;
        this.contentLength = null;
        this.receivedLength = 0;
    }

    /**
     * 判断是否支持fetch请求
     */
    static isSupported(): boolean {
        let isSupport: boolean = false;
        try {
            const isWorkWellEdge = Browser.msedge && Browser.version.minor >= 15048;
            const browserNotBlacklisted = Browser.msedge ? isWorkWellEdge : true;
            isSupport = GlobalEnvironment.fetch && (GlobalEnvironment as any).ReadableStream && browserNotBlacklisted;
        } catch (e) {
            isSupport = false;
        }

        return isSupport;
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

    destroy() {
        this.abort();
        this.eventEmitter.removeAllListeners();
        delete this.eventEmitter;
        delete this.mediaConfig;
        delete this.seekRange;
        delete this.seekHandler;
        delete this.userConfig;
        this._status = LoaderStatus.kIdle;
        this._onContentLengthKnown = null;
        this._onURLRedirect = null;
        this._onDataArrival = null;
        this._onError = null;
        this._onComplete = null;
    }

    /**
     * 开始加载
     */
    startLoad(mediaConfig: MediaConfig, seekRange: SeekRange): void {
        this.mediaConfig = mediaConfig;
        this.seekRange = seekRange;
        let sourceURL = mediaConfig.url;

        if(this.userConfig.reuseRedirectedURL && mediaConfig.redirectedURL !== undefined) {
            sourceURL = mediaConfig.redirectedURL;
        }

        const seekConfig: SeekConfig = this.seekHandler.getConfig(sourceURL, seekRange);
        const headers: Headers = new (GlobalEnvironment as any).Headers();

        const params = {
            method: 'GET', // 请求方法 get post
            headers, // 加到请求头的参数
            mode: 'cors', // 请求模式
            cache: 'default', // 缓存
            referrerPolicy: 'no-referrer-when-downgrade', // 控制refferrer 此为默认值
            credentials: 'same-origin' // 控制cookie，同源发送
        };

        if(typeof seekConfig.headers === 'object') {
            const configHeaders = seekConfig.headers;
            Object.keys(configHeaders).forEach((key) => {
                headers.append(key, (configHeaders as any)[key]);
            });
        }

        if(typeof this.userConfig.headers === 'object') {
            Object.keys(this.userConfig.headers).forEach((key) => {
                this.userConfig.headers && headers.append(key, this.userConfig.headers[key]);
            });
        }

        if(mediaConfig.cors === false) {
            params.mode = 'same-origin';
        }

        if(mediaConfig.withCredentials) {
            params.credentials = 'include'; // 发送cookie
        }

        if(mediaConfig.referrerPolicy) {
            params.referrerPolicy = mediaConfig.referrerPolicy;
        }

        this._status = LoaderStatus.kConnecting;

        GlobalEnvironment.fetch(seekConfig.url, params as any)
            .then((res) => {
                if(this.requestAbort) {
                    this.requestAbort = false;
                    this._status = LoaderStatus.kIdle;
                    return;
                }
                if(res && res.ok && (res.status >= 200 && res.status <= 299)) {
                    if(res.url !== seekConfig.url) {
                        if(this._onURLRedirect) {
                            const redirectedURL: string = this.seekHandler.removeURLParameters(
                                res.url
                            );
                            this._onURLRedirect(redirectedURL);
                        }
                    }

                    const lengthHeader: string | null = res.headers.get('Content-Length');
                    if(lengthHeader !== null) {
                        this.contentLength = parseInt(lengthHeader, 10);
                        if(this.contentLength !== 0) {
                            if(this._onContentLengthKnown) {
                                this._onContentLengthKnown(this.contentLength);
                            }
                        }
                    }
                    if(res === null || res.body === null) {
                        return;
                    }
                    return this._pump.call(this, res.body.getReader());
                }
                this._status = LoaderStatus.kError;
                if(this._onError) {
                    this._onError(LoaderErrors.HTTP_STATUS_CODE_INVALID, {
                        code: res.status,
                        reason: res.statusText
                    });
                } else {
                    throw new RuntimeException(
                        `FetchStreamLoader: Http code invalid, ${res.status} ${res.statusText}`
                    );
                }
            })
            .catch((e) => {
                this._status = LoaderStatus.kError;
                if(this._onError) {
                    this._onError(LoaderErrors.EXCEPTION, { code: -1, reason: e.message });
                } else {
                    throw e;
                }
            });
    }

    _pump(reader: ReadableStreamDefaultReader): Promise<any> {
        return reader
            .read()
            .then((result) => {
                if(result.done) {
                    if(this.contentLength !== null && this.receivedLength < this.contentLength) {
                        this._status = LoaderStatus.kError;
                        const type = LoaderErrors.EARLY_EOF;
                        const info = { code: -1, reason: 'Fetch stream meet Early-EOF' };

                        if(this._onError) {
                            this._onError(type, info);
                        } else {
                            throw new RuntimeException(info.reason);
                        }
                    } else {
                        this._status = LoaderStatus.kComplete;
                        if(this._onComplete) {
                            this._onComplete(
                                this.seekRange.from,
                                this.seekRange.from + this.receivedLength - 1
                            );
                        }
                    }
                } else {
                    if(this.requestAbort === true) {
                        this.requestAbort = false;
                        this._status = LoaderStatus.kComplete;
                        return reader.cancel();
                    }

                    this._status = LoaderStatus.kBuffering;
                    const chunk = result.value.buffer;
                    const byteStart = this.seekRange.from + this.receivedLength;
                    this.receivedLength += chunk.byteLength;

                    if(this._onDataArrival) {
                        this._onDataArrival(chunk, byteStart, this.receivedLength);
                    }
                    this._pump(reader);
                }
            })
            .catch((e) => {
                if(e.code === 11 && Browser.msedge) {
                    return;
                }
                this._status = LoaderStatus.kError;
                let type: number | string = LoaderErrors.EXCEPTION;
                let info: { reason: string; code: number } = { code: e.code || -1, reason: e.message || 'readable stream exception' };

                if(
                    (e.code === 19 || e.message === 'network error')
                    && (this.contentLength === null
                        || (this.contentLength !== null && this.receivedLength < this.contentLength))
                ) {
                    type = LoaderErrors.EARLY_EOF;
                    info = { code: e.code, reason: e.message };
                }

                if(this._onError) {
                    this._onError(type, info);
                } else {
                    if(!info) {
                        return;
                    }
                    throw new RuntimeException(info.reason);
                }
            });
    }

    /**
     * 待实现
     */
    // isWorking(): boolean {
    //     return true
    // }
    /**
     * 取消加载
     */
    abort(): void {
        this.requestAbort = true;
    }
}

export default FetchStreamLoader;
