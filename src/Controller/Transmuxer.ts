import EventEmitter from 'eventemitter3';
import Logger from '../Utils/Logger';
import LoggingControl from '../Utils/logging-control';
import TransmuxingController from './TransmuxingController';
import Events from '../Events/index';
import TransmuxingWorker from './TransmuxingWorker';
import MediaInfo from './MediaInfo';
import getMediaTypeSupport from '../Utils/getMediaTypeSupport';
import { InitSegment, MediaSegment } from '../Interfaces/Segment';
import TempNavigatorType from '../Interfaces/TempNavigator';
import MediaConfig from '../Interfaces/MediaConfig';
import StatisticsInfoObject from '../Interfaces/StatisticsInfo';
import Metadata from '../Interfaces/Metadata';
import WEBWORKER_CMD from '../Utils/workerCmd';
import HJPlayerConfig from '../Interfaces/HJPlayerConfig';
import TSManifest from '../Interfaces/TSManifest';

const webworkify = require('webworkify-webpack');

const typeSupported = getMediaTypeSupport();
const tempNavigator: TempNavigatorType = {
    vendor: window.navigator.vendor || '',
    userAgent: window.navigator.userAgent
};
class Transmuxer {
    /**
     * 文件标签
     */
    Tag: string

    /**
     * 事件中心
     */
    private _emitter: EventEmitter

    /**
     * webworker
     */
    private _worker?: any
    /**
     * web-worker是否在摧毁中
     */

    private _workerDestroying?: boolean

    /**
     * 转码控制器
     */
    private _controller?: TransmuxingController

    /**
     * 回调函数的包裹体
     */
    e: any

    constructor(mediaDataSource: MediaConfig, config: HJPlayerConfig) {
        this.Tag = 'Transmuxer';
        this._emitter = new EventEmitter();
        const WORK: any = webworkify;
        if(config.enableWorker && typeof Worker !== 'undefined') {
            try {
                this._worker = WORK(require.resolve('./TransmuxingWorker'));
                this._workerDestroying = false;
                this._worker
                    && this._worker.addEventListener('message', this._onWorkerMessage.bind(this));
                this._worker
                    && this._worker.postMessage({
                        cmd: WEBWORKER_CMD.INIT,
                        param: [mediaDataSource, config, typeSupported, tempNavigator]
                    });
                this.e = {
                    onLoggingConfigChanged: this._onLoggingConfigChanged.bind(this)
                };
                LoggingControl.registerListener(this.e.onLoggingConfigChanged);
                this._worker
                    && this._worker.postMessage({
                        cmd: WEBWORKER_CMD.LOG_CONFIG_CHANGE,
                        param: LoggingControl.getConfig()
                    });
            } catch (error) {
                Logger.error(
                    this.Tag,
                    'Error while initialize transmuxing worker, fallback to inline transmuxing'
                );
                delete this._worker;
                this._controller = new TransmuxingController(
                    mediaDataSource,
                    config,
                    typeSupported,
                    tempNavigator
                );
            }
        } else {
            this._controller = new TransmuxingController(
                mediaDataSource,
                config,
                typeSupported,
                tempNavigator
            );
        }

        if(this._controller) {
            const ctl = this._controller;
            ctl.on(Events.IO_ERROR, this._onIOError.bind(this));
            ctl.on(Events.DEMUX_ERROR, this._onDemuxError.bind(this));
            ctl.on(Events.INIT_SEGMENT, this._onInitSegment.bind(this));
            ctl.on(Events.MEDIA_SEGMENT, this._onMediaSegment.bind(this));
            ctl.on(Events.LOAD_COMPLETE, this._onLoadingComplete.bind(this));
            ctl.on(Events.RECOVERED_EARLY_EOF, this._onRecoveredEarlyEof.bind(this));
            ctl.on(Events.MEDIA_INFO, this._onMediaInfo.bind(this));
            ctl.on(Events.METADATA_ARRIVED, this._onMetaDataArrived.bind(this));
            ctl.on(Events.SCRIPTDATA_ARRIVED, this._onScriptDataArrived.bind(this));
            ctl.on(Events.STATISTICS_INFO, this._onStatisticsInfo.bind(this));
            ctl.on(Events.RECOMMEND_SEEKPOINT, this._onRecommendSeekpoint.bind(this));
            ctl.on(Events.GET_SEI_INFO, this._onGetSeiInfo.bind(this));
            ctl.on(Events.MANIFEST_PARSED, this._onMainfestParsed.bind(this));
        }
    }

