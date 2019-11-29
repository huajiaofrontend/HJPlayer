import decodeUTF8 from '../../../Utils/utf8-conv';
import { ScriptData } from '../Interface';

const le = (function littleEdian() {
    const buf = new ArrayBuffer(2);
    new DataView(buf).setInt16(0, 256, true); // little-endian write
    return new Int16Array(buf)[0] === 256; // platform-spec read, if equal then LE
}());

class AMF {
    static parseScriptData(arrayBuffer: ArrayBuffer, dataOffset: number, dataSize: number) {
        const info: ScriptData = Object.create(null);

        try {
            const name: ScriptData = AMF.parseValue(arrayBuffer, dataOffset, dataSize);
            const size: number = name.size || 0;
            const data: string = name.data || '';
            const value: ScriptData = AMF.parseValue(
                arrayBuffer,
                dataOffset + size,
                dataSize - size
            );

            info[data] = value.data;
        } catch (e) {
            // Log.e('AMF', e.toString());
        }

        return info;
    }

    static parseObject(arrayBuffer: ArrayBuffer, dataOffset: number, dataSize: number) {
        if(dataSize < 3) {
            throw new Error('Data not enough when parse ScriptDataObject');
        }
        const name = AMF.parseString(arrayBuffer, dataOffset, dataSize);
        const value = AMF.parseValue(arrayBuffer, dataOffset + name.size, dataSize - name.size);
        const size: number = value.size || 0;
        const isObjectEnd = value.objectEnd;

        return {
            data: {
                name: name.data,
                value: value.data
            },
            size: name.size + size,
            objectEnd: isObjectEnd
        };
    }

    static parseVariable(arrayBuffer: ArrayBuffer, dataOffset: number, dataSize: number) {
        return AMF.parseObject(arrayBuffer, dataOffset, dataSize);
    }

    static parseString(arrayBuffer: ArrayBuffer, dataOffset: number, dataSize: number) {
        if(dataSize < 2) {
            throw new Error('Data not enough when parse String');
        }
        const v = new DataView(arrayBuffer, dataOffset, dataSize);
        const length = v.getUint16(0, !le);

        let str;
        if(length > 0) {
            str = decodeUTF8(new Uint8Array(arrayBuffer, dataOffset + 2, length));
        } else {
            str = '';
        }

        return {
            data: str,
            size: 2 + length
        };
    }

    static parseLongString(arrayBuffer: ArrayBuffer, dataOffset: number, dataSize: number) {
        if(dataSize < 4) {
            throw new Error('Data not enough when parse LongString');
        }
        const v = new DataView(arrayBuffer, dataOffset, dataSize);
        const length = v.getUint32(0, !le);

        let str;
        if(length > 0) {
            str = decodeUTF8(new Uint8Array(arrayBuffer, dataOffset + 4, length));
        } else {
            str = '';
        }

        return {
            data: str,
            size: 4 + length
        };
    }

    static parseDate(arrayBuffer: ArrayBuffer, dataOffset: number, dataSize: number) {
        if(dataSize < 10) {
            throw new Error('Data size invalid when parse Date');
        }
        const v = new DataView(arrayBuffer, dataOffset, dataSize);
        let timestamp = v.getFloat64(0, !le);
        const localTimeOffset = v.getInt16(8, !le);
        timestamp += localTimeOffset * 60 * 1000; // get UTC time

        return {
            data: new Date(timestamp),
            size: 8 + 2
        };
    }

    static parseValue(arrayBuffer: ArrayBuffer, dataOffset: number, dataSize: number): ScriptData {
        if(dataSize < 1) {
            throw new Error('Data not enough when parse Value');
        }

        const v = new DataView(arrayBuffer, dataOffset, dataSize);

        let offset = 1;
        const type = v.getUint8(0);
        let value: any;
        let objectEnd = false;

        try {
            switch(type) {
            case 0: // Number(Double) type
                value = v.getFloat64(1, !le);
                offset += 8;
                break;
            case 1: {
                // Boolean type
                const b = v.getUint8(1);
                value = !!b;
                offset += 1;
                break;
            }
            case 2: {
                // String type
                const amfstr = AMF.parseString(arrayBuffer, dataOffset + 1, dataSize - 1);
                value = amfstr.data;
                offset += amfstr.size;
                break;
            }
            case 3: {
                // Object(s) type
                value = {};
                let terminal = 0; // workaround for malformed Objects which has missing ScriptDataObjectEnd
                if((v.getUint32(dataSize - 4, !le) & 0x00ffffff) === 9) {
                    terminal = 3;
                }
                while(offset < dataSize - 4) {
                    // 4 === type(UI8) + ScriptDataObjectEnd(UI24)
                    const amfobj = AMF.parseObject(
                        arrayBuffer,
                        dataOffset + offset,
                        dataSize - offset - terminal
                    );
                    if(amfobj.objectEnd) break;
                    value[amfobj.data.name] = amfobj.data.value;
                    offset += amfobj.size;
                }
                if(offset <= dataSize - 3) {
                    const marker = v.getUint32(offset - 1, !le) & 0x00ffffff;
                    if(marker === 9) {
                        offset += 3;
                    }
                }
                break;
            }
            case 8: {
                // ECMA array type (Mixed array)
                value = {};
                offset += 4; // ECMAArrayLength(UI32)
                let terminal = 0; // workaround for malformed MixedArrays which has missing ScriptDataObjectEnd
                if((v.getUint32(dataSize - 4, !le) & 0x00ffffff) === 9) {
                    terminal = 3;
                }
                while(offset < dataSize - 8) {
                    // 8 === type(UI8) + ECMAArrayLength(UI32) + ScriptDataVariableEnd(UI24)
                    const amfvar = AMF.parseVariable(
                        arrayBuffer,
                        dataOffset + offset,
                        dataSize - offset - terminal
                    );
                    if(amfvar.objectEnd) break;
                    value[amfvar.data.name] = amfvar.data.value;
                    offset += amfvar.size;
                }
                if(offset <= dataSize - 3) {
                    const marker = v.getUint32(offset - 1, !le) & 0x00ffffff;
                    if(marker === 9) {
                        offset += 3;
                    }
                }
                break;
            }
            case 9: // ScriptDataObjectEnd
                value = undefined;
                offset = 1;
                objectEnd = true;
                break;
            case 10: {
                // Strict array type
                // ScriptDataValue[n]. NOTE: according to video_file_format_spec_v10_1.pdf
                value = [];
                const strictArrayLength = v.getUint32(1, !le);
                offset += 4;
                for(let i = 0; i < strictArrayLength; i++) {
                    const val: ScriptData = AMF.parseValue(
                        arrayBuffer,
                        dataOffset + offset,
                        dataSize - offset
                    );
                    const size = val.size || 0;
                    value.push(val.data);
                    offset += size;
                }
                break;
            }
            case 11: {
                // Date type
                const date = AMF.parseDate(arrayBuffer, dataOffset + 1, dataSize - 1);
                value = date.data;
                offset += date.size;
                break;
            }
            case 12: {
                // Long string type
                const amfLongStr = AMF.parseString(arrayBuffer, dataOffset + 1, dataSize - 1);
                value = amfLongStr.data;
                offset += amfLongStr.size;
                break;
            }
            default:
                // ignore and skip
                offset = dataSize;
                // Log.w('AMF', 'Unsupported AMF value type ' + type);
            }
        } catch (e) {
            // Log.e('AMF', e.toString());
        }

        return {
            data: value,
            size: offset,
            objectEnd
        };
    }
}

export default AMF;
