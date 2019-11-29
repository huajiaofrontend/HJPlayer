/* eslint-diabale   */
import EventEmitter from 'eventemitter3';
import Events from '../Events/index';
import Errors from '../Errors/index';
import Transmuxer from '../Controller/Transmuxer';
import MSEController from '../Controller/MSEController';
import { InitSegment, MediaSegment } from '../Interfaces/Segment';
import MediaConfig from '../Interfaces/MediaConfig';
import { IllegalStateException } from '../Utils/Exception';
import Browser from '../Utils/Browser';
import Logger from '../Utils/Logger';
import MediaInfoObject from '../Interfaces/MediaInfoObject';
import StatisticsInfoObject from '../Interfaces/StatisticsInfo';
import Metadata from '../Interfaces/Metadata';
import ErrorData from '../Interfaces/ErrorData';
import HJPlayerConfig from '../Interfaces/HJPlayerConfig';
import TSManifest from '../Interfaces/TSManifest';
/* eslint-enabale   */

class MSEPlayer {
    /**
     * 文件标签
     */
    Tag: string

    /**
     * 播放器类型
     */
    private _type: string

    /**
     * 事件中心
     */
    private _emitter: EventEmitter | null

    /**
     * 媒体设置
     */
    mediaConfig: MediaConfig | null

    /**
     * 用户设置
     */
    userConfig: HJPlayerConfig | null

    /**
     * 存放回调函数的对象
     */
    private e: any

    /**
     * 获得当前时间的函数
     */
    private _now: Function

    /**
     * 等待跳转的时间点, 在没有媒体元素时先记录该时间点
     */
    private _pendingSeekTime: number | null

    private _requestSetTime: boolean

    /**
     * seek点记录
     */
    private _seekpointRecord: SeekpointRecord | null

    /**
     * 进度检查定时器
     */
    private _progressCheckTimer: number | undefined

    /**
     * 媒体元素
     */
    private _mediaElement: HTMLMediaElement | null

    /**
     * MediaSource 控制器
     */
    private _msectl: MSEController | null

    /**
     * 转码器
     */
    private _transmuxer: Transmuxer | null

    /**
     * MediaSource 是否处于已 opened 状态
     */
    private _mseSourceOpened: boolean

    /**
     * 是否正在等待load, 如果是的话, 会在 souceOpen 事件之后 执行 load 操作
     */
    private _hasPendingLoad: boolean

    /**
     * 接收到的媒体数据流是否可以支持播放
     */
    private _receivedCanPlay: boolean

    /**
     * 媒体的信息
     */
    private _mediaInfo: MediaInfoObject | null

    /**
     * 媒体播放时的统计信息
     */
    private _statisticsInfo: StatisticsInfoObject | null

    /**
     * M3U8文档是否已经解析
     */
    private _manifestParsed: boolean

    /**
     * 开始播放时设定的 currentTime
     */
    private _startPosition: number

    /**
     * 当前播放的M3U8 playlist文档 解析后的内筒
     */
    private _currentDetail: any | null

    /**
     * 是否一直 seek 到 关键帧
     */
    private _alwaysSeekKeyframe: boolean

    constructor(mediaConfig: MediaConfig, config: HJPlayerConfig) {
        this.Tag = 'MSEPlayer';
        this._type = 'MSEPlayer';
        this._emitter = new EventEmitter();
        this.userConfig = config;
        this.mediaConfig = mediaConfig;
        this.e = {
            onvLoadedMetadata: this._onvLoadedMetadata.bind(this),
            onvSeeking: this._onvSeeking.bind(this),
            onvCanPlay: this._onvCanPlay.bind(this),
            onvStalled: this._onvStalled.bind(this),
            onvProgress: this._onvProgress.bind(this),
        };

        if(window.performance && window.performance.now) {
            this._now = window.performance.now.bind(window.performance);
        } else {
            this._now = Date.now;
        }

        this._pendingSeekTime = null; // in seconds
        this._requestSetTime = false;
        this._seekpointRecord = null;
        this._progressCheckTimer = undefined;
        this._mediaElement = null;
        this._msectl = null;
        this._transmuxer = null;
        this._mseSourceOpened = false;
        this._hasPendingLoad = false;
        this._receivedCanPlay = false;
        this._mediaInfo = null;
        this._statisticsInfo = null;

        const chromeNeedIDRFix = Browser.chrome
            && (Browser.version.major < 50
                || (Browser.version.major === 50 && Browser.version.build < 2661));
        this._alwaysSeekKeyframe = !!(chromeNeedIDRFix || Browser.msedge || Browser.msie);

        if(this._alwaysSeekKeyframe) {
            this.userConfig.accurateSeek = false;
        }

        this._manifestParsed = false; // 是否已经解析了M3U8文件
        this._startPosition = 0; // 起播点
        this._currentDetail = null; // playList-loader 解析出来的文档
    }

