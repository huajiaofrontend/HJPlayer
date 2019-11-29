/**
 * metadata 的定义 详见 https://my.oschina.net/u/213072/blog/52053
 */
type Metadata = {
    audiocodecid?: number // flv音频编码格式ID
    audiodatarate?: number
    audiosamplerate?: number
    audiosamplesize?: number
    audiosize?: number
    canSeekToEnd?: boolean
    compatibleBrands?: string
    datasize?: number
    duration?: number
    encoder?: string
    filesize?: number
    framerate?: number
    hasAudio?: boolean
    hasKeyframes?: boolean
    hasMetadata?: boolean
    hasVideo?: boolean
    height?: number
    keyframes?: any
    lastkeyframelocation?: number
    lastkeyframetimestamp?: number
    lasttimestamp?: number
    majorBrand?: string
    minorVersion?: string
    stereo?: boolean
    videocodecid?: number // flv规定的视频编码格式ID  详见 https?://blog.csdn.net/qiuchangyong/article/details/6754206
    videodatarate?: number
    videosize?: number
    width?: number
}

export default Metadata;
