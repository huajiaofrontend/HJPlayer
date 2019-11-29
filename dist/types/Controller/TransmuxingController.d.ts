import EventEmitter from 'eventemitter3';
import MediaInfo from './MediaInfo';
import typeSupportData from '../Interfaces/typeSupportData';
import TempNavigatorType from '../Interfaces/TempNavigator';
import Metadata from '../Interfaces/Metadata';
import ErrorData from '../Interfaces/ErrorData';
import { MediaSegment, InitSegment } from '../Interfaces/Segment';
import MediaConfig from '../Interfaces/MediaConfig';
import HJPlayerConfig from '../Interfaces/HJPlayerConfig';
import { TSExtraData } from '../Interfaces/TSExtraData';
import TSManifest from '../Interfaces/TSManifest';
declare class TransmuxingController {
    /**
     * 文件标签
     */
    Tag: string;
    /**
     * 事件中心
     */
    private _emitter;
    /**
     * 媒体设置
     */
    private _mediaDataSource;
    /**
     * 用户设置
     */
    private _config;
    /**
     * MediaSource对MP4, MEPG, MP3格式是否支持
     */
    private typeSupported;
    /**
     * 上一级缓存的关于navigator的数据, 用于在worker中解码TS音视频的必要参数
     */
    private navigator;
    /**
     * 当前播放的媒体片段的索引值, 在MediaConfig中无segment选项是 0
     */
    private _currentSegmentIndex;
    /**
     * 媒体信息
     */
    private _mediaInfo;
    /**
     * IO 控制器, 主要负责缓存loader发送过来的数据
     */
    private _ioctl;
    /**
     * 未加载时 挂起的 seek 时间点
     */
    private _pendingSeekTime;
    /**
     * 等待解决的seek时间点 (单位: 毫秒)
     */
    private _pendingResolveSeekPoint;
    /**
     * 统计信息报告定时器
     */
    private _statisticsReportTimer;
    /**
     * 新版解码器 待实现
     */
    private _mediaCodec;
    /**
     * 旧版解码器
     */
    private _demuxer;
    /**
     * 旧版转码器
     */
    private _remuxer;
    constructor(mediaDataSource: MediaConfig, config: HJPlayerConfig, typeSupported: typeSupportData, navigator: TempNavigatorType);
    destroy(): void;
    on(event: string, listener: EventEmitter.ListenerFn): void;
    off(event: string, listener: EventEmitter.ListenerFn): void;
    start(): void;
    /**
     * 加载segment
     * @param { Number } segmentIndex - segment 索引值
     * @param {  Number } optionalFrom - 选择的开始地点
     */
    _loadSegment(segmentIndex: number, optionalFrom?: number): void;
    stop(): void;
    _internalAbort(): void;
    pause(): void;
    resume(): void;
    seek(milliseconds: number): void;
    /**
     * 根据要跳转的毫秒数和每个Segment的timestampBase的比较, 来查找相应的Segment索引值
     * @param milliseconds 跳转的毫秒数
     */
    _searchSegmentIndexContains(milliseconds: number): number;
    /**
     * 当loader第一次发送过来数据时, 先判断解码器是否能解码数据, 然后初始化解码器, 绑定事件, 否则触发错误
     * @param { ArrayBuffer } data  flv 是 array  m3u8的loader是Uint8Array
     * @param { Number } byteStart 本次收到的数据的偏移量
     * @param { Number } receivedLength 累计的bytelength
     * @param { Object } extraData m3u8的fragmentLoader所发出来的数据 详见 fragment-loader
     */
    _onInitChunkArrival(data: ArrayBuffer, byteStart: number, extraData: TSExtraData): number;
    _onMediaInfo(mediaInfo: MediaInfo): void;
    _onMetaDataArrived(metadata: Metadata): void;
    _onScriptDataArrived(data: any): void;
    _onIOSeeked(): void;
    _onIOComplete(extraData: number): void;
    _onIORedirect(redirectedURL: string): void;
    _onIORecoveredEarlyEof(): void;
    _onIOException(type: string, info: ErrorData): void;
    _onDemuxException(type: string, info: ErrorData): void;
    _onRemuxerInitSegmentArrival(type: string, initSegment: InitSegment): void;
    _onRemuxerMediaSegmentArrival(type: string, mediaSegment: MediaSegment): void;
    _enableStatisticsReporter(): void;
    _disableStatisticsReporter(): void;
    _reportSegmentMediaInfo(segmentIndex: number): void;
    _reportStatisticsInfo(): void;
    _onManifestParsed(data: TSManifest): void;
    _mediaCodecBindEvents(): void;
}
export default TransmuxingController;
