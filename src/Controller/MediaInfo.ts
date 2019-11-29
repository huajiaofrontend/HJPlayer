import { KeyframeData, MediaKeyframe } from '../Interfaces/MediaInfo';
import Metadata from '../Interfaces/Metadata';

class MediaInfo {
    mimeType: string | null

    // 媒体类型
    duration: number | undefined

    // 媒体播放时长
    hasAudio: boolean | null

    // 是否有音频
    hasVideo: boolean | null

    // 是否有视频
    audioCodec: string | null

    // 音频编码格式
    videoCodec: string | null

    // 视频编码格式
    audioDataRate: number | null

    // 音频比特率（千比特/秒）
    videoDataRate: number | null

    // 视频比特率（千比特/秒)
    audioSampleRate: number | null

    // 音频采样率
    audioChannelCount: number | null

    // 音频声道数量
    width: number | null

    // 媒体渲染宽度
    height: number | null

    // 媒体渲染高度
    fps: number | null

    // 媒体每秒播放帧数
    profile: string | null

    // H264 profile, 四种: baseline, extended, main, high 详见 https://www.cnblogs.com/lidabo/p/7419393.html
    level: string | null

    // H264 level级别 详见 https://www.cnblogs.com/lidabo/p/7419393.html
    refFrames: number | string | null

    // B帧的最大参考数量 详见 https://www.jianshu.com/p/a82da1d0d84f
    chromaFormat: number | null

    // 亮度和色度空间 详见 http://blog.chinaunix.net/uid-12947719-id-3413698.html 例如: 4:2:0, 4:2:1
    sarNum: number | null

    // 由容器指定的播放高宽比的分子 详见 https://www.nmm-hd.org/doc/FFmpegSource2 章节 输出给的AviSynth变量
    sarDen: number | null

    // 由容器指定的播放高宽比的分母 详见 https://www.nmm-hd.org/doc/FFmpegSource2 章节 输出给的AviSynth变量
    metadata: Metadata | null

    // 媒体的元数据
    segments: Array<any> | null

    // 媒体片段(flv.js的segment选项内容)
    segmentCount: number | null

    // 媒体片段数量
    hasKeyframesIndex: boolean | null

    // 是否有关键帧索引
    keyframesIndex: MediaKeyframe | null

    // 关键帧索引
    constructor() {
        this.mimeType = null;
        this.duration = undefined;

        this.hasAudio = null;
        this.hasVideo = null;
        this.audioCodec = null;
        this.videoCodec = null;
        this.audioDataRate = null;
        this.videoDataRate = null;

        this.audioSampleRate = null;
        this.audioChannelCount = null;

        this.width = null;
        this.height = null;
        this.fps = null;
        this.profile = null;
        this.level = null;
        this.refFrames = null;
        this.chromaFormat = null;
        this.sarNum = null;
        this.sarDen = null;

        this.metadata = null;
        this.segments = null; // MediaInfo[]
        this.segmentCount = null;
        this.hasKeyframesIndex = null;
        this.keyframesIndex = null;
    }

    /**
     * 是否已经完成
     */
    isComplete() {
        const audioInfoComplete = this.hasAudio === false
            || (this.hasAudio === true
                && this.audioCodec != null
                && this.audioSampleRate != null
                && this.audioChannelCount != null);

        const videoInfoComplete = this.hasVideo === false
            || (this.hasVideo === true
                && this.videoCodec != null
                && this.width != null
                && this.height != null
                && this.fps != null
                && this.profile != null
                && this.level != null
                && this.refFrames != null
                && this.chromaFormat != null
                && this.sarNum != null
                && this.sarDen != null);

        return (
            this.mimeType !== null
            && this.duration !== undefined
            && this.metadata !== null
            && this.hasKeyframesIndex !== null
            && audioInfoComplete
            && videoInfoComplete
        );
    }

    /**
     * 根据 hasKeyframesIndex(有关键帧索引) 是否为真来判断是否可以 SEEK
     */
    isSeekable(): boolean {
        return this.hasKeyframesIndex === true;
    }

    /**
     * 寻找跳转时间点最近的关键帧
     * @param milliseconds 跳转的时间
     */
    getNearestKeyframe(milliseconds: number): KeyframeData | null {
        if(this.keyframesIndex == null) {
            return null;
        }

        const table = this.keyframesIndex;
        const keyframeIdx = this._search(table.times, milliseconds);

        return {
            index: keyframeIdx,
            milliseconds: table.times[keyframeIdx],
            fileposition: table.filepositions[keyframeIdx]
        };
    }

    /**
     * 查找关键帧索引值
     * @param list 关键帧时间点
     * @param value 寻找的时间点
     */
    private _search(list: Array<number>, value: number): number {
        let idx = 0;

        const last = list.length - 1;
        let mid = 0;
        let lbound = 0;
        let ubound = last;

        if(value < list[0]) {
            idx = 0;
            lbound = ubound + 1; // skip search
        }

        while(lbound <= ubound) {
            mid = lbound + Math.floor((ubound - lbound) / 2);
            if(mid === last || (value >= list[mid] && value < list[mid + 1])) {
                idx = mid;
                break;
            } else if(list[mid] < value) {
                lbound = mid + 1;
            } else {
                ubound = mid - 1;
            }
        }

        return idx;
    }
}

export default MediaInfo;
