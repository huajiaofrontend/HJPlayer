import { ScriptData } from '../Interface';
declare class AMF {
    static parseScriptData(arrayBuffer: ArrayBuffer, dataOffset: number, dataSize: number): ScriptData;
    static parseObject(arrayBuffer: ArrayBuffer, dataOffset: number, dataSize: number): {
        data: {
            name: string;
            value: any;
        };
        size: number;
        objectEnd: boolean | undefined;
    };
    static parseVariable(arrayBuffer: ArrayBuffer, dataOffset: number, dataSize: number): {
        data: {
            name: string;
            value: any;
        };
        size: number;
        objectEnd: boolean | undefined;
    };
    static parseString(arrayBuffer: ArrayBuffer, dataOffset: number, dataSize: number): {
        data: string;
        size: number;
    };
    static parseLongString(arrayBuffer: ArrayBuffer, dataOffset: number, dataSize: number): {
        data: string;
        size: number;
    };
    static parseDate(arrayBuffer: ArrayBuffer, dataOffset: number, dataSize: number): {
        data: Date;
        size: number;
    };
    static parseValue(arrayBuffer: ArrayBuffer, dataOffset: number, dataSize: number): ScriptData;
}
export default AMF;
