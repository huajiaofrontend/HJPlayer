import EventEmitter from 'eventemitter3';
import UserConfig from '../Interfaces/UserConfig';
declare class LoggingControl {
    static emitter: EventEmitter;
    static forceGlobalTag: boolean;
    static globalTag: string;
    static enableAll: boolean | undefined;
    static enableDebug: boolean | undefined;
    static enableInfo: boolean | undefined;
    static enableWarn: boolean | undefined;
    static enableError: boolean | undefined;
    static getConfig(): {
        globalTag: string;
        forceGlobalTag: boolean | undefined;
        enableDebug: boolean | undefined;
        enableInfo: boolean | undefined;
        enableWarn: boolean | undefined;
        enableError: boolean | undefined;
        enableCallback: boolean | undefined;
    };
    static applyConfig(config: UserConfig): void;
    static _notifyChange(): void;
    static registerListener(listener: EventEmitter.ListenerFn): void;
    static removeListener(listener: EventEmitter.ListenerFn): void;
    static addLogListener(listener: EventEmitter.ListenerFn): void;
    static removeLogListener(listener: EventEmitter.ListenerFn): void;
}
export default LoggingControl;
