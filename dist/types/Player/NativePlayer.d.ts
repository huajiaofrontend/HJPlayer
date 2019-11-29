import EventEmitter from 'eventemitter3';
import Codec from '../Codecs/index';
import HJPlayerConfig from '../Interfaces/HJPlayerConfig';
import MediaConfig from '../Interfaces/MediaConfig';
declare class NativePlayer {
    /**
     * 解码器
     */
    Codec: Codec | null;
    /**
     * 文件标签
     */
    Tag: string;
    /**
     * 播放器类型
     */
    _type: string;
    /**
     * 事件中心
     */
    _emitter: EventEmitter;
    /**
     * 媒体设置
     */
    mediaConfig: MediaConfig;
    /**
     * 用户设置
     */
    userConfig: HJPlayerConfig;
    /**
     * 媒体元素
     */
    _mediaElement: HTMLMediaElement | null;
    /**
     * 加载时设置的seek time
     */
    _pendingSeekTime: number | null;
    /**
     * 统计信息报告定时器
     */
    _statisticsReportTimer: number | null;
    /**
     * 回调函数包裹
     */
    e: any;
    constructor(mediaConfig: MediaConfig, userConfig: HJPlayerConfig);
    destroy(): void;
    on(event: string, listener: EventEmitter.ListenerFn): void;
    off(event: string, listener: EventEmitter.ListenerFn): void;
    /**
     * 绑定媒体元素
     * @param mediaElement 媒体元素
     */
    attachMediaElement(mediaElement: HTMLMediaElement): void;
    /**
     * 解绑媒体元素
     */
    detachMediaElement(): void;
    /**
     * 加载媒体文件
     */
    load(): void;
    /**
     * 停止加载媒体文件
     */
    unload(): void;
    play(): Promise<void> | undefined;
    pause(): void;
    readonly type: string;
    readonly buffered: TimeRanges | null;
    readonly duration: number;
    volume: number;
    muted: boolean;
    currentTime: number;
    readonly mediaInfo: {
        mediaPrefix: string;
        duration?: number;
        width?: number;
        height?: number;
    };
    readonly statisticsInfo: {
        playerType: string;
        url: string;
        decoded?: number;
        dropped?: number;
    };
    _onvLoadedMetadata(): void;
    /**
     * 报告统计信息
     */
    _reportStatisticsInfo(): void;
}
export default NativePlayer;