    /**
     * 自我销毁
     */
    destroy() {
        if(this._worker) {
            if(!this._workerDestroying) {
                this._workerDestroying = true;
                this._worker.postMessage({ cmd: WEBWORKER_CMD.DESTROY });
                LoggingControl.removeListener(this.e.onLoggingConfigChanged);
                this.e = null;
            }
        } else {
            this._controller && this._controller.destroy();
            delete this._controller;
        }
        this._emitter.removeAllListeners();
        delete this._emitter;
    }

    on(event: string, listener: EventEmitter.ListenerFn) {
        this._emitter.addListener(event, listener);
    }

    off(event: string, listener: EventEmitter.ListenerFn) {
        this._emitter.removeListener(event, listener);
    }

    /**
     * 是否使用了多线程
     */
    hasWorker(): boolean {
        return this._worker != null;
    }

    /**
     * 开始
     */
    open() {
        if(this._worker) {
            this._worker.postMessage({ cmd: WEBWORKER_CMD.START });
        } else {
            this._controller && this._controller.start();
        }
    }

    /**
     * 停止
     */
    close() {
        if(this._worker) {
            this._worker.postMessage({ cmd: WEBWORKER_CMD.STOP });
        } else {
            this._controller && this._controller.stop();
        }
    }

    /**
     * 跳转的时间点
     * @param milliseconds 跳转的时间点
     */
    seek(milliseconds: number) {
        if(this._worker) {
            this._worker.postMessage({ cmd: WEBWORKER_CMD.SEEK, param: milliseconds });
        } else {
            this._controller && this._controller.seek(milliseconds);
        }
    }

    /**
     * 暂停转码
     */
    pause() {
        if(this._worker) {
            this._worker.postMessage({ cmd: WEBWORKER_CMD.PAUSE });
        } else {
            this._controller && this._controller.pause();
        }
    }

    /**
     * 恢复转码
     */
    resume() {
        if(this._worker) {
            this._worker.postMessage({ cmd: WEBWORKER_CMD.RESUME });
        } else {
            this._controller && this._controller.resume();
        }
    }

    /**
     * 收到初始化片段向上报告
     * @param type 片段类型
     * @param initSegment 片段数据
     */
    _onInitSegment(type: string, initSegment: InitSegment) {
        Promise.resolve().then(() => {
            this._emitter.emit(Events.INIT_SEGMENT, type, initSegment);
        });
    }

    /**
     * 收到媒体片段向上报告
     * @param type 片段类型
     * @param initSegment 片段数据
     */
    _onMediaSegment(type: string, mediaSegment: MediaSegment) {
        Promise.resolve().then(() => {
            this._emitter.emit(Events.MEDIA_SEGMENT, type, mediaSegment);
        });
    }

    /**
     * 当加载完成时向上报告
     */
    _onLoadingComplete() {
        Promise.resolve().then(() => {
            this._emitter.emit(Events.LOAD_COMPLETE);
        });
    }

    /**
     * 从过早遇到 EOF 事件恢复后向上报告
     */
    _onRecoveredEarlyEof() {
        Promise.resolve().then(() => {
            this._emitter.emit(Events.RECOVERED_EARLY_EOF);
        });
    }

    /**
     * 当收到解析后的媒体信息后向上提交
     * @param mediaInfo 媒体信息
     */
    _onMediaInfo(mediaInfo: MediaInfo) {
        Promise.resolve().then(() => {
            this._emitter.emit(Events.MEDIA_INFO, mediaInfo);
        });
    }

