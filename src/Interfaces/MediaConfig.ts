import FileSegment from './FileSegment';

interface MediaConfig {
    hasAudio?: boolean;
    hasVideo?: boolean
    withCredentials?: boolean
    type: string
    url: string
    fileSize?: number // todo 更改
    redirectedURL?: string
    duration?: number
    segments?: Array<FileSegment>
    cors?: boolean
    referrerPolicy?:
        | ''
        | 'same-origin'
        | 'no-referrer-when-downgrade'
        | 'no-referrer'
        | 'origin'
        | 'strict-origin'
        | 'origin-when-cross-origin'
        | 'strict-origin-when-cross-origin'
        | 'unsafe-url'
        | undefined
}

export interface TsMediaConfig extends MediaConfig {
    reuseRedirectedURL?: string
    maxFragLookUpTolerance: number
    tsAutoLevelChoose?: boolean // 自适应码率，根据网络选择合适的码率
    defaultAudioCodec: string // 默认的编码规则
}

export default MediaConfig;
