import BaseLoader from './BaseLoader';
import MediaConfig from '../Interfaces/MediaConfig';
import SeekRange from '../Interfaces/SeekRange';
import SeekHandler from '../Interfaces/SeekHandler';
import HJPlayerConfig from '../Interfaces/HJPlayerConfig';
declare class MozChunkedLoader extends BaseLoader {
    Tag: string;
    private _seekHandler;
    private _config;
    _needStash: boolean;
    private _xhr;
    /**
     * 请求流的url
     */
    private _requestURL;
    /**
     * 是否终止请求
     */
    private _requestAbort;
    /**
     * 数据的长度
     */
    private _contentLength;
    /**
     * 接收到的数据长度
     */
    private _receivedLength;
    /**
     * 请求流的配置
     */
    private _dataSource;
    /**
     * 数据请求的范围
     */
    private _range;
    static isSupported(): boolean;
    constructor(seekHandler: SeekHandler, config: HJPlayerConfig);
    destroy(): void;
    startLoad(dataSource: MediaConfig, range: SeekRange): void;
    abort(): void;
    _onReadyStateChange(e: Event): void;
    _onProgress(e: ProgressEvent): void;
    _onLoadEnd(e: Event): void;
    _onXhrError(e: ProgressEvent): void;
}
export default MozChunkedLoader;
