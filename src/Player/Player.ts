import EventEmitter from 'eventemitter3';
import PlayerInterface from '../Interfaces/Player';
import HJPlayerConfig from '../Interfaces/HJPlayerConfig';
import MediaConfig from '../Interfaces/MediaConfig';

class Player implements PlayerInterface {
    Tag: string

    type: string

    mediaConfig: MediaConfig

    userConfig: HJPlayerConfig

    videoElement: HTMLVideoElement | null

    eventEmitter: EventEmitter

    mediaInfo: Object

    statisticsInfo: Object

    constructor(mediaConfig: MediaConfig, userConfig: HJPlayerConfig) {
        this.Tag = 'Player';
        this.type = 'basePlayer';
        this.mediaConfig = mediaConfig;
        this.userConfig = userConfig;
        this.videoElement = null;
        this.eventEmitter = new EventEmitter();
        this.mediaInfo = Object.create(null);
        this.statisticsInfo = Object.create(null);
    }

    /**
     * 绑定媒体元素
     * @param videoElement video标签
     */
    attachMedia(videoElement: HTMLVideoElement): void {
        this.videoElement = videoElement;
    }

    /**
     * 解绑媒体
     */
    detachMedia(): void {
        this.videoElement = null;
    }

    /**
     * 加载流
     */
    load(): void {}

    /**
     * 停止加载
     */
    unload(): void {}

    /**
     * 播放器开始播放
     */
    play(): void {}

    /**
     * 播放器暂停
     */
    pause(): void {}

    /**
     * 绑定事件
     * @param eventName 事件名称
     * @param callback 回调方法
     */
    on(eventName: string, callback: EventEmitter.ListenerFn): void {
        this.eventEmitter.on(eventName, callback);
    }

    /**
     * 绑定一次性事件
     * @param eventName 事件名称
     * @param callback 回调方法
     */
    once(eventName: string, callback: EventEmitter.ListenerFn): void {
        this.eventEmitter.once(eventName, callback);
    }

    /**
     * 解绑事件
     * @param eventName 事件名称
     * @param callback 回调方法名称
     */
    off(eventName: string, callback?: EventEmitter.ListenerFn): void {
        this.eventEmitter.off(eventName, callback);
    }

    /**
     * 销毁播放器
     */
    destroy(): void {
        this.eventEmitter.removeAllListeners();
        throw new Error('this function must be override');
    }

    get buffered(): TimeRanges | null {
        return this.videoElement ? this.videoElement.buffered : null;
    }

    get duration(): number {
        return this.videoElement ? this.videoElement.duration : 0;
    }

    get volume(): number {
        return this.videoElement ? this.videoElement.volume : 0;
    }

    set volume(volumeNumber: number) {
        if(volumeNumber > 1) {
            volumeNumber = 1;
        }

        if(volumeNumber < 0) {
            volumeNumber = 0;
        }
        this.videoElement && (this.videoElement.volume = volumeNumber);
    }

    get muted(): boolean {
        return this.videoElement ? this.videoElement.muted : false;
    }

    set muted(isMuted: boolean) {
        this.videoElement && (this.videoElement.muted = isMuted);
    }

    get currentTime(): number {
        return this.videoElement ? this.videoElement.currentTime : 0;
    }

    set currentTime(current: number) {
        if(current > this.duration) {
            current = this.duration;
        }

        if(current < 0) {
            current = 0;
        }
        this.videoElement && (this.videoElement.currentTime = current);
    }
}

export default Player;
