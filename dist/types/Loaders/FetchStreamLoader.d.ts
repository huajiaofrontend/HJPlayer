import EventEmitter from 'eventemitter3';
import BaseLoader from './BaseLoader';
import SeekHandler from '../Interfaces/SeekHandler';
import MediaConfig from '../Interfaces/MediaConfig';
import SeekRange from '../Interfaces/SeekRange';
import HJPlayerConfig from '../Interfaces/HJPlayerConfig';
declare class FetchStreamLoader extends BaseLoader {
    Tag: string;
    eventEmitter: EventEmitter;
    private mediaConfig;
    /**
     * 初始化回调函数
     */
    private seekHandler;
    /**
     * 初始化配置
     */
    private userConfig;
    private seekRange;
    /**
     * 请求是否阻止
     */
    private requestAbort;
    /**
     * 数据长度
     */
    private contentLength;
    /**
     * 接收到的数据长度
     */
    private receivedLength;
    constructor(seekHandler: SeekHandler, userConfig: HJPlayerConfig);
    /**
     * 判断是否支持fetch请求
     */
    static isSupported(): boolean;
    on(eventName: string, callback: EventEmitter.ListenerFn): void;
    once(eventName: string, callback: EventEmitter.ListenerFn): void;
    off(eventName: string, callback?: EventEmitter.ListenerFn): void;
    destroy(): void;
    /**
     * 开始加载
     */
    startLoad(mediaConfig: MediaConfig, seekRange: SeekRange): void;
    _pump(reader: ReadableStreamDefaultReader): Promise<any>;
    /**
     * 待实现
     */
    /**
     * 取消加载
     */
    abort(): void;
}
export default FetchStreamLoader;
