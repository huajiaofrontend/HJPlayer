/**
 * ADTS(Audio Data Transport Stream) parser helper
 * @link https://wiki.multimedia.cx/index.php?title=ADTS
 */
import EventEmitter from 'eventemitter3';
import { track, TSAudioTrack } from '../TSCodecInterface';
export declare function getAudioConfig(observer: EventEmitter, data: Uint8Array, offset: number, audioCodec: string | undefined): {
    config: number[];
    samplerate: number;
    channelCount: number;
    codec: string;
    manifestCodec: string | undefined;
} | undefined;
/**
 * 是否符合Header的格式
 */
export declare function isHeaderPattern(data: Uint8Array, offset: number): boolean;
/**
 * 获取Header的长度
 */
export declare function getHeaderLength(data: Uint8Array, offset: number): 9 | 7;
/**
 * 获取整个帧的数据长度
 */
export declare function getFullFrameLength(data: Uint8Array, offset: number): number;
/**
 * 是不是Header
 */
export declare function isHeader(data: Uint8Array, offset: number): boolean;
/**
 * 探测是不是音频数据
 * @param data 音频数据块
 * @param offset 偏移量
 */
export declare function probe(data: Uint8Array, offset: number): boolean;
/**
 * 初始化Track设置, 给Audiotrack添加属性
 * @param track track 信息
 * @param observer 事件中心
 * @param data 音频数据块
 * @param offset 偏移量
 * @param audioCodec 音频编码格式
 */
export declare function initTrackConfig(track: TSAudioTrack, observer: EventEmitter, data: Uint8Array, offset: number, audioCodec: string | undefined): void;
/**
 * 获取帧播放时长
 * @param samplerate sample码率
 */
export declare function getFrameDuration(samplerate: number): number;
/**
 * 解析帧头部信息
 * @param data 音频数据块
 * @param offset 偏移
 * @param pts 展示时间
 * @param frameIndex 帧索引值
 * @param frameDuration 帧持续时间
 */
export declare function parseFrameHeader(data: Uint8Array, offset: number, pts: number, frameIndex: number, frameDuration: number): {
    headerLength: number;
    frameLength: number;
    stamp: number;
} | undefined;
export declare function appendFrame(track: track, data: Uint8Array, offset: number, pts: number, frameIndex: number): {
    sample: {
        unit: Uint8Array;
        pts: number;
        dts: number;
    };
    length: number;
} | undefined;
