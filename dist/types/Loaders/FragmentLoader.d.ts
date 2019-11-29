import EventEmitter from 'eventemitter3';
import BaseLoader from './BaseLoader';
import XHRLoader from './XHRLoader';
import ParamSeekHandler from './ParamSeekHandler';
import PlayListLoader from './PlaylistLoader';
import MediaConfig from '../Interfaces/MediaConfig';
import { FragLoaderContext, SingleLevels, LoaderStats, ResponseData, LoaderResponse, ErrorData, timeoutData } from '../Interfaces/Loader';
import Fragment from './Fragment';
import HJPlayerConfig from '../Interfaces/HJPlayerConfig';
declare class FragmentLoader extends BaseLoader {
    eventEmitter: EventEmitter;
    Tag: string;
    _seekHandler: ParamSeekHandler;
    _config: HJPlayerConfig;
    _needStash: boolean;
    _requestAbort: boolean;
    _contentLength: number | null;
    _receivedLength: number;
    _parser: any;
    _dataSource: any;
    _range: any;
    pl: PlayListLoader | null;
    audioCodecSwitch: boolean;
    levels: SingleLevels[] | null;
    startFragRequested: boolean;
    bitrateTest: boolean;
    stats: LoaderStats | null;
    stashFrag: Fragment[];
    sn: number | 'initSegment';
    loading: boolean;
    masterLevels: SingleLevels[];
    currentFrag: Fragment | null;
    loader: XHRLoader | null;
    _pause: boolean;
    audioCodecSwap: boolean;
    constructor(seekHandler: ParamSeekHandler, mediaConfig: HJPlayerConfig);
    /**
     * 判断在当前浏览器环境下是否支持加载相应媒体类型的文件
     * @param mediaType 媒体类型 flv或者m3u8 // todo
     */
    static isSupport(): boolean;
    on(eventName: string, callback: EventEmitter.ListenerFn): void;
    once(eventName: string, callback: EventEmitter.ListenerFn): void;
    off(eventName: string, callback?: EventEmitter.ListenerFn): void;
    onComplete: Function | null;
    destroy(): void;
    /**
     * 取消清秀
     */
    abort(): void;
    /**
     * loader 暂停
     */
    pause(): void;
    /**
     * 恢复
     */
    resume(): void;
    isWorking(): boolean;
    /**
     * 开始下载M3U8文件
     * @param { Object } dataSource
     * @param { Number } range
     */
    open(dataSource: MediaConfig, range: any): void;
    startLoad(dataSource: MediaConfig, range: any): void;
    /**
     * Fragment-loader 去加载下一个片段;
     */
    loadNextFrag(): void;
    loadFrag(frag: Fragment): void;
    seek(milliseconds: number): void;
    onManifestParsed(data: any): void;
    onFragLoaded(data: {
        payload: string | ArrayBuffer;
        frag: Fragment;
        stats: LoaderStats;
        networkDetails: any;
    }): void;
    _getAudioCodec(currentLevel: any): string;
    _loadsuccess(response: LoaderResponse, stats: LoaderStats, context: FragLoaderContext, networkDetails?: any): void;
    _loaderror(response: ErrorData, context: FragLoaderContext, networkDetails?: any): void;
    _loadtimeout(stats: LoaderStats, context: FragLoaderContext, networkDetails?: any): void;
    _loadprogress(stats: LoaderStats, context: FragLoaderContext, networkDetails?: any): void;
    _loadingM3U8Complete(): void;
    _loadingM3U8Error(errData: ResponseData): void;
    _loadingM3U8Timeout(errData: timeoutData): void;
    /**
     * 计算当前网速的码率
     * @param { Number } loadedLength - 已经加载的ts文件的byte长度
     * @param { Object } stats - 请求状态
     * @returns { Number } mySupportCodeRate - 当前网速所满足的最大码率 bit/s
     */
    _caluCodeRate(loadedLength: number, stats: LoaderStats): number;
    _parseM3U8Error(errData: LoaderResponse): void;
    /**
     * 在masterLevels中查找适合当前网速相应码率的level Index
     * @param { Number } codeRate -当前网速所能支持的码率
     * @returns { Number }
     */
    _findSuitableLevels(codeRate: number): number;
}
export default FragmentLoader;
