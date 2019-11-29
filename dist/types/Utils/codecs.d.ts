export declare type CodecType = 'audio' | 'video';
declare function isCodecType(codec: string, type: CodecType): boolean;
declare function isCodecSupportedInMp4(codec: string, type: CodecType): boolean;
export { isCodecType, isCodecSupportedInMp4 };
