const DECIMAL_RESOLUTION_REGEX = /^(\d+)x(\d+)$/; // eslint-disable-line no-useless-escape
const ATTR_LIST_REGEX = /\s*(.+?)\s*=((?:\".*?\")|.*?)(?:,|$)/g; // eslint-disable-line no-useless-escape

// adapted from https://github.com/kanongil/node-m3u8parse/blob/master/attrlist.js
class AttrList {
    AUDIO: string = '' // todo 确认内容

    constructor(attrs: string | object) {
        if(typeof attrs === 'string') {
            attrs = AttrList.parseAttrList(attrs);
        }

        Object.keys(attrs).forEach((attr) => {
            (this as any)[attr] = (attrs as any)[attr];
        });
    }

    decimalInteger(attrName: string): number {
        const intValue = parseInt((this as any)[attrName], 10);
        if(intValue > Number.MAX_SAFE_INTEGER) {
            return Infinity;
        }

        return intValue;
    }

    hexadecimalInteger(attrName: string): Uint8Array | null {
        if((this as any)[attrName]) {
            let stringValue = ((this as any)[attrName] || '0x').slice(2);
            stringValue = (stringValue.length & 1 ? '0' : '') + stringValue;

            const value = new Uint8Array(stringValue.length / 2);
            for(let i = 0; i < stringValue.length / 2; i++) {
                value[i] = parseInt(stringValue.slice(i * 2, i * 2 + 2), 16);
            }

            return value;
        }
        return null;
    }

    hexadecimalIntegerAsNumber(attrName: string): number {
        const intValue = parseInt((this as any)[attrName], 16);
        if(intValue > Number.MAX_SAFE_INTEGER) {
            return Infinity;
        }

        return intValue;
    }

    decimalFloatingPoint(attrName: string): number {
        return parseFloat((this as any)[attrName]);
    }

    enumeratedString(attrName: string): number {
        return (this as any)[attrName];
    }

    decimalResolution(attrName: string): undefined | { width: number; height: number } {
        const res = DECIMAL_RESOLUTION_REGEX.exec((this as any)[attrName]);
        if(res === null) {
            return undefined;
        }

        return {
            width: parseInt(res[1], 10),
            height: parseInt(res[2], 10)
        };
    }

    static parseAttrList(input: string) {
        let match;
        const attrs = Object.create(null);
        const quote = '"';
        let value;
        ATTR_LIST_REGEX.lastIndex = 0;
        while(ATTR_LIST_REGEX.exec(input) !== null) {
            const match:RegExpExecArray = <RegExpExecArray>ATTR_LIST_REGEX.exec(input);
            value = match[2];
            if(value.indexOf(quote) === 0 && value.lastIndexOf(quote) === value.length - 1) {
                value = value.slice(1, -1);
            }
            (attrs as any)[match[1]] = value; // todo attrs 类型
        }
        return attrs;
    }
}

export default AttrList;
