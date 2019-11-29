import EventEmitter from 'eventemitter3';
import {
    ProbeData,
    ScriptData,
    FrameRate,
    track,
    audioTrack,
    videoTrack,
    KeyframesData,
    AacAudioData,
    AacAudioDataPacket,
    Mp3AudioData,
    AvcSampleData,
    AudioMediaData,
    VideoMediaData
} from '../Interface';
import AMF from './AmfParser';
import SPSParser from './SPSParser';
import Log from '../../../Utils/Logger';
import Events from '../Events/index';
import { ErrorTypes, ErrorDetails } from '../errors';
import MediaInfo from '../../../Utils/media-info';
import MP4Remuxer from '../Remuxer/mp4-remuxer';
import { NALUnit } from '../../TSCodec/TSCodecInterface';
import getGlobal from '../../../Utils/getGlobalObject';

const GG = getGlobal();

function ReadBig32(array: Uint8Array, index: number) {
    return (
        (array[index] << 24) | (array[index + 1] << 16) | (array[index + 2] << 8) | array[index + 3]
    );
}
/**
 * FLV 文件解码器总输出
 */
class FLVDemuxer {
    Tag: string

    type: string

    _dataOffset: number | undefined

    _littleEndian: boolean

    _firstParse: boolean

    _dispatch: boolean

    _hasAudio: boolean | undefined

    _hasVideo: boolean | undefined

    _hasAudioFlagOverrided: boolean

    _hasVideoFlagOverrided: boolean

    _audioInitialMetadataDispatched: boolean

    _videoInitialMetadataDispatched: boolean

    _metadata: ScriptData | null

    _mediaInfo: MediaInfo

    _audioMetadata: track | null

    _videoMetadata: track | null

    _naluLengthSize: number

    _timestampBase: number

    _timescale: number

    _duration: number

    _durationOverrided: boolean

    _referenceFrameRate: FrameRate

    _flvSoundRateTable: number[]

    _mpegSamplingRates: number[]

    _mpegAudioV10SampleRateTable: number[]

    _mpegAudioV20SampleRateTable: number[]

    _mpegAudioV25SampleRateTable: number[]

    _mpegAudioL1BitRateTable: number[]

    _mpegAudioL2BitRateTable: number[]

    _mpegAudioL3BitRateTable: number[]

    _videoTrack: videoTrack

    _audioTrack: audioTrack

    _onError: Function | null

    eventEmitter: EventEmitter

    remuxer: MP4Remuxer

    config: Record<string, any>

    constructor(data: ArrayBuffer, emitter: EventEmitter, config: Record<string, any>) {
        const probeData: ProbeData = FLVDemuxer.probe(data);
        this.eventEmitter = emitter;
        this.Tag = 'FLVCodec';
        this.type = 'FLVCodec';
        this.config = config;
        this.remuxer = new MP4Remuxer(this.eventEmitter, this.config);

        this._onError = null;

        this._dataOffset = probeData.dataOffset;
        this._firstParse = true;
        this._dispatch = false;

        this._hasAudio = probeData.hasAudioTrack;
        this._hasVideo = probeData.hasVideoTrack;

        this._hasAudioFlagOverrided = false;
        this._hasVideoFlagOverrided = false;

        this._audioInitialMetadataDispatched = false;
        this._videoInitialMetadataDispatched = false;

        this._mediaInfo = new MediaInfo();
        this._mediaInfo.hasAudio = this._hasAudio;
        this._mediaInfo.hasVideo = this._hasVideo;
        this._metadata = null;
        this._audioMetadata = null;
        this._videoMetadata = null;

        this._naluLengthSize = 4;
        this._timestampBase = 0; // int32, in milliseconds
        this._timescale = 1000;
        this._duration = 0; // int32, in milliseconds
        this._durationOverrided = false;
        this._referenceFrameRate = {
            fixed: true,
            fps: 23.976,
            fpsNum: 23976,
            fpsDen: 1000
        };

        this._flvSoundRateTable = [5500, 11025, 22050, 44100, 48000];

        this._mpegSamplingRates = [
            96000,
            88200,
            64000,
            48000,
            44100,
            32000,
            24000,
            22050,
            16000,
            12000,
            11025,
            8000,
            7350
        ];
        // 音频采样率解释 https://baike.baidu.com/item/%E9%9F%B3%E9%A2%91%E9%87%87%E6%A0%B7%E7%8E%87/9023551?fr=aladdin
        this._mpegAudioV10SampleRateTable = [44100, 48000, 32000, 0];
        this._mpegAudioV20SampleRateTable = [22050, 24000, 16000, 0];
        this._mpegAudioV25SampleRateTable = [11025, 12000, 8000, 0];

        this._mpegAudioL1BitRateTable = [
            0,
            32,
            64,
            96,
            128,
            160,
            192,
            224,
            256,
            288,
            320,
            352,
            384,
            416,
            448,
            -1
        ];
        this._mpegAudioL2BitRateTable = [
            0,
            32,
            48,
            56,
            64,
            80,
            96,
            112,
            128,
            160,
            192,
            224,
            256,
            320,
            384,
            -1
        ];
        this._mpegAudioL3BitRateTable = [
            0,
            32,
            40,
            48,
            56,
            64,
            80,
            96,
            112,
            128,
            160,
            192,
            224,
            256,
            320,
            -1
        ];

        this._videoTrack = {
            type: 'video', id: 1, sequenceNumber: 0, samples: [], length: 0
        };
        this._audioTrack = {
            type: 'audio', id: 2, sequenceNumber: 0, samples: [], length: 0
        };

        const getLittleEndian = () => {
            const buf: ArrayBuffer = new ArrayBuffer(2);
            new DataView(buf).setInt16(0, 256, true); // little-endian write
            return new Int16Array(buf)[0] === 256; // platform-spec read, if equal then LE
        };
        this._littleEndian = getLittleEndian();
    }

