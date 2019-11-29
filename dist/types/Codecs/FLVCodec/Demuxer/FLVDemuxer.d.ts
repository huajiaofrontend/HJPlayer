import EventEmitter from 'eventemitter3';
import { ScriptData, FrameRate, track, audioTrack, videoTrack, KeyframesData, AacAudioDataPacket, Mp3AudioData } from '../Interface';
import MediaInfo from '../../../Utils/media-info';
import MP4Remuxer from '../Remuxer/mp4-remuxer';
/**
 * FLV 文件解码器总输出
 */
declare class FLVDemuxer {
    Tag: string;
    type: string;
    _dataOffset: number | undefined;
    _littleEndian: boolean;
    _firstParse: boolean;
    _dispatch: boolean;
    _hasAudio: boolean | undefined;
    _hasVideo: boolean | undefined;
    _hasAudioFlagOverrided: boolean;
    _hasVideoFlagOverrided: boolean;
    _audioInitialMetadataDispatched: boolean;
    _videoInitialMetadataDispatched: boolean;
    _metadata: ScriptData | null;
    _mediaInfo: MediaInfo;
    _audioMetadata: track | null;
    _videoMetadata: track | null;
    _naluLengthSize: number;
    _timestampBase: number;
    _timescale: number;
    _duration: number;
    _durationOverrided: boolean;
    _referenceFrameRate: FrameRate;
    _flvSoundRateTable: number[];
    _mpegSamplingRates: number[];
    _mpegAudioV10SampleRateTable: number[];
    _mpegAudioV20SampleRateTable: number[];
    _mpegAudioV25SampleRateTable: number[];
    _mpegAudioL1BitRateTable: number[];
    _mpegAudioL2BitRateTable: number[];
    _mpegAudioL3BitRateTable: number[];
    _videoTrack: videoTrack;
    _audioTrack: audioTrack;
    _onError: Function | null;
    eventEmitter: EventEmitter;
    remuxer: MP4Remuxer;
    config: Record<string, any>;
    constructor(data: ArrayBuffer, emitter: EventEmitter, config: Record<string, any>);
    /**
     * 添加数据
     * @param chunk loader给的数据
     */
    parseChunks(chunk: ArrayBuffer, byteStart: number): number;
    _parseScriptData(arrayBuffer: ArrayBuffer, dataOffset: number, dataSize: number): void;
    _parseKeyframesIndex(keyframes: KeyframesData): {
        times: number[];
        filepositions: number[];
    };
    _parseAudioData(arrayBuffer: ArrayBuffer, dataOffset: number, dataSize: number, tagTimestamp: number): void;
    _parseAACAudioData(arrayBuffer: ArrayBuffer, dataOffset: number, dataSize: number): AacAudioDataPacket | undefined;
    _parseAACAudioSpecificConfig(arrayBuffer: ArrayBuffer, dataOffset: number, dataSize: number): {
        config: any[];
        samplingRate: number;
        channelCount: number;
        codec: string;
        originalCodec: string;
    } | undefined;
    _parseMP3AudioData(arrayBuffer: ArrayBuffer, dataOffset: number, dataSize: number, requestHeader: boolean): Mp3AudioData | Uint8Array | undefined;
    _parseVideoData(arrayBuffer: ArrayBuffer, dataOffset: number, dataSize: number, tagTimestamp: number, tagPosition: number): void;
    _parseAVCVideoPacket(arrayBuffer: ArrayBuffer, dataOffset: number, dataSize: number, tagTimestamp: number, tagPosition: number, frameType: number): void;
    _parseAVCDecoderConfigurationRecord(arrayBuffer: ArrayBuffer, dataOffset: number, dataSize: number): void;
    _parseAVCVideoData(arrayBuffer: ArrayBuffer, dataOffset: number, dataSize: number, tagTimestamp: number, tagPosition: number, frameType: number, cts: number): void;
    static probe(data: ArrayBuffer): {
        match: boolean;
    } | {
        match: boolean;
        consumed: number;
        dataOffset: number;
        hasAudioTrack: boolean;
        hasVideoTrack: boolean;
    };
    on(eventName: string, callback: EventEmitter.ListenerFn): void;
    once(eventName: string, callback: EventEmitter.ListenerFn): void;
    off(eventName: string, callback?: EventEmitter.ListenerFn): void;
    destroy(): void;
    timestampBase: number;
    overridedDuration: number;
    overridedHasAudio: boolean;
    overridedHasVideo: boolean;
    resetMediaInfo(): void;
    _isInitialMetadataDispatched(): boolean;
    insertDiscontinuity(): void;
    seek(): void;
    flushStashedSamples(): void;
}
export default FLVDemuxer;
