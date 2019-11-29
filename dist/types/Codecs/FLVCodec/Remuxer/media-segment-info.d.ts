import SampleInfo from '../../../Utils/SampleInfo';
export declare class MediaSegmentInfo {
    beginDts: number;
    endDts: number;
    beginPts: number;
    endPts: number;
    originalBeginDts: number;
    originalEndDts: number;
    syncPoints: SampleInfo[];
    firstSample: SampleInfo | null;
    lastSample: SampleInfo | null;
    constructor();
    appendSyncPoint(sampleInfo: SampleInfo): void;
}
export declare class IDRSampleList {
    _list: SampleInfo[];
    constructor();
    clear(): void;
    appendArray(syncPoints: SampleInfo[]): void;
    getLastSyncPointBeforeDts(dts: number): SampleInfo | null;
}
export declare class MediaSegmentInfoList {
    _type: string;
    _list: MediaSegmentInfo[];
    _lastAppendLocation: number;
    constructor(type: string);
    readonly type: string;
    readonly length: number;
    isEmpty(): boolean;
    clear(): void;
    _searchNearestSegmentBefore(originalBeginDts: any): number;
    _searchNearestSegmentAfter(originalBeginDts: number): number;
    append(mediaSegmentInfo: MediaSegmentInfo): void;
    getLastSegmentBefore(originalBeginDts: number): MediaSegmentInfo | null;
    getLastSampleBefore(originalBeginDts: number): SampleInfo | null;
    getLastSyncPointBefore(originalBeginDts: number): SampleInfo | null;
}
