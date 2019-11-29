/**
 * 播放器的全部设置类型, TODO, 需要添加HLS流的相关设置
 */
type HJPlayerConfig = {
    // 强制使用全局标签 HJPLAYER
    FORCE_GLOBAL_TAG: boolean
    // Logger的全局标签
    GLOBAL_TAG: string
    // 是否触发logger的绑定事件
    ENABLE_CALLBACK: boolean
    // 是否打开 ERROR 提示
    ENABLE_ERROR: boolean
    // 是否打开 INFO 提示
    ENABLE_INFO: boolean
    // 是否打开 WARN 提示
    ENABLE_WARN: boolean
    // 是否打开 DEBUG 提示
    ENABLE_DEBUG: boolean
    /**
     * 是否启用Web Worker
     */
    enableWorker: boolean
    /**
     * 是否存储Buffer
     */
    enableStashBuffer: boolean
    /**
     * 存储的初始尺寸
     */
    stashInitialSize: number

    /**
     * 是否为直播
     */
    isLive: boolean
    /**
     * 是否懒加载
     */
    lazyLoad: boolean
    /**
     * 懒加载最大触发时长
     */
    lazyLoadMaxDuration: number
    /**
     * 懒加载恢复触发时长
     */
    lazyLoadRecoverDuration: number
    /**
     * 是否延迟到 SourceOpen 事件触发之后加载媒体资源
     */
    deferLoadAfterSourceOpen: boolean
    autoCleanupMaxBackwardDuration: number
    autoCleanupMinBackwardDuration: number
    /**
     * 统计信息上报间隔, 单位: 毫秒
     */
    statisticsInfoReportInterval: number
    /**
     * 是否修正音频缺口
     */
    fixAudioTimestampGap: boolean
    /**
     * 是否精确seek
     */
    accurateSeek: boolean
    /**
     * 进行seek操作时加载媒体资源的方式
     */
    seekType: string // [range, param, custom]
    /**
     * seek操作的开始点的参数名
     */
    seekParamStart: string
    /**
     * seek操作的结束点的参数名
     */
    seekParamEnd: string
    /**
     * 使用Rang加载资源时, 是否在刚开始加载时发送bytes=0-的参数
     */
    rangeLoadZeroStart: boolean
    /**
     * 自定义的seek操作助手
     */
    CustomSeekHandler: any | undefined
    /**
     * 是否拒绝地址跳转
     */
    reuseRedirectedURL: boolean
    // referrerPolicy: leave as unspecified
    /**
     * 自定义header
     */
    headers: Record<string, string> | undefined
    /**
     * 自定义loader
     */
    customLoader: any | undefined

    /**
     * 自动选择ts码率, 在master.m3u8时适用
     */
    tsAutoLevelChoose: boolean
    /**
     * used by stream-controller
     */

    maxFragLookUpTolerance: number

    referrerPolicy?: any,

    defaultAudioCodec: string | undefined
}

export default HJPlayerConfig;
