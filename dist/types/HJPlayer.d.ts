import HJPlayerCodec from './Codecs/index';
import HJPlayerLogger from './Utils/Logger';
import UserConfig from './Interfaces/UserConfig';
import MediaConfig from './Interfaces/MediaConfig';
import HJPlayerConfig from './Interfaces/HJPlayerConfig';
import FragmentLoader from './Loaders/FragmentLoader';
import FetchSteamLoader from './Loaders/FetchStreamLoader';
import ParamSeekHandler from './Utils/param-seek-handler';
import PlayListLoader from './Loaders/PlaylistLoader';
import IOController from './Controller/IOController';
import TransmuxingController from './Controller/TransmuxingController';
declare class HJPlayer {
    /**
     * 文件标签名
     */
    Tag: string;
    /**
     * 媒体设置
     */
    mediaConfig: MediaConfig | null;
    /**
     * 播放器设置
     */
    userConfig: HJPlayerConfig | null;
    constructor(mediaConfig: MediaConfig, userConfig?: UserConfig);
    /**
     * 浏览器是否支持功能
     */
    static isSupported(): boolean;
    /**
     * 事件集合
     */
    static readonly Events: {
        INIT_SEGMENT: string;
        MEDIA_SEGMENT: string;
        GET_SEI_INFO: string;
        MEDIA_INFO: string;
        LOAD_COMPLETE: string;
        DATA_ARRIVED: string;
        STATISTICS_INFO: string;
        HJ_PLAYER_LOG: string;
        FRAG_PARSED: string;
        FRAG_PARSING_METADATA: string;
        FRAG_PARSING_USERDATA: string;
        INIT_PTS_FOUND: string;
        FRAG_PARSING_INIT_SEGMENT: string;
        MEDIA_SEEK: string;
        RECOVERED_EARLY_EOF: string;
        RECOMMEND_SEEKPOINT: string;
        METADATA_ARRIVED: string;
        SCRIPTDATA_ARRIVED: string;
        UPDATE_END: string;
        BUFFER_FULL: string;
        SOURCE_OPEN: string;
        ERROR: string;
        MANIFEST_PARSED: string;
        IO_ERROR: string;
        DEMUX_ERROR: string;
        WORKER_LOG: string;
        LOAD_NEXT_FRAG: string;
    };
    /**
     * 错误集合
     */
    static readonly Errors: {
        UN_SUPPORT_MEDIA: string;
        NETWORK_ERROR: string;
        TRANSMUXING_ERROR: string;
        IO_ERROR: string;
        OK: string;
        EXCEPTION: string;
        HTTP_STATUS_CODE_INVALID: string;
        CONNECTING_TIMEOUT: string;
        EARLY_EOF: string;
        UNRECOVERABLE_EARLY_EOF: string;
        MEDIA_ERROR: string;
        MEDIA_MSE_ERROR: string;
        FORMAT_ERROR: string;
        FORMAT_UNSUPPORTED: string;
        CODEC_UNSUPPORTED: string;
    };
    /**
     * 解码器
     */
    static readonly Codec: typeof HJPlayerCodec;
    /**
     * 日志器
     */
    static readonly Logger: typeof HJPlayerLogger;
    /**
     * HLS流加载器
     */
    static readonly FragmentLoader: typeof FragmentLoader;
    /**
     * FLV流氏加载器
     */
    static readonly FetchSteamLoader: typeof FetchSteamLoader;
    static readonly ParamSeekHandler: typeof ParamSeekHandler;
    static readonly PlayListLoader: typeof PlayListLoader;
    static readonly IOController: typeof IOController;
    static readonly HJPlayerDefaultConfig: {
        FORCE_GLOBAL_TAG: boolean;
        GLOBAL_TAG: string;
        ENABLE_CALLBACK: boolean;
        ENABLE_ERROR: boolean;
        ENABLE_INFO: boolean;
        ENABLE_WARN: boolean;
        ENABLE_DEBUG: boolean;
        enableWorker: boolean;
        enableStashBuffer: boolean;
        stashInitialSize: number;
        isLive: boolean;
        lazyLoad: boolean;
        lazyLoadMaxDuration: number;
        lazyLoadRecoverDuration: number;
        deferLoadAfterSourceOpen: boolean;
        autoCleanupMaxBackwardDuration: number;
        autoCleanupMinBackwardDuration: number;
        statisticsInfoReportInterval: number;
        fixAudioTimestampGap: boolean;
        accurateSeek: boolean;
        seekType: string;
        seekParamStart: string;
        seekParamEnd: string;
        rangeLoadZeroStart: boolean;
        CustomSeekHandler: any;
        reuseRedirectedURL: boolean;
        headers: any;
        customLoader: any;
        tsAutoLevelChoose: boolean;
        maxFragLookUpTolerance: number;
        defaultAudioCodec: undefined;
    };
    static readonly TransmuxingController: typeof TransmuxingController;
    static readonly typeSupported: import("./Interfaces/typeSupportData").default;
}
export default HJPlayer;
