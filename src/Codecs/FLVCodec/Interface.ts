export interface ProbeData {
    match: boolean
    consumed?: number
    dataOffset?: number
    hasAudioTrack?: boolean
    hasVideoTrack?: boolean
}

export interface ScriptData {
    size?: number
    data?: any
    objectEnd?: boolean
    [propName: string]: any
}

export interface FrameRate {
    fixed: boolean
    fps: number
    fpsNum: number
    fpsDen: number
}

export interface KeyframesData {
    times: number[]
    filepositions: number[]
}

export interface AacAudioData {
    config: number[] | null
    samplingRate: number
    channelCount: number
    codec: string
    originalCodec: string
}

export interface AacAudioDataPacket {
    packetType: number
    data: AacAudioData | Uint8Array
    type: string
}

export interface Mp3AudioData {
    bitRate: number
    samplingRate: number
    channelCount: number
    codec: string
    originalCodec: string
}

export interface AvcSampleData {
    units: NALUnit[]
    length: number
    isKeyframe: boolean
    dts: number
    cts: number
    pts: number
    fileposition?: number
}

export interface AudioMediaData {
    type?: string
    id?: number | undefined
    timescale?: number | undefined
    duration?: number | undefined
    audioSampleRate?: number | undefined
    refSampleDuration?: number
    channelCount?: number
    codec?: string
    originalCodec?: string
    config?: number[]
}

export interface VideoMediaData {
    type?: string
    id?: number | undefined
    timescale?: number | any
    duration?: number | undefined
    refSampleDuration?: number
    avcc?: any

    codecWidth?: number
    codecHeight?: number
    presentWidth?: number
    presentHeight?: number

    profile?: string
    level?: string
    bitDepth?: number
    chromaFormat?: number
    sarRatio?:
        | {
              width: number
              height: number
          }
        | any
    frameRate?:
        | {
              fixed: number
              fps: number
              fpsDen: number
              fpsNum: number
          }
        | any
    codec?: string
}

export type typeSupported = {
    mp4: boolean
    mpeg: boolean
    mp3: boolean
}

export type agentInfo = {
    userAgent: string
    vendor: string
}

export type track = {
    container?: string | undefined
    type?: string
    id: number
    pid?: number
    inputTimeScale?: number
    sequenceNumber: number
    samples: Array<any>
    dropped?: number | undefined
    isAAC?: boolean | undefined
    duration?: number
    [propName: string]: any
}
export type audioTrack = {
    // container: string | undefined
    type: string
    id: number
    // pid: number
    // inputTimeScale: number
    sequenceNumber: number
    samples: Array<aacSample>
    // dropped: number | undefined
    // isAAC: boolean | undefined
    // duration: number | undefined
    length: number
    // [x: string]: any
}

export type videoTrack = {
    // container: string | undefined
    type: string
    id: number
    // pid: number
    // inputTimeScale: number
    sequenceNumber: number
    samples: Array<AvcSampleData>
    // dropped: number | undefined
    // isAAC: boolean | undefined
    // duration: number | undefined
    length: number
    // [x: string]: any
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
    length: number
    [x: string]: any
}
export type aacSample = {
    unit: Uint8Array
    dts: number
    pts: number
    cts: number,
    length: number
}

export type DetailAacSample = {
    dts: number,
    pts: number,
    cts: number,
    unit: Uint8Array,
    size: number,
    duration: number,
    originalDts: number,
    flags: {
        isLeading: number,
        dependsOn: number,
        isDependedOn: number,
        hasRedundancy: number
    }
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