    /**
     * 添加数据
     * @param chunk loader给的数据
     */
    parseChunks(chunk: ArrayBuffer, byteStart: number): number {
        let offset = 0;
        const le = this._littleEndian;

        if(byteStart === 0) {
            // FLV header 部分的 buffer
            if(chunk.byteLength > 13) {
                const probeData: ProbeData = FLVDemuxer.probe(chunk);
                offset = probeData.dataOffset || 0;
            } else {
                return 0;
            }
        }

        if(this._firstParse) {
            // handle PreviousTagSize0 before Tag1
            this._firstParse = false;
            if(byteStart + offset !== this._dataOffset) {
                Log.warn(this.Tag, 'First time parsing but chunk byteStart invalid!');
            }

            const v = new DataView(chunk, offset);
            const prevTagSize0 = v.getUint32(0, !le);
            if(prevTagSize0 !== 0) {
                Log.warn(this.Tag, 'PrevTagSize0 !== 0 !!!');
            }
            offset += 4;
        }
        while(offset < chunk.byteLength) {
            this._dispatch = true;

            const v = new DataView(chunk, offset);

            if(offset + 11 + 4 > chunk.byteLength) {
                // 数据不全
                break;
            }

            const tagType = v.getUint8(0);
            const dataSize = v.getUint32(0, !le) & 0x00ffffff;

            if(offset + 11 + dataSize + 4 > chunk.byteLength) {
                // 数据不全
                break;
            }

            if(tagType !== 8 && tagType !== 9 && tagType !== 18) {
                // 没有需要的类型
                Log.warn(this.Tag, `Unsupported tag type ${tagType}, skipped`);
                offset += 11 + dataSize + 4;
                continue;
            }

            const ts2 = v.getUint8(4);
            const ts1 = v.getUint8(5);
            const ts0 = v.getUint8(6);
            const ts3 = v.getUint8(7);

            const timestamp = ts0 | (ts1 << 8) | (ts2 << 16) | (ts3 << 24);

            const streamId = v.getUint32(7, !le) & 0x00ffffff;
            if(streamId !== 0) {
                Log.warn(this.Tag, 'Meet tag which has StreamID != 0!');
            }

            const dataOffset = offset + 11;

            switch(tagType) {
            case 8: // Audio
                this._parseAudioData(chunk, dataOffset, dataSize, timestamp);
                break;
            case 9: // Video
                this._parseVideoData(chunk, dataOffset, dataSize, timestamp, byteStart + offset);
                break;
            case 18: // ScriptDataObject
                this._parseScriptData(chunk, dataOffset, dataSize);
                break;
            default:
                Log.warn(this.Tag, `Unsupported tag type ${tagType}, skipped`);
                offset += 11 + dataSize + 4;
                break;
            }

            const prevTagSize = v.getUint32(11 + dataSize, !le);

            if(prevTagSize !== 11 + dataSize) {
                Log.warn(this.Tag, `Invalid PrevTagSize ${prevTagSize}`);
            }

            offset += 11 + dataSize + 4; // tagBody + dataSize + prevTagSize
        }
        // 解析后的数据帧 传递给MP4编码器
        if(this._isInitialMetadataDispatched()) {
            if(this._dispatch && (this._audioTrack.length || this._videoTrack.length)) {
                this.remuxer.remux(this._audioTrack, this._videoTrack);
            }
        }
        return offset;
    }

