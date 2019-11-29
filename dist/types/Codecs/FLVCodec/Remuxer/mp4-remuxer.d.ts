import EventEmitter from 'eventemitter3';
import { MediaSegmentInfoList } from './media-segment-info';
import { track, audioTrack, videoTrack, aacSample, AvcSampleData } from '../Interface';
declare class MP4Remuxer {
    TAG: string;
    emitter: EventEmitter;
    _config: Record<string, any>;
    _isLive: boolean;
    _dtsBase: number;
    _dtsBaseInited: boolean;
    _audioDtsBase: number;
    _videoDtsBase: number;
    _audioNextDts: number | undefined;
    _videoNextDts: number | undefined;
    _audioStashedLastSample: aacSample | null;
    _videoStashedLastSample: AvcSampleData | null;
    _audioMeta: track | null;
    _videoMeta: track | null;
    _audioSegmentInfoList: MediaSegmentInfoList | null;
    _videoSegmentInfoList: MediaSegmentInfoList | null;
    _onInitSegment: null;
    _onMediaSegment: null;
    _forceFirstIDR: boolean;
    _fillSilentAfterSeek: boolean;
    _mp3UseMpegAudio: boolean;
    _fillAudioTimestampGap: boolean;
    _audioNextRefDts: any;
    constructor(emitter: EventEmitter, config: Record<string, any>);
    destroy(): void;
    insertDiscontinuity(): void;
    seek(): void;
    remux(audioTrack: audioTrack, videoTrack: videoTrack): void;
    _onTrackMetadataReceived(type: string, metadata: track): void;
    /**
     * 从音频序列和视频序列中取他们第一个sample的dts比较, 最小的为dts基准值
     * @param audioTrack 音频序列
     * @param videoTrack 视频序列
     */
    _calculateDtsBase(audioTrack: audioTrack, videoTrack: videoTrack): void;
    flushStashedSamples(): void;
    _remuxAudio(audioTrack: audioTrack, force?: boolean): void;
    _remuxVideo(videoTrack: videoTrack, force?: boolean): void;
    /**
     * 将两个MP4 BOX合并成一个 Uint8Array 并返回
     * @param moof moof 盒子
     * @param mdat mdat盒子
     */
    _mergeBoxes(moof: Uint8Array, mdat: Uint8Array): Uint8Array;
}
export default MP4Remuxer;
