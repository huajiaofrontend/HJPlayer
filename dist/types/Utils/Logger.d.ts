/**
 * Log部分
 */
import EventEmitter from 'eventemitter3';
import LogConfig from '../Interfaces/LogConfig';
declare class Logger {
    static _config: LogConfig;
    static _tag: string;
    static GLOBAL_TAG: string;
    static config: LogConfig;
    static readonly emitter: EventEmitter<string | symbol>;
    static on(eventName: string, callback: EventEmitter.ListenerFn): void;
    static once(eventName: string, callback: EventEmitter.ListenerFn): void;
    static off(eventName: string, callback: EventEmitter.ListenerFn): void;
    static clearEvents(): void;
    static error(tag: string, msg: string): void;
    /**
     * 在控制台打印程序运行时的一些日志信息
     * @param tag 文件标签
     * @param msg 消息
     */
    static info(tag: string, msg: string): void;
    static log(tag: string, msg: string): void;
    static warn(tag: string, msg: string): void;
    static debug(tag: string, msg: string): void;
}
export default Logger;
