/**
 * 带优化, 很多都用不到
 */
declare const createHLSDefaultConfig: () => {
    forceKeyFrameOnDiscontinuity: boolean;
    maxAudioFramesDrift: number;
    maxBufferHole: number;
    maxFragLookUpTolerance: number;
    stretchShortVideoTrack: boolean;
};
export default createHLSDefaultConfig;
