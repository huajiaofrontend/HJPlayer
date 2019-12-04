# HJPlayer

[English](../README.md) | 中文

目前支持浏览器环境下, 播放`H264`视频编码, AAC音频编码的`FLV`流和`HLS`流(不支持解密), 项目需要浏览器支持`video`标签和`Media Source Extensions`才能正常运行;

## 为什么做这个?

本项目开发目的出发点是要解决综艺项目和PC官网播放页需要同时支持FLV直播流和HLS回放流的问题, 一个`javascript`文件中同时集合2个库, 而其中的功能又重合, 所以尝试对这2个库进行合并, 进过一番学习后尝试采用`flv.js`为基础, 加入`hls.js`中的解析文档功能, 加载功能, 解码和转码功能, 响应`flvjs`的各种功能控制, 使之能在播放`FLV`流的基础上正常播放`HLS`直播流和点播流, 文件体积较两者之和小了很多, 当然, 代码并不完美, 仍旧有许多需要修改和优化的地方, 但实现了相似的功能,  在此感谢 [flv.js](https://github.com/bilibili/flv.js) 和 [hls.js](https://github.com/video-dev/hls.js); 

## 播放器工作原理

HJPlayer的工作原理是将FLV文件流和HLS的TS文件流经过解码和转码, 转换为Fragmented MP4，
然后通过 `Media Source Extensions` API, 将`mp4`片段填充到到 HTML5 <video> 元素中。

## Feature

1. 播放`H264`视频编码和`AAC`音频编码的FLV直播流和点播流
2. 播放`H264`视频编码和`AAC`音频编码的HLS直播流和点播流

## Installation

```shell
npm install hjplayer --save
```

## 打包

```shell

npm install

npm run build

```

## 引用方法

本库可采用 `ES6 Moudule` 引用 或者 直接在 `script src` 方式引用


``` javascript
import HJPlayer from 'hjplayer'
```

或者

```HTML
<script src="./dist/hjplayer.min.js">
```

## 使用方法

FLV直播流

```javascript
if (HJPlayer.isSupported()) {
    player = new HJPlayer({
        type: 'flv',
        url: 'http://xxx.xxx.com/xxxx.flv',
    }, {
        ...用户设置
    });
}
```
HLS直播流

```javascript

if (HJPlayer.isSupported()) {
    player = new HJPlayer({
        type: 'm3u8',
        url: 'http://xxx.xxx.com/xxxx.m3u8',
    }, {
        ...用户设置
    });
}

```

## demo

[demo](http://activity.test.huajiao.com/web/share/banner/2019/testHJPlayer/index.html)

## 设置参数

[设置参数](config.md);

## func

[主要功能](func.md);


## Licence

[Licence](Licence.md);


## 继承

此播放器整合自 [flv.js](https://github.com/bilibili/flv.js) and [hls.js](https://github.com/video-dev/hls.js);

## 它是怎么工作的

![HJPlayer的框架](./HJ-PLAYER.png)