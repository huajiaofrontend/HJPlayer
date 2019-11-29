/**
 * 因为reduce的类型转换不对, 所以单独写了这个函数 解析 UUID
 * @param uuidArray UUID的Uint8Array数组
 */
function getUUIDString(uuidArray: Uint8Array): string {
    let index = 0;
    let UUID = '';
    if(!uuidArray) {
        return UUID;
    }
    while(index < uuidArray.length) {
        if(index % 4 === 0 && index !== 0) {
            UUID += '-';
        }
        UUID += uuidArray[index].toString(16);
        index++;
    }
    return UUID;
}

function checkContinuation(uint8array: Uint8Array, start: number, checkLength: number): boolean {
    const array = uint8array;
    if(start + checkLength < array.length) {
        while(checkLength--) {
            if((array[++start] & 0xc0) !== 0x80) return false;
        }
        return true;
    }
    return false;
}

function decodeUTF8(uint8array: Uint8Array): string {
    const out = [];
    const input = uint8array;
    let i = 0;
    const { length } = uint8array;

    while(i < length) {
        if(input[i] < 0x80) {
            out.push(String.fromCharCode(input[i]));
            ++i;
            continue;
        } else if(input[i] < 0xc0) {
            // fallthrough
        } else if(input[i] < 0xe0) {
            if(checkContinuation(input, i, 1)) {
                const ucs4 = ((input[i] & 0x1f) << 6) | (input[i + 1] & 0x3f);
                if(ucs4 >= 0x80) {
                    out.push(String.fromCharCode(ucs4 & 0xffff));
                    i += 2;
                    continue;
                }
            }
        } else if(input[i] < 0xf0) {
            if(checkContinuation(input, i, 2)) {
                const ucs4 = ((input[i] & 0xf) << 12) | ((input[i + 1] & 0x3f) << 6) | (input[i + 2] & 0x3f);
                if(ucs4 >= 0x800 && (ucs4 & 0xf800) !== 0xd800) {
                    out.push(String.fromCharCode(ucs4 & 0xffff));
                    i += 3;
                    continue;
                }
            }
        } else if(input[i] < 0xf8) {
            if(checkContinuation(input, i, 3)) {
                let ucs4 = ((input[i] & 0x7) << 18)
                    | ((input[i + 1] & 0x3f) << 12)
                    | ((input[i + 2] & 0x3f) << 6)
                    | (input[i + 3] & 0x3f);
                if(ucs4 > 0x10000 && ucs4 < 0x110000) {
                    ucs4 -= 0x10000;
                    out.push(String.fromCharCode((ucs4 >>> 10) | 0xd800));
                    out.push(String.fromCharCode((ucs4 & 0x3ff) | 0xdc00));
                    i += 4;
                    continue;
                }
            }
        }
        out.push(String.fromCharCode(0xfffd));
        ++i;
    }

    return out.join('');
}

/**
 * [parseVideoSei description]
 * @param  {[Uint8Array]} unitArray [包含所有SEI信息的unit8array无符号整型数组]
 */
function parseVideoSei(unitArray: Uint8Array): Object | null {
    let offset = 0;
    let isError = false;
    const RESULT = [];
    const NALU_LENGTH = unitArray.length;
    const NALU_TYPE = unitArray[offset];
    offset++;
    while(unitArray.length > offset + 1) {
        const TYPE = unitArray[offset]; // SEI信息携带内容的类型
        if(TYPE !== 5) {
            // 不是自定义信息
            isError = true;
            break;
        }
        let SEI_SUM = 0; // 自定义SEI信息的长度
        do {
            offset++;
            SEI_SUM += unitArray[offset];
        } while(unitArray[offset] === 255);
        offset++;
        const uuidArray = unitArray.subarray(offset, offset + 16);
        offset += 16;

        const UUID = getUUIDString(uuidArray);

        // const UUID = uuidArray.reduce((last, next, index) => {
        //     const lastString = index === 1 ? last.toString(16) : last;
        //     return `${lastString}-${next.toString(16)}`;
        // });

        // const UUID = uuidArray.reduce(getUUIDString);

        const SELF_DEFINE_TYPE = unitArray[offset];
        let SELF_DEFINE_CONTENT_LENGTH = 0; // 自定义携带的内容的长度
        do {
            offset++;
            SELF_DEFINE_CONTENT_LENGTH += unitArray[offset];
        } while(unitArray[offset] === 255);
        offset++;
        const SELF_DEFINE_CONTENT_ARRAY = unitArray.subarray(
            offset,
            offset + SELF_DEFINE_CONTENT_LENGTH
        );
        let SELF_DEFINE_CONTENT_STRING = '';
        if(SELF_DEFINE_TYPE === 1) {
            SELF_DEFINE_CONTENT_STRING = decodeUTF8(SELF_DEFINE_CONTENT_ARRAY).split(',')[0];
        } else {
            const length = SELF_DEFINE_CONTENT_ARRAY.length - 1;
            const lastNumber = SELF_DEFINE_CONTENT_ARRAY[length];
            SELF_DEFINE_CONTENT_STRING = lastNumber === 0
                ? decodeUTF8(SELF_DEFINE_CONTENT_ARRAY.subarray(0, length))
                : decodeUTF8(SELF_DEFINE_CONTENT_ARRAY);
        }
        offset += SELF_DEFINE_CONTENT_LENGTH;
        RESULT.push({
            TYPE,
            SEI_SUM,
            UUID,
            SELF_DEFINE_TYPE,
            SELF_DEFINE_CONTENT_LENGTH,
            SELF_DEFINE_CONTENT_STRING
        });
    }
    return isError ? null : { NALU_LENGTH, NALU_TYPE, RESULT };
}

export default parseVideoSei;