    /**
     * MSEPlayer销毁
     */
    destroy() {
        if(this._progressCheckTimer !== undefined) {
            window.clearInterval(this._progressCheckTimer);
            this._progressCheckTimer = undefined;
        }
        if(this._transmuxer) {
            this.unload();
        }
        if(this._mediaElement) {
            this.detachMediaElement();
        }
        this.e = null;
        this._emitter && this._emitter.removeAllListeners();
        this._manifestParsed = false;
        this._startPosition = 0;
        this._currentDetail = null;
        this._statisticsInfo = null;
        this._mediaInfo = null;
        this._seekpointRecord = null;
        delete this._emitter;
        delete this.mediaConfig;
        delete this.userConfig;
        this._emitter = null;
        this.mediaConfig = null;
        this.userConfig = null;
    }

    /**
     * MSEPlayer绑定事件
     * @param event 事件名
     * @param listener 回调函数
     */
    on(event: string, listener: EventEmitter.ListenerFn) {
        if(!this._emitter) return;
        if(event === Events.MEDIA_INFO) {
            if(this._mediaInfo !== null) {
                Promise.resolve().then(() => {
                    this._emitter && this._emitter.emit(Events.MEDIA_INFO, this.mediaInfo);
                });
            }
        } else if(event === Events.STATISTICS_INFO) {
            if(this._statisticsInfo !== null) {
                Promise.resolve().then(() => {
                    this._emitter && this._emitter.emit(Events.STATISTICS_INFO, this.statisticsInfo);
                });
            }
        }
        this._emitter.addListener(event, listener);
    }

    /**
     * MSEPlayer取消绑定事件
     * @param event 事件名
     * @param listener 回调函数
     */
    off(event: string, listener: EventEmitter.ListenerFn) {
        this._emitter && this._emitter.removeListener(event, listener);
    }

    /**
     * 媒体元素和 MediaSource 链接起来
     * @param mediaElement 要绑定的媒体元素
     */
    attachMediaElement(mediaElement: HTMLMediaElement) {
        this._mediaElement = mediaElement;
        mediaElement.addEventListener('loadedmetadata', this.e.onvLoadedMetadata);
        mediaElement.addEventListener('seeking', this.e.onvSeeking);
        mediaElement.addEventListener('canplay', this.e.onvCanPlay);
        mediaElement.addEventListener('stalled', this.e.onvStalled);
        mediaElement.addEventListener('progress', this.e.onvProgress);

        this.userConfig && (this._msectl = new MSEController(this.userConfig));

        this._msectl!.on(Events.UPDATE_END, this._onmseUpdateEnd.bind(this));
        this._msectl!.on(Events.BUFFER_FULL, this._onmseBufferFull.bind(this));
        this._msectl!.on(Events.SOURCE_OPEN, () => {
            this._mseSourceOpened = true;
            if(this._hasPendingLoad) {
                this._hasPendingLoad = false;
                this.load();
            }
        });

        this._msectl!.on(Events.ERROR, (info: ErrorData) => {
            this._emitter && this._emitter.emit(Events.ERROR, Errors.MEDIA_ERROR, Errors.MEDIA_MSE_ERROR, info);
        });

        this._msectl!.attachMediaElement(mediaElement);

        if(this._pendingSeekTime != null) {
            try {
                mediaElement.currentTime = this._pendingSeekTime;
                this._pendingSeekTime = null;
            } catch (e) {
                // IE11 may throw InvalidStateError if readyState === 0
                // We can defer set currentTime operation after loadedmetadata
            }
        }
    }

