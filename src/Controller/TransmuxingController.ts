import EventEmitter from 'eventemitter3';
import Browser from '../Utils/Browser';
import MediaInfo from './MediaInfo';
import Errors from '../Errors/index';
import IOController from './IOController';
import Events from '../Events/index';
import createHLSDefaultConfig from '../Utils/createHLSDefaultConfig';
import typeSupportData from '../Interfaces/typeSupportData';
import TempNavigatorType from '../Interfaces/TempNavigator';
import Logger from '../Utils/Logger';
import Metadata from '../Interfaces/Metadata';
import ErrorData from '../Interfaces/ErrorData';
import { MediaSegment, InitSegment } from '../Interfaces/Segment';
import MediaConfig from '../Interfaces/MediaConfig';
import FileSegment from '../Interfaces/FileSegment';
import TSCodec from '../Codecs/TSCodec'; // TS解码器和转码器
import FLVCodec from '../Codecs/FLVCodec'; // FLV的解码器和转码器
import HJPlayerConfig from '../Interfaces/HJPlayerConfig';
import { TSExtraData } from '../Interfaces/TSExtraData';
import getGlobal from '../Utils/getGlobalObject';
import TSManifest from '../Interfaces/TSManifest';

const GG = getGlobal();
// Transmuxing (IO, Demuxing, Remuxing) controller, with multipart support
class TransmuxingController {
    /**
     * 文件标签
     */
    Tag: string

    /**
     * 事件中心
     */
    private _emitter: EventEmitter

    /**
     * 媒体设置
     */
    private _mediaDataSource: MediaConfig

    /**
     * 用户设置
     */
    private _config: HJPlayerConfig

    /**
     * MediaSource对MP4, MEPG, MP3格式是否支持
     */
    private typeSupported: typeSupportData

    /**
     * 上一级缓存的关于navigator的数据, 用于在worker中解码TS音视频的必要参数
     */
    private navigator: TempNavigatorType

    /**
     * 当前播放的媒体片段的索引值, 在MediaConfig中无segment选项是 0
     */
    private _currentSegmentIndex: number

    /**
     * 媒体信息
     */
    private _mediaInfo: MediaInfo | null | any

    /**
     * IO 控制器, 主要负责缓存loader发送过来的数据
     */
    private _ioctl: IOController | null

    /**
     * 未加载时 挂起的 seek 时间点
     */
    private _pendingSeekTime: number | null

    /**
     * 等待解决的seek时间点 (单位: 毫秒)
     */
    private _pendingResolveSeekPoint: number | null

    /**
     * 统计信息报告定时器
     */
    private _statisticsReportTimer: number | undefined | null

    /**
     * 新版解码器 待实现
     */
    private _mediaCodec: TSCodec | FLVCodec | null

    /**
     * 旧版解码器
     */
    private _demuxer: null

    /**
     * 旧版转码器
     */
    private _remuxer: null

    constructor(
        mediaDataSource: MediaConfig,
        config: HJPlayerConfig,
        typeSupported: typeSupportData,
        navigator: TempNavigatorType
    ) {
        this.Tag = 'TransmuxingController';
        this._emitter = new EventEmitter();
        this._config = config;
        this.typeSupported = typeSupported;
        this.navigator = navigator;
        this._mediaCodec = null;
        // fill in default IO params if not exists
        if(typeof mediaDataSource.cors !== 'boolean') {
            mediaDataSource.cors = true;
        }

        if(typeof mediaDataSource.withCredentials !== 'boolean') {
            mediaDataSource.withCredentials = false;
        }

        this._mediaDataSource = mediaDataSource;
        let totalDuration = 0;
        this._currentSegmentIndex = 0;
        // treat single part media as multipart media, which has only one segment
        if(!mediaDataSource.segments) {
            this._mediaDataSource.segments = [
                {
                    duration: mediaDataSource.duration as any, // 可能是 undefined
                    filesize: mediaDataSource.fileSize,
                    url: mediaDataSource.url,
                    type: mediaDataSource.type,
                    live: config.isLive
                }
            ];
        }

        this._mediaDataSource.segments!.forEach((segment) => {
            // timestampBase for each segment, and calculate total duration
            segment.timestampBase = totalDuration;
            totalDuration += <number>segment.duration;
            // params needed by IOController
            segment.cors = mediaDataSource.cors;
            segment.withCredentials = mediaDataSource.withCredentials;
            // referrer policy control, if exist
            if(config.referrerPolicy) {
                segment.referrerPolicy = config.referrerPolicy;
            }
        });

        if(!Number.isNaN(totalDuration) && this._mediaDataSource.duration !== totalDuration) {
            this._mediaDataSource.duration = totalDuration;
        }

        this._mediaInfo = null;

        this._mediaCodec = null;

        this._ioctl = null;

        this._pendingSeekTime = null;

        this._pendingResolveSeekPoint = null;

        this._statisticsReportTimer = null;
    }

