/**
 * 计算M3U8文件加载周期
 * @param { Object } currentPlaylist - 当前的M3U8文件内容
 * @param { Object } newPlaylist - 新加载的M3U8文件内容
 * @param { Number } lastRequestTime 新加载M3U8请求时间
 * @returns { Number } loadtime - 下一次加载延迟
 */
import Level from '../Parser/Level';
export default function computeReloadInterval(currentPlaylist: Level | null, newPlaylist: Level, lastRequestTime: number): number;
