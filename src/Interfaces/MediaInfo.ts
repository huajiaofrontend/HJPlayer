interface MediaInfo {
    hasKeyframesIndex: boolean
    isComplete(): boolean
    isSeekable(): boolean
    getNearestKeyframe(): KeyframeData | null
    _search(list: Array<number>, value: number): number
}

interface KeyframeData {
    index: number
    milliseconds: number
    fileposition: number
}

interface MediaKeyframe {
    filepositions: Array<number>
    times: Array<number>
}

export { KeyframeData, MediaInfo, MediaKeyframe };
