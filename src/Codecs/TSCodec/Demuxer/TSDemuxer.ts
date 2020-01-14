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
import logger from '../../../Utils/Logger';
import * as ADTS from './adts';
import MpegAudio from './mpegaudio';
import Events from '../Events/index';
import ExpGolomb from './exp-golomb';
import { ErrorTypes, ErrorDetails } from '../errors';
import {
    track,
    pesData,
    parsedPesData,
    avcSample,
    NALUnit,
    TSTextTrack,
    TSId3Track,
    TSAudioTrack,
    TSVideoTrack,
    SampleLike,
    typeSupported,
    agentInfo
} from '../TSCodecInterface';
import createAVCSample from '../TSUtils/createAVCSample';
import MP4Remuxer from '../Remuxer/mp4-remuxer';
import { videoTrack } from '../../FLVCodec/Interface';
// We are using fixed track IDs for driving the MP4 remuxer
// instead of following the TS PIDs.
// There is no reason not to do this and some browsers/SourceBuffer-demuxers
// may not like if there are TrackID "switches"
// See https://github.com/video-dev/hls.js/issues/1331
// Here we are mapping our internal track types to constant MP4 track IDs
// With MSE currently one can only have one track of each, and we are muxing
// whatever video/audio rendition in them.
const RemuxerTrackIdConfig: Record<string, number> = {
    video: 1,
    audio: 2,
    id3: 3,
    text: 4
};

class TSDemuxer {
    /**
     * 事件中心
     */
    private _emitter: EventEmitter

    /**
     * 设置
     */
    private config: Record<string, any>

    /**
     * 浏览器支持回放类型
     */
    private typeSupported: typeSupported

    /**
     * 浏览器代理信息
     */
    agentInfo: agentInfo

    /**
     * 上一个加载的fragment
     */
    private frag: any

    /**
     * TS 转码器
     */
    private remuxer: MP4Remuxer

    /**
     * 待查明
     */
    private sampleAes: any

    /**
     * 上报错误的方法
     */
    private _onError: Function | null

    /**
     * 媒体信息
     */
    private _mediaInfo: Record<string, any>

    /**
     * 上报媒体信息的方法
     */
    private _onMediaInfo: Function | null

    /**
     * 上报metaData的方法
     */
    private _onMetaDataArrived: Function | null

    /**
     * 上报 ScriptData 的方法 (TS解码器没用);
     */
    private _onScriptDataArrived: Function | null

    /**
     * 上报 TrackMetadata 的方法
     */
    private _onTrackMetadata: Function | null

    /**
     * 上报数据的方法
     */
    private _onDataAvailable: Function | null

    /**
     * fragment的序列号
     */
    private sequenceNumber: number

    /**
     * 时间基础值
     */
    private _timestampBase: number

    /**
     * 是否对有声音的标识进行过覆盖
     */
    private _hasAudioFlagOverrided: boolean

    /**
     * 视频是否有声音
     */
    private _hasAudio: boolean

    /**
     * 是否对有视频的标识进行过覆盖
     */
    private _hasVideoFlagOverrided: boolean

    /**
     * 视频有视频
     */
    private _hasVideo: boolean

    /**
     * 媒体文件长度
     */
    private _duration: number

    /**
     * 是否对duration进行过覆盖
     */
    private _durationOverrided: boolean

    /**
     * fragment 的 ID, 等同于 sequenceNumber
     */
    private id: any

    /**
     * PMT表格是否已经解析
     */
    private pmtParsed: boolean

    /**
     * PMT的ID是多少
     */
    private _pmtId: number

    /**
     * AVC Track
     */
    private _avcTrack: TSVideoTrack

    /**
     * audio track
     */
    private _audioTrack: TSAudioTrack

    /**
     * id3 track
     */
    private _id3Track: TSId3Track

    /**
     * txt track
     */
    private _txtTrack: TSTextTrack

    /**
     * 溢出的AAC数据
     */
    aacOverFlow: Uint8Array | null

    /**
     * 音频最后的PTS时间
     */
    aacLastPTS: number | undefined

    /**
     * AVC Sample 的存储单元
     */
    avcSample: avcSample | null

    /**
     * 音频解码器类型
     */
    audioCodec: string | undefined

    /**
     * 视频解码器类型
     */
    videoCodec: string | undefined

    /**
     * 是否连续
     */
    contiguous: boolean

    /**
     * 初始的PTS
     */
    _initPTS: undefined

    /**
     * 初始的DTS
     */
    _initDTS: undefined

    constructor(
        emitter: EventEmitter,
        config: Record<string, any>,
        typeSupported: typeSupported,
        agentInfo: agentInfo
    ) {
        this._emitter = emitter;
        this.config = config;
        this.typeSupported = typeSupported;
        this.agentInfo = agentInfo;
        this.frag = null;
        this.remuxer = new MP4Remuxer(this._emitter, config, typeSupported, agentInfo);
        this.sampleAes = null;
        this._onError = null;
        this._mediaInfo = Object.create(null);
        this._onMediaInfo = null;
        this._onMetaDataArrived = null;
        this._onScriptDataArrived = null;
        this._onTrackMetadata = null;
        this._onDataAvailable = null;
        this.sequenceNumber = 0;
        this._timestampBase = 0;
        this._avcTrack = TSDemuxer.createVideoTrack();
        this._audioTrack = TSDemuxer.createAudioTrack(0);
        this._id3Track = TSDemuxer.createId3Track();
        this._txtTrack = TSDemuxer.createTextTrack();
        this._hasAudioFlagOverrided = false;
        this._hasAudio = false;
        this._hasVideoFlagOverrided = false;
        this._hasVideo = false;
        this._durationOverrided = false;
        this._duration = 0;
        this.pmtParsed = false;
        this._pmtId = -1;
        this.contiguous = false;
        this.avcSample = null;
        this.aacOverFlow = null;
        this.aacLastPTS = undefined;
    }

    /**
     * 文件标签
     */
    static Tag: 'TSDemuxer'

    // prototype: function(type: string, metadata: any): void
    get onTrackMetadata() {
        return this._onTrackMetadata;
    }

    set onTrackMetadata(callback) {
        this._onTrackMetadata = callback;
    }

    // prototype: function(mediaInfo: MediaInfo): void
    get onMediaInfo() {
        return this._onMediaInfo;
    }

    set onMediaInfo(callback) {
        this._onMediaInfo = callback;
    }

    get onMetaDataArrived() {
        return this._onMetaDataArrived;
    }

    set onMetaDataArrived(callback) {
        this._onMetaDataArrived = callback;
    }

    get onScriptDataArrived() {
        return this._onScriptDataArrived;
    }

    set onScriptDataArrived(callback) {
        this._onScriptDataArrived = callback;
    }

    // prototype: function(type: number, info: string): void
    get onError() {
        return this._onError;
    }