    // script数据包解析
    _parseScriptData(arrayBuffer: ArrayBuffer, dataOffset: number, dataSize: number) {
        const scriptData = AMF.parseScriptData(arrayBuffer, dataOffset, dataSize);

        if(scriptData.onMetaData !== undefined) {
            if(scriptData.onMetaData == null || typeof scriptData.onMetaData !== 'object') {
                Log.warn(this.Tag, 'Invalid onMetaData structure!');
                return;
            }
            if(this._metadata) {
                Log.warn(this.Tag, 'Found another onMetaData tag!');
            }
            this._metadata = scriptData;
            const { onMetaData } = scriptData;
            this.eventEmitter.emit(Events.MEDIA_DATA_ARRIVED, { ...onMetaData });

            if(typeof onMetaData.hasAudio === 'boolean') {
                // hasAudio
                if(this._hasAudioFlagOverrided === false) {
                    this._hasAudio = onMetaData.hasAudio;
                    this._mediaInfo.hasAudio = this._hasAudio;
                }
            }
            if(typeof onMetaData.hasVideo === 'boolean') {
                // hasVideo
                if(this._hasVideoFlagOverrided === false) {
                    this._hasVideo = onMetaData.hasVideo;
                    this._mediaInfo.hasVideo = this._hasVideo;
                }
            }
            if(typeof onMetaData.audiodatarate === 'number') {
                // audiodatarate
                this._mediaInfo.audioDataRate = onMetaData.audiodatarate;
            }
            if(typeof onMetaData.videodatarate === 'number') {
                // videodatarate
                this._mediaInfo.videoDataRate = onMetaData.videodatarate;
            }
            if(typeof onMetaData.width === 'number') {
                // width
                this._mediaInfo.width = onMetaData.width;
            }
            if(typeof onMetaData.height === 'number') {
                // height
                this._mediaInfo.height = onMetaData.height;
            }
            if(typeof onMetaData.duration === 'number') {
                // duration
                if(!this._durationOverrided) {
                    const duration = Math.floor(onMetaData.duration * this._timescale);
                    this._duration = duration;
                    this._mediaInfo.duration = duration;
                }
            } else {
                this._mediaInfo.duration = 0;
            }
            if(typeof onMetaData.framerate === 'number') {
                // framerate
                const fpsNum = Math.floor(onMetaData.framerate * 1000);
                if(fpsNum > 0) {
                    const fps = fpsNum / 1000;
                    this._referenceFrameRate.fixed = true;
                    this._referenceFrameRate.fps = fps;
                    this._referenceFrameRate.fpsNum = fpsNum;
                    this._referenceFrameRate.fpsDen = 1000;
                    this._mediaInfo.fps = fps;
                }
            }
            if(typeof onMetaData.keyframes === 'object') {
                // keyframes
                this._mediaInfo.hasKeyframesIndex = true;
                const { keyframes } = onMetaData;
                this._mediaInfo.keyframesIndex = this._parseKeyframesIndex(keyframes);
                onMetaData.keyframes = null; // keyframes has been extracted, remove it
            } else {
                this._mediaInfo.hasKeyframesIndex = false;
            }
            this._dispatch = false;
            this._mediaInfo.metadata = onMetaData;
            Log.info(this.Tag, 'Parsed onMetaData');
            if(this._mediaInfo.isComplete()) {
                this.eventEmitter.emit(Events.MEDIA_INFO, this._mediaInfo);
            }
        }

        if(Object.keys(scriptData).length > 0) {
            this.eventEmitter.emit(Events.SCRIPT_DATA_ARRIVED, { ...scriptData });
        }
    }

    _parseKeyframesIndex(keyframes: KeyframesData) {
        const times = [];
        const filepositions = [];

        // ignore first keyframe which is actually AVC Sequence Header (AVCDecoderConfigurationRecord)
        for(let i = 1; i < keyframes.times.length; i++) {
            const time = this._timestampBase + Math.floor(keyframes.times[i] * 1000);
            times.push(time);
            filepositions.push(keyframes.filepositions[i]);
        }

        return { times, filepositions };
    }

