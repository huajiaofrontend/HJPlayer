/**
 * Log部分
 */
import EventEmitter from 'eventemitter3';
import LogConfig from '../Interfaces/LogConfig';
import HJPlayerEvents from '../Events/index';

const eventEmitter = new EventEmitter();

class Logger {
    static _config: LogConfig

    static _tag: string

    static get GLOBAL_TAG() {
        return Logger._tag;
    }

    static set GLOBAL_TAG(TAG: string) {
        Logger._tag = TAG;
    }

    static get config() {
        if(!Logger._config) {
            Logger._config = Object.create(null);
            // throw new Error("please set Logger's config first!")
        }
        return Logger._config;
    }

    static set config(config: LogConfig) {
        Logger._config = config;
    }

    static get emitter() {
        return eventEmitter;
    }

    static on(eventName: string, callback: EventEmitter.ListenerFn) {
        Logger.emitter.on(eventName, callback);
    }

    static once(eventName: string, callback: EventEmitter.ListenerFn) {
        Logger.emitter.once(eventName, callback);
    }

    static off(eventName: string, callback: EventEmitter.ListenerFn) {
        Logger.emitter.off(eventName, callback);
    }

    static clearEvents() {
        Logger.emitter.removeAllListeners();
    }

    static error(tag: string, msg: string) {
        if(!tag || Logger.config.FORCE_GLOBAL_TAG) tag = Logger.GLOBAL_TAG;

        const str = `[${tag}] > ${msg}`;

        if(Logger.config.ENABLE_CALLBACK) {
            Logger.emitter.emit(HJPlayerEvents.HJ_PLAYER_LOG, 'error', str);
        }

        if(!Logger.config.ENABLE_ERROR) {
            return;
        }

        if(console.error) {
            console.error(str);
        } else if(console.warn) {
            console.warn(str);
        } else {
            console.log(str);
        }
    }

    /**
     * 在控制台打印程序运行时的一些日志信息
     * @param tag 文件标签
     * @param msg 消息
     */
    static info(tag: string, msg: string) {
        if(!tag || Logger.config.FORCE_GLOBAL_TAG) tag = Logger.GLOBAL_TAG;

        const str = `[${tag}] > ${msg}`;

        if(Logger.config.ENABLE_CALLBACK) {
            Logger.emitter.emit(HJPlayerEvents.HJ_PLAYER_LOG, 'info', str);
        }

        if(!Logger.config.ENABLE_INFO) {
            return;
        }

        if(console.info) {
            console.info(str);
        } else {
            console.log(str);
        }
    }

    static log(tag: string, msg: string) {
        if(!tag || Logger.config.FORCE_GLOBAL_TAG) tag = Logger.GLOBAL_TAG;

        const str = `[${tag}] > ${msg}`;

        if(Logger.config.ENABLE_CALLBACK) {
            Logger.emitter.emit(HJPlayerEvents.HJ_PLAYER_LOG, 'log', str);
        }

        if(!Logger.config.ENABLE_INFO) {
            return;
        }

        console.log(str);
    }

    static warn(tag: string, msg: string) {
        if(!tag || Logger.config.FORCE_GLOBAL_TAG) tag = Logger.GLOBAL_TAG;

        const str = `[${tag}] > ${msg}`;

        if(Logger.config.ENABLE_CALLBACK) {
            Logger.emitter.emit(HJPlayerEvents.HJ_PLAYER_LOG, 'warn', str);
        }

        if(!Logger.config.ENABLE_WARN) {
            return;
        }

        if(console.warn) {
            console.warn(str);
        } else {
            console.log(str);
        }
    }

    static debug(tag: string, msg: string) {
        if(!tag || Logger.config.FORCE_GLOBAL_TAG) tag = Logger.GLOBAL_TAG;

        const str = `[${tag}] > ${msg}`;

        if(Logger.config.ENABLE_CALLBACK) {
            Logger.emitter.emit(HJPlayerEvents.HJ_PLAYER_LOG, 'debug', str);
        }

        if(!Logger.config.ENABLE_DEBUG) {
            return;
        }

        if(console.debug) {
            console.debug(str);
        } else {
            console.log(str);
        }
    }
}

export default Logger;
