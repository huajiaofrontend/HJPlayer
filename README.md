# HJPlayer

English | [中文](docs/Readme_Chinese.md)

This Library currently support play FLV steam video and HLS stream video(do not support decrypt) in browser environment;
It relies on HTML5 video element and MediaSource Extensions BOM API. only with `H264` codec and `AAC` codec;

## Why we do this?

This spring we finish a new PC web project, It needs to play FLV stream video and HLS stream video stream in a browser page. First, we import 
`flv.js` and hls.js at the same time, `flv.js` plays FLV stream video, `hls.js` plays HLS stream video; It was certainly worked well, but the 
filesize of the javascript does not. After studying the `flv.js` and `hls.js` code, we find the same process of two libraries;
They all have `download`, `demuxer`, `remuxer`, `controller` function, so we try to use the framework of `flv.js` to assemble the `download`, `demuxer` and `remuxer` function of `hls.js` library; It works!!!; The filesize is less than `flv.js` + `hls.js`, but it can do similar functions to play flv stream video and hls stream video; (not perfectly, still has some coincident codes, can be more smaller);  Thanks to [flv.js](https://github.com/bilibili/flv.js) 和 [hls.js](https://github.com/video-dev/hls.js);


## How do this libary work?

When played flv stream video, `loader` downloads the flv stream data, and send data to `FLVCodec` module, `FLVCodec` module use the data to generates ISO BMFF (MP4) fragments - InitSegment(ftyp + moov) and MediaSegment(moof + mdat), and then sends them to Video Element through `Media Source Extensions` API and URLS API; When played hls stream video, based on flv process, `loader` module will parse the `m3u8` document first;


## Feature

1. play flv live stream and flv playback;
2. play hls live stream and hls playback;
3. Chrome, FireFox, Safari 10, IE11 and Edge worked well;

## Installation

```shell
npm install hjplayer --save
```

## build

```shell
npm install

npm run build
```

## How to import

This library can import the way of ES6 Moudule

``` javascript
import HJPlayer from 'hjplayer'
```

or import through script src;


```HTML
<script src="./dist/hjplayer.js">
```

## Getting Started

flv

```javascript
if (HJPlayer.isSupported()) {
    player = new HJPlayer({
        type: 'flv',
        url: 'http://xxx.xxx.com/xxxx.flv',
    }, {
        ...user config
    });
    player.attachMediaElement(videoElement);
    player.load();
    player.play();
}
```
HLS

```javascript

if (HJPlayer.isSupported()) {
    player = new HJPlayer({
        type: 'm3u8',
        url: 'http://xxx.xxx.com/xxxx.m3u8',
    }, {
        ...user config
    });
    player.attachMediaElement(videoElement);
    player.load();
    player.play();
}

```

## demo


[demo](http://activity.test.huajiao.com/web/share/banner/2019/testHJPlayer/index.html)

## config

When init the player, it needs `MediaConfig`(@required) and `userConfig`(@optional) params;

### MediaConfig

| field              | type                  | Description                              |
| ------------------ | --------------------- | ---------------------------------------- |
| `type`             | `string`              | media type, 'flv' or 'mp4' or 'm3u8'|
| `isLive?`          | `boolean`             | whether the media is a live stream |
| `cors?`            | `boolean`             | Indicates whether to enable CORS for http fetching |
| `withCredentials?` | `boolean`             | Indicates whether to do http fetching with cookies |
| `hasAudio?`        | `boolean`             | Indicates whether the stream has audio track |
| `hasVideo?`        | `boolean`             | Indicates whether the stream has video track |
| `duration?`        | `number`              | Indicates total media duration, in milliseconds |
| `filesize?`        | `number`              | Indicates total file size of media file, in bytes |
| `url?`             | `string`              | Indicates media URL, can be starts with 'https(s)' or 'ws(s)' (WebSocket flv only) |
| `segments?`        | `Array<MediaSegment>` | Optional field for multipart playback, see **MediaSegment** |

## MediaSegment

If segments field exists, transmuxer will treat this MediaDataSource as a multipart source.

In multipart mode, duration filesize url field in MediaDataSource structure will be ignored.

MediaSegment Object :

| field       | type     | Description                              |
| ----------- | -------- | ---------------------------------------- |
| `duration`  | `number` | Required field, indicates segment duration in milliseconds |
| `filesize?` | `number` | Optional field, indicates segment file size in bytes |
| `url`       | `string` | Required field, indicates segment file URL |

 `segments` demo

```javascript
{
    type: 'flv',
    // Required
    "segments": [
        {
            "duration": 3333,  // in milliseconds
            "filesize": 4444,  // in bytes
            "url": "http://xxxx/segments-1.flv"
        },
        {
            "duration": 5555,
            "filesize": 6666,
            "url": "http://xxxx/segments-2.flv"
        },
        {
            "duration": 7777,
            "filesize": 8888,
            "url": "http://xxxx/segments-3.flv"
        }
        ...
    ]
}

```

### userConfig

| field                            | type      | default                      | Description                            |
| -------------------------------- | --------- | ---------------------------- | ---------------------------------------- |
| `enableWorker?`                  | `boolean` | `false`                      | Enable separated thread for transmuxing (unstable for now) |
| `enableStashBuffer?`             | `boolean` | `true`                       | Enable IO stash buffer. Set to false if you need realtime (minimal latency) for live stream playback, but may stalled if there's network jittering. |
| `FORCE_GLOBAL_TAG?`              | `boolean` | `false`                      | enable to use global tag `HJPLAYER` when console |
| `GLOBAL_TAG`                     | `string`  | `HJPLAYER`                   | default global tag |
| `ENABLE_CALLBACK`                | `boolean` | `false`                      | enable logger callback |
| `ENABLE_ERROR`                   | `boolean` | `true`                       | enable console.error |     
| `ENABLE_INFO`                   | `boolean` | `false`                       | enable console.info | 
| `ENABLE_WARN`                   | `boolean` | `false`                       | enable console.warn | 
| `ENABLE_DEBUG`                   | `boolean` | `false`                      | enable console.debug |  
| `stashInitialSize?`              | `number`  | `384KB`                      | Indicates IO stash buffer initial size. Default is 384KB. Indicate a suitable size can improve video load/seek time. |
| `isLive?`                        | `boolean` | `false`                      | Same to isLive in MediaDataSource, ignored if has been set in MediaDataSource structure. `flv only`|
| `lazyLoad?`                      | `boolean` | `true`                       | Abort the http connection if there's enough data for playback|
| `lazyLoadMaxDuration?`           | `number`  | `3 * 60`                     | Indicates how many seconds of data to be kept for lazyLoad. |
| `lazyLoadRecoverDuration?`       | `number`  | `30`                         | Indicates the lazyLoad recover time boundary in seconds. |
| `deferLoadAfterSourceOpen?`      | `boolean` | `true`                       | Do load after MediaSource sourceopen event triggered. On Chrome, tabs which be opened in background may not trigger sourceopen event until switched to that tab. |
| `autoCleanupSourceBuffer`        | `boolean` | `false`                      | Do auto cleanup for SourceBuffer         |
| `autoCleanupMaxBackwardDuration` | `number`  | `3 * 60`                     | When backward buffer duration exceeded this value (in seconds), do auto cleanup for SourceBuffer |
| `autoCleanupMinBackwardDuration` | `number`  | `2 * 60`                     | Indicates the duration in seconds to reserve for backward buffer when doing auto cleanup. |
| `fixAudioTimestampGap`           | `boolean` | `true`                       | Fill silent audio frames to avoid a/v unsync when detect large audio timestamp gap. |
| `accurateSeek?`                  | `boolean` | `false`                      | Accurate seek to any frame, not limited to video IDR frame, but may a bit slower. Available on `Chrome > 50`, `FireFox` and `Safari`. |
| `seekType?`                      | `string`  | `'range'`                    | `'range'` use range request to seek, or `'param'` add params into url to indicate request range. |
| `seekParamStart?`                | `string`  | `'bstart'`                   | Indicates seek start parameter name for `seekType = 'param'` |
| `seekParamEnd?`                  | `string`  | `'bend'`                     | Indicates seek end parameter name for `seekType = 'param'` |
| `rangeLoadZeroStart?`            | `boolean` | `false`                      | Send `Range: bytes=0-` for first time load if use Range seek |
| `customSeekHandler?`             | `object`  | `undefined`                  | Indicates a custom seek handler          |
| `reuseRedirectedURL?`            | `boolean` | `false`                      | Reuse 301/302 redirected url for subsequence request like seek, reconnect, etc. |
| `referrerPolicy?`                | `string`  | `no-referrer-when-downgrade` | Indicates the [Referrer Policy][] when using FetchStreamLoader |
| `headers?`                       | `object`  | `undefined`                  | Indicates additional headers that will be added to request |
HLS config. |
| `tsAutoLevelChoose?`             | `boolean` | `false`                      | when play hls. whether auto choose the suitable bitrate level |
| `maxFragLookUpTolerance?`        | `float`   | `0.25`                       | This tolerance factor is used during fragment lookup. Instead of checking whether buffered.end is located within [start, end] range, frag lookup will be done by checking within [start-maxFragLookUpTolerance, end-maxFragLookUpTolerance] range. |
| `defaultAudioCodec`              | `undefined`| `undefined`                 | If audio codec is not signaled in variant manifest, or if only a stream manifest is provided, libraty tries to guess audio codec by parsing audio sampling rate in ADTS header. If sampling rate is less or equal than 22050 Hz, then libraty assumes it is HE-AAC, otherwise it assumes it is AAC-LC. This could result in bad guess, leading to audio decode error, ending up in media error. It is possible to hint default audiocodec to libraty by configuring this value as below: |

[Referrer Policy]: https://w3c.github.io/webappsec-referrer-policy/#referrer-policy

## Player methods

The info below is the methods and properties of Player, you can controll the player or get some useful info;

### static methods

|methods                        | result             | Description                         |
|-------------------------------|--------------------|-------------------------------------|
|HJPlayer.isSupported()         | boolean            | whether the browser support this lib|
|HJPlayer.typeSupported()       | Object             | return the media type of browser support |
|HJPlayer.HJPlayerDefaultConfig | Object             | the default config of player        |
  
### Instance methods

|methods                       | result             | Description                         |
|------------------------------|--------------------|-------------------------------------|
| on()                         | void               | bind callback for player events      |
| off()                        | void               | cancel bind callback for player events|
| attachMediaElement()         | void               | bind media element                   |
| detachMediaElement()         | void               | remove the link of the media element with SourceBuffer            |
| load()                       | void               | load the media stream                |
| unload()                     | void               | unload the media stream              |
| play()                       | Promise<void>      | the player plays the video           |                            
| pause()                      | void               | the player pauses                    |

### Instance property

|property                      | result             | Description                         |
|------------------------------|--------------------|-------------------------------------|
| type                         | string             | player type: 'MSEPlayer' or 'NativePlayer'|
| buffered                     | TimeRanges         | the TimeRanges of the player |
| duration                     | number             | the duration of the media element    |
| volume                       | number             | the volume of the video            |
| currentTime                  | currentTime        | the currentTime of the video       |
| muted                        | boolean            | whether the video is muted         |
| mediaInfo                    | Object             | the meida info (metadata)          |
| statisticsInfo               | Object             | the statistics info of player stauts, such as dropframe, speed etc; |   

### HJPlayer.Events

`HJPlayer.Events`, you can use the way `Player.on(HJPlayer.Events.xxx, fn)` to get the info of player when play,  `Player.off(HJPlayer.Events.xxx)` cancel listener

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


### HJPlayer.ErrorTypes

when player is playing, it maybe happen something unexpected, you can use `player.on(HJPlayer.Events.ERROR, () => {})` to get what happend, 
HJPlayer.ErrorTypes.xxx is the error type; you will also get a Object contain `reason`, it will tell you more details

| Error         | Description                              |
| ------------- | ---------------------------------------- |
| NETWORK_ERROR | Errors related to the network            |
| MEDIA_ERROR   | Errors related to the media (format error, decode issue, etc) |
| OTHER_ERROR   | Any other unspecified error              | 


### HJPlayer.ErrorDetails

 prefix with `HJPlayer.ErrorDetails`: HJPlayer.ErrorDetails.xxxx

| Error                           | Description                              |
| ------------------------------- | ---------------------------------------- |
| NETWORK_EXCEPTION               | Related to any other issues with the network; contains a `reason` |
| NETWORK_STATUS_CODE_INVALID     | Related to an invalid HTTP status code, such as 403, 404, etc. |
| NETWORK_TIMEOUT                 | Related to timeout request issues        |
| NETWORK_UNRECOVERABLE_EARLY_EOF | Related to unexpected network EOF which cannot be recovered |
| MEDIA_MSE_ERROR                 | Related to MediaSource's error such as decode issue |
| MEDIA_FORMAT_ERROR              | Related to any invalid parameters in the media stream |
| MEDIA_FORMAT_UNSUPPORTED        | The input MediaDataSource format is not supported by flv.js |
| MEDIA_CODEC_UNSUPPORTED         | The media stream contains video/audio codec which is not supported |

## Licence

HJPlayer.js is released under [Apache 2.0 License](docs/Licence.md)


## super class

This player is extended [flv.js](https://github.com/bilibili/flv.js) and [hls.js](https://github.com/video-dev/hls.js)

## How it works?

![How does HJPlayer works](docs/HJ-PLAYER.png)

