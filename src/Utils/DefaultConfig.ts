const CustomSeekHandler:any = undefined;
const headers:any = undefined;
const customLoader:any = undefined;

const HJPlayerDefaultConfig = {
    /**
     * Logger 相关的设置
     */
    // 强制使用全局标签 HJPLAYER
    FORCE_GLOBAL_TAG: false,
    // Logger的全局标签
    GLOBAL_TAG: 'HJPLAYER',
    // 是否触发logger的绑定事件
    ENABLE_CALLBACK: false,
    // 是否打开 ERROR 提示
    ENABLE_ERROR: true,
    // 是否打开 INFO 提示
    ENABLE_INFO: false,
    // 是否打开 WARN 提示
    ENABLE_WARN: false,
    // 是否打开 DEBUG 提示
    ENABLE_DEBUG: false,
    // 是否打开多线程
    enableWorker: false,

    enableStashBuffer: true,

    stashInitialSize: 384,

    isLive: false,

    lazyLoad: true,

    lazyLoadMaxDuration: 3 * 60,

    lazyLoadRecoverDuration: 30,

    deferLoadAfterSourceOpen: true,

    // autoCleanupSourceBuffer: default as false, leave unspecified
    autoCleanupMaxBackwardDuration: 3 * 60,

    autoCleanupMinBackwardDuration: 2 * 60,

    statisticsInfoReportInterval: 1000,

    fixAudioTimestampGap: true,

    accurateSeek: false,

    seekType: 'range', // [range, param, custom]

    seekParamStart: 'bstart',

    seekParamEnd: 'bend',

    rangeLoadZeroStart: false,

    CustomSeekHandler,

    reuseRedirectedURL: false,

    headers,

    customLoader,

    tsAutoLevelChoose: false, // 自动选择ts码率, 在master.m3u8时适用

    maxFragLookUpTolerance: 0.25, // used by stream-controller

    defaultAudioCodec: undefined
};

export default HJPlayerDefaultConfig;
