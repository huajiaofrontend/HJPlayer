import { track } from '../TSCodecInterface';
declare class MP4 {
    static types: Record<string, Array<number>>;
    static HDLR_TYPES: Record<string, Uint8Array>;
    static STTS: Uint8Array;
    static STSC: Uint8Array;
    static STCO: Uint8Array;
    static STSZ: Uint8Array;
    static VMHD: Uint8Array;
    static SMHD: Uint8Array;
    static STSD: Uint8Array;
    static FTYP: Uint8Array;
    static DINF: Uint8Array;
    static init(): void;
    /**
     * 给 MP4 box 填充数据
     * @param type 代表Box类型的数组
     * @param mergePayload 合并的 Uint8Array 数据
     */
    static box(type: Array<number>, ...mergePayload: Array<Uint8Array>): Uint8Array;
    /**
     * handler, declares the media (handler) type box
     * @param type 获取的类型
     */
    static hdlr(type: string): Uint8Array;
    /**
     * 填充MDAT数据
     * @param data 媒体数据
     */
    static mdat(data: Uint8Array): Uint8Array;
    /**
     * media header, overall information about the media
     * @param timescale 时间尺度
     * @param duration 播放时长
     */
    static mdhd(timescale: number, duration: number): Uint8Array;
    static mdia(track: track): Uint8Array;
    static mfhd(sequenceNumber: number): Uint8Array;
    /**
     *  media information container
     * @param track 一个视频或音频序列
     */
    static minf(track: track): Uint8Array;
    /**
     * movie fragement
     * @param sn 序列号
     * @param baseMediaDecodeTime 媒体解码时间
     * @param track 一个视频或音频序列
     */
    static moof(sn: number, baseMediaDecodeTime: number, track: track): Uint8Array;
    /**
     * container for all the metadata
     * @param tracks 视频或音频序列数组
     */
    static moov(tracks: Array<track>): Uint8Array;
    /**
     * movie extends box
     * @param tracks 视频或音频序列数组
     */
    static mvex(tracks: Array<track>): Uint8Array;
    static mvhd(timescale: number, duration: number): Uint8Array;
    static sdtp(track: track): Uint8Array;
    static stbl(track: track): Uint8Array;
    static avc1(track: track): Uint8Array;
    static esds(track: track): Uint8Array;
    static mp4a(track: track): Uint8Array;
    static mp3(track: track): Uint8Array;
    static stsd(track: track): Uint8Array;
    static tkhd(track: track): Uint8Array;
    static traf(track: track, baseMediaDecodeTime: number): Uint8Array;
    /**
     * Generate a track box.
     * @param track {object} a track definition
     * @return {Uint8Array} the track box
     */
    static trak(track: track): Uint8Array;
    static trex(track: track): Uint8Array;
    static trun(track: track, offset: number): Uint8Array;
    static initSegment(tracks: Array<track>): Uint8Array;
}
export default MP4;
