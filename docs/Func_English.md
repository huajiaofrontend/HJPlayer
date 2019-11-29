# function

## HJPlayer.isSupported()

```js
HJPlayer.isSupported(): boolean;
```

if the brower support, it will return true, otherwise false;

the codes below show how it works:

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

## HJPlayer.Events

`HJPlayer.Events`, you can use the way `Player.on(HJPlayer.Events.xxx, fn)` to get the info of player when play,  `Player.off(HJPlayer.Events.xxx)` cancel listen

| Event               | Description                              |
| ------------------- | ---------------------------------------- |
| ERROR               | An error occurred by any cause during the playback |
| LOADING_COMPLETE    | The input MediaDataSource has been completely buffered to end |
| RECOVERED_EARLY_EOF | An unexpected network EOF occurred during buffering but automatically recovered |
| MEDIA_INFO          | Provides technical information of the media like video/audio codec, bitrate, etc. |
| METADATA_ARRIVED    | Provides metadata which FLV file(stream) can contain with an "onMetaData" marker.  |
| SCRIPTDATA_ARRIVED  | Provides scriptdata (OnCuePoint / OnTextData) which FLV file(stream) can contain. |
| STATISTICS_INFO     | Provides playback statistics information like dropped frames, current speed, etc. |
| GET_SEI_INFO        | it will returns the SEI info(Uint8Array) . |
| HJ_PLAYER_LOG       | it will returns a log contains a type: string and a info: string |
| MANIFEST_PARSED     | you can get the details of index.m3u8: Object |


## HJPlayer.ErrorTypes

when player is playing, it maybe happen something unexpected, you can use `player.on(HJPlayer.Events.ERROR, () => {})` to get what happend, 
HJPlayer.ErrorTypes.xxx is the error type; you will also get a Object contain `reason`, it will tell you more details

| Error         | Description                              |
| ------------- | ---------------------------------------- |
| NETWORK_ERROR | Errors related to the network            |
| MEDIA_ERROR   | Errors related to the media (format error, decode issue, etc) |
| OTHER_ERROR   | Any other unspecified error              | 


## HJPlayer.ErrorDetails

 prefix with `HJPlayer.ErrorDetails`: HJPlayer.ErrorDetails.xxxx

| Error                           | Description                              |
| ------------------------------- | ---------------------------------------- |
| NETWORK_EXCEPTION               | Related to any other issues with the network; contains a `message` |
| NETWORK_STATUS_CODE_INVALID     | Related to an invalid HTTP status code, such as 403, 404, etc. |
| NETWORK_TIMEOUT                 | Related to timeout request issues        |
| NETWORK_UNRECOVERABLE_EARLY_EOF | Related to unexpected network EOF which cannot be recovered |
| MEDIA_MSE_ERROR                 | Related to MediaSource's error such as decode issue |
| MEDIA_FORMAT_ERROR              | Related to any invalid parameters in the media stream |
| MEDIA_FORMAT_UNSUPPORTED        | The input MediaDataSource format is not supported by flv.js |
| MEDIA_CODEC_UNSUPPORTED         | The media stream contains video/audio codec which is not supported |