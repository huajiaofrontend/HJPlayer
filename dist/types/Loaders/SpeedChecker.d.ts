declare class SpeedChecker {
    /**
     * 首次检测时间
     */
    _firstCheckpoint: number;
    /**
     * 最新检测时间
     */
    _lastCheckpoint: number;
    /**
     * 单次下载量
     */
    _intervalBytes: number;
    /**
     * 总字节数
     */
    _totalBytes: number;
    /**
     * 最新下载速度
     */
    _lastSecondBytes: number;
    /**
     * 获取现在时间 performace.now || Date.now
     */
    _now: () => number;
    constructor();
    reset(): void;
    /**
     * 添加下载数据
     * @param bytes 下载数据大小
     */
    addBytes(bytes: number): void;
    /**
     * 当前下载速度
     */
    readonly currentKBps: number;
    readonly lastSecondKBps: number;
    /**
     * 平均下载速度
     */
    readonly averageKBps: number;
}
export default SpeedChecker;
