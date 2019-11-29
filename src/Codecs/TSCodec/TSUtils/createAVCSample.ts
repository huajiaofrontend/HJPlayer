import { avcSample } from '../TSCodecInterface';

function createAVCSample(
    key: boolean,
    pts: number | undefined,
    dts: number | undefined,
    debug: string
): avcSample {
    return {
        key,
        pts: <number>pts,
        dts: <number>dts,
        units: [],
        debug,
        frame: false
    };
}

export default createAVCSample;