    // audio数据包解析
    _parseAudioData(
        arrayBuffer: ArrayBuffer,
        dataOffset: number,
        dataSize: number,
        tagTimestamp: number
    ) {
        if(dataSize <= 1) {
            Log.warn(this.Tag, 'Flv: 无效的数据包, missing SoundData payload!');
            return;
        }

        if(this._hasAudioFlagOverrided === true && this._hasAudio === false) {
            // If hasAudio: false indicated explicitly in MediaDataSource,
            // 忽略所有音频数据包
            return;
        }

        const le = this._littleEndian;
        const v = new DataView(arrayBuffer, dataOffset, dataSize);

        const soundSpec = v.getUint8(0);

        const soundFormat = soundSpec >>> 4;
        if(soundFormat !== 2 && soundFormat !== 10) {
            // MP3 or AAC
            this.eventEmitter.emit(Events.ERROR, {
                type: ErrorTypes.MUX_ERROR,
                details: ErrorDetails.CODEC_UNSUPPORTED,
                fatal: false,
                reason: `Flv: 不支持的类型 idx: ${soundFormat}`
            });
            return;
        }

        let soundRate = 0;
        const soundRateIndex = (soundSpec & 12) >>> 2;
        if(soundRateIndex >= 0 && soundRateIndex <= 4) {
            soundRate = this._flvSoundRateTable[soundRateIndex];
        } else {
            this.eventEmitter.emit(Events.ERROR, {
                type: ErrorTypes.MUX_ERROR,
                details: ErrorDetails.FORMAT_ERROR,
                fatal: false,
                reason: `Flv: 音频采样率无效 idx: ${soundRateIndex}`
            });
            return;
        }

        const soundSize = (soundSpec & 2) >>> 1; // unused
        const soundType = soundSpec & 1;

        let meta: any = this._audioMetadata;
        const track = this._audioTrack;
        if(!meta) {
            if(this._hasAudio === false && this._hasAudioFlagOverrided === false) {
                this._hasAudio = true;
                this._mediaInfo.hasAudio = true;
            }

            // initial metadata
            this._audioMetadata = Object.create(null);
            meta = this._audioMetadata;
            meta.type = 'audio';
            meta.id = track.id;
            meta.timescale = this._timescale;
            meta.duration = this._duration;
            meta.audioSampleRate = soundRate;
            meta.channelCount = soundType === 0 ? 1 : 2;
        }

        if(soundFormat === 10) {
            // AAC 格式的音频
            const aacData: AacAudioDataPacket | undefined = this._parseAACAudioData(
                arrayBuffer,
                dataOffset + 1,
                dataSize - 1
            );
            if(aacData === undefined) {
                return;
            }

            if(aacData.packetType === 0) {
                // AAC sequence header (AudioSpecificConfig)
                if(meta.config) {
                    Log.warn(this.Tag, 'Found another AudioSpecificConfig!');
                }
                if(aacData.type === 'object') {
                    const misc = <AacAudioData>aacData.data;
                    meta.audioSampleRate = misc.samplingRate;
                    meta.channelCount = misc.channelCount;
                    meta.codec = misc.codec;
                    meta.originalCodec = misc.originalCodec;
                    meta.config = misc.config;
                    // The decode result of an aac sample is 1024 PCM samples
                    const sampleRate = meta.audioSampleRate || 0;
                    const timescale = meta.timescale || 0;
                    meta.refSampleDuration = (1024 / sampleRate) * timescale;
                    Log.info(this.Tag, 'Parsed AudioSpecificConfig');

                    if(this._isInitialMetadataDispatched()) {
                        // Non-initial metadata, force dispatch (or flush) parsed frames to remuxer
                        if(
                            this._dispatch
                            && (this._audioTrack.length || this._videoTrack.length)
                        ) {
                            this.remuxer.remux(this._audioTrack, this._videoTrack);
                        }
                    } else {
                        this._audioInitialMetadataDispatched = true;
                    }
                    // then notify new metadata
                    this._dispatch = false;
                    this.remuxer._onTrackMetadataReceived('audio', meta);

                    const mi: MediaInfo = this._mediaInfo;
                    mi.audioCodec = meta.originalCodec;
                    mi.audioSampleRate = meta.audioSampleRate;
                    mi.audioChannelCount = meta.channelCount;
                    if(mi.hasVideo) {
                        if(mi.videoCodec != null) {
                            mi.mimeType = `video/x-flv; codecs="${mi.videoCodec},${mi.audioCodec}"`;
                        }
                    } else {
                        mi.mimeType = `video/x-flv; codecs="${mi.audioCodec}"`;
                    }
                    if(mi.isComplete()) {
                        this.eventEmitter.emit(Events.MEDIA_INFO, mi);
                    }
                }
            } else if(aacData.packetType === 1) {
                // AAC raw frame data
                const aacDataUnitArray = <Uint8Array>aacData.data;
                const dts = this._timestampBase + tagTimestamp;
                const aacSample = {
                    unit: aacDataUnitArray,
                    length: aacDataUnitArray.byteLength,
                    dts,
                    pts: dts,
                    cts: 0,
                };
                track.samples.push(aacSample);
                track.length += aacDataUnitArray.length;
            } else {
                Log.error(this.Tag, `Flv: Unsupported AAC data type ${aacData.packetType}`);
            }
        } else if(soundFormat === 2) {
            // 处理MP3格式的音频
            if(!meta.codec) {
                // We need metadata for mp3 audio track, extract info from frame header
                const misc: Mp3AudioData | Uint8Array | undefined = this._parseMP3AudioData(
                    arrayBuffer,
                    dataOffset + 1,
                    dataSize - 1,
                    true
                );
                if(misc === undefined || misc instanceof Uint8Array) {
                    return;
                }
                meta.audioSampleRate = misc.samplingRate;
                meta.channelCount = misc.channelCount;
                meta.codec = misc.codec;
                meta.originalCodec = misc.originalCodec;
                // The decode result of an mp3 sample is 1152 PCM samples
                const sampleRate2 = meta.audioSampleRate || 0;
                const timescale2 = meta.timescale || 0;
                meta.refSampleDuration = (1152 / sampleRate2) * timescale2;
                Log.info(this.Tag, 'Parsed MPEG Audio Frame Header');
                this._audioInitialMetadataDispatched = true;
                this.remuxer._onTrackMetadataReceived('audio', meta);
                const mi = this._mediaInfo;
                mi.audioCodec = meta.codec;
                mi.audioSampleRate = meta.audioSampleRate;
                mi.audioChannelCount = meta.channelCount;
                mi.audioDataRate = misc.bitRate;
                if(mi.hasVideo) {
                    if(mi.videoCodec != null) {
                        mi.mimeType = `video/x-flv; codecs="${mi.videoCodec},${mi.audioCodec}"`;
                    }
                } else {
                    mi.mimeType = `video/x-flv; codecs="${mi.audioCodec}"`;
                }
                if(mi.isComplete()) {
                    this.eventEmitter.emit(Events.MEDIA_INFO, mi);
                }
            }

            // This packet is always a valid audio packet, extract it
            const data: Mp3AudioData | Uint8Array | undefined = this._parseMP3AudioData(
                arrayBuffer,
                dataOffset + 1,
                dataSize - 1,
                false
            );
            if(data === undefined || !(data instanceof Uint8Array)) {
                return;
            }
            const dts = this._timestampBase + tagTimestamp;
            const mp3Sample = {
                unit: data, length: data.byteLength, dts, pts: dts, cts: 0,
            };
            track.samples.push(mp3Sample);
            track.length += data.length;
        }
    }

    _parseAACAudioData(
        arrayBuffer: ArrayBuffer,
        dataOffset: number,
        dataSize: number
    ): AacAudioDataPacket | undefined {
        if(dataSize <= 1) {
            Log.warn(this.Tag, 'Flv: Invalid AAC packet, missing AACPacketType or/and Data!');
            return;
        }

        const result = Object.create(null);
        const array = new Uint8Array(arrayBuffer, dataOffset, dataSize);

        result.packetType = array[0];

        if(array[0] === 0) {
            result.type = 'object';
            result.data = this._parseAACAudioSpecificConfig(
                arrayBuffer,
                dataOffset + 1,
                dataSize - 1
            );
        } else {
            result.type = 'Unit8Array';
            result.data = array.subarray(1);
        }

        return result;
    }

