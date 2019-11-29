declare class ExpGolomb {
    Tag: string;
    data: Uint8Array;
    bytesAvailable: number;
    word: number;
    bitsAvailable: number;
    constructor(data: Uint8Array);
    loadWord(): void;
    skipBits(count: number): void;
    readBits(size: number): number;
    skipLZ(): number;
    skipUEG(): void;
    skipEG(): void;
    readUEG(): number;
    readEG(): number;
    readBoolean(): boolean;
    readUByte(): number;
    readUShort(): number;
    readUInt(): number;
    /**
     * Advance the ExpGolomb decoder past a scaling list. The scaling
     * list is optionally transmitted as part of a sequence parameter
     * set and is not relevant to transmuxing.
     * @param count {number} the number of entries in this scaling list
     * @see Recommendation ITU-T H.264, Section 7.3.2.1.1.1
     */
    skipScalingList(count: number): void;
    /**
     * Read a sequence parameter set and return some interesting video
     * properties. A sequence parameter set is the H264 metadata that
     * describes the properties of upcoming video frames.
     * @param data {Uint8Array} the bytes of a sequence parameter set
     * @return {object} an object with configuration parsed from the
     * sequence parameter set, including the dimensions of the
     * associated video frames.
     */
    readSPS(): {
        width: number;
        height: number;
        pixelRatio: number[];
    };
    readSliceType(): number;
}
export default ExpGolomb;