    destroy() {
        this._mediaInfo = null;

        delete this._mediaDataSource;

        if(this._statisticsReportTimer) {
            this._disableStatisticsReporter();
        }

        if(this._ioctl) {
            this._ioctl.destroy();
            this._ioctl = null;
        }

        // 摧毁解码器
        if(this._mediaCodec) {
            this._mediaCodec.destroy();
            this._mediaCodec = null;
        }

        this._emitter.removeAllListeners();
        delete this._emitter;
    }

    on(event: string, listener: EventEmitter.ListenerFn) {
        this._emitter.on(event, listener);
    }

    off(event: string, listener: EventEmitter.ListenerFn) {
        this._emitter.off(event, listener);
    }

    start() {
        this._loadSegment(0);
        this._enableStatisticsReporter();
    }

    /**
     * 加载segment
     * @param { Number } segmentIndex - segment 索引值
     * @param {  Number } optionalFrom - 选择的开始地点
     */
    _loadSegment(segmentIndex: number, optionalFrom?: number) {
        this._currentSegmentIndex = segmentIndex;
        const dataSource = (this._mediaDataSource.segments as Array<FileSegment>)[segmentIndex];
        this._ioctl = new IOController(dataSource, this._config, segmentIndex);
        const ioctl = this._ioctl;
        ioctl.onError = this._onIOException.bind(this);
        ioctl.onSeeked = this._onIOSeeked.bind(this);
        ioctl.onComplete = this._onIOComplete.bind(this);
        ioctl.onRedirect = this._onIORedirect.bind(this);
        ioctl.onRecoveredEarlyEof = this._onIORecoveredEarlyEof.bind(this);
        ioctl.onManifestParsed = this._onManifestParsed.bind(this);

        if(optionalFrom && this._mediaCodec) {
            this._mediaCodec.bindDataSource(this._ioctl);
        } else {
            ioctl.onDataArrival = this._onInitChunkArrival.bind(this);
        }

        ioctl.open(optionalFrom);
    }

    stop() {
        this._internalAbort();
        this._disableStatisticsReporter();
    }

    _internalAbort() {
        if(this._ioctl) {
            this._ioctl.destroy();
            this._ioctl = null;
        }
    }

    pause() {
        // take a rest
        if(this._ioctl && this._ioctl.isWorking()) {
            this._ioctl.pause();
            this._disableStatisticsReporter();
        }
    }

    resume() {
        if(this._ioctl && this._ioctl.isPaused()) {
            this._ioctl.resume();
            this._enableStatisticsReporter();
        }
    }

    seek(milliseconds: number) {
        if(this._mediaDataSource.type === 'm3u8') {
            // m3u8 处理seek部分 需要去fragment-loader里去处理
            this._ioctl && this._ioctl.tsSeek(milliseconds);
            this.resume();
        } else {
            // flv 处理 seek
            if(this._mediaInfo == null || !this._mediaInfo.isSeekable()) {
                return;
            }

            const targetSegmentIndex = this._searchSegmentIndexContains(milliseconds);
            if(targetSegmentIndex === this._currentSegmentIndex) {
                // intra-segment seeking
                const segmentInfo = this._mediaInfo.segments
                    ? this._mediaInfo.segments[targetSegmentIndex]
                    : undefined;

                if(!segmentInfo) {
                    // current segment loading started, but mediainfo hasn't received yet
                    // wait for the metadata loaded, then seek to expected position
                    this._pendingSeekTime = milliseconds;
                } else {
                    const keyframe = segmentInfo.getNearestKeyframe(milliseconds);
                    this._mediaCodec && this._mediaCodec.seek(keyframe.milliseconds);
                    this._ioctl && this._ioctl.seek(keyframe.fileposition);
                    // Will be resolved in _onRemuxerMediaSegmentArrival()
                    this._pendingResolveSeekPoint = keyframe.milliseconds;
                }
            } else {
                // cross-segment seeking
                const targetSegmentInfo = this._mediaInfo.segments && this._mediaInfo.segments[targetSegmentIndex]
                    ? this._mediaInfo.segments[targetSegmentIndex]
                    : undefined;

                if(targetSegmentInfo === undefined) {
                    // target segment hasn't been loaded. We need metadata then seek to expected time
                    this._pendingSeekTime = milliseconds;
                    this._internalAbort();
                    if(this._mediaCodec) {
                        this._mediaCodec.seek();
                        this._mediaCodec.insertDiscontinuity();
                    }
                    this._loadSegment(targetSegmentIndex);
                    // Here we wait for the metadata loaded, then seek to expected position
                } else {
                    // We have target segment's metadata, direct seek to target position
                    const keyframe = targetSegmentInfo.getNearestKeyframe(milliseconds);
                    this._internalAbort();
                    if(this._mediaCodec) {
                        this._mediaCodec.seek();
                        this._mediaCodec.insertDiscontinuity();
                        this._mediaCodec.resetMediaInfo();
                        this._mediaCodec.timestampBase = (this._mediaDataSource.segments as Array<
                            FileSegment
                        >)[targetSegmentIndex].timestampBase;
                    }
                    this._loadSegment(targetSegmentIndex, keyframe.fileposition);
                    this._pendingResolveSeekPoint = keyframe.milliseconds;
                    this._reportSegmentMediaInfo(targetSegmentIndex);
                }
            }
        }

        this._enableStatisticsReporter();
    }

