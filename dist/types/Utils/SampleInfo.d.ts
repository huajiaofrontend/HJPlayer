export default class SampleInfo {
    dts: number;
    pts: number;
    duration: number;
    originalDts: number;
    isSyncPoint: boolean;
    fileposition: number | null;
    constructor(dts: number, pts: number, duration: number, originalDts: number, isSync: boolean);
}
