import BaseEvent from './BaseEvent';
import UserConfig from './UserConfig';
import MediaConfig from './MediaConfig';

interface Player extends BaseEvent {
    attachMedia(videoElement: HTMLMediaElement): void
    detachMedia(): void
    load(): void
    unload(): void
    play(): void
    pause(): void
    Tag: string
    mediaConfig: MediaConfig
    userConfig: UserConfig | undefined
    videoElement: HTMLVideoElement | null
    type: string
    buffered: TimeRanges | null
    duration: number
    volume: number
    muted: boolean
    currentTime: number
    mediaInfo: Object
    statisticsInfo: Object
}

export default Player;