    /**
     * MediaSource 与 媒体元素 分离链接
     */
    detachMediaElement() {
        if(this._mediaElement && this.e) {
            this._msectl && this._msectl.detachMediaElement();
            this._mediaElement.removeEventListener('loadedmetadata', this.e.onvLoadedMetadata);
            this._mediaElement.removeEventListener('seeking', this.e.onvSeeking);
            this._mediaElement.removeEventListener('canplay', this.e.onvCanPlay);
            this._mediaElement.removeEventListener('stalled', this.e.onvStalled);
            this._mediaElement.removeEventListener('progress', this.e.onvProgress);
            this._mediaElement = null;
        }
        if(this._msectl) {
            this._msectl.destroy();
            this._msectl = null;
        }
        this._startPosition = 0;
    }

    /**
     * 加载媒体文件, 并绑定回调事件
     */
    load() {
        if(!this._mediaElement) {
            throw new IllegalStateException('HTMLMediaElement must be attached before load()!');
        }
        if(this._transmuxer) {
            throw new IllegalStateException(
                'FlvPlayer.load() has been called, please call unload() first!'
            );
        }
        if(this._hasPendingLoad) {
            return;
        }

        if(this.userConfig!.deferLoadAfterSourceOpen && this._mseSourceOpened === false) {
            this._hasPendingLoad = true;
            return;
        }

        if(this._mediaElement.readyState > 0) {
            // IE11 may throw InvalidStateError if readyState === 0
            this._setMediaCurrentTime(0);
        }

        this.mediaConfig && this.userConfig && (this._transmuxer = new Transmuxer(this.mediaConfig, this.userConfig));

        this._transmuxer!.on(Events.INIT_SEGMENT, (type: string, is: InitSegment) => {
            this._msectl && this._msectl.appendInitSegment(is);
        });
        this._transmuxer!.on(Events.MEDIA_SEGMENT, (type: string, ms: MediaSegment) => {
            this._msectl && this._msectl.appendMediaSegment(ms);
            // lazyLoad check TODO 需要TS解码器中的Segment中添加Sample的相关信息, 添加后同样适用 HLS 点播流
            // && this.mediaConfig!.type === 'flv'
            if(
                this.userConfig!.lazyLoad
                && !this.userConfig!.isLive
                && this._mediaElement
            ) {
                const { currentTime } = this._mediaElement;
                if(
                    ms.info
                    && ms.info.endDts >= (currentTime + this.userConfig!.lazyLoadMaxDuration) * 1000
                ) {
                    if(this._progressCheckTimer === undefined) {
                        Logger.info(
                            this.Tag,
                            'Maximum buffering duration exceeded, suspend transmuxing task'
                        );
                        Logger.info(this.Tag, `start load at ${ms.info.endDts}`);
                        this._suspendTransmuxer();
                    }
                }
            }
        });
        this._transmuxer!.on(Events.LOAD_COMPLETE, () => {
            this._msectl && this._msectl.endOfStream();
            this._emitter!.emit(Events.LOAD_COMPLETE);
        });
        this._transmuxer!.on(Events.RECOVERED_EARLY_EOF, () => {
            this._emitter!.emit(Events.RECOVERED_EARLY_EOF);
        });
        this._transmuxer!.on(Events.IO_ERROR, (detail: string, info: ErrorData) => {
            this._emitter!.emit(Events.ERROR, Errors.NETWORK_ERROR, detail, info);
        });
        this._transmuxer!.on(Events.DEMUX_ERROR, (detail: string, info: string) => {
            this._emitter!.emit(Events.ERROR, Errors.MEDIA_ERROR, detail, { code: -1, reason: info });
        });
        this._transmuxer!.on(Events.MEDIA_INFO, (mediaInfo: MediaInfoObject) => {
            this._mediaInfo = mediaInfo;
            this._emitter!.emit(Events.MEDIA_INFO, { ...mediaInfo });
        });
        this._transmuxer!.on(Events.METADATA_ARRIVED, (metadata: Metadata) => {
            this._emitter!.emit(Events.METADATA_ARRIVED, metadata);
        });
        this._transmuxer!.on(Events.SCRIPTDATA_ARRIVED, (data: any) => {
            this._emitter!.emit(Events.SCRIPTDATA_ARRIVED, data);
        });
        this._transmuxer!.on(Events.STATISTICS_INFO, (statInfo: StatisticsInfoObject) => {
            this._statisticsInfo = this._fillStatisticsInfo(statInfo);
            this._emitter!.emit(Events.STATISTICS_INFO, { ...this._statisticsInfo });
        });
        this._transmuxer!.on(Events.RECOMMEND_SEEKPOINT, (milliseconds: number) => {
            if(this._mediaElement && !this.userConfig!.accurateSeek) {
                this._setMediaCurrentTime(milliseconds / 1000);
            }
        });

        this._transmuxer!.on(Events.GET_SEI_INFO, (data: Uint8Array) => {
            this._emitter!.emit(Events.GET_SEI_INFO, data);
        });

        this._transmuxer!.on(Events.MANIFEST_PARSED, (data: TSManifest) => { // 只对HLS生效
            // this._dealVideoCurrentTime(data);
            if(!this._manifestParsed) {
                this._manifestParsed = true;
                if(data.details.live === true) {
                    this.setMediaSourceDuration(Infinity);
                } else {
                    this.setMediaSourceDuration(data.details.totalduration);
                }
            }
            this._emitter!.emit(Events.MANIFEST_PARSED, data);
            this._currentDetail = data.details;
        });

        this._transmuxer && this._transmuxer.open();
    }

