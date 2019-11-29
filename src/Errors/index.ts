// import IOError from './IOError'

// export { IOError }

const HJPlayerErrors = {
    // 当 解码器探测返回false时触发
    UN_SUPPORT_MEDIA: 'UN_SUPPORT_MEDIA',

    // 当 loader 加载媒体文件遇到网络错误时触发
    NETWORK_ERROR: 'NETWORK_ERROR',

    // 解析错误
    TRANSMUXING_ERROR: 'TRANSMUXING_ERROR',

    // LoaderIO 出现错误
    IO_ERROR: 'IO_ERROR',

    /**
     * 加载相关的错误
     */
    OK: 'OK',

    // 加载异常
    EXCEPTION: 'EXCEPTION',

    // 加载是遇到 不可用的 HTTP的请求
    HTTP_STATUS_CODE_INVALID: 'HTTP_STATUS_CODE_INVALID',

    // 加载超时
    CONNECTING_TIMEOUT: 'CONNECTING_TIMEOUT',

    // 读取文件时非正常的提前进入EOF状态
    EARLY_EOF: 'EARLY_EOF',

    // 不可恢复的文件EOF异常
    UNRECOVERABLE_EARLY_EOF: 'UNRECOVERABLE_EARLY_EOF',

    // 媒体错误
    MEDIA_ERROR: 'MEDIA_ERROR',

    //
    MEDIA_MSE_ERROR: 'MEDIA_MSE_ERROR',

    FORMAT_ERROR: 'FORMAT_ERROR',

    FORMAT_UNSUPPORTED: 'FORMAT_UNSUPPORTED',

    CODEC_UNSUPPORTED: 'CODEC_UNSUPPORTED'
};

export default HJPlayerErrors;