    _onMetaDataArrived(metadata: Metadata) {
        Promise.resolve().then(() => {
            this._emitter.emit(Events.METADATA_ARRIVED, metadata);
        });
    }

    _onScriptDataArrived(data: any) {
        Promise.resolve().then(() => {
            this._emitter.emit(Events.SCRIPTDATA_ARRIVED, data);
        });
    }

    _onStatisticsInfo(statisticsInfo: StatisticsInfoObject) {
        Promise.resolve().then(() => {
            this._emitter.emit(Events.STATISTICS_INFO, statisticsInfo);
        });
    }

    _onIOError(type: string, info: string) {
        Promise.resolve().then(() => {
            this._emitter.emit(Events.IO_ERROR, type, info);
        });
    }

    _onDemuxError(type: string, info: string) {
        Promise.resolve().then(() => {
            this._emitter.emit(Events.DEMUX_ERROR, type, info);
        });
    }

    /**
     * 当收到 推荐的seek时间点后向上提交
     * @param milliseconds 推荐的seek时间点
     */
    _onRecommendSeekpoint(milliseconds: number) {
        Promise.resolve().then(() => {
            this._emitter.emit(Events.RECOMMEND_SEEKPOINT, milliseconds);
        });
    }

    /**
     * 收到解析到媒体增强信息后向上提交
     * @param data 媒体增强信息的Uin8Array
     */
    _onGetSeiInfo(data: Uint8Array) {
        Promise.resolve().then(() => {
            this._emitter.emit(Events.GET_SEI_INFO, data);
        });
    }

    _onLoggingConfigChanged(config: HJPlayerConfig) {
        if(this._worker) {
            this._worker.postMessage({ cmd: WEBWORKER_CMD.LOG_CONFIG_CHANGE, param: config });
        }
    }

    /**
     * 收到M3U8文档解析数据后向上提交
     * @param data M3U8文档解析数据, 暂时标为any
     */
    _onMainfestParsed(data: TSManifest) {
        Promise.resolve().then(() => {
            this._emitter.emit(Events.MANIFEST_PARSED, data);
        });
    }

    /**
     * 当收到web-worker消息时的处理操作
     * @param event 收到的信息体
     */
    _onWorkerMessage(event: MessageEvent) {
        const message = event.data;
        const { data } = message;

        if(message.msg === 'destroyed' || this._workerDestroying) {
            this._workerDestroying = false;
            this._worker && this._worker.terminate();
            delete this._worker;
            return;
        }

        switch(message.msg) {
        case Events.INIT_SEGMENT:
        case Events.MEDIA_SEGMENT:
            this._emitter.emit(message.msg, data.type, data.data);
            break;
        case Events.LOAD_COMPLETE:
        case Events.RECOVERED_EARLY_EOF:
            this._emitter.emit(message.msg);
            break;
        case Events.MEDIA_INFO:
            Object.setPrototypeOf(data, MediaInfo.prototype);
            this._emitter.emit(message.msg, data);
            break;
        case Events.METADATA_ARRIVED:
        case Events.SCRIPTDATA_ARRIVED:
        case Events.STATISTICS_INFO:
            this._emitter.emit(message.msg, data);
            break;
        case Events.IO_ERROR:
        case Events.DEMUX_ERROR:
            this._emitter.emit(message.msg, data.type, data.info);
            break;
        case Events.RECOMMEND_SEEKPOINT:
            this._emitter.emit(message.msg, data);
            break;
        case Events.GET_SEI_INFO:
            this._emitter.emit(message.msg, data);
            break;
        case Events.MANIFEST_PARSED:
            this._emitter.emit(message.msg, data);
            break;
        case Events.WORKER_LOG:
            Logger.emitter.emit(Events.HJ_PLAYER_LOG, data.type, data.msg);
            break;
        default:
            break;
        }
    }
}

export default Transmuxer;
