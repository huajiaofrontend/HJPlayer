/**
 * highly optimized TS demuxer:
 * parse PAT, PMT
 * extract PES packet from audio and video PIDs
 * extract AVC/H264 NAL units and AAC/ADTS samples from PES packet
 * trigger the remuxer upon parsing completion
 * it also tries to workaround as best as it can audio codec switch (HE-AAC to AAC and vice versa), without having to restart the MediaSource.
 * it also controls the remuxing process :
 * upon discontinuity or level switch detection, it will also notifies the remuxer so that it can reset its state.
 */
import EventEmitter from 'eventemitter3';
import { track, pesData, parsedPesData, avcSample, NALUnit, TSTextTrack, TSId3Track, TSAudioTrack, TSVideoTrack, SampleLike, typeSupported, agentInfo } from '../TSCodecInterface';
declare class TSDemuxer {
    /**
     * 事件中心
     */
    private _emitter;
    /**
     * 设置
     */
    private config;
    /**
     * 浏览器支持回放类型
     */
    private typeSupported;
    /**
     * 浏览器代理信息
     */
    agentInfo: agentInfo;
    /**
     * 上一个加载的fragment
     */
    private frag;
    /**
     * TS 转码器
     */
    private remuxer;
    /**
     * 待查明
     */
    private sampleAes;
    /**
     * 上报错误的方法
     */
    private _onError;
    /**
     * 媒体信息
     */
    private _mediaInfo;
    /**
     * 上报媒体信息的方法
     */
    private _onMediaInfo;
    /**
     * 上报metaData的方法
     */
    private _onMetaDataArrived;
    /**
     * 上报 ScriptData 的方法 (TS解码器没用);
     */
    private _onScriptDataArrived;
    /**
     * 上报 TrackMetadata 的方法
     */
    private _onTrackMetadata;
    /**
     * 上报数据的方法
     */
    private _onDataAvailable;
    /**
     * fragment的序列号
     */
    private sequenceNumber;
    /**
     * 时间基础值
     */
    private _timestampBase;
    /**
     * 是否对有声音的标识进行过覆盖
     */
    private _hasAudioFlagOverrided;
    /**
     * 视频是否有声音
     */
    private _hasAudio;
    /**
     * 是否对有视频的标识进行过覆盖
     */
    private _hasVideoFlagOverrided;
    /**
     * 视频有视频
     */
    private _hasVideo;
    /**
     * 媒体文件长度
     */
    private _duration;
    /**
     * 是否对duration进行过覆盖
     */
    private _durationOverrided;
    /**
     * fragment 的 ID, 等同于 sequenceNumber
     */
    private id;
    /**
     * PMT表格是否已经解析
     */
    private pmtParsed;
    /**
     * PMT的ID是多少
     */
    private _pmtId;
    /**
     * AVC Track
     */
    private _avcTrack;
    /**
     * audio track
     */
    private _audioTrack;
    /**
     * id3 track
     */
    private _id3Track;
    /**
     * txt track
     */
    private _txtTrack;
    /**
     * 溢出的AAC数据
     */
    aacOverFlow: Uint8Array | null;
    /**
     * 音频最后的PTS时间
     */
    aacLastPTS: number | undefined;
    /**
     * AVC Sample 的存储单元
     */
    avcSample: avcSample | null;
    /**
     * 音频解码器类型
     */
    audioCodec: string | undefined;
    /**
     * 视频解码器类型
     */
    videoCodec: string | undefined;
    /**
     * 是否连续
     */
    contiguous: boolean;
    /**
     * 初始的PTS
     */
    _initPTS: undefined;
    /**
     * 初始的DTS
     */
    _initDTS: undefined;
    constructor(emitter: EventEmitter, config: Record<string, any>, typeSupported: typeSupported, agentInfo: agentInfo);
    /**
     * 文件标签
     */
    static Tag: 'TSDemuxer';
    onTrackMetadata: Function | null;
    onMediaInfo: Function | null;
    onMetaDataArrived: Function | null;
    onScriptDataArrived: Function | null;
    onError: Function | null;
    onDataAvailable: Function | null;
    timestampBase: number;
    overridedDuration: number;
    overridedHasAudio: boolean;
    overridedHasVideo: boolean;
    on(event: string, listener: EventEmitter.ListenerFn): void;
    once(event: string, listener: EventEmitter.ListenerFn): void;
    off(event: string, listener: EventEmitter.ListenerFn): void;
    bindDataSource(loader: any): this;
    /**
     * 解析数据
     * @param { Uint8Aarray } chunks loader返回的额数据
     * @param { Number } byteStart 累计的bytelength
     * @param { * } extraData fragment-loader 返回的数据
     */
    parseChunks(chunks: Uint8Array, extraData: any): void;
    /**
     * 推入已经解密过的数据
     * @param data 要解析的数据块
     * @param decryptdata 解密相关参数
     * @param initSegment 初始化片段数据
     * @param audioCodec 音频编码格式
     * @param videoCodec 视频编码格式
     * @param timeOffset 时间偏移
     * @param discontinuity 是否不连续
     * @param trackSwitch 是都切换了level
     * @param contiguous 是否连续
     * @param duration 媒体时长
     * @param accurateTimeOffset 是否为精确的时间偏移
     * @param defaultInitPTS 默认初始的PTS
     */
    pushDecrypted(data: Uint8Array, decryptdata: any, initSegment: Uint8Array, audioCodec: string | undefined, videoCodec: string | undefined, timeOffset: number, discontinuity: boolean, trackSwitch: boolean, contiguous: boolean, duration: number, accurateTimeOffset: boolean, defaultInitPTS: number | undefined): void;
    /**
     * 判断Uint8Array是否为TS数据
     * @param data 侦测的数据
     */
    static probe(data: Uint8Array): boolean;
    /**
     * 查找同步位所在位置, 如果没有找到返回 -1, 找到就返回找到的位置, 一般为 0
     * @param data 要查找的数据
     */
    static _syncOffset(data: Uint8Array): number;
    /**
     * 创建一个 track 模板, 用于 转码时放数据
     * @param {string} type 'audio' | 'video' | 'id3' | 'text'
     * @param {number} duration
     * @return { track }
     */
    static createTrack(type: string, duration: number): track;
    /**
     * 创建视频序列
     */
    static createVideoTrack(): TSVideoTrack;
    /**
     * 创建音频序列
     * @param duration 时长
     */
    static createAudioTrack(duration: number): TSAudioTrack;
    /**
     * 创建Id3序列
     */
    static createId3Track(): TSId3Track;
    /**
     * 创建文本序列
     */
    static createTextTrack(): TSTextTrack;
    /**
     * Initializes a new init segment on the demuxer/remuxer interface. Needed for discontinuities/track-switches (or at stream start)
     * Resets all internal track instances of the demuxer.
     * 重新初始化初始化片段, 初始化各个track等相关参数, 会在 frament不连续, 切换level或者刚开始的时候调用
     * @override Implements generic demuxing/remuxing interface (see DemuxerInline)
     * @param { Uint8Array } initSegment
     * @param { string } audioCodec
     * @param { string } videoCodec
     * @param { number } duration (in TS timescale = 90kHz)
     */
    resetInitSegment(initSegment: Uint8Array, audioCodec: string | undefined, videoCodec: string | undefined, duration: number): void;
    /**
     * 重置时间基准值
     */
    resetTimeStamp(defaultInitPTS: number | undefined): void;
    /**
     * 重置媒体信息
     */
    resetMediaInfo(): void;
    /**
     * 想解码器添加数据
     * @param data 要解码的数据
     * @param timeOffset 时间偏移值
     * @param contiguous 是否连续
     * @param accurateTimeOffset 是否是精确的时间偏移
     */
    append(data: Uint8Array, timeOffset: number, contiguous: boolean, accurateTimeOffset: boolean): void;
    /**
     * 销毁功能
     */
    destroy(): void;
    /**
     * 解析 PAT表, 获取 PMT值
     * @param data 要解析的Uint8Array 数据
     * @param offset 偏移量
     */
    _parsePAT(data: Uint8Array, offset: number): number;
    /**
     *
     * @param data 解析的UInt8Array
     * @param offset 偏移数
     * @param mpegSupported 浏览器是否支持MPEG回放
     * @param isSampleAes 是否有解密程序
     */
    _parsePMT(data: Uint8Array, offset: number, mpegSupported: boolean, isSampleAes: boolean): {
        audio: number;
        avc: number;
        id3: number;
        isAAC: boolean;
    };
    /**
     * 解析PES包
     * @param stream PES包
     */
    _parsePES(stream: pesData): parsedPesData | null;
    pushAccesUnit(avcSample: avcSample, avcTrack: TSVideoTrack): void;
    /**
     * 解析AVC PES 数据
     * @param pes 要解析的PES Data
     * @param last 是否为最后一个
     */
    _parseAVCPES(pes: parsedPesData, last?: boolean): void;
    /**
     * 按照pts排序 插入一个sample
     * @param arr 被插入的avcsample
     * @param data 要排序的数据
     */
    _insertSampleInOrder(arr: Array<SampleLike>, data: SampleLike): void;
    _getLastNalUnit(): NALUnit | undefined;
    /**
     * 解析AVC的NAL Unit, 返回 NAL Unit 的数组
     * @param array 要解析的Uint8Array
     */
    _parseAVCNALu(array: Uint8Array): Array<NALUnit>;
    /**
     * remove Emulation Prevention bytes from a RBSP
     */
    discardEPB(data: Uint8Array): Uint8Array;
    /**
     * 解析AAC音频 PES 数据, 填充 AudioTrack的samples
     * @param pes 要解析的PES 数据
     * @param last 是否为最后一个PES
     */
    _parseAACPES(pes: parsedPesData, last?: boolean): void;
    /**
     * 解析MPEG的PES包, 填充 _audioTrack的samples
     * @param pes 待解析的 PES 包数据
     */
    _parseMPEGPES(pes: parsedPesData): void;
    _parseID3PES(pes: parsedPesData): void;
    /**
     * 填充mediaInfo, 并向上发送
     */
    _parseMediaInfo(audioTrack: track, videoTrack: track): void;
    /**
     * 创建metadata, 并用emitter发送出去
     * @param audioTrack 音频序列
     * @param videoTrack 视频序列
     */
    _createMetadata(audioTrack: TSAudioTrack, videoTrack: TSVideoTrack): void;
}
export default TSDemuxer;
