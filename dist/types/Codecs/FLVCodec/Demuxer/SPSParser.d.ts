import ExpGolomb from './ExpGolomb';
declare class SPSParser {
    static _ebsp2rbsp(uint8array: Uint8Array): Uint8Array;
    static parseSPS(uint8array: Uint8Array): {
        profileString: string;
        levelString: string;
        bitDepth: number;
        refFrames: number;
        chromaFormat: number;
        chromaFormatString: string;
        frameRate: {
            fixed: boolean;
            fps: number;
            fpsDen: number;
            fpsNum: number;
        };
        sarRatio: {
            width: number;
            height: number;
        };
        codecSize: {
            width: number;
            height: number;
        };
        presentSize: {
            width: number;
            height: number;
        };
    };
    static _skipScalingList(gb: ExpGolomb, count: number): void;
    static getProfileString(profileIdc: number): "Baseline" | "Main" | "Extended" | "High" | "High10" | "High422" | "High444" | "Unknown";
    static getLevelString(levelIdc: number): string;
    static getChromaFormatString(chroma: number): "Unknown" | "4:2:0" | "4:2:2" | "4:4:4";
}
export default SPSParser;
