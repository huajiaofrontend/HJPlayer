import logger from '../Utils/Logger';
import {
    LoaderContext,
    LoaderConfiguration,
    LoaderCallbacks,
    XhrLoaderStats
} from '../Interfaces/Loader';
import getGlobal from '../Utils/getGlobalObject';

const GlobalEnvironment = getGlobal();

const { performance } = GlobalEnvironment;

class XhrLoader {
    public Tag: string = 'XhrLoader'

    private xhrSetup: ((xhr: XMLHttpRequest, url: string) => void) | null = null

    private loader: XMLHttpRequest | null = null

    /**
     * 请求超时时间
     */
    private requestTimeout: null | number = null

    /**
     * xhr 请求时间统计
     */
    public stats: XhrLoaderStats | null = null

    /**
     * 重试timeout
     */
    retryTimeout: number | null = null;

    /* eslint-disable */
    context: LoaderContext | null = null;

    /* eslint-endable */

    config: LoaderConfiguration | null = null;

    /**
     * 回调函数
     */
    callbacks: LoaderCallbacks<LoaderContext> | null = null

    /**
     * 重试的delay时间
     */
    retryDelay: number = 0

    constructor(config?: { xhrSetup: (xhr: XMLHttpRequest, url: string) => void }) {
        this.context = null;
        if(config && config.xhrSetup) {
            this.xhrSetup = config.xhrSetup;
        }
    }

    destroy(): void {
        this.abort();
        this.loader = null;
    }

    abort(): void {
        const { loader } = this;
        if(loader && loader.readyState !== 4) {
            (this.stats as XhrLoaderStats).aborted = true;
            loader.abort();
        }

        (GlobalEnvironment as any).clearTimeout(this.requestTimeout);
        this.requestTimeout = null;
        (GlobalEnvironment as any).clearTimeout(this.retryTimeout);
        this.retryTimeout = null;
    }

    load(
        context: LoaderContext,
        config: LoaderConfiguration,
        callback: LoaderCallbacks<LoaderContext>
    ): void {
        this.context = context;
        this.config = config;
        this.callbacks = callback;
        this.stats = {
            trequest: performance.now(),
            retry: 0,
            tfirst: 0,
            loaded: 0,
            // total number of bytes
            total: 0,
            tload: 0,
            aborted: false
        };
        this.retryDelay = config.retryDelay;
        this.loadInternal();
    }

    loadInternal(): void {
        const { context } = this;
        const xhr = new XMLHttpRequest();

        const stats = this.stats as XhrLoaderStats;
        stats.tfirst = 0;
        stats.loaded = 0;
        const { xhrSetup } = this;

        if(!context || !this.callbacks || !this.config) {
            return;
        }

        try {
            if(xhrSetup) {
                try {
                    xhrSetup(xhr, context.url);
                } catch (e) {
                    xhr.open('GET', context.url, true);
                    xhrSetup(xhr, context.url);
                }
            }
            if(!xhr.readyState) {
                xhr.open('GET', context.url, true);
            }
        } catch (e) {
            this.callbacks.onError(
                {
                    code: xhr.status,
                    text: e.message
                },
                context,
                xhr
            );
            return;
        }

        if(context.rangeEnd) {
            xhr.setRequestHeader(
                'Range',
                `bytes=${context.rangeStart}-${context.rangeEnd - 1}`
            );
        }
        // statechange progress 事件设置回调
        xhr.onreadystatechange = this.readystatechange.bind(this);
        xhr.onprogress = this.loadprogress.bind(this);
        xhr.responseType = context.responseType;

        this.requestTimeout = GlobalEnvironment.setTimeout(this.loadtimeout.bind(this), this.config.timeout);
        xhr.send();
    }

    readystatechange(event: Event): void {
        const xhr = event.currentTarget as XMLHttpRequest;

        const { readyState } = xhr;
        const stats = this.stats as XhrLoaderStats;
        const context = this.context as LoaderContext;
        const config = this.config as LoaderConfiguration;

        if(stats.aborted) {
            return;
        }
        if(!this.callbacks) {
            return;
        }
        if(readyState >= 2) {
            (<any>GlobalEnvironment).clearTimeout(this.requestTimeout);
            if(stats.tfirst === 0) {
                stats.tfirst = Math.max(performance.now(), stats.trequest); // 首次请求开始时间
            }

            if(readyState === 4) {
                const { status } = xhr;
                if(status >= 200 && status < 300) {
                    // 正常返回数据
                    stats.tload = Math.max(stats.tfirst, performance.now());
                    let data; let
                        len;
                    if(context.responseType === 'arraybuffer') {
                        data = xhr.response;
                        len = data.byteLength;
                    } else {
                        data = xhr.responseText;
                        len = data.length;
                    }
                    stats.total = len;
                    stats.loaded = len;
                    const response = { url: xhr.responseURL, data };
                    this.callbacks.onSuccess(response, stats, context, xhr);
                } else if(
                    (stats.retry as number) >= config.maxRetry
                        || (status >= 400 && status < 499)
                ) {
                    // 4xx 客户端问题，抛出错误
                    logger.error(this.Tag, `${status} while loading ${context.url}`);
                    this.callbacks.onError(
                        {
                            code: status,
                            text: xhr.statusText
                        },
                        context,
                        xhr
                    );
                } else {
                    // 5xx 服务器端错误进行重试~
                    logger.warn(
                        this.Tag,
                        `${status} while loading ${context.url}, retrying in ${this.retryDelay}...`
                    );
                    // abort and reset internal state
                    this.destroy();
                    // schedule retry
                    this.retryTimeout = GlobalEnvironment.setTimeout(
                        this.loadInternal.bind(this),
                        this.retryDelay
                    );
                    // set exponential backoff
                    this.retryDelay = Math.min(2 * this.retryDelay, config.maxRetryDelay);
                    stats.retry++;
                }
            } else {
                this.requestTimeout = GlobalEnvironment.setTimeout(this.loadtimeout.bind(this), config.timeout); // 状态改变超时处理
            }
        }
    }

    /**
     * 状态改变超时处理
     */
    loadtimeout(): void {
        if(!this.context || !this.callbacks || !this.stats) {
            return;
        }
        logger.warn(this.Tag, `timeout while loading ${this.context.url}`);
        this.callbacks.onTimeout(this.stats, this.context, null);
    }

    /**
     * 进度处理
     */
    loadprogress(event: ProgressEvent): void {
        const xhr = <XMLHttpRequest>event.currentTarget;
        const { stats } = this;

        if(!stats || !this.callbacks || !this.context) {
            return;
        }
        stats.loaded = event.loaded;
        if(event.lengthComputable) {
            stats.total = event.total;
        }

        const { onProgress } = this.callbacks;
        if(onProgress) {
            onProgress(stats, this.context, '', xhr);
        }
    }
}

export default XhrLoader;