    _parseAACAudioSpecificConfig(arrayBuffer: ArrayBuffer, dataOffset: number, dataSize: number) {
        const array = new Uint8Array(arrayBuffer, dataOffset, dataSize);
        let config = null;

        /* Audio Object Type:
           0: Null
           1: AAC Main
           2: AAC LC
           3: AAC SSR (Scalable Sample Rate)
           4: AAC LTP (Long Term Prediction)
           5: HE-AAC / SBR (Spectral Band Replication)
           6: AAC Scalable
        */

        let audioObjectType = 0;
        let originalAudioObjectType = 0;
        // let audioExtensionObjectType = null;
        let samplingIndex = 0;
        let extensionSamplingIndex = null;

        // 5 bits
        originalAudioObjectType = array[0] >>> 3;
        audioObjectType = originalAudioObjectType;
        // 4 bits
        samplingIndex = ((array[0] & 0x07) << 1) | (array[1] >>> 7);

        if(samplingIndex < 0 || samplingIndex >= this._mpegSamplingRates.length) {
            this.eventEmitter.emit(Events.ERROR, {
                type: ErrorTypes.MUX_ERROR,
                details: ErrorDetails.FORMAT_ERROR,
                fatal: false,
                reason: 'Flv: AAC invalid sampling frequency index!'
            });
            return;
        }

        const samplingFrequence = this._mpegSamplingRates[samplingIndex];

        // 4 bits
        const channelConfig = (array[1] & 0x78) >>> 3;
        if(channelConfig < 0 || channelConfig >= 8) {
            this.eventEmitter.emit(Events.ERROR, {
                type: ErrorTypes.MUX_ERROR,
                details: ErrorDetails.FORMAT_ERROR,
                fatal: false,
                reason: 'Flv: AAC invalid channel configuration'
            });
            return;
        }

        if(audioObjectType === 5) {
            // HE-AAC?
            // 4 bits
            extensionSamplingIndex = ((array[1] & 0x07) << 1) | (array[2] >>> 7);
            // 5 bits
            // const audioExtensionObjectType = (array[2] & 0x7c) >>> 2
        }

        // workarounds for various browsers
        const userAgent = GG.navigator.userAgent.toLowerCase();

        if(userAgent.indexOf('firefox') !== -1) {
            // firefox: use SBR (HE-AAC) if freq less than 24kHz
            if(samplingIndex >= 6) {
                audioObjectType = 5;
                config = new Array(4);
                extensionSamplingIndex = samplingIndex - 3;
            } else {
                // use LC-AAC
                audioObjectType = 2;
                config = new Array(2);
                extensionSamplingIndex = samplingIndex;
            }
        } else if(userAgent.indexOf('android') !== -1) {
            // android: always use LC-AAC
            audioObjectType = 2;
            config = new Array(2);
            extensionSamplingIndex = samplingIndex;
        } else {
            // for other browsers, e.g. chrome...
            // Always use HE-AAC to make it easier to switch aac codec profile
            audioObjectType = 5;
            extensionSamplingIndex = samplingIndex;
            config = new Array(4);

            if(samplingIndex >= 6) {
                extensionSamplingIndex = samplingIndex - 3;
            } else if(channelConfig === 1) {
                // Mono channel
                audioObjectType = 2;
                config = new Array(2);
                extensionSamplingIndex = samplingIndex;
            }
        }

        config[0] = audioObjectType << 3;
        config[0] |= (samplingIndex & 0x0f) >>> 1;
        config[1] = (samplingIndex & 0x0f) << 7;
        config[1] |= (channelConfig & 0x0f) << 3;
        if(audioObjectType === 5) {
            config[1] |= (extensionSamplingIndex & 0x0f) >>> 1;
            config[2] = (extensionSamplingIndex & 0x01) << 7;
            // extended audio object type: force to 2 (LC-AAC)
            config[2] |= 2 << 2;
            config[3] = 0;
        }

        return {
            config,
            samplingRate: samplingFrequence,
            channelCount: channelConfig,
            codec: `mp4a.40.${audioObjectType}`,
            originalCodec: `mp4a.40.${originalAudioObjectType}`
        };
    }

