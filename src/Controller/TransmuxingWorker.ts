import LoggingControl from '../Utils/logging-control';
// import Polyfill from '../Utils/polyfill'; 暂时不需要
import TransmuxingController from './TransmuxingController';
import Events from '../Events/index';
import Segment, { MediaSegment, InitSegment } from '../Interfaces/Segment';
import { MediaInfo } from '../Interfaces/MediaInfo';
import Metadata from '../Interfaces/Metadata';
import StatisticsInfoObject from '../Interfaces/StatisticsInfo';
import WEBWORKER_CMD from '../Utils/workerCmd';

/* post message to worker:
   data: {
       cmd: string
       param: any
   }

   receive message from worker:
   data: {
       msg: string,
       data: any
   }
 */
/* eslint-disable */
const TransmuxingWorker = function (self: Worker) {
    const TAG: string = 'TransmuxingWorker';
    let controller: TransmuxingController | null = null;
    const logcatListener = onLogcatCallback.bind(self);

    // Polyfill.install();

    self.addEventListener('message', (e) => {
        switch(e.data.cmd) {
        case WEBWORKER_CMD.INIT:
            controller = new TransmuxingController(
                e.data.param[0],
                e.data.param[1],
                e.data.param[2],
                e.data.param[3]
            );
            controller.on(Events.IO_ERROR, onIOError.bind(self));
            controller.on(Events.DEMUX_ERROR, onDemuxError.bind(self));
            controller.on(Events.INIT_SEGMENT, onInitSegment.bind(self));
            controller.on(Events.MEDIA_SEGMENT, onMediaSegment.bind(self));
            controller.on(Events.LOAD_COMPLETE, onLoadingComplete.bind(self));
            controller.on(Events.RECOVERED_EARLY_EOF, onRecoveredEarlyEof.bind(self));
            controller.on(Events.MEDIA_INFO, onMediaInfo.bind(self));
            controller.on(Events.METADATA_ARRIVED, onMetaDataArrived.bind(self));
            controller.on(Events.SCRIPTDATA_ARRIVED, onScriptDataArrived.bind(self));
            controller.on(Events.STATISTICS_INFO, onStatisticsInfo.bind(self));
            controller.on(Events.RECOMMEND_SEEKPOINT, onRecommendSeekpoint.bind(self));
            controller.on(Events.GET_SEI_INFO, onGetSeiInfo.bind(self));
            controller.on(Events.MANIFEST_PARSED, onManifestParsed.bind(self));
            break;
        case WEBWORKER_CMD.DESTROY:
            if(controller) {
                controller.destroy();
                controller = null;
            }
            self.postMessage({ msg: 'destroyed' });
            break;
        case WEBWORKER_CMD.START:
            controller && controller.start();
            break;
        case WEBWORKER_CMD.STOP:
            controller && controller.stop();
            break;
        case WEBWORKER_CMD.SEEK:
            controller && controller.seek(e.data.param);
            break;
        case WEBWORKER_CMD.PAUSE:
            controller && controller.pause();
            break;
        case WEBWORKER_CMD.RESUME:
            controller && controller.resume();
            break;
        case WEBWORKER_CMD.LOG_CONFIG_CHANGE: {
            const config = e.data.param;
            LoggingControl.applyConfig(config);

            if(config.enableCallback === true) {
                LoggingControl.addLogListener(logcatListener);
            } else {
                LoggingControl.removeLogListener(logcatListener);
            }
            break;
        }
        }
    });

    function onInitSegment(type: string, initSegment: InitSegment) {
        const obj = {
            msg: Events.INIT_SEGMENT,
            data: {
                type,
                data: initSegment
            }
        };
        // self.postMessage(obj, [initSegment.data]);  // data: ArrayBuffer
        let { data } = initSegment;
        if(initSegment.data instanceof Uint8Array) {
            data = initSegment.data.buffer;
        }
        self.postMessage(obj, [data]);
    }

    function onMediaSegment(type: string, mediaSegment: MediaSegment) {
        const obj = {
            msg: Events.MEDIA_SEGMENT,
            data: {
                type,
                data: mediaSegment
            }
        };
        let { data } = mediaSegment;
        if(mediaSegment.data instanceof Uint8Array) {
            data = mediaSegment.data.buffer;
        }
        self.postMessage(obj, [data]); // data: ArrayBuffer
    }

    function onLoadingComplete() {
        const obj = {
            msg: Events.LOAD_COMPLETE
        };
        self.postMessage(obj);
    }

    function onRecoveredEarlyEof() {
        const obj = {
            msg: Events.RECOVERED_EARLY_EOF
        };
        self.postMessage(obj);
    }

    function onMediaInfo(mediaInfo: MediaInfo) {
        const obj = {
            msg: Events.MEDIA_INFO,
            data: mediaInfo
        };
        self.postMessage(obj);
    }

    function onMetaDataArrived(metadata: Metadata) {
        const obj = {
            msg: Events.METADATA_ARRIVED,
            data: metadata
        };
        self.postMessage(obj);
    }
    /**
     * 向外发送 flv的script内容
     * @param data TODO flv的script内容格式
     */
    function onScriptDataArrived(data: any) {
        const obj = {
            msg: Events.SCRIPTDATA_ARRIVED,
            data
        };
        self.postMessage(obj);
    }

    function onStatisticsInfo(statInfo: StatisticsInfoObject) {
        const obj = {
            msg: Events.STATISTICS_INFO,
            data: statInfo
        };
        self.postMessage(obj);
    }

    function onIOError(type: string, info: string) {
        self.postMessage({
            msg: Events.IO_ERROR,
            data: {
                type,
                info
            }
        });
    }

    function onDemuxError(type: string, info: string) {
        self.postMessage({
            msg: Events.DEMUX_ERROR,
            data: {
                type,
                info
            }
        });
    }

    function onRecommendSeekpoint(milliseconds: number) {
        self.postMessage({
            msg: Events.RECOMMEND_SEEKPOINT,
            data: milliseconds
        });
    }

    function onGetSeiInfo(data: Uint8Array) {
        self.postMessage({
            msg: Events.GET_SEI_INFO,
            data
        });
    }

    function onManifestParsed(data: any) {
        self.postMessage({
            msg: Events.MANIFEST_PARSED,
            data
        });
    }

    function onLogcatCallback(logType: string, logInfo: string) {
        self.postMessage({
            msg: Events.WORKER_LOG,
            data: {
                type: logType,
                msg: logInfo
            }
        });
    }
};
/* eslint-enable */
export default TransmuxingWorker;
