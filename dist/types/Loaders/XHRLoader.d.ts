import { LoaderContext, LoaderConfiguration, LoaderCallbacks, XhrLoaderStats } from '../Interfaces/Loader';
declare class XhrLoader {
    Tag: string;
    private xhrSetup;
    private loader;
    /**
     * 请求超时时间
     */
    private requestTimeout;
    /**
     * xhr 请求时间统计
     */
    stats: XhrLoaderStats | null;
    /**
     * 重试timeout
     */
    retryTimeout: number | null;
    context: LoaderContext | null;
    config: LoaderConfiguration | null;
    /**
     * 回调函数
     */
    callbacks: LoaderCallbacks<LoaderContext> | null;
    /**
     * 重试的delay时间
     */
    retryDelay: number;
    constructor(config?: {
        xhrSetup: (xhr: XMLHttpRequest, url: string) => void;
    });
    destroy(): void;
    abort(): void;
    load(context: LoaderContext, config: LoaderConfiguration, callback: LoaderCallbacks<LoaderContext>): void;
    loadInternal(): void;
    readystatechange(event: Event): void;
    /**
     * 状态改变超时处理
     */
    loadtimeout(): void;
    /**
     * 进度处理
     */
    loadprogress(event: ProgressEvent): void;
}
export default XhrLoader;
