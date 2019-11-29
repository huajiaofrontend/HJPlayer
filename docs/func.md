# 功能函数

## HJPlayer.isSupported()

```js
HJPlayer.isSupported(): boolean;
```

当 浏览器支持基础的回放功能时返回 `true`, 否则返回 `false`

功能实现代码如下

``` typescript

export default function isSupported(): boolean {
    const mediaSource = getMediaSource();
    const sourceBuffer = (window as any).SourceBuffer || (window as any).WebKitSourceBuffer;
    const isTypeSupported = mediaSource
        && typeof mediaSource.isTypeSupported === 'function'
        && mediaSource.isTypeSupported('video/mp4; codecs="avc1.42E01E,mp4a.40.2"');

    // if SourceBuffer is exposed ensure its API is valid
    // safari and old version of Chrome doe not expose SourceBuffer globally so checking SourceBuffer.prototype is impossible
    const sourceBufferValidAPI = !sourceBuffer
        || (sourceBuffer.prototype
            && typeof sourceBuffer.prototype.appendBuffer === 'function'
            && typeof sourceBuffer.prototype.remove === 'function');
    return !!isTypeSupported && !!sourceBufferValidAPI;
}

```

## Player (abstract)

```typescript

interface Player {
    constructor(mediaConfig: mediaConfig, userConfig?: Config): MSEPlayer | NativePlayer;
    destroy(): void;
    on(event: string, listener: Function): void;
    off(event: string, listener: Function): void;
    attachMediaElement(mediaElement: HTMLMediaElement): void;
    detachMediaElement(): void;
    load(): void;
    unload(): void;
    play(): Promise<void>;
    pause(): void;
    type: string;
    buffered: TimeRanges;
    duration: number;
    volume: number;
    muted: boolean;
    currentTime: number;
    mediaInfo: Object;
    statisticsInfo: Object;
}
```

## HJPlayer.LoggingControl 定义

```typescript
interface LoggingControl {
    forceGlobalTag: boolean;
    globalTag: string;
    enableAll: boolean;
    enableDebug: boolean;
    enableVerbose: boolean;
    enableInfo: boolean;
    enableWarn: boolean;
    enableError: boolean;
    getConfig(): Object;
    applyConfig(config: Object): void;
    addLogListener(listener: Function): void;
    removeLogListener(listener: Function): void;
}
```

## HJPlayer.Events

`HJPlayer.Events` 下的事件, 可以使用 `Player.on(HJPlayer.Events.xxx, fn)` 监听事件,  `Player.off(HJPlayer.Events.xxx)` 取消监听

| Event               | Description                              |
| ------------------- | ---------------------------------------- |
| ERROR               | 播放时触发的错误, 会返回 type, 和 详细信息 |
| LOADING_COMPLETE    | MediaSouce中定义的文件加载完毕时触发 |
| RECOVERED_EARLY_EOF | 在加载时EOF的异常, 但是自动恢复了 |
| MEDIA_INFO          | 媒体文件的长度, 编码信息等 |
| METADATA_ARRIVED    | FLV file 的 METADATA 信息  |
| SCRIPTDATA_ARRIVED  | FLV file 的 SCRIPTDATA 信息 |
| STATISTICS_INFO     | 提供一些丢失的帧, 当前网络加载速度等统计信息 |
| GET_SEI_INFO        | 提供FLV解析出的SEI(补充增强信息). |
| HJ_PLAYER_LOG       | 提供 type: string 和 info: string 的信息 |
| MANIFEST_PARSED     | 解析的M3U8文档内容 |


## HJPlayer.ErrorTypes

播放器的一些可能发生的错误的类型,  使用格式为 `HJPlayer.ErrorTypes.xxx`, 会在 `HJPlayer.Events.ERROR` 事件触发时返回

| Error类型      | 说明                              |
| ------------- | ---------------------------------------- |
| NETWORK_ERROR | 网络相关的错误          |
| MEDIA_ERROR   | 和媒体相关的错误 (格式化错误, 解码错误等等) |
| OTHER_ERROR   | 其他没定义的错误   |    


## HJPlayer.ErrorDetails

`HJPlayer.ErrorDetails` 打头的错误说明

| Error类型                        | 说明                              |
| ------------------------------- | ---------------------------------------- |
| NETWORK_EXCEPTION               | 和网络相关的异常, 包含 `message` 字段说明原因 |
| NETWORK_STATUS_CODE_INVALID     | 发生网络异常时的状态码, 例如 403, 404等 |
| NETWORK_TIMEOUT                 | 超时        |
| NETWORK_UNRECOVERABLE_EARLY_EOF | 不可恢复的 EOF 错误 |
| MEDIA_MSE_ERROR                 | 和 `MediaSource` 相关的错误, 例如解码错误 |
| MEDIA_FORMAT_ERROR              | 媒体流中有错误的参数 |
| MEDIA_FORMAT_UNSUPPORTED        | 加载的媒体文件本lib不支持 |
| MEDIA_CODEC_UNSUPPORTED         | 视频/音频编码不支持 |