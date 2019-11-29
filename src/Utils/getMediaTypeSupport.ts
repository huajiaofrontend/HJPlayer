import typeSupportData from '../Interfaces/typeSupportData';

const typeSupport = function typeSupport(): typeSupportData {
    const MediaSource = (window as any).MediaSource || (window as any).WebKitMediaSource;
    if(MediaSource) {
        return {
            mp4: MediaSource.isTypeSupported('video/mp4'),
            mpeg: MediaSource.isTypeSupported('audio/mpeg'),
            mp3: MediaSource.isTypeSupported('audio/mp4; codecs="mp3"')
        };
    }
    return {
        mp4: false,
        mpeg: false,
        mp3: false
    };
};

export default typeSupport;
