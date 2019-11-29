export default class LevelKey {
    private _uri;
    method: string | null;
    key: Uint8Array | null;
    iv: Uint8Array | null;
    baseuri: string;
    reluri: string;
    constructor(baseURI: string, relativeURI: string);
    readonly uri: string;
}