    /**
     * 根据要跳转的毫秒数和每个Segment的timestampBase的比较, 来查找相应的Segment索引值
     * @param milliseconds 跳转的毫秒数
     */
    _searchSegmentIndexContains(milliseconds: number) {
        const segments = this._mediaDataSource.segments as Array<FileSegment>;
        let idx = segments.length - 1;

        for(let i = 0; i < segments.length; i++) {
            if(milliseconds < segments[i].timestampBase) {
                idx = i - 1;
                break;
            }
        }
        return idx;
    }

    /**
     * 当loader第一次发送过来数据时, 先判断解码器是否能解码数据, 然后初始化解码器, 绑定事件, 否则触发错误
     * @param { ArrayBuffer } data  flv 是 array  m3u8的loader是Uint8Array
     * @param { Number } byteStart 本次收到的数据的偏移量
     * @param { Number } receivedLength 累计的bytelength
     * @param { Object } extraData m3u8的fragmentLoader所发出来的数据 详见 fragment-loader
     */
    _onInitChunkArrival(
        data: ArrayBuffer,
        byteStart: number,
        extraData: TSExtraData
    ) {
        /**
         * probe功能探测数据返回的结果
         */
        let probeData = null;
        /**
         * 已被处理的数据的长度
         */
        let consumed = 0;
        if(byteStart > 0) {
            // IOController seeked immediately after opened, byteStart > 0 callback may received
            if(this._mediaCodec) {
                this._mediaCodec.bindDataSource(this._ioctl);
                this._mediaCodec.timestampBase = (this._mediaDataSource.segments as Array<
                    FileSegment
                >)[this._currentSegmentIndex].timestampBase;
                consumed = this._mediaCodec.parseChunks(data, byteStart, extraData);
                return consumed;
            }
        }

        probeData = FLVCodec.probe(data);

        if(probeData.match) {
            // Always create new FLVDemuxer
            this._mediaCodec = new FLVCodec(data, this._config);

            const mds = this._mediaDataSource;
            if(mds.duration !== undefined && !Number.isNaN(mds.duration)) {
                this._mediaCodec.overridedDuration = mds.duration;
            }

            if(typeof mds.hasAudio === 'boolean') {
                this._mediaCodec.overridedHasAudio = mds.hasAudio;
            }

            if(typeof mds.hasVideo === 'boolean') {
                this._mediaCodec.overridedHasVideo = mds.hasVideo;
            }

            this._mediaCodec.timestampBase = (mds.segments as Array<FileSegment>)[
                this._currentSegmentIndex
            ].timestampBase;

            this._mediaCodecBindEvents();
            // this._remuxer.bindDataSource(this._demuxer.bindDataSource(this._ioctl));
            this._mediaCodec.bindDataSource(this._ioctl);

            consumed = this._mediaCodec.parseChunks(data, byteStart);
            return consumed;
        }

        const tsProbeResult = TSCodec.probe(data);
        if(tsProbeResult) {
            this._mediaCodec = new TSCodec(
                createHLSDefaultConfig(),
                this.typeSupported,
                this.navigator
            );

            this._mediaCodecBindEvents();

            this._mediaCodec.resetInitSegment(
                new Uint8Array(extraData.initSegmentData),
                extraData.audioCodec,
                extraData.videoCodec,
                extraData.totalduration
            );
            this._mediaCodec.resetTimeStamp(undefined); // ts的_demuxer.resetTimeStamp 是没有任何作用的
            this._mediaCodec.bindDataSource(this._ioctl);
            this._mediaCodec.parseChunks(new Uint8Array(data), byteStart, extraData);
            consumed = data.byteLength; // 每个TS文件都为188个字节的整数倍, 所以处理过的数据应为全部数据, 没有余量
            return consumed;
        }

        probeData = null;

        Logger.error(this.Tag, `Unsupported media type, this ${this._mediaDataSource.type} stream is not standard format`);

        Promise.resolve().then(() => {
            this._internalAbort();
        });

        this._emitter.emit(
            Events.DEMUX_ERROR,
            Errors.FORMAT_UNSUPPORTED,
            `Unsupported media type, this ${this._mediaDataSource.type} stream is not standard format!`
        );
        consumed = 0;
        return consumed;
    }

