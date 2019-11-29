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
<script src="./dist/hjplayer.min.js">
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

[user config params](docs/Config_English.md);

## func

[primary func](docs/Func_English.md);

## framework

![How do HJPlayer works](docs/HJ-PLAYER.png)