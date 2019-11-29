import EventEmitter from 'eventemitter3';
import {
    track, pesData, parsedPesData, avcSample, NALUnit
} from '../TSCodecInterface';
/**
 * dummy remuxer
 */

class DummyRemuxer {
    observer: EventEmitter

    constructor(observer: EventEmitter) {
        this.observer = observer;
    }

    destroy() {}

    resetInitSegment() {}

    resetTimeStamp() {}

    remux(
        audioTrack: track,
        videoTrack: track,
        id3Track: track,
        textTrack: track,
        timeOffset: number
    ) {
        this._remuxAACSamples(audioTrack, timeOffset);
        this._remuxAVCSamples(videoTrack, timeOffset);
        this._remuxID3Samples(id3Track, timeOffset);
        this._remuxTextSamples(textTrack, timeOffset);
    }

    _remuxAVCSamples(track: track, timeOffset: number) {
    }

    _remuxAACSamples(track: track, timeOffset: number) {
    }

    _remuxID3Samples(track: track, timeOffset: number) {
    }

    _remuxTextSamples(track: track, timeOffset: number) {
    }
}

export default DummyRemuxer;
