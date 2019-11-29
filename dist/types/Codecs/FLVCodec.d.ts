import EventEmitter from 'eventemitter3';
import CodecInterface from '../Interfaces/Codec';
declare class FLVCodec implements CodecInterface {
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
     * flv解码器
     */
    private _demuxer;
    /**
     * flv解码设置
     */
    _config: Record<string, any>;
    constructor(data: ArrayBuffer, config: Record<string, any>);
    /**
     * 解码器添加数据
     * @param data loader 发送过来的数据
     * @param byteStart 开始字节
     */
    appendData(data: ArrayBuffer, byteStart: number): void;
    resetMediaInfo(): void;
    insertDiscontinuity(): void;
    seek(): void;
    /**
     * 探测数据是否能够解码
     * @param data loader第一次发送过来的数据
     */
    static probe(data: ArrayBuffer): {
        match: boolean;
    } | {
        match: boolean;
        consumed: number;
        dataOffset: number;
        hasAudioTrack: boolean;
        hasVideoTrack: boolean;
    };
    on(eventName: string, callback: EventEmitter.ListenerFn): void;
    once(eventName: string, callback: EventEmitter.ListenerFn): void;
    off(eventName: string, callback?: EventEmitter.ListenerFn): void;
    /**
     * 销毁功能
     */
    destroy(): void;
    timestampBase: number;
    overridedDuration: number;
    overridedHasAudio: boolean;
    overridedHasVideo: boolean;
    /**
     * 获取转码事件
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
        MEDIA_DATA_ARRIVED: string;
        SCRIPT_DATA_ARRIVED: string;
        INIT_SEGMENT: string;
        MEDIA_SEGMENT: string;
    };
    readonly config: Record<string, any>;
    static readonly typeSupportFunc: () => import("./FLVCodec/Interface").typeSupported;
    flushStashedSamples(): void;
    bindDataSource(dataSource: any): this;
    parseChunks(data: ArrayBuffer, byteStart: number): number;
}
export default FLVCodec;
