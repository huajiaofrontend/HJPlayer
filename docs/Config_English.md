# config params

When init the player, it needs `MediaConfig`(@required) and `userConfig`(@optional) params;

## MediaConfig

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

MediaSegment的参数如下:

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


## userConfig

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