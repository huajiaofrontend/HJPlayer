/**
 * 计算网速
 */
import getGlobal from './getGlobalObject';

const GW = getGlobal();

class NetworkSpeeder {
    private _firstCheckpoint: number

    private _lastCheckpoint: number

    private _intervalBytes: number

    private _totalBytes: number

    private _lastSecondBytes: number

    private _now: Function

    constructor() {
        // milliseconds
        this._firstCheckpoint = 0;
        this._lastCheckpoint = 0;
        this._intervalBytes = 0;
        this._totalBytes = 0;
        this._lastSecondBytes = 0;

        if(GW.performance && GW.performance.now) {
            this._now = GW.performance.now.bind(GW.performance);
        } else {
            this._now = Date.now;
        }
    }

    reset(): void {
        this._firstCheckpoint = 0;
        this._lastCheckpoint = 0;
        this._totalBytes = 0;
        this._intervalBytes = 0;
        this._lastSecondBytes = 0;
    }

    /**
     * 添加数据, 用于计算带宽
     * @param bytes 从loader添加的数据长度
     */
    addBytes(bytes: number): void {
        if(this._firstCheckpoint === 0) {
            this._firstCheckpoint = this._now();
            this._lastCheckpoint = this._firstCheckpoint;
            this._intervalBytes += bytes;
            this._totalBytes += bytes;
        } else if(this._now() - this._lastCheckpoint < 1000) {
            this._intervalBytes += bytes;
            this._totalBytes += bytes;
        } else {
            // duration >= 1000
            this._lastSecondBytes = this._intervalBytes;
            this._intervalBytes = bytes;
            this._totalBytes += bytes;
            this._lastCheckpoint = this._now();
        }
    }

    get currentKBps(): number {
        this.addBytes(0);

        let durationSeconds = (this._now() - this._lastCheckpoint) / 1000;
        if(durationSeconds === 0) durationSeconds = 1;
        return this._intervalBytes / durationSeconds / 1024;
    }

    get lastSecondKBps(): number {
        this.addBytes(0);

        if(this._lastSecondBytes !== 0) {
            return this._lastSecondBytes / 1024;
        }
        // lastSecondBytes === 0
        if(this._now() - this._lastCheckpoint >= 500) {
            // if time interval since last checkpoint has exceeded 500ms
            // the speed is nearly accurate
            return this.currentKBps;
        }
        // We don't know
        return 0;
    }

    get averageKBps(): number {
        const durationSeconds = (this._now() - this._firstCheckpoint) / 1000;
        return this._totalBytes / durationSeconds / 1024;
    }
}

export default NetworkSpeeder;
