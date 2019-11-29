import { typeSupported } from '../TSCodecInterface';

const typeSupport = function typeSupport(): typeSupported {
    const MediaSource = (window as any).MediaSource || (window as any).WebKitMediaSource;
    return {
        mp4: MediaSource.isTypeSupported('video/mp4'),
        mpeg: MediaSource.isTypeSupported('audio/mpeg'),
        mp3: MediaSource.isTypeSupported('audio/mp4; codecs="mp3"')
    };
};

export default typeSupport;
