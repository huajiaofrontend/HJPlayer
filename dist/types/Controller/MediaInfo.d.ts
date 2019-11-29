import { KeyframeData, MediaKeyframe } from '../Interfaces/MediaInfo';
import Metadata from '../Interfaces/Metadata';
declare class MediaInfo {
    mimeType: string | null;
    duration: number | undefined;
    hasAudio: boolean | null;
    hasVideo: boolean | null;
    audioCodec: string | null;
    videoCodec: string | null;
    audioDataRate: number | null;
    videoDataRate: number | null;
    audioSampleRate: number | null;
    audioChannelCount: number | null;
    width: number | null;
    height: number | null;
    fps: number | null;
    profile: string | null;
    level: string | null;
    refFrames: number | string | null;
    chromaFormat: number | null;
    sarNum: number | null;
    sarDen: number | null;
    metadata: Metadata | null;
    segments: Array<any> | null;
    segmentCount: number | null;
    hasKeyframesIndex: boolean | null;
    keyframesIndex: MediaKeyframe | null;
    constructor();
    /**
     * 是否已经完成
     */
    isComplete(): boolean;
    /**
     * 根据 hasKeyframesIndex(有关键帧索引) 是否为真来判断是否可以 SEEK
     */
    isSeekable(): boolean;
    /**
     * 寻找跳转时间点最近的关键帧
     * @param milliseconds 跳转的时间
     */
    getNearestKeyframe(milliseconds: number): KeyframeData | null;
    /**
     * 查找关键帧索引值
     * @param list 关键帧时间点
     * @param value 寻找的时间点
     */
    private _search;
}
export default MediaInfo;
