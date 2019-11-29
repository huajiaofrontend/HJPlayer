/**
 * 存放事件的集合
 */
const HJPlayerEvents = {
    // 当转码器解析出初始化片段时触发, 不对外
    INIT_SEGMENT: 'INIT_SEGMENT',

    // 当转码器解析出媒体化片段时触发 不对外
    MEDIA_SEGMENT: 'MEDIA_SEGMENT',

    // 当转码器解析出媒体增强信息时触发 对外
    GET_SEI_INFO: 'GET_SEI_INFO',

    // 当转码器解析出媒体信息时触发 对外
    MEDIA_INFO: 'MEDIA_INFO',

    // 当 loader 加载媒体文件完成时触发 // 对外
    LOAD_COMPLETE: 'LOAD_COMPLETE',

    // 当 loader 获得到媒体数据时触发 不对外
    DATA_ARRIVED: 'DATA_ARRIVED',

    // 媒体统计信息 对外
    STATISTICS_INFO: 'STATISTICS_INFO',

    // 播放器log事件 对外
    HJ_PLAYER_LOG: 'HJ_PLAYER_LOG',

    // FRAG_PARSED
    FRAG_PARSED: 'FRAG_PARSED',

    // FRAG_PARSING_METADATA 不对外
    FRAG_PARSING_METADATA: 'FRAG_PARSING_METADATA',

    // FRAG_PARSING_USERDATA
    FRAG_PARSING_USERDATA: 'FRAG_PARSING_USERDATA',

    // INIT_PTS_FOUND
    INIT_PTS_FOUND: 'INIT_PTS_FOUND',

    // FRAG_PARSING_INIT_SEGMENT
    FRAG_PARSING_INIT_SEGMENT: 'FRAG_PARSING_INIT_SEGMENT',

    // 媒体 SEEK 事件 不对外
    MEDIA_SEEK: 'MEDIA_SEEK',

    // 从文件过早结束的异常中恢复 对外
    RECOVERED_EARLY_EOF: 'RECOVERED_EARLY_EOF',

    // 推荐的SEEK点 不对外
    RECOMMEND_SEEKPOINT: 'RECOMMEND_SEEKPOINT',

    // 媒体信息 对外
    METADATA_ARRIVED: 'METADATA_ARRIVED',

    // FLV ScriptData 对外
    SCRIPTDATA_ARRIVED: 'SCRIPTDATA_ARRIVED',

    // 更新结束, 不对外
    UPDATE_END: 'UPDATE_END',

    // sourceBuffer 已满 不对外
    BUFFER_FULL: 'BUFFER_FULL',

    // sourceBuffer 已开 不对外
    SOURCE_OPEN: 'SOURCE_OPEN',

    // 总错误事件 对外
    ERROR: 'ERROR',

    // m3u8 playlist 解析完事件 对外
    MANIFEST_PARSED: 'MANIFEST_PARSED',

    // IO 出现错误时触发 对外
    IO_ERROR: 'IO_ERROR',

    // 解码出现错误时触发 对外
    DEMUX_ERROR: 'DEMUX_ERROR',

    // webworker 发送log日志
    WORKER_LOG: 'WORKER_LOG',

    // 加载下一个 frag, 不对外
    LOAD_NEXT_FRAG: 'LOAD_NEXT_FRAG'
};

export default HJPlayerEvents;
