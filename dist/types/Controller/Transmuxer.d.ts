import EventEmitter from 'eventemitter3';
import MediaInfo from './MediaInfo';
import { InitSegment, MediaSegment } from '../Interfaces/Segment';
import MediaConfig from '../Interfaces/MediaConfig';
import StatisticsInfoObject from '../Interfaces/StatisticsInfo';
import Metadata from '../Interfaces/Metadata';
import HJPlayerConfig from '../Interfaces/HJPlayerConfig';
import TSManifest from '../Interfaces/TSManifest';
declare class Transmuxer {
    /**
     * 文件标签
     */
    Tag: string;
    /**
     * 事件中心
     */
    private _emitter;
    /**
     * webworker
     */
    private _worker?;
    /**
     * web-worker是否在摧毁中
     */
    private _workerDestroying?;
    /**
     * 转码控制器
     */
    private _controller?;
    /**
     * 回调函数的包裹体
     */
    e: any;
    constructor(mediaDataSource: MediaConfig, config: HJPlayerConfig);
    /**
     * 自我销毁
     */
    destroy(): void;
    on(event: string, listener: EventEmitter.ListenerFn): void;
    off(event: string, listener: EventEmitter.ListenerFn): void;
    /**
     * 是否使用了多线程
     */
    hasWorker(): boolean;
    /**
     * 开始
     */
    open(): void;
    /**
     * 停止
     */
    close(): void;
    /**
     * 跳转的时间点
     * @param milliseconds 跳转的时间点
     */
    seek(milliseconds: number): void;
    /**
     * 暂停转码
     */
    pause(): void;
    /**
     * 恢复转码
     */
    resume(): void;
    /**
     * 收到初始化片段向上报告
     * @param type 片段类型
     * @param initSegment 片段数据
     */
    _onInitSegment(type: string, initSegment: InitSegment): void;
    /**
     * 收到媒体片段向上报告
     * @param type 片段类型
     * @param initSegment 片段数据
     */
    _onMediaSegment(type: string, mediaSegment: MediaSegment): void;
    /**
     * 当加载完成时向上报告
     */
    _onLoadingComplete(): void;
    /**
     * 从过早遇到 EOF 事件恢复后向上报告
     */
    _onRecoveredEarlyEof(): void;
    /**
     * 当收到解析后的媒体信息后向上提交
     * @param mediaInfo 媒体信息
     */
    _onMediaInfo(mediaInfo: MediaInfo): void;
    _onMetaDataArrived(metadata: Metadata): void;
    _onScriptDataArrived(data: any): void;
    _onStatisticsInfo(statisticsInfo: StatisticsInfoObject): void;
    _onIOError(type: string, info: string): void;
    _onDemuxError(type: string, info: string): void;
    /**
     * 当收到 推荐的seek时间点后向上提交
     * @param milliseconds 推荐的seek时间点
     */
    _onRecommendSeekpoint(milliseconds: number): void;
    /**
     * 收到解析到媒体增强信息后向上提交
     * @param data 媒体增强信息的Uin8Array
     */
    _onGetSeiInfo(data: Uint8Array): void;
    _onLoggingConfigChanged(config: HJPlayerConfig): void;
    /**
     * 收到M3U8文档解析数据后向上提交
     * @param data M3U8文档解析数据, 暂时标为any
     */
    _onMainfestParsed(data: TSManifest): void;
    /**
     * 当收到web-worker消息时的处理操作
     * @param event 收到的信息体
     */
    _onWorkerMessage(event: MessageEvent): void;
}
export default Transmuxer;