    set onError(callback) {
        this._onError = callback;
    }

    // prototype: function(videoTrack: any, audioTrack: any): void
    get onDataAvailable() {
        return this._onDataAvailable;
    }

    set onDataAvailable(callback) {
        this._onDataAvailable = callback;
    }

    // timestamp base for output samples, must be in milliseconds
    get timestampBase() {
        return this._timestampBase;
    }

    set timestampBase(base) {
        this._timestampBase = base;
    }

    get overridedDuration() {
        return this._duration;
    }

    // Force-override media duration. Must be in milliseconds, int32
    set overridedDuration(duration) {
        this._durationOverrided = true;
        this._duration = duration;
        this._mediaInfo.duration = duration;
    }

    // Force-override audio track present flag, boolean
    set overridedHasAudio(hasAudio: boolean) {
        this._hasAudioFlagOverrided = true;
        this._hasAudio = hasAudio;
        this._mediaInfo.hasAudio = hasAudio;
    }

    // Force-override video track present flag, boolean
    set overridedHasVideo(hasVideo: boolean) {
        this._hasVideoFlagOverrided = true;
        this._hasVideo = hasVideo;
        this._mediaInfo.hasVideo = hasVideo;
    }

    on(event: string, listener: EventEmitter.ListenerFn) {
        this._emitter.on(event, listener);
    }

    once(event: string, listener: EventEmitter.ListenerFn) {
        this._emitter.once(event, listener);
    }

    off(event: string, listener: EventEmitter.ListenerFn) {
        this._emitter.off(event, listener);
    }

    // TODO 和 push 结合在一起
    bindDataSource(loader: any) {
        loader.onDataArrival = this.parseChunks.bind(this);
        return this;
    }

    /**
     * 解析数据
     * @param { Uint8Aarray } chunks loader返回的额数据
     * @param { Number } byteStart 累计的bytelength
     * @param { * } extraData fragment-loader 返回的数据
     */
    parseChunks(chunks: Uint8Array, extraData: any) {
        /**
         * 发送过来数据块所属的fragment
         */
        const frag = extraData.fragCurrent;
        /**
         * 时间偏移
         */
        const timeOffset = Number.isFinite(frag.startPTS) ? frag.startPTS : frag.start;
        /**
         * 解码数据
         */
        const { decryptdata } = frag;
        /**
         * 上一个frag
         */
        const lastFrag = this.frag;
        /**
         * 是否不连续
         */
        const discontinuity = !(lastFrag && frag.cc === lastFrag.cc);
        /**
         * 是不是变了level
         */
        const trackSwitch = !(lastFrag && frag.level === lastFrag.level);
        /**
         * SN号是否连续的
         */
        const nextSN = lastFrag && frag.sn === lastFrag.sn + 1;
        /**
         * fragment是否是相邻的
         */
        const contiguous = !trackSwitch && nextSN;

        if(discontinuity) {
            logger.debug(TSDemuxer.Tag, `${this.id}:discontinuity detected`);
        }

        if(trackSwitch) {
            logger.debug(TSDemuxer.Tag, `${this.id}:switch detected`);
        }

        this.frag = frag;
        // 暂时不解密
        this.pushDecrypted(
            chunks,
            decryptdata,
            new Uint8Array(extraData.initSegmentData),
            extraData.audioCodec,
            extraData.videoCodec,
            timeOffset,
            discontinuity,
            trackSwitch,
            contiguous,
            extraData.totalduration,
            extraData.accurateTimeOffset,
            extraData.defaultInitPTS
        );
    }

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
    pushDecrypted(
        data: Uint8Array,
        decryptdata: any,
        initSegment: Uint8Array,
        audioCodec: string | undefined,
        videoCodec: string | undefined,
        timeOffset: number,
        discontinuity: boolean,
        trackSwitch: boolean,
        contiguous: boolean,
        duration: number,
        accurateTimeOffset: boolean,
        defaultInitPTS: number | undefined
    ) {
        // 如果过不连续或者变更了level 则重新生成初始化segment
        if(discontinuity || trackSwitch) {
            this.resetInitSegment(initSegment, audioCodec, videoCodec, duration);
            this.remuxer.resetInitSegment();
        }

        // 如果过不连续 重置 时间基础值
        if(discontinuity) {
            this.resetTimeStamp(defaultInitPTS);
            this.remuxer.resetTimeStamp(defaultInitPTS);
        }

        this.append(new Uint8Array(data), timeOffset, contiguous, accurateTimeOffset);
    }

    /**
     * 判断Uint8Array是否为TS数据
     * @param data 侦测的数据
     */
    static probe(data: Uint8Array) {
        const syncOffset = TSDemuxer._syncOffset(data);
        if(syncOffset < 0) {
            return false;
        }
        if(syncOffset) {
            logger.warn(
                TSDemuxer.Tag,
                `MPEG2-TS detected but first sync word found @ offset ${syncOffset}, junk ahead ?`
            );
        }
        return true;
    }

    /**
     * 查找同步位所在位置, 如果没有找到返回 -1, 找到就返回找到的位置, 一般为 0
     * @param data 要查找的数据
     */
    static _syncOffset(data: Uint8Array): number {
        // scan 1000 first bytes
        const scanwindow = Math.min(1000, data.length - 3 * 188);
        let i = 0;
        while(i < scanwindow) {
            // a TS fragment should contain at least 3 TS packets, a PAT, a PMT, and one PID, each starting with 0x47
            if(data[i] === 0x47 && data[i + 188] === 0x47 && data[i + 2 * 188] === 0x47) {
                return i;
            }
            i++;
        }
        return -1;
    }

    /**
     * 创建一个 track 模板, 用于 转码时放数据
     * @param {string} type 'audio' | 'video' | 'id3' | 'text'
     * @param {number} duration
     * @return { track }
     */
    static createTrack(type: string, duration: number): track {
        return {
            container: type === 'video' || type === 'audio' ? 'video/mp2t' : undefined,
            type,
            id: RemuxerTrackIdConfig[type],
            pid: -1,
            inputTimeScale: 90000,
            sequenceNumber: 0,
            samples: [],
            dropped: type === 'video' ? 0 : undefined,
            isAAC: type === 'audio' ? true : undefined,
            duration: type === 'audio' ? duration : undefined
        };
    }

    /**
     * 创建视频序列
     */
    static createVideoTrack(): TSVideoTrack {
        return {
            container: 'video/mp2t',
            type: 'video',
            id: RemuxerTrackIdConfig.video,
            pid: -1,
            inputTimeScale: 90000,
            sequenceNumber: 0,
            samples: [],
            dropped: 0,
            isAAC: undefined,
            duration: undefined
        };
    }

