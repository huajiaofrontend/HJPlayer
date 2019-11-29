import EventEmitter from 'eventemitter3';
import CodecInterface from '../Interfaces/Codec';
import FLVDemuxer from './FLVCodec/Demuxer/FLVDemuxer';
import Events from './FLVCodec/Events/index';
import DefaultConfig from './FLVCodec/config';
import typeSupport from './FLVCodec/Utils/getMediaTypeSupport';

class FLVCodec implements CodecInterface {
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
     * flv解码器
     */
    private _demuxer: FLVDemuxer

    /**
     * flv解码设置
     */
    _config: Record<string, any>

    constructor(data: ArrayBuffer, config: Record<string, any>) {
        this.Tag = 'FLVCodec';
        this.type = 'FLVCodec';
        this.eventEmitter = new EventEmitter();
        this._config = Object.assign(Object.create(null), DefaultConfig, config);
        this._demuxer = new FLVDemuxer(data, this.eventEmitter, config);
    }

    /**
     * 解码器添加数据
     * @param data loader 发送过来的数据
     * @param byteStart 开始字节
     */
    appendData(data: ArrayBuffer, byteStart: number) {
        this._demuxer.parseChunks(data, byteStart);
    }

    resetMediaInfo() {
        this._demuxer.resetMediaInfo();
    }

    insertDiscontinuity() {
        this._demuxer.insertDiscontinuity();
    }

    seek() {
        this._demuxer.seek();
    }

    /**
     * 探测数据是否能够解码
     * @param data loader第一次发送过来的数据
     */
    static probe(data: ArrayBuffer) {
        return FLVDemuxer.probe(new Uint8Array(data));
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
        delete this.eventEmitter;
    }

    set timestampBase(base: number) {
        this._demuxer.timestampBase = base;
    }

    set overridedDuration(duration: number) {
        this._demuxer.overridedDuration = duration;
    }

    set overridedHasAudio(hasAudio: boolean) {
        this._demuxer.overridedHasAudio = hasAudio;
    }

    set overridedHasVideo(hasVideo: boolean) {
        this._demuxer.overridedHasVideo = hasVideo;
    }

    /**
     * 获取转码事件
     */
    static get Events() {
        return Events;
    }

    get config() {
        return this._config;
    }

    static get typeSupportFunc() {
        return typeSupport;
    }

    flushStashedSamples(): void {
        this._demuxer.flushStashedSamples();
    }

    bindDataSource(dataSource: any) {
        dataSource.onDataArrival = this.parseChunks.bind(this);
        return this;
    }

    parseChunks(data: ArrayBuffer, byteStart: number): number {
        return this._demuxer.parseChunks(data, byteStart);
    }
}

export default FLVCodec;
