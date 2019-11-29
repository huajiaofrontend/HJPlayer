import EventEmitter from 'eventemitter3';
import CodecInterface from '../Interfaces/Codec';
import { typeSupported, agentInfo } from './TSCodec/TSCodecInterface';
import { TSExtraData } from '../Interfaces/TSExtraData';
declare class TSCodec implements CodecInterface {
    /**
     * 文件标签
     */
    Tag: string;
    /**
     * 类型
     */
    type: string;
    /**
     * 事件中心
     */
    eventEmitter: EventEmitter;
    /**
     * HLS流TS文件解码器
     */
    private _demuxer;
    /**
     * TS解码设置
     */
    _config: Record<string, any>;
    timestampBase: number;
    constructor(config: Record<string, any>, typeSupported: typeSupported, agentInfo: agentInfo);
    /**
     * 解码器添加数据
     * @param data loader 发送过来的数据
     * @param timeOffset 时间偏移量
     * @param contiguous 是否连续
     * @param accurateTimeOffset 是否为精确的时间偏移
     */
    appendData(data: ArrayBuffer, timeOffset: number, contiguous: boolean, accurateTimeOffset: boolean): void;
    /**
     * 探测数据是否能够解码
     * @param data loader第一次发送过来的数据
     */
    static probe(data: ArrayBuffer): boolean;
    on(eventName: string, callback: EventEmitter.ListenerFn): void;
    once(eventName: string, callback: EventEmitter.ListenerFn): void;
    off(eventName: string, callback?: EventEmitter.ListenerFn): void;
    /**
     * 销毁功能
     */
    destroy(): void;
    /**
     * 重置初始化片段
     * @param initSegment 初始化片段
     * @param audioCodec 音频编码类型
     * @param videoCodec 视频编码类型
     * @param duration 时长
     */
    resetInitSegment(initSegment: Uint8Array, audioCodec: string | undefined, videoCodec: string | undefined, duration: number): void;
    /**
     * 重置时间基准值
     */
    resetTimeStamp(data?: any): void;
    /**
     * 获取TS转码事件
     */
    static readonly Events: {
        ERROR: string;
        GET_SEI_INFO: string;
        FRAG_PARSED: string;
        INIT_PTS_FOUND: string;
        FRAG_PARSING_INIT_SEGMENT: string;
        FRAG_PARSING_METADATA: string;
        FRAG_PARSING_USERDATA: string;
        MEDIA_INFO: string;
        INIT_SEGMENT: string;
        MEDIA_SEGMENT: string;
        LOAD_NEXT_FRAG: string;
        META_DATA: string;
    };
    readonly config: Record<string, any>;
    /**
     * 测试使用, 真实环境中需要父级传过来
     */
    static readonly typeSupportFunc: () => typeSupported;
    seek(ms?: number): void;
    insertDiscontinuity(): void;
    flushStashedSamples(): void;
    bindDataSource(dataSource: any): this;
    resetMediaInfo(): void;
    /**
     *
     * @param data 要解析的数据
     * @param byteStart FLV中parseChunks所需参数, HLS流不需要
     * @param extraData loader发送过来的关于ts文件的详情
     * @returns { number } 已被解析的数据的长度
     */
    parseChunks(data: ArrayBuffer, byteStart: number, extraData: TSExtraData): number;
}
export default TSCodec;
