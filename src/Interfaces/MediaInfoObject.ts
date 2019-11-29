import Metadata from './Metadata';

type MediaInfoObject = {
    audioChannelCount: number
    audioCodec: string
    audioDataRate?: number | null
    audioSampleRate: number
    chromaFormat: string | null
    duration: number
    fps: number | null
    hasAudio: boolean
    hasKeyframesIndex: boolean
    hasVideo: boolean
    height: number
    level: string | null
    metadata: Metadata
    mimeType: string
    pixelRatio: Array<Number> | null
    pps: Uint8Array
    profile: string | null
    refFrames: number | null
    sarDen: number | null
    sarNum: number | null
    segmentCount: number
    sps: Uint8Array
    videoCodec: string
    videoDataRate: number | null
    width: number
}

export default MediaInfoObject;