    /**
     * 创建音频序列
     * @param duration 时长
     */
    static createAudioTrack(duration: number): TSAudioTrack {
        return {
            container: 'video/mp2t',
            type: 'audio',
            id: RemuxerTrackIdConfig.audio,
            pid: -1,
            inputTimeScale: 90000,
            sequenceNumber: 0,
            samples: [],
            dropped: undefined,
            isAAC: true,
            duration
        };
    }

    /**
     * 创建Id3序列
     */
    static createId3Track(): TSId3Track {
        return {
            container: undefined,
            type: 'id3',
            id: RemuxerTrackIdConfig.id3,
            pid: -1,
            inputTimeScale: 90000,
            sequenceNumber: 0,
            samples: [],
            dropped: undefined,
            isAAC: undefined,
            duration: undefined
        };
    }

    /**
     * 创建文本序列
     */
    static createTextTrack(): TSTextTrack {
        return {
            container: undefined,
            type: 'text',
            id: RemuxerTrackIdConfig.text,
            pid: -1,
            inputTimeScale: 90000,
            sequenceNumber: 0,
            samples: [],
            dropped: undefined,
            isAAC: undefined,
            duration: undefined
        };
    }

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
    resetInitSegment(
        initSegment: Uint8Array,
        audioCodec: string | undefined,
        videoCodec: string | undefined,
        duration: number
    ) {
        this.pmtParsed = false;

        this._pmtId = -1;

        this._avcTrack = TSDemuxer.createVideoTrack();
        this._audioTrack = TSDemuxer.createAudioTrack(duration);
        this._id3Track = TSDemuxer.createId3Track();
        this._txtTrack = TSDemuxer.createTextTrack();

        // flush any partial content
        this.aacOverFlow = null;
        this.aacLastPTS = undefined;
        this.avcSample = null;
        this.audioCodec = audioCodec;
        this.videoCodec = videoCodec;
        this._duration = duration;
    }

    /**
     * 重置时间基准值
     */
    resetTimeStamp(defaultInitPTS: number | undefined) {}

    /**
     * 重置媒体信息
     */
    resetMediaInfo() {
        this._mediaInfo = Object.create(null);
    }

    // feed incoming data to the front of the parsing pipeline
    /**
     * 想解码器添加数据
     * @param data 要解码的数据
     * @param timeOffset 时间偏移值
     * @param contiguous 是否连续
     * @param accurateTimeOffset 是否是精确的时间偏移
     */
    append(data: Uint8Array, timeOffset: number, contiguous: boolean, accurateTimeOffset: boolean) {
        let start;
        /**
         * 要解析数据的长度
         */

        let len = data.length;
        /**
         * ISOIEC13818-1 规定 负载单元起始标示符 为 true 时代表该包中含有 PES packets (refer to 2.4.3.6) or PSI data (refer to 2.4.4).
         */
        let stt = false;
        /**
         * ts packet id 包ID
         */
        let pid;
        /**
         * adaptation_field_control 自适应域标志
         */
        let atf;
        /**
         * 偏移量
         */
        let offset;
        /**
         * 经 parsePES 方法解析后的 pes 包数据
         */
        let pes;
        /**
         * 是否为未知的PID
         */
        let unknownPIDs = false;
        this.contiguous = contiguous;
        let { pmtParsed } = this;
        const avcTrack = this._avcTrack;
        const audioTrack = this._audioTrack;
        const id3Track = this._id3Track;
        let avcId = avcTrack ? avcTrack.pid : -1;
        let audioId = audioTrack ? audioTrack.pid : -1;
        let id3Id = id3Track ? id3Track.pid : -1;
        let pmtId = this._pmtId;
        let avcData: pesData | undefined = avcTrack.pesData;
        let audioData: pesData | undefined = audioTrack.pesData;
        let id3Data: pesData | undefined = id3Track.pesData;
        const parsePAT = this._parsePAT;
        const parsePMT = this._parsePMT;
        const parsePES = this._parsePES;
        const parseAVCPES = this._parseAVCPES.bind(this);
        const parseAACPES = this._parseAACPES.bind(this);
        const parseMPEGPES = this._parseMPEGPES.bind(this);
        const parseID3PES = this._parseID3PES.bind(this);

        const syncOffset = TSDemuxer._syncOffset(data);

        // don't parse last TS packet if incomplete
        len -= (len + syncOffset) % 188;

        // loop through TS packets
        for(start = syncOffset; start < len; start += 188) {
            if(data[start] === 0x47) {
                stt = !!(data[start + 1] & 0x40);
                // pid is a 13-bit field starting at the last bit of TS[1]
                pid = ((data[start + 1] & 0x1f) << 8) + data[start + 2];
                atf = (data[start + 3] & 0x30) >> 4;
                // if an adaption field is present, its length is specified by the fifth byte of the TS packet header.
                if(atf > 1) {
                    offset = start + 5 + data[start + 4];
                    // continue if there is only adaptation field
                    if(offset === start + 188) {
                        continue;
                    }
                } else {
                    offset = start + 4;
                }

                switch(pid) {
                case avcId:
                    if(stt) {
                        avcData && (pes = parsePES(avcData));
                        if(avcData && pes && pes.pts !== undefined) {
                            parseAVCPES(pes, false);
                        }
                        avcData = {
                            data: [],
                            size: 0
                        };
                    }
                    if(avcData) {
                        avcData.data.push(data.subarray(offset, start + 188));
                        avcData.size += start + 188 - offset;
                    }
                    break;
                case audioId:
                    if(stt) {
                        audioData && (pes = parsePES(audioData));
                        if(audioData && pes && pes.pts !== undefined) {
                            if(audioTrack.isAAC) {
                                parseAACPES(pes);
                            } else {
                                parseMPEGPES(pes);
                            }
                        }
                        audioData = {
                            data: [],
                            size: 0
                        };
                    }
                    if(audioData) {
                        audioData.data.push(data.subarray(offset, start + 188));
                        audioData.size += start + 188 - offset;
                    }
                    break;
                case id3Id:
                    if(stt) {
                        id3Data && (pes = parsePES(id3Data));

                        if(id3Data && pes && pes.pts !== undefined) {
                            parseID3PES(pes);
                        }

                        id3Data = {
                            data: [],
                            size: 0
                        };
                    }
                    if(id3Data) {
                        id3Data.data.push(data.subarray(offset, start + 188));
                        id3Data.size += start + 188 - offset;
                    }
                    break;
                case 0:
                    if(stt) {
                        offset += data[offset] + 1;
                    }
                    this._pmtId = parsePAT(data, offset);
                    pmtId = this._pmtId;
                    break;
                    // eslint-disable-next-line no-case-declarations
                case pmtId: {
                    if(stt) {
                        offset += data[offset] + 1;
                    }

                    const parsedPIDs = parsePMT(
                        data,
                        offset,
                        this.typeSupported.mpeg === true || this.typeSupported.mp3 === true,
                        this.sampleAes !== null
                    );

                    // only update track id if track PID found while parsing PMT
                    // this is to avoid resetting the PID to -1 in case
                    // track PID transiently disappears from the stream
                    // this could happen in case of transient missing audio samples for example
                    // NOTE this is only the PID of the track as found in TS,
                    // but we are not using this for MP4 track IDs.
                    avcId = parsedPIDs.avc;

                    if(avcId > 0) {
                        avcTrack.pid = avcId;
                    }

                    audioId = parsedPIDs.audio;

                    if(audioId > 0) {
                        audioTrack.pid = audioId;
                        audioTrack.isAAC = parsedPIDs.isAAC;
                    }

                    id3Id = parsedPIDs.id3;
                    if(id3Id > 0) {
                        id3Track.pid = id3Id;
                    }

                    if(unknownPIDs && !pmtParsed) {
                        logger.log(TSDemuxer.Tag, 'reparse from beginning');
                        unknownPIDs = false;
                        // we set it to -188, the += 188 in the for loop will reset start to 0
                        start = syncOffset - 188;
                    }
                    this.pmtParsed = true;
                    pmtParsed = true;
                    break;
                }
                case 17:
                case 0x1fff:
                    break;
                default:
                    unknownPIDs = true;
                    break;
                }
            } else {
                this._emitter.emit(Events.ERROR, {
                    type: ErrorTypes.MEDIA_ERROR,
                    details: ErrorDetails.FRAG_PARSING_ERROR,
                    fatal: false,
                    code: -2,
                    reason: 'TS packet did not start with 0x47'
                });
            }
        }
        // try to parse last PES packets
        avcData && (pes = parsePES(avcData));
        if(avcData && pes && pes.pts !== undefined) {
            parseAVCPES(pes, true);
            avcTrack.pesData = undefined;
        } else {
            // either avcData null or PES truncated, keep it for next frag parsing
            avcTrack.pesData = avcData;
        }
        audioData && (pes = parsePES(audioData));
        if(audioData && pes && pes.pts !== undefined) {
            if(audioTrack.isAAC) {
                parseAACPES(pes, true);
            } else {
                parseMPEGPES(pes);
            }
            audioTrack.pesData = undefined;
        } else {
            if(audioData && audioData.size) {
                logger.log(
                    TSDemuxer.Tag,
                    'last AAC PES packet truncated,might overlap between fragments'
                );
            }

            // either audioData null or PES truncated, keep it for next frag parsing
            audioTrack.pesData = audioData;
        }
        id3Data && (pes = parsePES(id3Data));
        if(id3Data && pes && pes.pts !== undefined) {
            parseID3PES(pes);
            id3Track.pesData = undefined;
        } else {
            // either id3Data null or PES truncated, keep it for next frag parsing
            id3Track.pesData = id3Data;
        }
        this.sequenceNumber += 1;
        const { sequenceNumber } = this;
        audioTrack.sequenceNumber = sequenceNumber;
        avcTrack.sequenceNumber = sequenceNumber;
        this._parseMediaInfo(audioTrack, avcTrack);

        this._createMetadata(audioTrack, avcTrack);
        this.remuxer.remux(
            audioTrack,
            avcTrack,
            id3Track,
            this._txtTrack,
            timeOffset,
            contiguous,
            accurateTimeOffset
        );
    }