    /**
     * 停止加载
     */
    unload() {
        if(this._mediaElement) {
            this._mediaElement.pause();
        }
        if(this._msectl) {
            this._msectl.seek();
        }
        if(this._transmuxer) {
            this._transmuxer.close();
            this._transmuxer.destroy();
            this._transmuxer = null;
        }
        this._manifestParsed = false;
        this._startPosition = 0;
        this._currentDetail = null;
    }

    /**
     * 开始播放
     */
    play() {
        if(this._mediaElement) {
            return this._mediaElement.play();
        }
    }

    /**
     * 暂停
     */
    pause() {
        this._mediaElement && this._mediaElement.pause();
    }

    /**
     * 返回当前播放器类型
     */
    get type() {
        return this._type;
    }

    /**
     * 返回媒体元素已缓存的时间段
     */
    get buffered() {
        return this._mediaElement ? this._mediaElement.buffered : null;
    }

    /**
     * 返回媒体元素加载的时长或者整个媒体文件的时长
     */
    get duration() {
        return this._mediaElement ? this._mediaElement.duration : 0;
    }

    /**
     * 获取媒体元素的声音大小
     */
    get volume() {
        return this._mediaElement ? this._mediaElement.volume : 0;
    }

    /**
     * 设置媒体元素的声音
     */
    set volume(value) {
        this._mediaElement && (this._mediaElement.volume = value);
    }

    /**
     * 获取媒体元素是否静音
     */
    get muted() {
        return this._mediaElement ? this._mediaElement.muted : false;
    }

    /**
     * 设置媒体静音
     */
    set muted(muted) {
        this._mediaElement && (this._mediaElement.muted = muted);
    }

    /**
     * 获取媒体元素当前播放的时间点
     */
    get currentTime() {
        if(this._mediaElement) {
            return this._mediaElement.currentTime;
        }
        return 0;
    }

    /**
     * 设置媒体元素的 currentTime
     */
    set currentTime(seconds) {
        if(this._mediaElement) {
            this._internalSeek(seconds);
        } else {
            this._pendingSeekTime = seconds;
        }
    }

    /**
     * 获取媒体文件信息
     */
    get mediaInfo() {
        return { ...this._mediaInfo };
    }

