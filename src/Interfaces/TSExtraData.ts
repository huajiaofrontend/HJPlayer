export type TSExtraData = {
    accurateTimeOffset: boolean | undefined
    audioCodec: string | undefined
    totalduration: number
    videoCodec: string | undefined
    fragCurrent: Fragment
    initSegmentData: Array<number>
}

/**
 * Fragment 带实现
 */
export type Fragment = {
    baseurl: string
    cc: number
    duration: number
    level: number
    levelkey: LevelKey
    programDateTime: number | null
    rawProgramDateTime: number | null
    relurl: string
    sn: number
    start: number
    tagList: Array<Array<string>>
    title: null | any
    type: string
    urlId: number
    [x: string]: any
}

export type LevelKey = {
    [x: string]: any
}
