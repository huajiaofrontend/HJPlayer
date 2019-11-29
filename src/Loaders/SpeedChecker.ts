/*
 * Copyright (C) 2016 Bilibili. All Rights Reserved.
 *
 * @author zheng qian <xqq@xqq.im>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Utility class to calculate realtime network I/O speed
import getGlobal from '../Utils/getGlobalObject';

const GlobalEnvironment = getGlobal();
class SpeedChecker {
    /**
     * 首次检测时间
     */
    _firstCheckpoint: number

    /**
     * 最新检测时间
     */
    _lastCheckpoint: number

    /**
     * 单次下载量
     */
    _intervalBytes: number

    /**
     * 总字节数
     */
    _totalBytes: number

    /**
     * 最新下载速度
     */
    _lastSecondBytes: number

    /**
     * 获取现在时间 performace.now || Date.now
     */
    _now: () => number

    constructor() {
        // milliseconds
        this._firstCheckpoint = 0;
        this._lastCheckpoint = 0;
        this._intervalBytes = 0;
        this._totalBytes = 0;
        this._lastSecondBytes = 0;

        // compatibility detection
        if(GlobalEnvironment.performance && GlobalEnvironment.performance.now) {
            this._now = GlobalEnvironment.performance.now.bind(GlobalEnvironment.performance);
        } else {
            this._now = Date.now;
        }
    }

    reset(): void {
        this._lastCheckpoint = 0;
        this._firstCheckpoint = 0;
        this._intervalBytes = 0;
        this._totalBytes = 0;
        this._lastSecondBytes = 0;
    }

    /**
     * 添加下载数据
     * @param bytes 下载数据大小
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

    /**
     * 当前下载速度
     */
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

    /**
     * 平均下载速度
     */
    get averageKBps(): number {
        const durationSeconds = (this._now() - this._firstCheckpoint) / 1000;
        return this._totalBytes / durationSeconds / 1024;
    }
}

export default SpeedChecker;
