import EventEmitter from 'eventemitter3';
import CodecInterface from '../Interfaces/Codec';
import HLSDemuxer from './TSCodec/Demuxer/TSDemuxer';
import { typeSupported, agentInfo } from './TSCodec/TSCodecInterface';
import TSEvents from './TSCodec/Events/index';
import TSDefaultConfig from './TSCodec/config';
import typeSupport from './TSCodec/TSUtils/getMediaTypeSupport';
import { TSExtraData } from '../Interfaces/TSExtraData';

class TSCodec implements CodecInterface {
    /**
     * 文件标签
     */
    Tag: string

    /**
     * 类型
     */
    type: string

    /**
     * 事件中心
     */
    eventEmitter: EventEmitter

    /**
     * HLS流TS文件解码器
     */
    private _demuxer: HLSDemuxer

    /**
     * TS解码设置
     */
    _config: Record<string, any>

    timestampBase: number

    constructor(config: Record<string, any>, typeSupported: typeSupported, agentInfo: agentInfo) {
        this.Tag = 'TSCodec';
        this.type = 'TSCodec';
        this.eventEmitter = new EventEmitter();
        this._config = Object.assign(Object.create(null), TSDefaultConfig, config);
        this._demuxer = new HLSDemuxer(this.eventEmitter, this._config, typeSupported, agentInfo);
        this.timestampBase = 0;
    }

    /**
     * 解码器添加数据
     * @param data loader 发送过来的数据
     * @param timeOffset 时间偏移量
     * @param contiguous 是否连续
     * @param accurateTimeOffset 是否为精确的时间偏移
     */
    appendData(
        data: ArrayBuffer,
        timeOffset: number,
        contiguous: boolean,
        accurateTimeOffset: boolean
    ) {
        this._demuxer.append(new Uint8Array(data), timeOffset, contiguous, accurateTimeOffset);
    }

    /**
     * 探测数据是否能够解码
     * @param data loader第一次发送过来的数据
     */
    static probe(data: ArrayBuffer) {
        return HLSDemuxer.probe(new Uint8Array(data));
    }

    on(eventName: string, callback: EventEmitter.ListenerFn) {
        this.eventEmitter.on(eventName, callback);
    }

    once(eventName: string, callback: EventEmitter.ListenerFn) {
        this.eventEmitter.once(eventName, callback);
    }

    off(eventName: string, callback?: EventEmitter.ListenerFn) {
        this.eventEmitter.off(eventName, callback);
    }

    /**
     * 销毁功能
     */
    destroy() {
        this.eventEmitter.removeAllListeners();
        this._demuxer.destroy();
        delete this._demuxer;
        delete this._config;
        delete this.eventEmitter;
    }

    /**
     * 重置初始化片段
     * @param initSegment 初始化片段
     * @param audioCodec 音频编码类型
     * @param videoCodec 视频编码类型
     * @param duration 时长
     */
    resetInitSegment(
        initSegment: Uint8Array,
        audioCodec: string | undefined,
        videoCodec: string | undefined,
        duration: number
    ) {
        this._demuxer.resetInitSegment(initSegment, audioCodec, videoCodec, duration);
    }

    /**
     * 重置时间基准值
     */
    resetTimeStamp(data?: any) {
        this._demuxer.resetTimeStamp(data);
    }

    /**
     * 获取TS转码事件
     */
    static get Events() {
        return TSEvents;
    }

    get config() {
        return this._config;
    }

    /**
     * 测试使用, 真实环境中需要父级传过来
     */
    static get typeSupportFunc() {
        return typeSupport;
    }

    seek(ms?: number) {}

    insertDiscontinuity() {}

    flushStashedSamples() {}

    bindDataSource(dataSource: any) {
        dataSource.onDataArrival = this.parseChunks.bind(this);
        return this;
    }

    resetMediaInfo() {}

    /**
     *
     * @param data 要解析的数据
     * @param byteStart FLV中parseChunks所需参数, HLS流不需要
     * @param extraData loader发送过来的关于ts文件的详情
     * @returns { number } 已被解析的数据的长度
     */
    parseChunks(data: ArrayBuffer, byteStart: number, extraData: TSExtraData): number {
        const typeData = new Uint8Array(data);
        this._demuxer.parseChunks(typeData, extraData);
        return typeData.length;
    }
}

export default TSCodec;