    /**
     * 销毁功能
     */
    destroy() {
        this._initDTS = undefined;
        this._initPTS = undefined;
        this._duration = 0;
        this.sequenceNumber = 0;
        this._emitter.removeAllListeners();
        delete this._emitter;
        delete this.config;
        delete this.typeSupported;
        delete this.agentInfo;
        this.frag = null;
        delete this.remuxer;
        this.sampleAes = null;
        this._onError = null;
        delete this._mediaInfo;
        this._onMediaInfo = null;
        this._onMetaDataArrived = null;
        this._onScriptDataArrived = null;
        this._onTrackMetadata = null;
        this._onDataAvailable = null;
        this.sequenceNumber = 0;
        this._timestampBase = 0;
        delete this._avcTrack;
        delete this._audioTrack;
        delete this._id3Track;
        delete this._txtTrack;
        this._hasAudioFlagOverrided = false;
        this._hasAudio = false;
        this._hasVideoFlagOverrided = false;
        this._hasVideo = false;
        this._durationOverrided = false;
        this._duration = 0;
        this.pmtParsed = false;
        this._pmtId = -1;
        this.contiguous = false;
        this.avcSample = null;
        this.aacOverFlow = null;
        this.aacLastPTS = undefined;
    }

    /**
     * 解析 PAT表, 获取 PMT值
     * @param data 要解析的Uint8Array 数据
     * @param offset 偏移量
     */
    _parsePAT(data: Uint8Array, offset: number): number {
        // skip the PSI header and parse the first PMT entry
        return ((data[offset + 10] & 0x1f) << 8) | data[offset + 11];
        // logger.log('PMT PID:'  + this._pmtId);
    }

    /**
     *
     * @param data 解析的UInt8Array
     * @param offset 偏移数
     * @param mpegSupported 浏览器是否支持MPEG回放
     * @param isSampleAes 是否有解密程序
     */
    _parsePMT(data: Uint8Array, offset: number, mpegSupported: boolean, isSampleAes: boolean) {
        let pid;
        const result = {
            audio: -1,
            avc: -1,
            id3: -1,
            isAAC: true
        };
        const sectionLength = ((data[offset + 1] & 0x0f) << 8) | data[offset + 2];
        const tableEnd = offset + 3 + sectionLength - 4;
        // to determine where the table is, we have to figure out how
        // long the program info descriptors are
        const programInfoLength = ((data[offset + 10] & 0x0f) << 8) | data[offset + 11];
        // advance the offset to the first entry in the mapping table
        offset += 12 + programInfoLength;

        while(offset < tableEnd) {
            pid = ((data[offset + 1] & 0x1f) << 8) | data[offset + 2];
            switch(data[offset]) {
            case 0xcf: // SAMPLE-AES AAC
                if(!isSampleAes) {
                    logger.log(TSDemuxer.Tag, `unkown stream type:${data[offset]}`);
                    break;
                }
                /* falls through */

                // ISO/IEC 13818-7 ADTS AAC (MPEG-2 lower bit-rate audio)
                // eslint-disable-next-line no-fallthrough
            case 0x0f:
                // logger.log('AAC PID:'  + pid);
                if(result.audio === -1) {
                    result.audio = pid;
                }

                break;

                // Packetized metadata (ID3)
            case 0x15:
                // logger.log('ID3 PID:'  + pid);
                if(result.id3 === -1) {
                    result.id3 = pid;
                }

                break;

            case 0xdb: // SAMPLE-AES AVC
                if(!isSampleAes) {
                    logger.log(TSDemuxer.Tag, `unkown stream type:${data[offset]}`);
                    break;
                }
                /* falls through */

                // ITU-T Rec. H.264 and ISO/IEC 14496-10 (lower bit-rate video)
                // eslint-disable-next-line no-fallthrough
            case 0x1b:
                // logger.log('AVC PID:'  + pid);
                if(result.avc === -1) {
                    result.avc = pid;
                }

                break;

                // ISO/IEC 11172-3 (MPEG-1 audio)
                // or ISO/IEC 13818-3 (MPEG-2 halved sample rate audio)
            case 0x03:
            case 0x04:
                // logger.log('MPEG PID:'  + pid);
                if(!mpegSupported) {
                    logger.log(
                        TSDemuxer.Tag,
                        'MPEG audio found, not supported in this browser for now'
                    );
                } else if(result.audio === -1) {
                    result.audio = pid;
                    result.isAAC = false;
                }
                break;

            case 0x24:
                logger.log(TSDemuxer.Tag, 'HEVC stream type found, not supported for now');
                break;

            default:
                logger.log(TSDemuxer.Tag, `unkown stream type:${data[offset]}`);
                break;
            }
            // move to the next table entry
            // skip past the elementary stream descriptors, if present
            offset += (((data[offset + 3] & 0x0f) << 8) | data[offset + 4]) + 5;
        }
        return result;
    }