    _parseMP3AudioData(
        arrayBuffer: ArrayBuffer,
        dataOffset: number,
        dataSize: number,
        requestHeader: boolean
    ): Mp3AudioData | Uint8Array | undefined {
        if(dataSize < 4) {
            Log.warn(this.Tag, 'Flv: Invalid MP3 packet, header missing!');
            return;
        }

        const le = this._littleEndian;
        const array = new Uint8Array(arrayBuffer, dataOffset, dataSize);
        let result = null;

        if(requestHeader) {
            if(array[0] !== 0xff) {
                return;
            }
            const ver = (array[1] >>> 3) & 0x03;
            const layer = (array[1] & 0x06) >> 1;

            const bitrateIndex = (array[2] & 0xf0) >>> 4;
            const samplingFreqIndex = (array[2] & 0x0c) >>> 2;

            const channelMode = (array[3] >>> 6) & 0x03;
            const channelCount = channelMode !== 3 ? 2 : 1;

            let sampleRate = 0;
            let bitRate = 0;
            let objectType = 34; // Layer-3, listed in MPEG-4 Audio Object Types

            const codec = 'mp3';

            switch(ver) {
            case 0: // MPEG 2.5
                sampleRate = this._mpegAudioV25SampleRateTable[samplingFreqIndex];
                break;
            case 2: // MPEG 2
                sampleRate = this._mpegAudioV20SampleRateTable[samplingFreqIndex];
                break;
            case 3: // MPEG 1
                sampleRate = this._mpegAudioV10SampleRateTable[samplingFreqIndex];
                break;
            default:
                sampleRate = this._mpegAudioV25SampleRateTable[samplingFreqIndex];
                break;
            }

            switch(layer) {
            case 1: // Layer 3
                objectType = 34;
                if(bitrateIndex < this._mpegAudioL3BitRateTable.length) {
                    bitRate = this._mpegAudioL3BitRateTable[bitrateIndex];
                }
                break;
            case 2: // Layer 2
                objectType = 33;
                if(bitrateIndex < this._mpegAudioL2BitRateTable.length) {
                    bitRate = this._mpegAudioL2BitRateTable[bitrateIndex];
                }
                break;
            case 3: // Layer 1
                objectType = 32;
                if(bitrateIndex < this._mpegAudioL1BitRateTable.length) {
                    bitRate = this._mpegAudioL1BitRateTable[bitrateIndex];
                }
                break;
            default:
                objectType = 34;
                if(bitrateIndex < this._mpegAudioL3BitRateTable.length) {
                    bitRate = this._mpegAudioL3BitRateTable[bitrateIndex];
                }
                break;
            }

            result = {
                bitRate,
                samplingRate: sampleRate,
                channelCount,
                codec,
                originalCodec: codec
            };
        } else {
            result = array;
        }

        return result;
    }

    _parseVideoData(
        arrayBuffer: ArrayBuffer,
        dataOffset: number,
        dataSize: number,
        tagTimestamp: number,
        tagPosition: number
    ) {
        if(dataSize <= 1) {
            Log.warn(this.Tag, 'Flv: Invalid video packet, missing VideoData payload!');
            return;
        }

        if(this._hasVideoFlagOverrided === true && this._hasVideo === false) {
            // If hasVideo: false indicated explicitly in MediaDataSource,
            // Ignore all the video packets
            return;
        }

        const spec = new Uint8Array(arrayBuffer, dataOffset, dataSize)[0];

        const frameType = (spec & 240) >>> 4;
        const codecId = spec & 15;

        if(codecId !== 7) {
            this.eventEmitter.emit(Events.ERROR, ErrorTypes.MUX_ERROR, {
                type: ErrorTypes.MUX_ERROR,
                code: -1,
                details: ErrorDetails.CODEC_UNSUPPORTED,
                fatal: false,
                reason: `Flv: Unsupported codec in video frame: ${codecId}`,
            });
            return;
        }

        this._parseAVCVideoPacket(
            arrayBuffer,
            dataOffset + 1,
            dataSize - 1,
            tagTimestamp,
            tagPosition,
            frameType
        );
    }

    _parseAVCVideoPacket(
        arrayBuffer: ArrayBuffer,
        dataOffset: number,
        dataSize: number,
        tagTimestamp: number,
        tagPosition: number,
        frameType: number
    ) {
        if(dataSize < 4) {
            Log.warn(
                this.Tag,
                'Flv: Invalid AVC packet, missing AVCPacketType or/and CompositionTime'
            );
            return;
        }

        const le = this._littleEndian;
        const v = new DataView(arrayBuffer, dataOffset, dataSize);

        const packetType = v.getUint8(0);
        const ctsUnsigned = v.getUint32(0, !le) & 0x00ffffff;
        const cts = (ctsUnsigned << 8) >> 8; // convert to 24-bit signed int

        if(packetType === 0) {
            // AVCDecoderConfigurationRecord
            this._parseAVCDecoderConfigurationRecord(arrayBuffer, dataOffset + 4, dataSize - 4);
        } else if(packetType === 1) {
            // One or more Nalus
            this._parseAVCVideoData(
                arrayBuffer,
                dataOffset + 4,
                dataSize - 4,
                tagTimestamp,
                tagPosition,
                frameType,
                cts
            );
        } else if(packetType === 2) {
            // empty, AVC end of sequence
        } else {
            this.eventEmitter.emit(Events.ERROR, {
                type: ErrorTypes.MUX_ERROR,
                details: ErrorDetails.FORMAT_ERROR,
                fatal: false,
                reason: `Flv: Invalid video packet type ${packetType}`
            });
        }
    }

