/**
 * 计算M3U8文件加载周期
 * @param { Object } currentPlaylist - 当前的M3U8文件内容
 * @param { Object } newPlaylist - 新加载的M3U8文件内容
 * @param { Number } lastRequestTime 新加载M3U8请求时间
 * @returns { Number } loadtime - 下一次加载延迟
 */

import getGlobalObject from './getGlobalObject';
import Level from '../Parser/Level';

const global = getGlobalObject();

export default function computeReloadInterval(
    currentPlaylist: Level | null,
    newPlaylist: Level,
    lastRequestTime: number
) {
    let reloadInterval = 1000
        * (newPlaylist.averagetargetduration
            ? newPlaylist.averagetargetduration
            : newPlaylist.targetduration);
    const minReloadInterval = reloadInterval / 2;
    if(currentPlaylist && newPlaylist.endSN === currentPlaylist.endSN) {
        // follow HLS Spec, If the client reloads a Playlist file and finds that it has not
        // changed then it MUST wait for a period of one-half the target
        // duration before retrying.
        reloadInterval = minReloadInterval;
    }

    if(lastRequestTime) {
        reloadInterval = Math.max(
            minReloadInterval,
            reloadInterval - (global.performance.now() - lastRequestTime)
        );
    }
    // in any case, don't reload more than half of target duration
    return Math.round(reloadInterval);
}