    /**
     * 解析PES包
     * @param stream PES包
     */
    _parsePES(stream: pesData): parsedPesData | null {
        let i = 0;
        let frag;
        let pesFlags;
        let pesLen;
        let pesHdrLen;
        let pesData;
        let pesPts: number | undefined;
        let pesDts: number | undefined;
        let payloadStartOffset;
        const { data } = stream;
        // safety check
        if(!stream || stream.size === 0) {
            return null;
        }

        // we might need up to 19 bytes to read PES header
        // if first chunk of data is less than 19 bytes, let's merge it with following ones until we get 19 bytes
        // usually only one merge is needed (and this is rare ...)
        while(data[0].length < 19 && data.length > 1) {
            const newData = new Uint8Array(data[0].length + data[1].length);
            newData.set(data[0]);
            newData.set(data[1], data[0].length);
            data[0] = newData;
            data.splice(1, 1);
        }
        // retrieve PTS/DTS from first fragment
        frag = data[0];
        const pesPrefix = (frag[0] << 16) + (frag[1] << 8) + frag[2];
        if(pesPrefix === 1) {
            pesLen = (frag[4] << 8) + frag[5];
            // if PES parsed length is not zero and greater than total received length, stop parsing. PES might be truncated
            // minus 6 : PES header size
            if(pesLen && pesLen > stream.size - 6) {
                return null;
            }

            pesFlags = frag[7];
            if(pesFlags & 0xc0) {
                /* PES header described here : http://dvd.sourceforge.net/dvdinfo/pes-hdr.html
                    as PTS / DTS is 33 bit we cannot use bitwise operator in JS,
                    as Bitwise operators treat their operands as a sequence of 32 bits */
                pesPts = (frag[9] & 0x0e) * 536870912 // 1 << 29
                    + (frag[10] & 0xff) * 4194304 // 1 << 22
                    + (frag[11] & 0xfe) * 16384 // 1 << 14
                    + (frag[12] & 0xff) * 128 // 1 << 7
                    + (frag[13] & 0xfe) / 2;
                // check if greater than 2^32 -1
                if(pesPts > 4294967295) {
                    // decrement 2^33
                    pesPts -= 8589934592;
                }
                if(pesFlags & 0x40) {
                    pesDts = (frag[14] & 0x0e) * 536870912 // 1 << 29
                        + (frag[15] & 0xff) * 4194304 // 1 << 22
                        + (frag[16] & 0xfe) * 16384 // 1 << 14
                        + (frag[17] & 0xff) * 128 // 1 << 7
                        + (frag[18] & 0xfe) / 2;
                    // check if greater than 2^32 -1
                    if(pesDts > 4294967295) {
                        // decrement 2^33
                        pesDts -= 8589934592;
                    }
                    if(pesPts - pesDts > 60 * 90000) {
                        logger.warn(
                            TSDemuxer.Tag,
                            `${Math.round(
                                (pesPts - pesDts) / 90000
                            )}s delta between PTS and DTS, align them`
                        );
                        pesPts = pesDts;
                    }
                } else {
                    pesDts = pesPts;
                }
            }
            pesHdrLen = frag[8];
            // 9 bytes : 6 bytes for PES header + 3 bytes for PES extension
            payloadStartOffset = pesHdrLen + 9;

            stream.size -= payloadStartOffset;
            // reassemble PES packet
            pesData = new Uint8Array(stream.size);
            for(let j = 0, dataLen = data.length; j < dataLen; j++) {
                frag = data[j];
                let len = frag.byteLength;
                if(payloadStartOffset) {
                    if(payloadStartOffset > len) {
                        // trim full frag if PES header bigger than frag
                        payloadStartOffset -= len;
                        continue;
                    } else {
                        // trim partial frag if PES header smaller than frag
                        frag = frag.subarray(payloadStartOffset);
                        len -= payloadStartOffset;
                        payloadStartOffset = 0;
                    }
                }
                pesData.set(frag, i);
                i += len;
            }
            if(pesLen) {
                // payload size : remove PES header + PES extension
                pesLen -= pesHdrLen + 3;
            }
            return {
                data: pesData,
                pts: pesPts,
                dts: pesDts,
                len: pesLen
            };
        }
        return null;
    }

    pushAccesUnit(avcSample: avcSample, avcTrack: TSVideoTrack) {
        if(avcSample.units.length && avcSample.frame) {
            const { samples } = avcTrack;
            const nbSamples = samples.length;
            // only push AVC sample if starting with a keyframe is not mandatory OR
            //    if keyframe already found in this fragment OR
            //       keyframe found in last fragment (track.sps) AND
            //          samples already appended (we already found a keyframe in this fragment) OR fragment is contiguous
            if(
                !this.config.forceKeyFrameOnDiscontinuity
                || avcSample.key === true
                || (avcTrack.sps && (nbSamples || this.contiguous))
            ) {
                avcSample.id = nbSamples;
                samples.push(avcSample);
            } else {
                // dropped samples, track it
                avcTrack.dropped !== undefined && avcTrack.dropped++;
            }
        }
        if(avcSample.debug.length) {
            logger.info(TSDemuxer.Tag, `${avcSample.pts}/${avcSample.dts}:${avcSample.debug}`);
        }
    }

