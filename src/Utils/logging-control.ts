import EventEmitter from 'eventemitter3';
import Log from './Logger';
import UserConfig from '../Interfaces/UserConfig';
import HJPlayerEvents from '../Events/index';

class LoggingControl {
    static emitter: EventEmitter

    static get forceGlobalTag() {
        return Log.config.FORCE_GLOBAL_TAG || false;
    }

    static set forceGlobalTag(enable: boolean) {
        Log.config.FORCE_GLOBAL_TAG = enable;
        LoggingControl._notifyChange();
    }

    static get globalTag() {
        return Log.GLOBAL_TAG;
    }

    static set globalTag(tag: string) {
        Log.GLOBAL_TAG = tag;
        LoggingControl._notifyChange();
    }

    static get enableAll() {
        return (
            Log.config.ENABLE_DEBUG
            && Log.config.ENABLE_INFO
            && Log.config.ENABLE_WARN
            && Log.config.ENABLE_ERROR
        );
    }

    static set enableAll(enable) {
        Log.config.ENABLE_DEBUG = enable;
        Log.config.ENABLE_INFO = enable;
        Log.config.ENABLE_WARN = enable;
        Log.config.ENABLE_ERROR = enable;
        LoggingControl._notifyChange();
    }

    static get enableDebug() {
        return Log.config.ENABLE_DEBUG;
    }

    static set enableDebug(enable) {
        Log.config.ENABLE_DEBUG = enable;
        LoggingControl._notifyChange();
    }

    static get enableInfo() {
        return Log.config.ENABLE_INFO;
    }

    static set enableInfo(enable) {
        Log.config.ENABLE_INFO = enable;
        LoggingControl._notifyChange();
    }

    static get enableWarn() {
        return Log.config.ENABLE_WARN;
    }

    static set enableWarn(enable) {
        Log.config.ENABLE_WARN = enable;
        LoggingControl._notifyChange();
    }

    static get enableError() {
        return Log.config.ENABLE_ERROR;
    }

    static set enableError(enable) {
        Log.config.ENABLE_ERROR = enable;
        LoggingControl._notifyChange();
    }

    static getConfig() {
        return {
            globalTag: Log.GLOBAL_TAG,
            forceGlobalTag: Log.config.FORCE_GLOBAL_TAG,
            enableDebug: Log.config.ENABLE_DEBUG,
            enableInfo: Log.config.ENABLE_INFO,
            enableWarn: Log.config.ENABLE_WARN,
            enableError: Log.config.ENABLE_ERROR,
            enableCallback: Log.config.ENABLE_CALLBACK
        };
    }

    static applyConfig(config: UserConfig) {
        Log.GLOBAL_TAG = config.GLOBAL_TAG || 'HJPLAYER';
        Log.config.FORCE_GLOBAL_TAG = config.FORCE_GLOBAL_TAG;
        Log.config.ENABLE_DEBUG = config.ENABLE_DEBUG;
        Log.config.ENABLE_INFO = config.ENABLE_INFO;
        Log.config.ENABLE_WARN = config.ENABLE_WARN;
        Log.config.ENABLE_ERROR = config.ENABLE_ERROR;
        Log.config.ENABLE_CALLBACK = config.ENABLE_CALLBACK;
    }

    static _notifyChange() {
        const { emitter } = LoggingControl;

        if(emitter.listenerCount('change') > 0) {
            const config = LoggingControl.getConfig();
            emitter.emit('change', config);
        }
    }

    static registerListener(listener: EventEmitter.ListenerFn) {
        LoggingControl.emitter.addListener('change', listener);
    }

    static removeListener(listener: EventEmitter.ListenerFn) {
        LoggingControl.emitter.removeListener('change', listener);
    }

    static addLogListener(listener: EventEmitter.ListenerFn) {
        Log.emitter.addListener(HJPlayerEvents.HJ_PLAYER_LOG, listener);
        if(Log.emitter.listenerCount(HJPlayerEvents.HJ_PLAYER_LOG) > 0) {
            Log.config.ENABLE_CALLBACK = true;
            LoggingControl._notifyChange();
        }
    }

    static removeLogListener(listener: EventEmitter.ListenerFn) {
        Log.emitter.removeListener(HJPlayerEvents.HJ_PLAYER_LOG, listener);
        if(Log.emitter.listenerCount(HJPlayerEvents.HJ_PLAYER_LOG) === 0) {
            Log.config.ENABLE_CALLBACK = false;
            LoggingControl._notifyChange();
        }
    }
}

LoggingControl.emitter = new EventEmitter();

export default LoggingControl;
