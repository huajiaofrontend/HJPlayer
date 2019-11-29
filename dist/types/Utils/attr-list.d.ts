declare class AttrList {
    AUDIO: string;
    constructor(attrs: string | object);
    decimalInteger(attrName: string): number;
    hexadecimalInteger(attrName: string): Uint8Array | null;
    hexadecimalIntegerAsNumber(attrName: string): number;
    decimalFloatingPoint(attrName: string): number;
    enumeratedString(attrName: string): number;
    decimalResolution(attrName: string): undefined | {
        width: number;
        height: number;
    };
    static parseAttrList(input: string): any;
}
export default AttrList;
