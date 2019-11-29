import EventEmitter from 'eventemitter3';
import Events from '../Events/index';
import Codec from '../Codecs/index';
import HJPlayerConfig from '../Interfaces/HJPlayerConfig';
import MediaConfig from '../Interfaces/MediaConfig';
import { InvalidArgumentException, IllegalStateException } from '../Utils/Exception';

class NativePlayer {
    /**
     * 解码器
     */
    Codec: Codec | null

    /**
     * 文件标签
     */
    Tag: string

    /**
     * 播放器类型
     */
    _type: string

    /**
     * 事件中心
     */
    _emitter: EventEmitter

    /**
     * 媒体设置
     */
    mediaConfig: MediaConfig

    /**
     * 用户设置
     */
    userConfig: HJPlayerConfig

    /**
     * 媒体元素
     */
    _mediaElement: HTMLMediaElement | null

    /**
     * 加载时设置的seek time
     */
    _pendingSeekTime: number | null

    /**
     * 统计信息报告定时器
     */
    _statisticsReportTimer: number | null

    /**
     * 回调函数包裹
     */
    e: any

    constructor(mediaConfig: MediaConfig, userConfig: HJPlayerConfig) {
        this.Tag = 'NativePlayer';
        this._type = 'NativePlayer';
        this._emitter = new EventEmitter();
        this.Codec = null;
        if(mediaConfig.segments) {
            throw new InvalidArgumentException(
                `NativePlayer(${mediaConfig.type}) doesn't support multipart playback!`
            );
        }

        this.e = {
            onvLoadedMetadata: this._onvLoadedMetadata.bind(this)
        };

        this._pendingSeekTime = null;
        this._statisticsReportTimer = null;
        this.mediaConfig = mediaConfig;
        this.userConfig = userConfig;
        this._mediaElement = null;
    }

    destroy() {
        if(this._mediaElement) {
            this.unload();
            this.detachMediaElement();
        }
        this.e = null;
        delete this.mediaConfig;
        this._emitter.removeAllListeners();
        delete this._emitter;
    }

    on(event: string, listener: EventEmitter.ListenerFn) {
        if(event === Events.MEDIA_INFO) {
            if(this._mediaElement != null && this._mediaElement.readyState !== 0) {
                // HAVE_NOTHING
                Promise.resolve().then(() => {
                    this._emitter.emit(Events.MEDIA_INFO, this.mediaInfo);
                });
            }
        } else if(event === Events.STATISTICS_INFO) {
            if(this._mediaElement != null && this._mediaElement.readyState !== 0) {
                Promise.resolve().then(() => {
                    this._emitter.emit(Events.STATISTICS_INFO, this.statisticsInfo);
                });
            }
        }
        this._emitter.addListener(event, listener);
    }

    off(event: string, listener: EventEmitter.ListenerFn) {
        this._emitter.removeListener(event, listener);
    }

    /**
     * 绑定媒体元素
     * @param mediaElement 媒体元素
     */
    attachMediaElement(mediaElement: HTMLMediaElement) {
        this._mediaElement = mediaElement;
        mediaElement.addEventListener('loadedmetadata', this.e.onvLoadedMetadata);

        if(this._pendingSeekTime != null) {
            try {
                mediaElement.currentTime = this._pendingSeekTime;
                this._pendingSeekTime = null;
            } catch (e) {
                // IE11 may throw InvalidStateError if readyState === 0
                // Defer set currentTime operation after loadedmetadata
            }
        }
    }

    /**
     * 解绑媒体元素
     */
    detachMediaElement() {
        if(this._mediaElement) {
            this._mediaElement.src = '';
            this._mediaElement.removeAttribute('src');
            this._mediaElement.removeEventListener('loadedmetadata', this.e.onvLoadedMetadata);
            this._mediaElement = null;
        }
        if(this._statisticsReportTimer != null) {
            window.clearInterval(this._statisticsReportTimer);
            this._statisticsReportTimer = null;
        }
    }

    /**
     * 加载媒体文件
     */
    load() {
        if(!this._mediaElement) {
            throw new IllegalStateException('HTMLMediaElement must be attached before load()!');
        }
        this._mediaElement.src = this.mediaConfig.url;

        if(this._mediaElement.readyState > 0) {
            this._mediaElement.currentTime = 0;
        }

        this._mediaElement.preload = 'auto';
        this._mediaElement.load();
        this._statisticsReportTimer = window.setInterval(
            this._reportStatisticsInfo.bind(this),
            this.userConfig.statisticsInfoReportInterval
        );
    }

    /**
     * 停止加载媒体文件
     */
    unload() {
        if(this._mediaElement) {
            this._mediaElement.src = '';
            this._mediaElement.removeAttribute('src');
        }
        if(this._statisticsReportTimer != null) {
            window.clearInterval(this._statisticsReportTimer);
            this._statisticsReportTimer = null;
        }
    }

    play() {
        if(this._mediaElement) return this._mediaElement.play();
    }

    pause() {
        this._mediaElement && this._mediaElement.pause();
    }

    get type() {
        return this._type;
    }

    get buffered() {
        if(this._mediaElement) {
            return this._mediaElement.buffered;
        }
        return null;
    }

    get duration() {
        if(this._mediaElement) {
            return this._mediaElement.duration;
        }
        return 0;
    }

    get volume() {
        if(this._mediaElement) {
            return this._mediaElement.volume;
        }
        return 0;
    }

    set volume(value: number) {
        this._mediaElement && (this._mediaElement.volume = value);
    }

    get muted() {
        if(this._mediaElement) {
            return this._mediaElement.muted;
        }
        return false;
    }

    set muted(muted: boolean) {
        this._mediaElement && (this._mediaElement.muted = muted);
    }

    get currentTime() {
        if(this._mediaElement) {
            return this._mediaElement.currentTime;
        }
        return 0;
    }

    set currentTime(seconds) {
        if(this._mediaElement) {
            this._mediaElement.currentTime = seconds;
        } else {
            this._pendingSeekTime = seconds;
        }
    }

    get mediaInfo(): {
        mediaPrefix: string
        duration?: number
        width?: number
        height?: number
        } {
        const mediaPrefix = this._mediaElement instanceof HTMLAudioElement ? 'audio/' : 'video/';
        const info = Object.create(null);
        info.mimeType = mediaPrefix + this.mediaConfig.type;
        if(this._mediaElement) {
            info.duration = Math.floor(this._mediaElement.duration * 1000);
            if(this._mediaElement instanceof HTMLVideoElement) {
                info.width = this._mediaElement.videoWidth;
                info.height = this._mediaElement.videoHeight;
            }
        }
        return info;
    }

    get statisticsInfo(): {
        playerType: string
        url: string
        decoded?: number
        dropped?: number
        } {
        const info = Object.create(null);
        info.playerType = this._type;
        info.url = this.mediaConfig.url;

        if(!(this._mediaElement instanceof HTMLVideoElement)) {
            return info;
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
            info.decodedFrames = decoded;
            info.droppedFrames = dropped;
        }

        return info;
    }

    _onvLoadedMetadata() {
        if(this._pendingSeekTime != null && this._mediaElement) {
            this._mediaElement.currentTime = this._pendingSeekTime;
            this._pendingSeekTime = null;
        }
        this._emitter.emit(Events.MEDIA_INFO, this.mediaInfo);
    }

    /**
     * 报告统计信息
     */
    _reportStatisticsInfo() {
        this._emitter.emit(Events.STATISTICS_INFO, this.statisticsInfo);
    }
}

export default NativePlayer;
