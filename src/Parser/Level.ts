import Fragment from '../Loaders/Fragment';

export default class Level {
    endCC: number

    /**
     * m3u8 最后ts文件的序列号
     */
    endSN: number

    fragments: Fragment[]

    initSegment: any

    live: boolean

    needSidxRanges: boolean

    startCC: number

    /**
     * m3u8第一个ts序列号
     */
    startSN: number

    startTimeOffset: null | number

    /**
     * 视频的最大时长
     */
    targetduration: number

    /**
     * 总时长
     */
    totalduration: number

    type: any

    /**
     * ts 链接
     */
    private url: string

    /**
     * 平均时长
     */
    averagetargetduration?: number

    /**
     * 兼容的版本号
     */
    version: null | string | number

    constructor(baseUrl: string) {
        // Please keep properties in alphabetical order
        this.endCC = 0;
        this.endSN = 0;
        this.fragments = [];
        this.initSegment = null;
        this.live = true;
        this.needSidxRanges = false;
        this.startCC = 0;
        this.startSN = 0;
        this.startTimeOffset = null;
        this.targetduration = 0;
        this.totalduration = 0;
        this.type = null;
        this.url = baseUrl;
        this.version = null;
        this.averagetargetduration = 0;
    }

    get hasProgramDateTime(): boolean {
        return !!(this.fragments[0] && Number.isFinite(<number> this.fragments[0].programDateTime));
    }
}
