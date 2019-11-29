import EventEmitter from 'eventemitter3';
import FLVCodec from './FLVCodec';
import TSCodec from './TSCodec';
declare class Codec {
    Tag: string;
    eventEmitter: EventEmitter;
    constructor();
    /**
     * 获取可支持转码的转码器
     * @param type 媒体类型
     * @param data buffer数据
     */
    static getSupportCodec(type: string, data: ArrayBuffer): typeof FLVCodec | typeof TSCodec | null;
    /**
     * 获取FLVCodec
     */
    static readonly FLVCodec: typeof FLVCodec;
    /**
     * 获取TSCodec
     */
    static readonly TSCodec: typeof TSCodec;
}
export default Codec;
