import { AudioMediaData } from '../Codecs/FLVCodec/interface';
declare class MediaInfo {
    mimeType: string | null;
    duration: number | null | undefined;
    hasAudio: boolean | null | undefined;
    hasVideo: boolean | null | undefined;
    audioCodec: string | null | undefined;
    videoCodec: string | null | undefined;
    audioDataRate: number | null;
    videoDataRate: number | null;
    audioSampleRate: number | null | undefined;
    audioChannelCount: number | null | undefined;
    width: number | null | undefined;
    height: number | null | undefined;
    fps: number | null;
    profile: string | null | undefined;
    level: string | null | undefined;
    refFrames: number | null;
    chromaFormat: string | null;
    sarNum: number | null;
    sarDen: number | null;
    metadata: AudioMediaData | null;
    segments: MediaInfo[] | null;
    segmentCount: number | null;
    hasKeyframesIndex: boolean | null;
    keyframesIndex: {
        times: number[];
        filepositions: number[];
    } | null;
    constructor();
    isComplete(): boolean;
    isSeekable(): boolean;
    getNearestKeyframe(milliseconds: number): {
        index: number;
        milliseconds: number;
        fileposition: number;
    } | null;
    _search(list: number[], value: number): number;
}
export default MediaInfo;
