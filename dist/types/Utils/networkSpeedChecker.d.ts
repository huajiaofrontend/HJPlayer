declare class NetworkSpeeder {
    private _firstCheckpoint;
    private _lastCheckpoint;
    private _intervalBytes;
    private _totalBytes;
    private _lastSecondBytes;
    private _now;
    constructor();
    reset(): void;
    /**
     * 添加数据, 用于计算带宽
     * @param bytes 从loader添加的数据长度
     */
    addBytes(bytes: number): void;
    readonly currentKBps: number;
    readonly lastSecondKBps: number;
    readonly averageKBps: number;
}
export default NetworkSpeeder;