    _parseAVCDecoderConfigurationRecord(
        arrayBuffer: ArrayBuffer,
        dataOffset: number,
        dataSize: number
    ) {
        if(dataSize < 7) {
            Log.warn(this.Tag, 'Flv: Invalid AVCDecoderConfigurationRecord, lack of data!');
            return;
        }

        let meta: any = this._videoMetadata;
        const track = this._videoTrack;
        const le = this._littleEndian;
        const v = new DataView(arrayBuffer, dataOffset, dataSize);
        if(!meta) {
            if(this._hasVideo === false && this._hasVideoFlagOverrided === false) {
                this._hasVideo = true;
                this._mediaInfo.hasVideo = true;
            }
            this._videoMetadata = Object.create(null);
            meta = this._videoMetadata;
            meta.type = 'video';
            meta.id = track.id;
            meta.timescale = this._timescale;
            meta.duration = this._duration;
        } else if(typeof meta.avcc !== 'undefined') {
            Log.warn(this.Tag, 'Found another AVCDecoderConfigurationRecord!');
        }

        const version = v.getUint8(0); // configurationVersion
        const avcProfile = v.getUint8(1); // avcProfileIndication
        const profileCompatibility = v.getUint8(2); // profile_compatibility
        const avcLevel = v.getUint8(3); // AVCLevelIndication

        if(version !== 1 || avcProfile === 0) {
            this.eventEmitter.emit(Events.ERROR, {
                type: ErrorTypes.MUX_ERROR,
                details: ErrorDetails.FORMAT_ERROR,
                fatal: false,
                reason: 'Flv: Invalid AVCDecoderConfigurationRecord'
            });
            return;
        }

        this._naluLengthSize = (v.getUint8(4) & 3) + 1; // lengthSizeMinusOne
        if(this._naluLengthSize !== 3 && this._naluLengthSize !== 4) {
            // holy shit!!!
            this.eventEmitter.emit(Events.ERROR, {
                type: ErrorTypes.MUX_ERROR,
                details: ErrorDetails.FORMAT_ERROR,
                fatal: false,
                reason: `Flv: Strange NaluLengthSizeMinusOne: ${this._naluLengthSize - 1}`
            });
            return;
        }

        const spsCount = v.getUint8(5) & 31; // numOfSequenceParameterSets
        if(spsCount === 0) {
            this.eventEmitter.emit(Events.ERROR, {
                type: ErrorTypes.MUX_ERROR,
                details: ErrorDetails.FORMAT_ERROR,
                fatal: false,
                reason: 'Flv: Invalid AVCDecoderConfigurationRecord: No SPS'
            });
            return;
        } if(spsCount > 1) {
            Log.warn(
                this.Tag,
                `Flv: Strange AVCDecoderConfigurationRecord: SPS Count = ${spsCount}`
            );
        }

        let offset = 6;

        for(let i = 0; i < spsCount; i++) {
            const len = v.getUint16(offset, !le); // sequenceParameterSetLength
            offset += 2;

            if(len === 0) {
                continue;
            }

            // Notice: Nalu without startcode header (00 00 00 01)
            const sps = new Uint8Array(arrayBuffer, dataOffset + offset, len);
            offset += len;

            const config = SPSParser.parseSPS(sps);
            if(i !== 0) {
                // ignore other sps's config
                continue;
            }

            meta.codecWidth = config.codecSize.width;
            meta.codecHeight = config.codecSize.height;
            meta.presentWidth = config.presentSize.width;
            meta.presentHeight = config.presentSize.height;

            meta.profile = config.profileString;
            meta.level = config.levelString;
            meta.bitDepth = config.bitDepth;
            meta.chromaFormat = config.chromaFormat;
            meta.sarRatio = config.sarRatio;
            meta.frameRate = config.frameRate;

            if(
                config.frameRate.fixed === false
                || config.frameRate.fpsNum === 0
                || config.frameRate.fpsDen === 0
            ) {
                meta.frameRate = this._referenceFrameRate;
            }
            const { frameRate } = meta;
            const { fpsDen } = frameRate;
            const { fpsNum } = frameRate;
            meta.refSampleDuration = meta.timescale * (fpsDen / fpsNum);

            const codecArray = sps.subarray(1, 4);
            let codecString = 'avc1.';
            for(let j = 0; j < 3; j++) {
                let h = codecArray[j].toString(16);
                if(h.length < 2) {
                    h = `0${h}`;
                }
                codecString += h;
            }
            meta.codec = codecString;

            const mi = this._mediaInfo;
            mi.width = meta.codecWidth;
            mi.height = meta.codecHeight;
            mi.fps = meta.frameRate.fps;
            mi.profile = meta.profile;
            mi.level = meta.level;
            mi.refFrames = config.refFrames;
            mi.chromaFormat = config.chromaFormatString;
            const { sarRatio } = meta;
            mi.sarNum = sarRatio.width;
            mi.sarDen = sarRatio.height;
            mi.videoCodec = codecString;

            if(mi.hasAudio) {
                if(mi.audioCodec != null) {
                    mi.mimeType = `video/x-flv; codecs="${mi.videoCodec},${mi.audioCodec}"`;
                }
            } else {
                mi.mimeType = `video/x-flv; codecs="${mi.videoCodec}"`;
            }
            if(mi.isComplete()) {
                this.eventEmitter.emit(Events.MEDIA_INFO, mi);
            }
        }

        const ppsCount = v.getUint8(offset); // numOfPictureParameterSets

        if(ppsCount === 0) {
            this.eventEmitter.emit(Events.ERROR, {
                type: ErrorTypes.MUX_ERROR,
                details: ErrorDetails.FORMAT_ERROR,
                fatal: false,
                reason: 'Flv: Invalid AVCDecoderConfigurationRecord: No PPS'
            });
            return;
        } if(ppsCount > 1) {
            Log.warn(
                this.Tag,
                `Flv: Strange AVCDecoderConfigurationRecord: PPS Count = ${ppsCount}`
            );
        }

        offset++;

        for(let i = 0; i < ppsCount; i++) {
            const len = v.getUint16(offset, !le); // pictureParameterSetLength
            offset += 2;

            if(len === 0) {
                continue;
            }

            // pps is useless for extracting video information
            offset += len;
        }

        meta.avcc = new Uint8Array(dataSize);
        meta.avcc.set(new Uint8Array(arrayBuffer, dataOffset, dataSize), 0);
        Log.info(this.Tag, 'Parsed AVCDecoderConfigurationRecord');

        if(this._isInitialMetadataDispatched()) {
            // flush parsed frames
            if(this._dispatch && (this._audioTrack.length || this._videoTrack.length)) {
                this.remuxer.remux(this._audioTrack, this._videoTrack);
            }
        } else {
            this._videoInitialMetadataDispatched = true;
        }
        // notify new metadata
        this._dispatch = false;
        this.remuxer._onTrackMetadataReceived('video', meta);
    }

