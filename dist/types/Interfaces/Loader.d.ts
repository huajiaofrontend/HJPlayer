import Level from '../Parser/Level';
import Attr from '../Utils/attr-list';
import Fragment from '../Loaders/Fragment';
export interface LoaderContext {
    url: string;
    responseType: XMLHttpRequestResponseType;
    rangeStart?: number;
    rangeEnd?: number;
    progressData?: boolean;
}
export interface FragLoaderContext extends LoaderContext {
    frag?: Fragment;
    type?: string;
    level?: number;
    id?: number | null;
}
export interface level {
    bitrate: number;
    width: number;
    height: number;
    name: string;
    url: string;
    videoCodec: string;
}
export interface LoaderConfiguration {
    maxRetry: number;
    timeout: number;
    retryDelay: number;
    maxRetryDelay: number;
}
export interface LoaderResponse {
    url: string;
    data: string | ArrayBuffer;
}
export interface LoaderStats {
    trequest: number;
    tfirst: number;
    tload: number;
    tparsed?: number;
    loaded: number;
    total: number;
    tbuffered?: number;
}
/**
 * xhr-load stats
 */
export interface XhrLoaderStats extends LoaderStats {
    aborted: boolean;
    retry: number;
    text?: string;
}
export interface XhrLoaderResponse extends LoaderResponse {
    text?: string;
}
export interface Frag {
    byteRangeStartOffset: number;
    byteRangeEndOffset: number;
    start: number;
    duration: number;
    type: string;
    url: string;
    sn: number;
}
declare type LoaderOnSuccess<T extends LoaderContext> = (response: LoaderResponse, stats: XhrLoaderStats, context: T, networkDetails: any) => void;
declare type LoaderOnProgress<T extends LoaderContext> = (stats: LoaderStats, context: T, data: string | ArrayBuffer, networkDetails: any) => void;
export interface ResponseData {
    response: {
        code: string | number;
        text: string;
    };
}
export interface ErrorData {
    code: string | number;
    text: string;
}
declare type LoaderOnError<T extends LoaderContext> = (error: {
    code: number;
    text: string;
}, context: T, networkDetails: any) => void;
export declare type timeoutData = {
    stats: XhrLoaderStats;
    context: LoaderContext;
    xhr: XMLHttpRequest | null;
};
export declare type LoaderOnTimeout<T extends LoaderContext> = (stats: XhrLoaderStats, context: T, xhr: XMLHttpRequest | null) => void;
export interface LoaderCallbacks<T extends LoaderContext> {
    onSuccess: LoaderOnSuccess<T>;
    onError: LoaderOnError<T>;
    onTimeout: LoaderOnTimeout<T>;
    onProgress?: LoaderOnProgress<T>;
}
export interface Loader<T extends LoaderContext> {
    destroy(): void;
    abort(): void;
    load(context: LoaderContext, config: LoaderConfiguration, callbacks: LoaderCallbacks<T>): void;
    context: T;
}
/**
 * `type` property values for this loaders' context object
 * @enum
 *
 */
export declare enum PlaylistContextType {
    MANIFEST = "manifest",
    LEVEL = "level",
    AUDIO_TRACK = "audioTrack",
    SUBTITLE_TRACK = "subtitleTrack"
}
/**
 * @enum {string}
 */
export declare enum PlaylistLevelType {
    MAIN = "main",
    AUDIO = "audio",
    SUBTITLE = "subtitle"
}
export interface SingleLevels {
    url: string;
    details: Level;
    bitrate: number;
    height: number;
    audioCodec: string;
    attrs: Attr;
    videoCodec: 'string';
}
export interface PlaylistLoaderContext extends LoaderContext {
    loader?: Loader<PlaylistLoaderContext>;
    type: PlaylistContextType;
    id: number | null;
    isSidxRequest?: boolean;
    levelDetails?: Level;
}
export {};
