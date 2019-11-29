/**
 * 带优化, 很多都用不到
 */
const createHLSDefaultConfig = function createHLSDefaultConfig() {
    return {
        forceKeyFrameOnDiscontinuity: true,
        maxAudioFramesDrift: 1,
        maxBufferHole: 0.5,
        maxFragLookUpTolerance: 0.25,
        stretchShortVideoTrack: false
    };
};

export default createHLSDefaultConfig;
