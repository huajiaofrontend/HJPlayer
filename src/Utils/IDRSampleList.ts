import SampleInfo from './SampleInfo';

class IDRSampleList {
    private _list: SampleInfo[] = []

    public clear() {
        this._list = [];
    }

    public appendArray(syncPoints: SampleInfo[]) {
        const list = this._list;

        if(syncPoints.length === 0) {
            return;
        }

        if(list.length > 0 && syncPoints[0].originalDts < list[list.length - 1].originalDts) {
            this.clear();
        }
        Array.prototype.push.apply(list, syncPoints);
    }

    public getLastSyncPointBeforeDts(dts: number) {
        if(this._list.length === 0) {
            return null;
        }

        const list = this._list;
        let idx = 0;
        const last = list.length - 1;
        let mid = 0;
        let lbound = 0;
        let ubound = last;

        if(dts < list[0].dts) {
            idx = 0;
            lbound = ubound + 1;
        }

        while(lbound <= ubound) {
            mid = lbound + Math.floor((ubound - lbound) / 2);
            if(mid === last || (dts >= list[mid].dts && dts < list[mid + 1].dts)) {
                idx = mid;
                break;
            } else if(list[mid].dts < dts) {
                lbound = mid + 1;
            } else {
                ubound = mid - 1;
            }
        }
        return this._list[idx];
    }
}

export default IDRSampleList;
