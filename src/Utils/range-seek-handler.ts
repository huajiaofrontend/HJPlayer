import SeekRange from '../Interfaces/SeekRange';

class RangeSeekHandler {
    private _zeroStart: number | boolean

    constructor(zeroStart: number | boolean) {
        this._zeroStart = zeroStart || false;
    }

    getConfig(url: string, range: SeekRange) {
        const headers = Object.create(null);

        if(range.from !== 0 || range.to !== -1) {
            let param;
            if(range.to !== -1) {
                param = `bytes=${range.from.toString()}-${range.to.toString()}`;
            } else {
                param = `bytes=${range.from.toString()}-`;
            }
            headers.Range = param;
        } else if(this._zeroStart) {
            headers.Range = 'bytes=0-';
        }

        return {
            url,
            headers
        };
    }

    removeURLParameters(seekedURL: string) {
        return seekedURL;
    }
}

export default RangeSeekHandler;
