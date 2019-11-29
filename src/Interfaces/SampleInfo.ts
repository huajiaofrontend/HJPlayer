type SampleInfo = {
    dts: number
    duration: number
    fileposition: number | null
    isSyncPoint: boolean
    originalDts: number
    pts: number
}

export default SampleInfo;
