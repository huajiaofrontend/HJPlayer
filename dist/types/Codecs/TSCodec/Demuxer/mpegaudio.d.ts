import { track } from '../TSCodecInterface';
/**
 *  MPEG parser helper
 */
declare const MpegAudio: {
    BitratesMap: number[];
    SamplingRateMap: number[];
    SamplesCoefficients: number[][];
    BytesInSlot: number[];
    appendFrame(track: track, data: Uint8Array, offset: number, pts: number, frameIndex: number): {
        sample: {
            unit: Uint8Array;
            pts: number;
            dts: number;
        };
        length: number;
    } | undefined;
    parseHeader(data: Uint8Array, offset: number): {
        sampleRate: number;
        channelCount: number;
        frameLength: number;
        samplesPerFrame: number;
    } | undefined;
    isHeaderPattern(data: Uint8Array, offset: number): boolean;
    isHeader(data: Uint8Array, offset: number): boolean;
    probe(data: Uint8Array, offset: number): boolean;
};
export default MpegAudio;
