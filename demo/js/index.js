/* eslint-disable */
var player = null;
var CustomSeekHandler = undefined;
var headers = undefined;
var customLoader = undefined;
var videoElement = document.getElementById('videoElement');

var app = new Vue({
    el: '#app',
    data: {
        mediaType: 'flv',
        mediaUrl: '',
        params: {
            /**
             * Logger 相关的设置
             */
            // 强制使用全局标签 HJPLAYER
            FORCE_GLOBAL_TAG: false,
            // Logger的全局标签
            GLOBAL_TAG: 'HJPLAYER',
            // 是否触发logger的绑定事件
            ENABLE_CALLBACK: false,
            // 是否打开 ERROR 提示
            ENABLE_ERROR: true,
            // 是否打开 INFO 提示
            ENABLE_INFO: false,
            // 是否打开 WARN 提示
            ENABLE_WARN: false,
            // 是否打开 DEBUG 提示
            ENABLE_DEBUG: false,
            /**
             * seek 相关的参数设置
             */
            enableWorker: false,

            enableStashBuffer: true,

            stashInitialSize: 384,

            isLive: true,

            lazyLoad: true,

            lazyLoadMaxDuration: 3 * 60,

            lazyLoadRecoverDuration: 30,

            deferLoadAfterSourceOpen: true,

            // autoCleanupSourceBuffer: default as false, leave unspecified
            autoCleanupMaxBackwardDuration: 3 * 60,

            autoCleanupMinBackwardDuration: 2 * 60,

            statisticsInfoReportInterval: 1000,

            fixAudioTimestampGap: true,

            accurateSeek: false,

            seekType: 'range', // [range, param, custom]

            seekParamStart: 'bstart',

            seekParamEnd: 'bend',

            rangeLoadZeroStart: false,

            CustomSeekHandler: CustomSeekHandler,

            reuseRedirectedURL: false,
            // referrerPolicy: leave as unspecified

            headers: headers,

            customLoader: customLoader,

            tsAutoLevelChoose: false, // 自动选择ts码率, 在master.m3u8时适用

            maxFragLookUpTolerance: 0.25, // used by stream-controller

            defaultAudioCodec: undefined
        },
        intervalTime: [1000, 2000, 3000, 4000, 5000, 6000]
    },
    methods: {
        initPlayer: function() {
            var localSource = localStorage.getItem('source');
            var inputSource = this.mediaUrl;
            var inputType = this.mediaType;
            if (localSource !== inputSource && inputSource !== '') {
                localStorage.setItem('source', inputSource);
                localStorage.setItem('playType', inputType);
            }
            player && player.destroy();
            this.createPlayer();
        },
        createPlayer: function() {
            if (HJPlayer.isSupported()) {
                const params = Object.create(null);
                Object.keys(this.params).forEach(function(key){
                    params[key] = this.params[key];
                }.bind(this));
                // console.log(params);
                player = new HJPlayer({
                    type: this.mediaType,
                    url: this.mediaUrl,
                }, params);

                player.attachMediaElement(videoElement);

                // 测试统计信息
                // player.on(HJPlayer.Events.STATISTICS_INFO, function (e) {
                //     console.log('STATISTICS_INFO', e);
                // })

                // // 测试mediaInfo
                // player.on(HJPlayer.Events.MEDIA_INFO, function (e) {
                //     console.log('MEDIA_INFO', e);
                // })

                // 测试logger事件
                HJPlayer.Logger.on(HJPlayer.Events.HJ_PLAYER_LOG, function (type, str)  {
                    console.log('HJ_PLAYER_LOG', type, str);
                })

                player.on(HJPlayer.Events.ERROR, function (e1, e2, e3) {
                    console.log(e1, e2, e3);
                })

                // player.on(HJPlayer.Events.MANIFEST_PARSED, function (DATA) {
                //     console.log('MANIFEST_PARSED', DATA);
                // })

                player.load();
                player.play();
            } else {
                alert('not support')
            }
        },
        consoleType: function() {
            console.log('打印TYPE', player && player.type);
        }, 
        buffered: function() {
            console.log('打印buffered', player && player.buffered);
            for (var i = 0; i < player.buffered.length; i++) {
                var start = player.buffered.start(i);
                var end = player.buffered.end(i);
                console.log({
                    start: start,
                    end: end,
                })
            }
        }, 
        duration: function() {
            console.log('player-duration', player && player.duration);
        },
        volume: function() {
            console.log('player-volume', player && player.volume);
        }, 
        muted: function() {
            console.log('player-muted', player && player.muted);
        }, 
        currentTime: function() {
            console.log('player-currentTime', player && player.currentTime);
        }, 
        mediaInfo: function() {
            console.log('player-mediaInfo', player && player.mediaInfo);
        }, 
        statisticsInfo: function() {
            console.log('player-statisticsInfo', player && player.statisticsInfo);
        },
        fillType: function() {
            this.$nextTick(function(){
                var value = this.mediaUrl;
                if (value.indexOf('.m3u8') > -1) {
                    this.mediaType = 'm3u8';
                } else if (value.indexOf('.flv') > -1) {
                    this.mediaType = 'flv';
                }
            }.bind(this));
        }
    },
    mounted: function() {
        var localUrl = localStorage.getItem('source');
        var localType = localStorage.getItem('playType');
        this.mediaType = localType || 'm3u8';
        if (this.mediaUrl === '' && localUrl) {
            this.mediaUrl = localUrl || '';
            if (localUrl.indexOf('.m3u8') > -1) {
                this.mediaType = 'm3u8';
            } else if (localUrl.indexOf('.flv') > -1) {
                this.mediaType = 'flv';
            }
        }
    }
})
