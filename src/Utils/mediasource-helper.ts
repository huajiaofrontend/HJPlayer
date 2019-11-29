/**
 * MediaSource helper
 */

export default function getMediaSource(): typeof MediaSource {
    return (window as any).MediaSource || (window as any).WebKitMediaSource;
}
