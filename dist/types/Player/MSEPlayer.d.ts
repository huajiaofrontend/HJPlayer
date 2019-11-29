import EventEmitter from 'eventemitter3';
import MediaConfig from '../Interfaces/MediaConfig';
import HJPlayerConfig from '../Interfaces/HJPlayerConfig';
declare class MSEPlayer {
    /**
     * 文件标签
     */
    Tag: string;
    /**
     * 播放器类型
     */
    private _type;
    /**
     * 事件中心
     */
    private _emitter;
    /**
     * 媒体设置
     */
    mediaConfig: MediaConfig | null;
    /**
     * 用户设置
     */
    userConfig: HJPlayerConfig | null;
    /**
     * 存放回调函数的对象
     */
    private e;
    /**
     * 获得当前时间的函数
     */
    private _now;
    /**
     * 等待跳转的时间点, 在没有媒体元素时先记录该时间点
     */
    private _pendingSeekTime;
    private _requestSetTime;
    /**
     * seek点记录
     */
    private _seekpointRecord;
    /**
     * 进度检查定时器
     */
    private _progressCheckTimer;
    /**
     * 媒体元素
     */
    private _mediaElement;
    /**
     * MediaSource 控制器
     */
    private _msectl;
    /**
     * 转码器
     */
    private _transmuxer;
    /**
     * MediaSource 是否处于已 opened 状态
     */
    private _mseSourceOpened;
    /**
     * 是否正在等待load, 如果是的话, 会在 souceOpen 事件之后 执行 load 操作
     */
    private _hasPendingLoad;
    /**
     * 接收到的媒体数据流是否可以支持播放
     */
    private _receivedCanPlay;
    /**
     * 媒体的信息
     */
    private _mediaInfo;
    /**
     * 媒体播放时的统计信息
     */
    private _statisticsInfo;
    /**
     * M3U8文档是否已经解析
     */
    private _manifestParsed;
    /**
     * 开始播放时设定的 currentTime
     */
    private _startPosition;
    /**
     * 当前播放的M3U8 playlist文档 解析后的内筒
     */
    private _currentDetail;
    /**
     * 是否一直 seek 到 关键帧
     */
    private _alwaysSeekKeyframe;
    constructor(mediaConfig: MediaConfig, config: HJPlayerConfig);
    /**
     * MSEPlayer销毁
     */
    destroy(): void;
    /**
     * MSEPlayer绑定事件
     * @param event 事件名
     * @param listener 回调函数
     */
    on(event: string, listener: EventEmitter.ListenerFn): void;
    /**
     * MSEPlayer取消绑定事件
     * @param event 事件名
     * @param listener 回调函数
     */
    off(event: string, listener: EventEmitter.ListenerFn): void;
    /**
     * 媒体元素和 MediaSource 链接起来
     * @param mediaElement 要绑定的媒体元素
     */
    attachMediaElement(mediaElement: HTMLMediaElement): void;
    /**
     * MediaSource 与 媒体元素 分离链接
     */
    detachMediaElement(): void;
    /**
     * 加载媒体文件, 并绑定回调事件
     */
    load(): void;
    /**
     * 停止加载
     */
    unload(): void;
    /**
     * 开始播放
     */
    play(): Promise<void> | undefined;
    /**
     * 暂停
     */
    pause(): void;
    /**
     * 返回当前播放器类型
     */
    readonly type: string;
    /**
     * 返回媒体元素已缓存的时间段
     */
    readonly buffered: TimeRanges | null;
    /**
     * 返回媒体元素加载的时长或者整个媒体文件的时长
     */
    readonly duration: number;
    /**
     * 获取媒体元素的声音大小
     */
    /**
    * 设置媒体元素的声音
    */
    volume: number;
    /**
     * 获取媒体元素是否静音
     */
    /**
    * 设置媒体静音
    */
    muted: boolean;
    /**
     * 获取媒体元素当前播放的时间点
     */
    /**
    * 设置媒体元素的 currentTime
    */
    currentTime: number;
    /**
     * 获取媒体文件信息
     */
    readonly mediaInfo: {};
    /**
     * 获取播放器的统计信息
     */
    readonly statisticsInfo: {
        currentSegmentIndex?: number | undefined;
        decodedFrames?: number | undefined;
        droppedFrames?: number | undefined;
        hasRedirect?: boolean | undefined;
        loaderType?: string | undefined;
        playerType?: string | undefined;
        speed?: number | undefined;
        totalSegmentCount?: number | undefined;
        url?: string | undefined;
    };
    /**
     * 填充 MSEPlayer 这一层的少量统计信息, 并返回全部统计信息
     * @param statInfo 待填充 MSEPlayer 这一层信息的残缺的统计信息
     */
    private _fillStatisticsInfo;
    /**
     * 当 MediaSource 更新结束后的处理事件, 通过判断已缓存的进度来判断是否暂停加载
     */
    private _onmseUpdateEnd;
    /**
     * 当 MediaSource Buffer 已满的处理事件, 暂停加载
     */
    private _onmseBufferFull;
    /**
     * 暂停加载, 并启动进度检查定时器
     */
    private _suspendTransmuxer;
    /**
     * 检查播放进度, 当 currentTime 和 缓存的进度 之间的差值 小于 this.userConfig.lazyLoadRecoverDuration 时, 恢复加载
     */
    private _checkProgressAndResume;
    /**
     * 查询要跳转的时间点是否已处于缓存区域
     * @param seconds 查询的时间点
     */
    private _isTimepointBuffered;
    /**
     * 非用户操作的内部跳转
     * @param seconds seek的描述
     */
    private _internalSeek;
    /**
     * 过100毫秒之后检查, 如果要跳转的点还没有缓存就停止progressCheck, _msectl 和 _transmuxer 跳转到相应时间点
     */
    private _checkAndApplyUnbufferedSeekpoint;
    /**
     * 当 MediaElement 触发 `stalled`事件 或者 触发 `progress` 时的操作, 进行检查和恢复处理
     * @param stalled 是否卡住了
     */
    private _checkAndResumeStuckPlayback;
    /**
     * 当接收到视频Metadata数据时的处理函数, 当已收到Metadata后把等待跳转的时间点设置为元素的currentTime
     * 当IE11在 attachMedia时设置 currentTime 报错, 那么在 LoadedMetadata 后设置 currentTime
     */
    private _onvLoadedMetadata;
    /**
     * 当视频 seek 的时候处理函数
     */
    private _onvSeeking;
    private _onvCanPlay;
    private _onvStalled;
    private _onvProgress;
    /**
     * 给 media 设置 currentTime
     * @param seconds 设置的时间
     */
    private _setMediaCurrentTime;
    setMediaSourceDuration(duration: number): void;
}
export default MSEPlayer;