    /**
     * 获取播放器的统计信息
     */
    get statisticsInfo() {
        if(this._statisticsInfo == null) {
            this._statisticsInfo = {};
        }
        this._statisticsInfo = this._fillStatisticsInfo(this._statisticsInfo);
        return { ...this._statisticsInfo };
    }

    /**
     * 填充 MSEPlayer 这一层的少量统计信息, 并返回全部统计信息
     * @param statInfo 待填充 MSEPlayer 这一层信息的残缺的统计信息
     */
    private _fillStatisticsInfo(statInfo: StatisticsInfoObject): StatisticsInfoObject {
        statInfo.playerType = this._type;

        if(!(this._mediaElement instanceof HTMLVideoElement)) {
            return statInfo;
        }

        let hasQualityInfo = true;
        let decoded = 0;
        let dropped = 0;

        if(this._mediaElement.getVideoPlaybackQuality) {
            const quality = this._mediaElement.getVideoPlaybackQuality();
            decoded = quality.totalVideoFrames;
            dropped = quality.droppedVideoFrames;
        } else if((this._mediaElement as any).webkitDecodedFrameCount !== undefined) {
            decoded = (this._mediaElement as any).webkitDecodedFrameCount;
            dropped = (this._mediaElement as any).webkitDroppedFrameCount;
        } else {
            hasQualityInfo = false;
        }

        if(hasQualityInfo) {
            statInfo.decodedFrames = decoded;
            statInfo.droppedFrames = dropped;
        }

        return statInfo;
    }

    /**
     * 当 MediaSource 更新结束后的处理事件, 通过判断已缓存的进度来判断是否暂停加载
     */
    private _onmseUpdateEnd() {
        if(!this.userConfig!.lazyLoad || this.userConfig!.isLive || !this._mediaElement) {
            return;
        }

        const { buffered } = this._mediaElement;
        const { currentTime } = this._mediaElement;
        let currentRangeEnd = 0;

        for(let i = 0; i < buffered.length; i++) {
            const start = buffered.start(i);
            const end = buffered.end(i);
            if(start <= currentTime && currentTime < end) {
                currentRangeEnd = end;
                break;
            }
        }

        if(
            currentRangeEnd >= currentTime + this.userConfig!.lazyLoadMaxDuration
            && this._progressCheckTimer === undefined
        ) {
            Logger.info(this.Tag, 'Maximum buffering duration exceeded, suspend transmuxing task');
            Logger.info(this.Tag, `start load at ${currentRangeEnd}`);
            this._suspendTransmuxer();
        }
    }

    /**
     * 当 MediaSource Buffer 已满的处理事件, 暂停加载
     */
    private _onmseBufferFull() {
        Logger.info(this.Tag, 'MSE SourceBuffer is full, suspend transmuxing task');
        if(this._progressCheckTimer === undefined) {
            this._suspendTransmuxer();
        }
    }

    /**
     * 暂停加载, 并启动进度检查定时器
     */
    private _suspendTransmuxer() {
        if(this._transmuxer) {
            this._transmuxer.pause();

            if(this._progressCheckTimer === undefined) {
                this._progressCheckTimer = window.setInterval(
                    this._checkProgressAndResume.bind(this),
                    1000
                );
            }
        }
    }

    /**
     * 检查播放进度, 当 currentTime 和 缓存的进度 之间的差值 小于 this.userConfig.lazyLoadRecoverDuration 时, 恢复加载
     */
    private _checkProgressAndResume() {
        if(!this._mediaElement) return;
        /**
         * 媒体元素当前播放时间点
         */
        const { currentTime } = this._mediaElement;
        /**
         * 媒体元素缓冲的时间点
         */
        const { buffered } = this._mediaElement;
        /**
         * 是否需要回复加载
         */
        let needResume = false;

        for(let i = 0; i < buffered.length; i++) {
            const start = buffered.start(i);
            const end = buffered.end(i);
            if(currentTime >= start && currentTime < end) {
                if(currentTime >= end - this.userConfig!.lazyLoadRecoverDuration) {
                    needResume = true;
                }
                break;
            }
        }

        if(needResume) {
            window.clearInterval(this._progressCheckTimer);
            this._progressCheckTimer = undefined;
            if(needResume) {
                Logger.info(this.Tag, 'Continue loading from paused position');
                this._transmuxer && this._transmuxer.resume();
            }
        }
    }

