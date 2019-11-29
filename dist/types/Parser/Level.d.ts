import Fragment from '../Loaders/Fragment';
export default class Level {
    endCC: number;
    /**
     * m3u8 最后ts文件的序列号
     */
    endSN: number;
    fragments: Fragment[];
    initSegment: any;
    live: boolean;
    needSidxRanges: boolean;
    startCC: number;
    /**
     * m3u8第一个ts序列号
     */
    startSN: number;
    startTimeOffset: null | number;
    /**
     * 视频的最大时长
     */
    targetduration: number;
    /**
     * 总时长
     */
    totalduration: number;
    type: any;
    /**
     * ts 链接
     */
    private url;
    /**
     * 平均时长
     */
    averagetargetduration?: number;
    /**
     * 兼容的版本号
     */
    version: null | string | number;
    constructor(baseUrl: string);
    readonly hasProgramDateTime: boolean;
}
