/*
 * 抛出的事件
 * */
enum ParserEvents {
    LOADING_ERROR = 'LOADING_ERROR', // 加载M3U8文件失败
    LOAD_COMPLETE = 'LOAD_COMPLETE', // 加载M3U8文件完毕
    MANIFEST_PARSED = 'MANIFEST_PARSED', // m3u8解析完成
    DEMUXER_PUSH = 'DEMUXER_PUSH',
    PARSE_SUCCESS = 'PARSE_SUCCESS', // 解析成功
    PARSE_ERROR = 'PARSE_ERROR', // 解析失败
    GET_TS_URL = 'GET_TS_URL', // 获取TS路径
    LOADIND_TIMEOUT = 'LOADIND_TIMEOUT'
}

export default ParserEvents;
