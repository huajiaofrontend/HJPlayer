/**
 * 存放事件的集合
 */
declare const HJPlayerEvents: {
    INIT_SEGMENT: string;
    MEDIA_SEGMENT: string;
    GET_SEI_INFO: string;
    MEDIA_INFO: string;
    LOAD_COMPLETE: string;
    DATA_ARRIVED: string;
    STATISTICS_INFO: string;
    HJ_PLAYER_LOG: string;
    FRAG_PARSED: string;
    FRAG_PARSING_METADATA: string;
    FRAG_PARSING_USERDATA: string;
    INIT_PTS_FOUND: string;
    FRAG_PARSING_INIT_SEGMENT: string;
    MEDIA_SEEK: string;
    RECOVERED_EARLY_EOF: string;
    RECOMMEND_SEEKPOINT: string;
    METADATA_ARRIVED: string;
    SCRIPTDATA_ARRIVED: string;
    UPDATE_END: string;
    BUFFER_FULL: string;
    SOURCE_OPEN: string;
    ERROR: string;
    MANIFEST_PARSED: string;
    IO_ERROR: string;
    DEMUX_ERROR: string;
    WORKER_LOG: string;
    LOAD_NEXT_FRAG: string;
};
export default HJPlayerEvents;