    /**
     * 查询要跳转的时间点是否已处于缓存区域
     * @param seconds 查询的时间点
     */
    private _isTimepointBuffered(seconds: number) {
        if(!this._mediaElement) return false;

        const { buffered } = this._mediaElement;

        for(let i = 0; i < buffered.length; i++) {
            const from = buffered.start(i);
            const to = buffered.end(i);
            if(seconds >= from && seconds < to) {
                return true;
            }
        }
        return false;
    }

    /**
     * 非用户操作的内部跳转
     * @param seconds seek的描述
     */
    private _internalSeek(seconds: number) {
        if(!this._mediaElement) return false;
        /**
         * 是否能直接跳转
         */
        const directSeek = this._isTimepointBuffered(seconds);
        /**
         * 是否直接跳转到视频开始处
         */
        let directSeekBegin = false;
        /**
         * 直接跳转到开始处的相应时间
         */
        let directSeekBeginTime = 0;

        if(seconds < 1.0 && this._mediaElement.buffered.length > 0) {
            const videoBeginTime = this._mediaElement.buffered.start(0);
            if((videoBeginTime < 1.0 && seconds < videoBeginTime) || Browser.safari) {
                directSeekBegin = true;
                // also workaround for Safari: Seek to 0 may cause video stuck, use 0.1 to avoid
                directSeekBeginTime = Browser.safari ? 0.1 : videoBeginTime;
            }
        }

        if(directSeekBegin) {
            // seek to video begin, set currentTime directly if beginPTS buffered
            this._setMediaCurrentTime(directSeekBeginTime);
            return;
        }

        if(directSeek) {
            // buffered position
            if(!this._alwaysSeekKeyframe) {
                this._setMediaCurrentTime(seconds);
            } else {
                const idr = this._msectl
                    ? this._msectl.getNearestKeyframe(Math.floor(seconds * 1000))
                    : null;
                const setTime: number = idr !== null ? idr.dts / 1000 : seconds;
                this._setMediaCurrentTime(setTime);
            }
            if(this._progressCheckTimer !== undefined) {
                this._checkProgressAndResume();
            }
            return;
        }

        if(this._progressCheckTimer !== undefined) {
            window.clearInterval(this._progressCheckTimer);
            this._progressCheckTimer = undefined;
        }
        this._msectl && this._msectl.seek();
        this._transmuxer && this._transmuxer.seek(Math.floor(seconds * 1000)); // in milliseconds
        // no need to set mediaElement.currentTime if non-accurateSeek,
        // just wait for the recommend_seekpoint callback
        if(this.userConfig!.accurateSeek) {
            this._setMediaCurrentTime(seconds);
        }
    }

    /**
     * 过100毫秒之后检查, 如果要跳转的点还没有缓存就停止progressCheck, _msectl 和 _transmuxer 跳转到相应时间点
     */
    private _checkAndApplyUnbufferedSeekpoint() {
        if(this._seekpointRecord && this._mediaElement) {
            if(this._seekpointRecord.recordTime <= this._now() - 100) {
                const target = this._mediaElement.currentTime;
                this._seekpointRecord = null;
                if(!this._isTimepointBuffered(target)) {
                    if(this._progressCheckTimer !== undefined) {
                        window.clearTimeout(this._progressCheckTimer);
                        this._progressCheckTimer = undefined;
                    }
                    // .currentTime is consists with .buffered timestamp
                    // Chrome/Edge use DTS, while FireFox/Safari use PTS
                    this._msectl && this._msectl.seek();
                    this._transmuxer && this._transmuxer.seek(Math.floor(target * 1000));
                    // set currentTime if accurateSeek, or wait for recommend_seekpoint callback
                    if(this.userConfig!.accurateSeek && this._mediaElement) {
                        // this._requestSetTime = true
                        // this._mediaElement.currentTime = target
                        this._setMediaCurrentTime(target);
                    }
                }
            } else {
                window.setTimeout(this._checkAndApplyUnbufferedSeekpoint.bind(this), 50);
            }
        }
    }

