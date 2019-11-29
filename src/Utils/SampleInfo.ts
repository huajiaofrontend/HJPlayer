export default class SampleInfo {
    dts: number

    pts: number

    duration: number

    originalDts: number

    isSyncPoint: boolean

    fileposition: number | null

    constructor(dts: number, pts: number, duration: number, originalDts: number, isSync: boolean) {
        this.dts = dts;
        this.pts = pts;
        this.duration = duration;
        this.originalDts = originalDts;
        this.isSyncPoint = isSync;
        this.fileposition = null;
    }
}