    _onMediaInfo(mediaInfo: MediaInfo) {
        if(this._mediaInfo === null) {
            // Store first segment's mediainfo as global mediaInfo
            this._mediaInfo = { ...mediaInfo };
            this._mediaInfo.keyframesIndex = null;
            this._mediaInfo.segments = [];
            this._mediaInfo.segmentCount = (this._mediaDataSource.segments as Array<
                FileSegment
            >).length;
            Object.setPrototypeOf(this._mediaInfo, MediaInfo.prototype);
        }

        const segmentInfo = { ...mediaInfo };

        Object.setPrototypeOf(segmentInfo, MediaInfo.prototype);

        (this._mediaInfo.segments as any)[this._currentSegmentIndex] = segmentInfo;

        // notify mediaInfo update
        this._reportSegmentMediaInfo(this._currentSegmentIndex);

        if(this._pendingSeekTime != null) {
            Promise.resolve().then(() => {
                const target = Number(this._pendingSeekTime);
                this._pendingSeekTime = null;
                this.seek(target);
            });
        }
    }

    _onMetaDataArrived(metadata: Metadata) {
        this._emitter.emit(Events.METADATA_ARRIVED, metadata);
    }

    _onScriptDataArrived(data: any) {
        this._emitter.emit(Events.SCRIPTDATA_ARRIVED, data);
    }

    _onIOSeeked() {
        this._mediaCodec && this._mediaCodec.insertDiscontinuity();
    }

    _onIOComplete(extraData: number) {
        const segmentIndex = extraData;
        const nextSegmentIndex = segmentIndex + 1;
        if(this._mediaCodec) {
            if(nextSegmentIndex < (this._mediaDataSource.segments as Array<FileSegment>).length) {
                this._internalAbort();
                this._mediaCodec.flushStashedSamples && this._mediaCodec.flushStashedSamples();
                this._loadSegment(nextSegmentIndex);
            } else {
                this._mediaCodec.flushStashedSamples && this._mediaCodec.flushStashedSamples();
                this._emitter.emit(Events.LOAD_COMPLETE);
                this._disableStatisticsReporter();
            }
        }
    }

    _onIORedirect(redirectedURL: string) {
        const segmentIndex: number = <number>(this._ioctl as IOController).extraData;
        (this._mediaDataSource.segments as Array<FileSegment>)[
            segmentIndex
        ].redirectedURL = redirectedURL;
    }

    _onIORecoveredEarlyEof() {
        this._emitter.emit(Events.RECOVERED_EARLY_EOF);
    }

    _onIOException(type: string, info: ErrorData) {
        Logger.error(
            this.Tag,
            `IOException: type = ${type}, code = ${info.code}, msg = ${info.reason}`
        );
        this._emitter.emit(Events.IO_ERROR, type, info);
        this._disableStatisticsReporter();
    }

    _onDemuxException(type: string, info: ErrorData) {
        Logger.error(this.Tag, `DemuxException: type = ${type}, info = ${info.reason}`);
        this._emitter.emit(Events.DEMUX_ERROR, type, info);
    }

    _onRemuxerInitSegmentArrival(type: string, initSegment: InitSegment) {
        this._emitter.emit(Events.INIT_SEGMENT, type, initSegment);
    }

