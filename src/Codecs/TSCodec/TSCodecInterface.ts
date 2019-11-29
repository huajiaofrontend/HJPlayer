// export type track = {
//     container: string | undefined
//     type: string
//     id: number
//     pid: number
//     inputTimeScale: number
//     sequenceNumber: number
//     samples: Array<any>
//     dropped: number | undefined
//     isAAC: boolean | undefined
//     duration: number | undefined
//     samplerate: number
//     config?: Array<number>
//     channelCount?: number
//     codec?: string
//     manifestCodec?: string
//     [x: string]: any
// }

export type track = {
    container: string | undefined
    type: string
    id: number
    pid: number
    inputTimeScale: number
    sequenceNumber: number
    samples: Array<any>
    dropped: number | undefined
    isAAC: boolean | undefined
    duration: number | undefined
    [x: string]: any
}

/**
 * 视频序列
 */
export type TSVideoTrack = {
    container: string
    type: string
    id: number
    pid: number
    inputTimeScale: number
    sequenceNumber: number
    samples: Array<avcSample>
    dropped: number
    isAAC: undefined
    duration: undefined | number
    pesData?: pesData
    [x: string]: any
}

/**
 * 音频序列
 */
export type TSAudioTrack = {
    container: string
    type: 'audio'
    id: number
    pid: number
    inputTimeScale: number
    sequenceNumber: number
    samples: Array<aacSample>
    dropped: undefined
    isAAC: boolean
    duration: number
    pesData?: pesData
    [x: string]: any
}

export type TSAACTrack = {
    container: string
    type: 'audio'
    id: number
    pid: number
    inputTimeScale: number
    sequenceNumber: number
    samples: Array<any>
    dropped: undefined
    isAAC: boolean
    duration: number
    samplerate: number
    config?: Array<number>
    channelCount?: number
    codec?: string
    manifestCodec?: string
    [x: string]: any
}

/**
 * mp3的歌手，标题，专辑名称，年代，风格等信息序列
 */
export type TSId3Track = {
    container: undefined
    type: 'id3'
    id: number
    pid: number
    inputTimeScale: number
    sequenceNumber: number
    samples: Array<parsedPesData>
    dropped: undefined
    isAAC: undefined
    duration: undefined
    pesData?: pesData
    [x: string]: any
}

/**
 * 文本序列
 */
export type TSTextTrack = {
    container: undefined
    type: 'text'
    id: number
    pid: number
    inputTimeScale: number
    sequenceNumber: number
    samples: Array<SampleLike>
    dropped: undefined
    isAAC: undefined
    duration: undefined
}

/**
 * 未解析的PES包数据
 */
export type pesData = {
    data: Array<Uint8Array>
    size: number
}

/**
 * 解析后的PES包数据
 */
export type parsedPesData = {
    data: Uint8Array
    pts: number | undefined
    dts: number | undefined
    len: number
}

/**
 * AVC视频 Sapmple 数据
 */
export type avcSample = {
    /**
     * 是否为关键帧
     */
    key: boolean
    /**
     * pts值
     */
    pts: number
    /**
     * dts 值
     */
    dts: number
    /**
     * NAL Uint Array
     */
    units: Array<NALUnit>
    /**
     * sample debug 信息
     */
    debug: string
    /**
     * 是否为I帧或者P帧(NALUnit.type == 5 || NALUnit.type == 1)
     */
    frame: boolean

    [x: string]: any
}

export type aacSample = {
    unit: Uint8Array
    dts: number
    pts: number
}

export type SampleLike = {
    /**
     * pts值
     */
    pts: number | undefined
    [x: string]: any
}

/**
 * H.264 NAL Unit
 */
export type NALUnit = {
    /**
     * NAL 的类型
     */
    type: number
    /**
     * NAL 的数据内容
     */
    data: Uint8Array
    /**
     * NAL Unit的状态
     */
    state?: number
}

export type typeSupported = {
    mp4: boolean
    mpeg: boolean
    mp3: boolean
}

export type TSVideoData = {
    data1: Uint8Array
    data2: Uint8Array
    startPTS: number
    endPTS: number
    startDTS: number
    endDTS: number
    type: string
    hasAudio: boolean
    hasVideo: boolean
    nb: number
    dropped: number | undefined
}

export type TSAudioData = {
    /**
     * moof 数据
     */
    data1: Uint8Array
    /**
     * mdat数据
     */
    data2: Uint8Array
    startPTS: number
    endPTS: number
    startDTS: number
    endDTS: number
    type: string
    hasAudio: boolean
    hasVideo: boolean
    nb: number
}

export type agentInfo = {
    userAgent: string
    vendor: string
}
