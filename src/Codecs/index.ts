import EventEmitter from 'eventemitter3';
import FLVCodec from './FLVCodec';
import TSCodec from './TSCodec';

class Codec {
    Tag: string

    eventEmitter: EventEmitter

    constructor() {
        this.Tag = 'Codec';
        this.eventEmitter = new EventEmitter();
    }

    /**
     * 获取可支持转码的转码器
     * @param type 媒体类型
     * @param data buffer数据
     */
    static getSupportCodec(type: string, data: ArrayBuffer) {
        type = type.toUpperCase();

        if(type === 'FLV' && FLVCodec.probe(data).match) {
            return FLVCodec;
        } if(type === 'M3U8' && TSCodec.probe(data)) {
            return TSCodec;
        }
        return null;
    }

    /**
     * 获取FLVCodec
     */
    static get FLVCodec() {
        return FLVCodec;
    }

    /**
     * 获取TSCodec
     */
    static get TSCodec() {
        return TSCodec;
    }
}

export default Codec;
