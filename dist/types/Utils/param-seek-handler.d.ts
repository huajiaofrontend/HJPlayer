import SeekRange from '../Interfaces/SeekRange';
declare class ParamSeekHandler {
    private _startName;
    private _endName;
    constructor(paramStart: string, paramEnd: string);
    getConfig(baseUrl: string, range: SeekRange): {
        url: string;
        headers: {};
    };
    removeURLParameters(seekedURL: string): string;
}
export default ParamSeekHandler;
