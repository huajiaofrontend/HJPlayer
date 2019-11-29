import SampleInfo from './SampleInfo';
declare class IDRSampleList {
    private _list;
    clear(): void;
    appendArray(syncPoints: SampleInfo[]): void;
    getLastSyncPointBeforeDts(dts: number): SampleInfo | null;
}
export default IDRSampleList;
