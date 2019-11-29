import Level from './Level';
import { MediaPlaylist, AudioGroup, MediaPlaylistType } from '../Interfaces/media-playlist';
import { PlaylistLevelType, SingleLevels } from '../Interfaces/loader';
export default class M3U8Parser {
    static Tag: string;
    static findGroup(groups: Array<AudioGroup>, mediaGroupId: string): AudioGroup | null;
    static convertAVC1ToAVCOTI(codec: string): string;
    static resolve(url: string, baseUrl: string): string;
    static parseMasterPlaylist(string: string, baseurl: string): SingleLevels[];
    static parseMasterPlaylistMedia(string: string, baseurl: string, type: MediaPlaylistType, audioGroups?: Array<AudioGroup>): Array<MediaPlaylist>;
    static parseLevelPlaylist(string: string, baseurl: string, id: number, type: PlaylistLevelType, levelUrlId: number): Level;
}