    /**
     * 解析AVC PES 数据
     * @param pes 要解析的PES Data
     * @param last 是否为最后一个
     */
    _parseAVCPES(pes: parsedPesData, last?: boolean) {
        const track = this._avcTrack;
        const units = this._parseAVCNALu(pes.data);
        const debug = false;
        let expGolombDecoder;
        let { avcSample } = this;
        /**
             * 是否插入到units中
             */
        let push = false;
        /**
             * 是否找到SPS
             */
        let spsfound = false;
        let i;
        const pushAccesUnit = this.pushAccesUnit.bind(this);
        // free pes.data to save up some memory
        delete pes.data;

        // if new NAL units found and last sample still there, let's push ...
        // this helps parsing streams with missing AUD (only do this if AUD never found)
        if(avcSample && units.length && !track.audFound) {
            pushAccesUnit(avcSample, track);
            this.avcSample = createAVCSample(false, pes.pts, pes.dts, '');
            ({ avcSample } = this);
        }

        units.forEach((unit) => {
            switch(unit.type) {
            // eslint-disable-next-line no-case-declarations
            case 1: { // NDR
                push = true;

                if(!avcSample) {
                    this.avcSample = createAVCSample(true, pes.pts, pes.dts, '');
                    ({ avcSample } = this);
                }

                if(!avcSample) {
                    return;
                }

                if(debug) {
                    avcSample.debug += 'NDR ';
                }

                avcSample.frame = true;

                const { data } = unit;
                // only check slice type to detect KF in case SPS found in same packet (any keyframe is preceded by SPS ...)
                if(spsfound && data.length > 4) {
                    // retrieve slice type by parsing beginning of NAL unit (follow H264 spec, slice_header definition) to detect keyframe embedded in NDR
                    const sliceType = new ExpGolomb(data).readSliceType();
                    // 2 : I slice, 4 : SI slice, 7 : I slice, 9: SI slice
                    // SI slice : A slice that is coded using intra prediction only and using quantisation of the prediction samples.
                    // An SI slice can be coded such that its decoded samples can be constructed identically to an SP slice.
                    // I slice: A slice that is not an SI slice that is decoded using intra prediction only.
                    // if (sliceType === 2 || sliceType === 7) {
                    // https://www.cnblogs.com/pengkunfan/p/3945445.html SliceType 简介
                    if(
                        sliceType === 2
                            || sliceType === 4
                            || sliceType === 7
                            || sliceType === 9
                    ) {
                        avcSample.key = true;
                    }
                }
                break;
            }
            // IDR
            case 5:
                push = true;
                // handle PES not starting with AUD
                if(!avcSample) {
                    this.avcSample = createAVCSample(true, pes.pts, pes.dts, '');
                    ({ avcSample } = this);
                }

                if(!avcSample) {
                    return;
                }

                if(debug) {
                    avcSample.debug += 'IDR ';
                }

                avcSample.key = true;
                avcSample.frame = true;
                break;
                // SEI
                // eslint-disable-next-line no-case-declarations
            case 6: {
                push = true;
                if(debug && avcSample) {
                    avcSample.debug += 'SEI ';
                }

                expGolombDecoder = new ExpGolomb(this.discardEPB(unit.data));

                // skip frameType
                expGolombDecoder.readUByte();

                let payloadType = 0;
                let payloadSize = 0;
                let endOfCaptions = false;
                let b = 0;

                while(!endOfCaptions && expGolombDecoder.bytesAvailable > 1) {
                    payloadType = 0;
                    do {
                        b = expGolombDecoder.readUByte();
                        payloadType += b;
                    } while(b === 0xff);

                    // Parse payload size.
                    payloadSize = 0;
                    do {
                        b = expGolombDecoder.readUByte();
                        payloadSize += b;
                    } while(b === 0xff);

                    // TODO: there can be more than one payload in an SEI packet...
                    // TODO: need to read type and size in a while loop to get them all
                    if(payloadType === 4 && expGolombDecoder.bytesAvailable !== 0) {
                        endOfCaptions = true;

                        const countryCode = expGolombDecoder.readUByte();

                        if(countryCode === 181) {
                            const providerCode = expGolombDecoder.readUShort();

                            if(providerCode === 49) {
                                const userStructure = expGolombDecoder.readUInt();

                                if(userStructure === 0x47413934) {
                                    const userDataType = expGolombDecoder.readUByte();

                                    // Raw CEA-608 bytes wrapped in CEA-708 packet
                                    if(userDataType === 3) {
                                        const firstByte = expGolombDecoder.readUByte();
                                        const secondByte = expGolombDecoder.readUByte();

                                        const totalCCs = 31 & firstByte;
                                        const byteArray = [firstByte, secondByte];

                                        for(i = 0; i < totalCCs; i++) {
                                            // 3 bytes per CC
                                            byteArray.push(expGolombDecoder.readUByte());
                                            byteArray.push(expGolombDecoder.readUByte());
                                            byteArray.push(expGolombDecoder.readUByte());
                                        }

                                        this._insertSampleInOrder(this._txtTrack.samples, {
                                            type: 3,
                                            pts: <number>pes.pts,
                                            bytes: byteArray
                                        });
                                    }
                                }
                            }
                        }
                    } else if(payloadType === 5 && expGolombDecoder.bytesAvailable !== 0) {
                        endOfCaptions = true;

                        if(payloadSize > 16) {
                            const uuidStrArray = [];
                            const userDataPayloadBytes = [];

                            for(i = 0; i < 16; i++) {
                                uuidStrArray.push(expGolombDecoder.readUByte().toString(16));

                                if(i === 3 || i === 5 || i === 7 || i === 9) {
                                    uuidStrArray.push('-');
                                }
                            }

                            for(i = 16; i < payloadSize; i++) {
                                userDataPayloadBytes.push(expGolombDecoder.readUByte());
                            }

                            this._insertSampleInOrder(this._txtTrack.samples, {
                                pts: pes.pts,
                                payloadType,
                                uuid: uuidStrArray.join(''),
                                userData: String.fromCharCode.apply(null, userDataPayloadBytes),
                                userDataBytes: userDataPayloadBytes
                            });
                        }
                    } else if(payloadSize < expGolombDecoder.bytesAvailable) {
                        for(i = 0; i < payloadSize; i++) {
                            expGolombDecoder.readUByte();
                        }
                    }
                }
                break;
            }
            // SPS
            // eslint-disable-next-line no-case-declarations
            case 7:
                push = true;
                spsfound = true;
                if(debug && avcSample) {
                    avcSample.debug += 'SPS ';
                }

                if(!track.sps) {
                    expGolombDecoder = new ExpGolomb(unit.data);
                    const config = expGolombDecoder.readSPS();
                    track.width = config.width;
                    track.height = config.height;
                    track.pixelRatio = config.pixelRatio;
                    track.sps = [unit.data];
                    track.duration = this._duration;
                    const codecarray = unit.data.subarray(1, 4);
                    let codecstring = 'avc1.';
                    for(i = 0; i < 3; i++) {
                        let h = codecarray[i].toString(16);
                        if(h.length < 2) {
                            h = `0${h}`;
                        }

                        codecstring += h;
                    }
                    track.codec = codecstring;
                }
                break;
                // PPS
            case 8:
                push = true;
                if(debug && avcSample) {
                    avcSample.debug += 'PPS ';
                }

                if(!track.pps) {
                    track.pps = [unit.data];
                }

                break;
                // AUD
            case 9:
                push = false;
                track.audFound = true;
                if(avcSample) {
                    pushAccesUnit(avcSample, track);
                }
                this.avcSample = createAVCSample(
                    false,
                    pes.pts,
                    pes.dts,
                    debug ? 'AUD ' : ''
                );
                ({ avcSample } = this);
                break;
                // Filler Data
            case 12:
                push = false;
                break;
            default:
                push = false;
                if(avcSample) {
                    avcSample.debug += `unknown NAL ${unit.type} `;
                }

                break;
            }
            if(avcSample && push) {
                const { units } = avcSample;
                units.push(unit);
            }
        });
        // if last PES packet, push samples
        if(last && avcSample) {
            pushAccesUnit(avcSample, track);
            this.avcSample = null;
        }
    }

