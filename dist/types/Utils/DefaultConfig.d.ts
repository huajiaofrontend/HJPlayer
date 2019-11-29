declare const HJPlayerDefaultConfig: {
    /**
     * Logger 相关的设置
     */
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
export default HJPlayerDefaultConfig;
