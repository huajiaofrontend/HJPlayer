interface SEIInfo {
    NALU_LENGTH: number
    NALU_TYPE: number
    RESULT: Array<SEIResult>
}

interface SEIResult {
    TYPE: number
    SEI_SUM: number
    UUID: string
    SELF_DEFINE_TYPE: number
    SELF_DEFINE_CONTENT_LENGTH: number
    SELF_DEFINE_CONTENT_STRING: string
}

export default SEIInfo;
