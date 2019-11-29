# 设置参数

初始化播放器的时候需要 `MediaConfig`参数和 `userConfig`(选传) 两个参数 

## MediaConfig

| 字段                | 类型                  | 字段作用                              |
| ------------------ | --------------------- | ---------------------------------------- |
| `type`             | `string`              | 播放的媒体文件类型, `'flv'`, `'mp4'` or `'m3u8'`|
| `isLive?`          | `boolean`             | 标明播放的媒体文件是否为一直直播流 |
| `cors?`            | `boolean`             | 标明是否跨域获取问题文件 |
| `withCredentials?` | `boolean`             | 标明是否在获取媒体文件时携带`cookies` |
| `hasAudio?`        | `boolean`             | 标明媒体流中是否有音频轨道 |
| `hasVideo?`        | `boolean`             | 标明媒体流中是否有视频轨道 |
| `duration?`        | `number`              | 标明媒体的总播放时间(单位: 毫秒) |
| `filesize?`        | `number`              | 标明媒体文件的字节数 |
| `url?`             | `string`              | 媒体文件地址 以`'https(s)'` or `'ws(s)'` (WebSocket)开头 |
| `segments?`        | `Array<MediaSegment>` | 选填字段, 播放多个视频, 详情请看 **MediaSegment** |

## MediaSegment

如果有`segments`字段, 那么播放器就会将`MediaConfig`当做多个子文件的源, 这时在 `MediaConfig` 中的 `duration` `filesize` `url` 都将被忽略

MediaSegment的参数如下:

| 字段         | 类型      | 字段作用                              |
| ----------- | -------- | ---------------------------------------- |
| `duration`  | `number` | 必填字段, 每个播放的子媒体文件的播放时长(单位: 毫秒) |
| `filesize?` | `number` | 选填字段, 标明每个子媒体文件的字节数 |
| `url`       | `string` | 必填字段, 每隔子媒体文件的地址 |

传入 `segments` 参数的 demo

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

用户设置的自选可选择以下字段选填

| 字段                              | 类型      | 默认值                        | 说明                            |
| -------------------------------- | --------- | ---------------------------- | ---------------------------------------- |
| `enableWorker?`                  | `boolean` | `false`                      | 启用多线程转码(不太稳定) |
| `enableStashBuffer?`             | `boolean` | `true`                       | 是否允许 IO 存储 buffer , 如果你想要减少直播延迟, 请设置为false, 但是网络抖动时会发生卡顿 |
| `FORCE_GLOBAL_TAG?`              | `boolean` | `false`                      | 是否在打印消息时启用全局标签 `HJPLAYER`, 不传则打印消息时为各组件标签|
| `GLOBAL_TAG`                     | `string`  | `HJPLAYER`                   | 默认全局标签 |
| `ENABLE_CALLBACK`                | `boolean` | `false`                      | 是否触发logger的绑定事件
| `ENABLE_ERROR`                   | `boolean` | `true`                       | 是否打印ERROR提示 |     
| `ENABLE_INFO`                   | `boolean` | `false`                       | 是否打印INFO提示 | 
| `ENABLE_WARN`                   | `boolean` | `false`                       | 是否打印WARN提示 | 
| `ENABLE_DEBUG`                   | `boolean` | `false`                      | 是否打印DEBUG提示 |  
| `stashInitialSize?`              | `number`  | `384KB`                      | 标识IO存储buffer的大小, 默认是 `384KB`, 设置合适的缓存可以改善视频的 加载 和 seek 时间 |
| `isLive?`                        | `boolean` | `false`                      | 和 **MediaConfig** 中的 `isLive` 一致, 在 `MediaConfig`中设置了, 这里的设置会被忽略. `flv only`|
| `lazyLoad?`                      | `boolean` | `true`                       | 当视频缓存足够长时会断开 HTTP 链接, `flv only`|
| `lazyLoadMaxDuration?`           | `number`  | `3 * 60`                     | 启用`lazyLoad` 后最大缓存多少秒之后停止加载. |
| `lazyLoadRecoverDuration?`       | `number`  | `30`                         | 懒加载恢复时长 |
| `deferLoadAfterSourceOpen?`      | `boolean` | `true`                       | 在 MediaSource `sourceopen` 事件触发后加载. 在Chrome中只有标签页在 focus 时才会触发 `sourceopen` 事件 |
| `autoCleanupSourceBuffer`        | `boolean` | `false`                      | 是否自动清理 SourceBuffer         |
| `autoCleanupMaxBackwardDuration` | `number`  | `3 * 60`                     | 当 `backward buffer` 超过此值(单位: 秒) 时, 自动清理 SourceBuffer |
| `autoCleanupMinBackwardDuration` | `number`  | `2 * 60`                     | 标识自动清理 `SourceBuffer` 时的恢复时间(单位: 秒) |
| `fixAudioTimestampGap`           | `boolean` | `true`                       | 当发现大的音频的缺口时, 填充静默的音频帧避免音视频不同步 |
| `accurateSeek?`                  | `boolean` | `false`                      | 精准seek操作, 有点慢, 需要 `Chrome` 50+ 版本 `FireFox` and `Safari` 浏览器 |
| `seekType?`                      | `string`  | `'range'`                    | 利用`'range'` 请求进行 seek 操作, 或者在 url 中添加参数进行seek 操作 |
| `seekParamStart?`                | `string`  | `'bstart'`                   | 标识 seek 操作的开始时间参数,  `seekType = 'param'` |
| `seekParamEnd?`                  | `string`  | `'bend'`                     | 标识 seek 操作的结束时间参数, `seekType = 'param'` |
| `rangeLoadZeroStart?`            | `boolean` | `false`                      | 当用 Range seek时, 第一次加载时发送 `Range: bytes=0-` 参数 |
| `customSeekHandler?`             | `object`  | `undefined`                  | 标识一个自定义的 seek 方法         |
| `reuseRedirectedURL?`            | `boolean` | `false`                      | 对后续的 `seek`, 重连等请求时拒绝301/302跳转 |
| `referrerPolicy?`                | `string`  | `no-referrer-when-downgrade` | 当用 `FetchStreamLoader` 时 referrerPolicy标识 [Referrer Policy][]|
| `headers?`                       | `object`  | `undefined`                  | 标识需要添加到请求头中的额外 headers |
HLS config. |
| `tsAutoLevelChoose?`             | `boolean` | `false`                      | 当播放master.m3u8时是否自动选择适合当前网络的最大码率的视频 |
| `maxFragLookUpTolerance?`        | `float`   | `0.25`                       | 视频 seek 时 时间上下浮动范围值(单位: 秒) |
| `defaultAudioCodec`              | `undefined`| `undefined`                 | 默认音频编码 |

[Referrer Policy]: https://w3c.github.io/webappsec-referrer-policy/#referrer-policy