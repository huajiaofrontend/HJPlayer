import URLToolkit from 'url-toolkit';

export default class LevelKey {
    private _uri: null | string = null

    public method: string | null = null

    public key: Uint8Array | null = null

    public iv: Uint8Array | null = null

    public baseuri: string

    public reluri: string

    constructor(baseURI: string, relativeURI: string) {
        this.baseuri = baseURI;
        this.reluri = relativeURI;
    }

    get uri(): string {
        if(!this._uri && this.reluri) {
            this._uri = URLToolkit.buildAbsoluteURL(this.baseuri, this.reluri, {
                alwaysNormalize: true
            });
        }
        return <string> this._uri;
    }
}
