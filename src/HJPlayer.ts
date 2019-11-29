import NativePlayer from './Player/NativePlayer';
import MSEPlayer from './Player/MSEPlayer';
import HJPlayerEvents from './Events/index';
import HJPlayerErrors from './Errors/index';
import HJPlayerCodec from './Codecs/index';
import DefaultConfig from './Utils/DefaultConfig';
import HJPlayerLogger from './Utils/Logger';
import SupportHelper from './Utils/support-helper';
import UserConfig from './Interfaces/UserConfig';
import MediaConfig from './Interfaces/MediaConfig';
import HJPlayerConfig from './Interfaces/HJPlayerConfig';
import FragmentLoader from './Loaders/FragmentLoader';
import FetchSteamLoader from './Loaders/FetchStreamLoader';
import ParamSeekHandler from './Utils/param-seek-handler';
import PlayListLoader from './Loaders/PlaylistLoader';
import IOController from './Controller/IOController';
import TransmuxingController from './Controller/TransmuxingController';
import typeSupported from './Utils/getMediaTypeSupport';

class HJPlayer {
    /**
     * 文件标签名
     */
    Tag: string

    /**
     * 媒体设置
     */
    mediaConfig: MediaConfig | null

    /**
     * 播放器设置
     */
    userConfig: HJPlayerConfig | null

    constructor(mediaConfig: MediaConfig, userConfig?: UserConfig) {
        this.Tag = 'HJPlayer';
        this.mediaConfig = mediaConfig;
        this.userConfig = { ...DefaultConfig, ...userConfig };
        HJPlayerLogger.config = this.userConfig;
        HJPlayerLogger.GLOBAL_TAG = this.userConfig.GLOBAL_TAG;

        if(!this.mediaConfig) {
            throw new Error('mediaConfig is needed');
        }

        if(!this.mediaConfig.type || typeof this.mediaConfig.type !== 'string') {
            throw new Error('mediaConfig need correct type option');
        }

        if(!this.mediaConfig.url || typeof this.mediaConfig.url !== 'string') {
            throw new Error('mediaConfig need correct url option');
        }

        const mediaType = this.mediaConfig.type.toLowerCase();

        switch(mediaType) {
        case 'mp4':
            return new NativePlayer(this.mediaConfig, this.userConfig);
        case 'flv':
        case 'm3u8':
            return new MSEPlayer(this.mediaConfig, this.userConfig);
        default:
            throw new Error('unsupport media type');
        }
    }

    /**
     * 浏览器是否支持功能
     */
    static isSupported(): boolean {
        return SupportHelper();
    }

    /**
     * 事件集合
     */
    static get Events() {
        return HJPlayerEvents;
    }

    /**
     * 错误集合
     */
    static get Errors() {
        return HJPlayerErrors;
    }

    /**
     * 解码器
     */
    static get Codec() {
        return HJPlayerCodec;
    }

    /**
     * 日志器
     */
    static get Logger() {
        return HJPlayerLogger;
    }

    /**
     * HLS流加载器
     */
    static get FragmentLoader() {
        return FragmentLoader;
    }

    /**
     * FLV流氏加载器
     */
    static get FetchSteamLoader() {
        return FetchSteamLoader;
    }

    static get ParamSeekHandler() {
        return ParamSeekHandler;
    }

    static get PlayListLoader() {
        return PlayListLoader;
    }

    static get IOController() {
        return IOController;
    }

    static get HJPlayerDefaultConfig() {
        return DefaultConfig;
    }

    static get TransmuxingController() {
        return TransmuxingController;
    }

    static get typeSupported() {
        return typeSupported();
    }
}

export default HJPlayer;
