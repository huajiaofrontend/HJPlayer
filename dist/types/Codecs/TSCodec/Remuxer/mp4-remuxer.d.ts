/**
 * fMP4 remuxer
 */
import EventEmitter from 'eventemitter3';
import { typeSupported, track, TSAudioTrack, TSVideoTrack, TSId3Track, TSTextTrack, TSVideoData, TSAudioData, agentInfo } from '../TSCodecInterface';
declare class MP4Remuxer {
    /**
     * 事件中心
     */
    emitter: EventEmitter;
    /**
     * 设置
     */
    config: any;
    /**
     * MediaSource 播放类型支持
     */
    typeSupported: typeSupported;
    /**
     * 浏览器代理信息
     */
    agentInfo: agentInfo;
    /**
     * 是否为safari浏览器
     */
    isSafari: boolean;
    /**
     * initSegment 是否已经产生了
     */
    ISGenerated: boolean;
    /**
     * 初始的PTS
     */
    private _initPTS;
    /**
     * 初始的DTS时间
     */
    private _initDTS;
    /**
     * 下一个AVC的DTS时间
     */
    nextAvcDts: number | undefined;
    /**
     * 下一段音频的展示时间
     */
    nextAudioPts: number | undefined;
    constructor(emitter: EventEmitter, config: any, typeSupported: typeSupported, agentInfo: agentInfo);
    static Tag: 'MP4Remuxer';
    destroy(): void;
    resetTimeStamp(defaultTimeStamp: number | undefined): void;
    resetInitSegment(): void;
    remux(audioTrack: TSAudioTrack, videoTrack: TSVideoTrack, id3Track: TSId3Track, textTrack: TSTextTrack, timeOffset: number, contiguous: boolean, accurateTimeOffset: boolean): void;
    generateIS(audioTrack: TSAudioTrack, videoTrack: TSVideoTrack, timeOffset: number): void;
    remuxVideo(track: track, timeOffset: number, contiguous: boolean, audioTrackLength: number | undefined, accurateTimeOffset: boolean): TSVideoData | undefined;
    remuxAudio(track: TSAudioTrack, timeOffset: number, contiguous: boolean, accurateTimeOffset?: boolean): TSAudioData | null;
    /**
     * 添加静默音频帧
     * @param track
     * @param timeOffset
     * @param contiguous
     * @param videoData
     */
    remuxEmptyAudio(track: TSAudioTrack, timeOffset: number, contiguous: boolean, videoData: TSVideoData): void;
    remuxID3(track: TSId3Track): void;
    /**
     * 封装文本序列
     * @param track 文本序列
     */
    remuxText(track: TSTextTrack): void;
    /**
     * 格式化PTS值
     * @param value pts值,
     * @param reference
     */
    _PTSNormalize(value: number, reference: number | undefined): number;
    /**
     * 将moof和mdat的数据合成一个media segment 发送出去
     * @param moof moof BOX的数据
     * @param mdat mdat BOX的数据
     */
    _mergeBoxes(moof: Uint8Array, mdat: Uint8Array): Uint8Array;
}
export default MP4Remuxer;