    /**
     * 按照pts排序 插入一个sample
     * @param arr 被插入的avcsample
     * @param data 要排序的数据
     */
    _insertSampleInOrder(arr: Array<SampleLike>, data: SampleLike) {
        const len = arr.length;
        if(len > 0) {
            if(data.pts && data.pts >= <number>arr[len - 1].pts) {
                arr.push(data);
            } else {
                for(let pos = len - 1; pos >= 0; pos--) {
                    if(data.pts && data.pts < <number>arr[pos].pts) {
                        arr.splice(pos, 0, data);
                        break;
                    }
                }
            }
        } else {
            arr.push(data);
        }
    }

    _getLastNalUnit(): NALUnit | undefined {
        let { avcSample } = this;
        let lastUnit;
        // try to fallback to previous sample if current one is empty
        if(!avcSample || avcSample.units.length === 0) {
            const track = this._avcTrack;
            const { samples } = track;
            avcSample = samples[samples.length - 1];
        }
        if(avcSample) {
            const { units } = avcSample;
            lastUnit = units[units.length - 1];
        }
        return lastUnit;
    }

    /**
     * 解析AVC的NAL Unit, 返回 NAL Unit 的数组
     * @param array 要解析的Uint8Array
     */
    _parseAVCNALu(array: Uint8Array): Array<NALUnit> {
        let i = 0;
        const len = array.byteLength;
        let value;
        let overflow;
        const track = this._avcTrack;
        let state = track.naluState || 0;
        const lastState = state;
        const units = [];
        let unit: NALUnit;
        let unitType: number;
        let lastUnitStart = -1;
        let lastUnitType = 0;
        // logger.log('PES:' + Hex.hexDump(array));

        if(state === -1) {
            // special use case where we found 3 or 4-byte start codes exactly at the end of previous PES packet
            lastUnitStart = 0;
            // NALu type is value read from offset 0
            lastUnitType = array[0] & 0x1f;
            state = 0;
            i = 1;
        }

        while(i < len) {
            value = array[i++];
            // optimization. state 0 and 1 are the predominant case. let's handle them outside of the switch/case
            if(!state) {
                state = value ? 0 : 1;
                continue;
            }
            if(state === 1) {
                state = value ? 0 : 2;
                continue;
            }
            // here we have state either equal to 2 or 3
            if(!value) {
                state = 3;
            } else if(value === 1) {
                if(lastUnitStart >= 0) {
                    unit = {
                        data: array.subarray(lastUnitStart, i - state - 1),
                        type: lastUnitType,
                        state: undefined
                    };
                    // logger.log('pushing NALU, type/size:' + unit.type + '/' + unit.data.byteLength);
                    if(unit.type === 6) {
                        // 获取到SEI信息
                        this._emitter.emit(Events.GET_SEI_INFO, new Uint8Array(unit.data));
                    }
                    units.push(unit);
                } else {
                    // lastUnitStart is undefined => this is the first start code found in this PES packet
                    // first check if start code delimiter is overlapping between 2 PES packets,
                    // ie it started in last packet (lastState not zero)
                    // and ended at the beginning of this PES packet (i <= 4 - lastState)
                    const lastUnit = this._getLastNalUnit();
                    if(lastUnit) {
                        if(lastState && i <= 4 - lastState) {
                            // start delimiter overlapping between PES packets
                            // strip start delimiter bytes from the end of last NAL unit
                            // check if lastUnit had a state different from zero
                            if(lastUnit.state) {
                                // strip last bytes
                                lastUnit.data = lastUnit.data.subarray(
                                    0,
                                    lastUnit.data.byteLength - lastState
                                );
                            }
                        }
                        // If NAL units are not starting right at the beginning of the PES packet, push preceding data into previous NAL unit.
                        overflow = i - state - 1;
                        if(overflow > 0) {
                            // logger.log('first NALU found with overflow:' + overflow);
                            const tmp = new Uint8Array(lastUnit.data.byteLength + overflow);
                            tmp.set(lastUnit.data, 0);
                            tmp.set(array.subarray(0, overflow), lastUnit.data.byteLength);
                            lastUnit.data = tmp;
                        }
                    }
                }
                // check if we can read unit type
                if(i < len) {
                    unitType = array[i] & 0x1f;
                    // logger.log('find NALU @ offset:' + i + ',type:' + unitType);
                    lastUnitStart = i;
                    lastUnitType = unitType;
                    state = 0;
                } else {
                    // not enough byte to read unit type. let's read it on next PES parsing
                    state = -1;
                }
            } else {
                state = 0;
            }
        }

        if(lastUnitStart >= 0 && state >= 0) {
            unit = {
                data: array.subarray(lastUnitStart, len),
                type: lastUnitType,
                state
            };
            units.push(unit);
            // logger.log('pushing NALU, type/size/state:' + unit.type + '/' + unit.data.byteLength + '/' + state);
        }
        // no NALu found
        if(units.length === 0) {
            // append pes.data to previous NAL unit
            const lastUnit = this._getLastNalUnit();
            if(lastUnit) {
                const tmp = new Uint8Array(lastUnit.data.byteLength + array.byteLength);
                tmp.set(lastUnit.data, 0);
                tmp.set(array, lastUnit.data.byteLength);
                lastUnit.data = tmp;
            }
        }
        track.naluState = state;
        return units;
    }