    /**
     * 当 MediaElement 触发 `stalled`事件 或者 触发 `progress` 时的操作, 进行检查和恢复处理
     * @param stalled 是否卡住了
     */
    private _checkAndResumeStuckPlayback(stalled?: boolean) {
        if(!this._mediaElement) return false;
        const media = this._mediaElement;
        if(stalled || !this._receivedCanPlay || media.readyState < 2) {
            // HAVE_CURRENT_DATA
            const { buffered } = media;
            if(buffered.length > 0 && media.currentTime < buffered.start(0)) {
                Logger.warn(
                    this.Tag,
                    `Playback seems stuck at ${media.currentTime}, seek to ${buffered.start(0)}`
                );
                this._setMediaCurrentTime(buffered.start(0));
                this._mediaElement.removeEventListener('progress', this.e.onvProgress);
            }
        } else {
            // Playback didn't stuck, remove progress event listener
            this._mediaElement.removeEventListener('progress', this.e.onvProgress);
        }
    }

    /**
     * 当接收到视频Metadata数据时的处理函数, 当已收到Metadata后把等待跳转的时间点设置为元素的currentTime
     * 当IE11在 attachMedia时设置 currentTime 报错, 那么在 LoadedMetadata 后设置 currentTime
     */
    private _onvLoadedMetadata() {
        if(this._pendingSeekTime != null && this._mediaElement) {
            this._mediaElement.currentTime = this._pendingSeekTime;
            this._pendingSeekTime = null;
        }
    }

    /**
     * 当视频 seek 的时候处理函数
     */
    private _onvSeeking() {
        // handle seeking request from browser's progress bar
        if(!this._mediaElement) return false;
        const target = this._mediaElement.currentTime;
        const { buffered } = this._mediaElement;

        if(this._requestSetTime) {
            this._requestSetTime = false;
            return;
        }

        if(target < 1.0 && buffered.length > 0) {
            // seek to video begin, set currentTime directly if beginPTS buffered
            const videoBeginTime = buffered.start(0);
            if((videoBeginTime < 1.0 && target < videoBeginTime) || Browser.safari) {
                // also workaround for Safari: Seek to 0 may cause video stuck, use 0.1 to avoid
                // this._mediaElement.currentTime = Browser.safari ? 0.1 : videoBeginTime
                this._setMediaCurrentTime(Browser.safari ? 0.1 : videoBeginTime);
                return;
            }
        }

        if(this._isTimepointBuffered(target)) {
            if(this._alwaysSeekKeyframe && this._msectl) {
                const idr = this._msectl.getNearestKeyframe(Math.floor(target * 1000));
                if(idr != null) {
                    this._setMediaCurrentTime(idr.dts / 1000);
                }
            }
            if(this._progressCheckTimer !== undefined) {
                this._checkProgressAndResume();
            }
            return;
        }

        this._seekpointRecord = {
            seekPoint: target,
            recordTime: this._now()
        };

        window.setTimeout(this._checkAndApplyUnbufferedSeekpoint.bind(this), 50);
    }

    private _onvCanPlay() {
        this._receivedCanPlay = true;
        this._mediaElement && this._mediaElement.removeEventListener('canplay', this.e.onvCanPlay);
    }

    private _onvStalled() {
        this._checkAndResumeStuckPlayback(true);
    }

    private _onvProgress() {
        this._checkAndResumeStuckPlayback();
    }

    /**
     * 给 media 设置 currentTime
     * @param seconds 设置的时间
     */
    private _setMediaCurrentTime(seconds: number) {
        this._requestSetTime = true;
        this._mediaElement && (this._mediaElement.currentTime = seconds);
    }

    setMediaSourceDuration(duration: number) {
        this._msectl!.setMediaSourceDuration(duration);
    }
}

export default MSEPlayer;