    // 解析NALU
    _parseAVCVideoData(
        arrayBuffer: ArrayBuffer,
        dataOffset: number,
        dataSize: number,
        tagTimestamp: number,
        tagPosition: number,
        frameType: number,
        cts: number
    ) {
        const le = this._littleEndian;
        const v = new DataView(arrayBuffer, dataOffset, dataSize);

        const units: Array<NALUnit> = [];
        let length = 0;

        let offset = 0;
        const lengthSize = this._naluLengthSize;
        const dts = this._timestampBase + tagTimestamp;
        let isKeyframe = frameType === 1; // from FLV Frame Type constants

        while(offset < dataSize) {
            if(offset + 4 >= dataSize) {
                Log.warn(
                    this.Tag,
                    `Malformed Nalu near timestamp ${dts}, offset = ${offset}, dataSize = ${dataSize}`
                );
                break; // data not enough for next Nalu
            }
            // Nalu with length-header (AVC1)
            let naluSize = v.getUint32(offset, !le); // Big-Endian read
            if(lengthSize === 3) {
                naluSize >>>= 8;
            }
            if(naluSize > dataSize - lengthSize) {
                Log.warn(this.Tag, `Malformed Nalus near timestamp ${dts}, NaluSize > DataSize!`);
                return;
            }

            const unitType = v.getUint8(offset + lengthSize) & 0x1f;

            if(unitType === 5) {
                // IDR
                isKeyframe = true;
            }

            const data = new Uint8Array(arrayBuffer, dataOffset + offset, lengthSize + naluSize);
            const unit: NALUnit = { type: unitType, data };
            if(unit.type === 6) {
                // 获取到SEI信息
                try {
                    const unitArray: Uint8Array = data.subarray(lengthSize);
                    this.eventEmitter.emit(Events.GET_SEI_INFO, unitArray);
                } catch (e) {
                    Log.log(this.Tag, 'parse sei info error!');
                }
            }

            units.push(unit);
            length += data.byteLength;
            offset += lengthSize + naluSize;
        }

        if(units.length) {
            const track = this._videoTrack;
            const avcSample: AvcSampleData = {
                units,
                length,
                isKeyframe,
                dts,
                cts,
                pts: dts + cts
            };
            if(isKeyframe) {
                avcSample.fileposition = tagPosition;
            }
            track.samples.push(avcSample);
            track.length += length;
        }
    }

    //  探测数据是否支持解码
    static probe(data: ArrayBuffer) {
        const info: Uint8Array = new Uint8Array(data);
        const mismatch: { match: boolean } = { match: false };

        if(info[0] !== 0x46 || info[1] !== 0x4c || info[2] !== 0x56 || info[3] !== 0x01) {
            return mismatch;
        }

        const hasAudio = (info[4] & 4) >>> 2 !== 0;
        const hasVideo = (info[4] & 1) !== 0;

        const offset = ReadBig32(info, 5);

        if(offset < 9) {
            return mismatch;
        }

        return {
            match: true,
            consumed: offset,
            dataOffset: offset,
            hasAudioTrack: hasAudio,
            hasVideoTrack: hasVideo
        };
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

    destroy() {
        this.eventEmitter.removeAllListeners();
        delete this.eventEmitter;
    }

    // timestamp base for output samples, must be in milliseconds
    get timestampBase() {
        return this._timestampBase;
    }

    set timestampBase(base: number) {
        this._timestampBase = base;
    }

    get overridedDuration() {
        return this._duration;
    }

    // Force-override media duration. Must be in milliseconds, int32
    set overridedDuration(duration: number) {
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

    resetMediaInfo() {
        this._mediaInfo = new MediaInfo();
    }

    _isInitialMetadataDispatched() {
        if(this._hasAudio && this._hasVideo) {
            // both audio & video
            return this._audioInitialMetadataDispatched && this._videoInitialMetadataDispatched;
        }
        if(this._hasAudio && !this._hasVideo) {
            // audio only
            return this._audioInitialMetadataDispatched;
        }
        if(!this._hasAudio && this._hasVideo) {
            // video only
            return this._videoInitialMetadataDispatched;
        }
        return false;
    }

    insertDiscontinuity() {
        this.remuxer.insertDiscontinuity();
    }

    seek() {
        this.remuxer.seek();
    }

    flushStashedSamples() {
        this.remuxer.flushStashedSamples();
    }
}

export default FLVDemuxer;
