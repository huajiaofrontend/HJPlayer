import SeekRange from '../Interfaces/SeekRange';

export interface SeekConfig {
    url: string
    headers: any
}

export default interface SeekHandler {
    _zeroStart: boolean | number
    getConfig(url: string, range: SeekRange): SeekConfig
    removeURLParameters(seekedURL: string): string
}
