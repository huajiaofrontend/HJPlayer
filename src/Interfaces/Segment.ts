interface Segment {
    type: string
    data: ArrayBuffer
}

export interface InitSegment extends Segment {
    codec: string
    container: string
    mediaDuration: number
}

// export type InitSegment = {
//     codec: string
//     container: string
//     type: string
//     data: ArrayBuffer
//     mediaDuration: number
// }

export interface MediaSegment extends Segment {
    sampleCount: number
    info: SegmentInfo
    timestampOffset?: number
}

// export type MediaSegment = {
//     type: string
//     data: ArrayBuffer
//     sampleCount: number
//     info: SegmentInfo
// }

interface SegmentInfo {
    beginDts: number
    beginPts: number
    endDts: number
    endPts: number
    originalBeginDts: number
    originalEndDts: number
    firstSample: SampleInfo | null
    lastSample: SampleInfo | null
    syncPoints: Array<SampleInfo>
}

interface SampleInfo {
    dts: number
    duration: number
    fileposition: number | null
    isSyncPoint: boolean
    originalDts: number
    pts: number
}

export default Segment;