    /**
     * remove Emulation Prevention bytes from a RBSP
     */
    discardEPB(data: Uint8Array): Uint8Array {
        const length = data.byteLength;
        const EPBPositions = [];
        let i = 1;

        // Find all `Emulation Prevention Bytes`
        while(i < length - 2) {
            if(data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 0x03) {
                EPBPositions.push(i + 2);
                i += 2;
            } else {
                i++;
            }
        }

        // If no Emulation Prevention Bytes were found just return the original
        // array
        if(EPBPositions.length === 0) {
            return data;
        }

        // Create a new array to hold the NAL unit data
        const newLength = length - EPBPositions.length;
        const newData = new Uint8Array(newLength);
        let sourceIndex = 0;

        for(i = 0; i < newLength; sourceIndex++, i++) {
            if(sourceIndex === EPBPositions[0]) {
                // Skip this byte
                sourceIndex++;
                // Remove this position index
                EPBPositions.shift();
            }
            newData[i] = data[sourceIndex];
        }
        return newData;
    }

    /**
     * 解析AAC音频 PES 数据, 填充 AudioTrack的samples
     * @param pes 要解析的PES 数据
     * @param last 是否为最后一个PES
     */
    _parseAACPES(pes: parsedPesData, last?: boolean) {
        const track = this._audioTrack;
        let { data } = pes;
        let pts = <number>pes.pts;
        const startOffset = 0;
        let { aacOverFlow } = this;
        const { aacLastPTS } = this;
        let frameIndex;
        let offset;
        let stamp;
        let len;
        if(aacOverFlow) {
            const tmp = new Uint8Array(aacOverFlow.byteLength + data.byteLength);
            tmp.set(aacOverFlow, 0);
            tmp.set(data, aacOverFlow.byteLength);
            // logger.log(`AAC: append overflowing ${aacOverFlow.byteLength} bytes to beginning of new PES`);
            data = tmp;
        }
        // look for ADTS header (0xFFFx)
        for(offset = startOffset, len = data.length; offset < len - 1; offset++) {
            if(ADTS.isHeader(data, offset)) {
                break;
            }
        }
        // if ADTS header does not start straight from the beginning of the PES payload, raise an error
        if(offset) {
            let reason; let
                fatal;
            if(offset < len - 1) {
                reason = `AAC PES did not start with ADTS header,offset:${offset}`;
                fatal = false;
            } else {
                reason = 'no ADTS header found in AAC PES';
                fatal = true;
            }
            logger.warn(TSDemuxer.Tag, `parsing error:${reason}`);

            this._emitter.emit(Events.ERROR, {
                type: ErrorTypes.MEDIA_ERROR,
                details: ErrorDetails.FRAG_PARSING_ERROR,
                fatal,
                reason
            });

            if(fatal) {
                return;
            }
        }

        ADTS.initTrackConfig(track, this._emitter, data, offset, this.audioCodec);
        frameIndex = 0;
        const frameDuration = ADTS.getFrameDuration(track.samplerate);

        // if last AAC frame is overflowing, we should ensure timestamps are contiguous:
        // first sample PTS should be equal to last sample PTS + frameDuration
        if(aacOverFlow && aacLastPTS && frameDuration) {
            const newPTS = aacLastPTS + frameDuration;
            if(pts && Math.abs(newPTS - pts) > 1) {
                logger.log(
                    TSDemuxer.Tag,
                    `AAC: align PTS for overlapping frames by ${Math.round((newPTS - pts) / 90)}`
                );
                pts = newPTS;
            }
        }

        // scan for aac samples
        while(offset < len) {
            if(ADTS.isHeader(data, offset) && offset + 5 < len && track) {
                const frame = ADTS.appendFrame(track, data, offset, pts, frameIndex);
                if(frame) {
                    // logger.log(`${Math.round(frame.sample.pts)} : AAC`);
                    offset += frame.length;
                    stamp = frame.sample.pts;
                    frameIndex++;
                } else {
                    // logger.log('Unable to parse AAC frame');
                    break;
                }
            } else {
                // nothing found, keep looking
                offset++;
            }
        }

        if(offset < len) {
            aacOverFlow = data.subarray(offset, len);
            // logger.log(`AAC: overflow detected:${len-offset}`);
        } else {
            aacOverFlow = null;
        }

        this.aacOverFlow = aacOverFlow;

        this.aacLastPTS = stamp;
    }

    /**
     * 解析MPEG的PES包, 填充 _audioTrack的samples
     * @param pes 待解析的 PES 包数据
     */
    _parseMPEGPES(pes: parsedPesData) {
        const { data } = pes;
        const { length } = data;
        let frameIndex = 0;
        let offset = 0;
        const { pts } = pes;

        while(offset < length) {
            if(MpegAudio.isHeader(data, offset)) {
                const frame = MpegAudio.appendFrame(
                    this._audioTrack,
                    data,
                    offset,
                    pts as number,
                    frameIndex
                );
                if(frame) {
                    offset += frame.length;
                    frameIndex++;
                } else {
                    // logger.log('Unable to parse Mpeg audio frame');
                    break;
                }
            } else {
                // nothing found, keep looking
                offset++;
            }
        }
    }

    _parseID3PES(pes: parsedPesData) {
        this._id3Track.samples.push(pes);
    }

    /**
     * 填充mediaInfo, 并向上发送
     */
    _parseMediaInfo(audioTrack: track, videoTrack: track) {
        this._mediaInfo = Object.assign(Object.create(null), this._mediaInfo, {
            duration: Math.max(<number>audioTrack.duration, <number>videoTrack.duration),
            audioChannelCount: audioTrack.channelCount,
            audioCodec: audioTrack.codec,
            audioSampleRate: audioTrack.samplerate,
            fps: null,
            hasAudio: !!audioTrack,
            hasKeyframesIndex: false,
            keyframesIndex: null,
            hasVideo: !!videoTrack,
            width: videoTrack.width,
            height: videoTrack.height,
            mimeType: `${videoTrack.container || audioTrack.container}; codecs="${
                videoTrack.codec
            },${audioTrack.codec}"`,
            videoCodec: videoTrack.codec,
            pixelRatio: videoTrack.pixelRatio,
            pps: videoTrack.pps,
            sps: videoTrack.sps
        });
        this._emitter.emit(Events.MEDIA_INFO, this._mediaInfo);
    }

    /**
     * 创建metadata, 并用emitter发送出去
     * @param audioTrack 音频序列
     * @param videoTrack 视频序列
     */
    _createMetadata(audioTrack: TSAudioTrack, videoTrack: TSVideoTrack) {
        const MD = {
            audiodatarate: 0,
            audiosamplerate: audioTrack.samplerate,
            compatibleBrands: 'isom',
            duration: videoTrack.duration,
            height: videoTrack.height,
            majorBrand: 'isom',
            minorVersion: '1',
            width: videoTrack.width
        };
        this._emitter.emit(Events.META_DATA, MD);
    }
}

export default TSDemuxer;