    _onRemuxerMediaSegmentArrival(type: string, mediaSegment: MediaSegment) {
        if(this._pendingSeekTime != null) {
            // Media segments after new-segment cross-seeking should be dropped.
            return;
        }
        this._emitter.emit(Events.MEDIA_SEGMENT, type, mediaSegment);

        // Resolve pending seekPoint
        if(this._pendingResolveSeekPoint != null && type === 'video') {
            const { syncPoints } = mediaSegment.info;
            let seekpoint = this._pendingResolveSeekPoint;
            this._pendingResolveSeekPoint = null;

            // Safari: Pass PTS for recommend_seekpoint
            if(
                Browser.safari
                && syncPoints.length > 0
                && syncPoints[0].originalDts === seekpoint
            ) {
                seekpoint = syncPoints[0].pts;
            }
            // else: use original DTS (keyframe.milliseconds)

            this._emitter.emit(Events.RECOMMEND_SEEKPOINT, seekpoint);
        }
    }

    _enableStatisticsReporter() {
        if(this._statisticsReportTimer == null) {
            this._statisticsReportTimer = GG.setInterval(
                this._reportStatisticsInfo.bind(this),
                this._config.statisticsInfoReportInterval
            );
        }
    }

    _disableStatisticsReporter() {
        if(this._statisticsReportTimer) {
            GG.clearInterval(this._statisticsReportTimer);
            this._statisticsReportTimer = null;
        }
    }

    _reportSegmentMediaInfo(segmentIndex: number) {
        const segmentInfo = ((this._mediaInfo as MediaInfo).segments as Array<FileSegment>)[
            segmentIndex
        ];
        const exportInfo = { ...segmentInfo };

        exportInfo.duration = <number>(this._mediaInfo as MediaInfo).duration;
        exportInfo.segmentCount = (this._mediaInfo as MediaInfo).segmentCount;
        delete exportInfo.segments;
        delete exportInfo.keyframesIndex;

        this._emitter.emit(Events.MEDIA_INFO, exportInfo);
    }

    _reportStatisticsInfo() {
        const info = Object.create(null);

        if(this._ioctl) {
            info.url = this._ioctl.currentURL;
            info.hasRedirect = this._ioctl.hasRedirect;
            if(info.hasRedirect) {
                info.redirectedURL = this._ioctl.currentRedirectedURL;
            }
            info.speed = this._ioctl.currentSpeed;
            info.loaderType = this._ioctl.loaderType;
        }
        info.currentSegmentIndex = this._currentSegmentIndex;
        info.totalSegmentCount = (this._mediaDataSource.segments as Array<FileSegment>).length;

        this._emitter.emit(Events.STATISTICS_INFO, info);
    }

    _onManifestParsed(data: TSManifest) {
        this._emitter.emit(Events.MANIFEST_PARSED, data);
    }

    _mediaCodecBindEvents() {
        if(!this._mediaCodec) {
            return;
        }

        this._mediaCodec.on(Events.ERROR, (info: ErrorData) => {
            this._onDemuxException(Errors.TRANSMUXING_ERROR, info);
        });

        this._mediaCodec.on(Events.MEDIA_INFO, (mediaInfo: MediaInfo) => {
            this._onMediaInfo(mediaInfo);
        });

        this._mediaCodec.on(Events.METADATA_ARRIVED, (metadata: Metadata) => {
            this._onMetaDataArrived(metadata);
        });

        this._mediaCodec.on(Events.SCRIPTDATA_ARRIVED, (scriptdata: any) => {
            this._onScriptDataArrived(scriptdata);
        });

        // FLV-demuxer 向上发送SEI信息
        this._mediaCodec.on(Events.GET_SEI_INFO, (data: Uint8Array) => {
            this._emitter.emit(Events.GET_SEI_INFO, data);
        });

        this._mediaCodec.on(Events.INIT_SEGMENT, (type: string, InitSegment: InitSegment) => {
            this._onRemuxerInitSegmentArrival(type, InitSegment);
        });

        this._mediaCodec.on(Events.MEDIA_SEGMENT, (type: string, MediaSegment: MediaSegment) => {
            this._onRemuxerMediaSegmentArrival(type, MediaSegment);
        });

        // 上一个fragment解析完毕, 通知loader加载下一个fragment
        this._mediaCodec.on(Events.LOAD_NEXT_FRAG, () => {
            if(this._ioctl && this._ioctl.isWorking()) {
                this._ioctl.loadNextFrag();
            }
        });
    }
}

export default TransmuxingController;
