import SeekRange from '../Interfaces/SeekRange';
declare class RangeSeekHandler {
    private _zeroStart;
    constructor(zeroStart: number | boolean);
    getConfig(url: string, range: SeekRange): {
        url: string;
        headers: any;
    };
    removeURLParameters(seekedURL: string): string;
}
export default RangeSeekHandler;
