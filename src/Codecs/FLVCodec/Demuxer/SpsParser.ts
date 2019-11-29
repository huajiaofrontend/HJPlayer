import ExpGolomb from './ExpGolomb';

class SPSParser {
    static _ebsp2rbsp(uint8array: Uint8Array) {
        const src = uint8array;
        const srcLength = src.byteLength;
        const dst = new Uint8Array(srcLength);
        let dstIndex = 0;

        for(let i = 0; i < srcLength; i++) {
            if(i >= 2) {
                // Unescape: Skip 0x03 after 00 00
                if(src[i] === 0x03 && src[i - 1] === 0x00 && src[i - 2] === 0x00) {
                    continue;
                }
            }
            dst[dstIndex] = src[i];
            dstIndex++;
        }

        return new Uint8Array(dst.buffer, 0, dstIndex);
    }

    static parseSPS(uint8array: Uint8Array) {
        const rbsp = SPSParser._ebsp2rbsp(uint8array);
        let gb: ExpGolomb | null = new ExpGolomb(rbsp);

        gb.readUByte();
        const profileIdc = gb.readUByte(); // profile_idc
        gb.readUByte(); // constraint_set_flags[5] + reserved_zero[3]
        const levelIdc = gb.readUByte(); // level_idc
        gb.readUEG(); // seq_parameter_set_id

        const profileString = SPSParser.getProfileString(profileIdc);
        const levelString = SPSParser.getLevelString(levelIdc);
        let chromaFormatIdc = 1;
        let chromaFormat = 420;
        const chromaFormatTable = [0, 420, 422, 444];
        let bitDepth = 8;

        if(
            profileIdc === 100
            || profileIdc === 110
            || profileIdc === 122
            || profileIdc === 244
            || profileIdc === 44
            || profileIdc === 83
            || profileIdc === 86
            || profileIdc === 118
            || profileIdc === 128
            || profileIdc === 138
            || profileIdc === 144
        ) {
            chromaFormatIdc = gb.readUEG();
            if(chromaFormatIdc === 3) {
                gb.readBits(1); // separate_colour_plane_flag
            }
            if(chromaFormatIdc <= 3) {
                chromaFormat = chromaFormatTable[chromaFormatIdc];
            }

            bitDepth = gb.readUEG() + 8; // bitDepth_luma_minus8
            gb.readUEG(); // bitDepth_chroma_minus8
            gb.readBits(1); // qpprime_y_zero_transform_bypass_flag
            if(gb.readBoolean()) {
                // seq_scaling_matrix_present_flag
                const scalingListCount = chromaFormatIdc !== 3 ? 8 : 12;
                for(let i = 0; i < scalingListCount; i++) {
                    if(gb.readBoolean()) {
                        // seq_scaling_list_present_flag
                        if(i < 6) {
                            SPSParser._skipScalingList(gb, 16);
                        } else {
                            SPSParser._skipScalingList(gb, 64);
                        }
                    }
                }
            }
        }
        gb.readUEG(); // log2_max_frame_num_minus4
        const picOrderCntType = gb.readUEG();
        if(picOrderCntType === 0) {
            gb.readUEG(); // log2_max_pic_order_cnt_lsb_minus_4
        } else if(picOrderCntType === 1) {
            gb.readBits(1); // delta_pic_order_always_zero_flag
            gb.readUEG(); // offset_for_non_ref_pic
            gb.readUEG(); // offset_for_top_to_bottom_field
            const numRefFramesInPicOrderCntCycle = gb.readUEG();
            for(let i = 0; i < numRefFramesInPicOrderCntCycle; i++) {
                gb.readUEG(); // offset_for_ref_frame
            }
        }
        const refFrames = gb.readUEG(); // max_num_refFrames
        gb.readBits(1); // gaps_in_frame_num_value_allowed_flag

        const picWidthInMbsMinus1 = gb.readUEG();
        const picHeightInMapUnitsMinus1 = gb.readUEG();

        const frameMbsOnlyFlag = gb.readBits(1);
        if(frameMbsOnlyFlag === 0) {
            gb.readBits(1); // mb_adaptive_frame_field_flag
        }
        gb.readBits(1); // direct_8x8_inference_flag

        let frameCropLeftOffset = 0;
        let frameCropRightOffset = 0;
        let frameCropTopOffset = 0;
        let frameCropBottomOffset = 0;

        const frameCroppingFlag = gb.readBoolean();
        if(frameCroppingFlag) {
            frameCropLeftOffset = gb.readUEG();
            frameCropRightOffset = gb.readUEG();
            frameCropTopOffset = gb.readUEG();
            frameCropBottomOffset = gb.readUEG();
        }

        let sarWidth = 1;
        let sarHeight = 1;
        let fps = 0;
        let fpsFixed = true;
        let fpsNum = 0;
        let fpsDen = 0;

        const vuiParametersPresentFlag = gb.readBoolean();
        if(vuiParametersPresentFlag) {
            if(gb.readBoolean()) {
                // aspect_ratio_info_present_flag
                const aspectRatioIdc = gb.readUByte();
                const sarWTable = [1, 12, 10, 16, 40, 24, 20, 32, 80, 18, 15, 64, 160, 4, 3, 2];
                const sarHTable = [1, 11, 11, 11, 33, 11, 11, 11, 33, 11, 11, 33, 99, 3, 2, 1];

                if(aspectRatioIdc > 0 && aspectRatioIdc < 16) {
                    sarWidth = sarWTable[aspectRatioIdc - 1];
                    sarHeight = sarHTable[aspectRatioIdc - 1];
                } else if(aspectRatioIdc === 255) {
                    sarWidth = (gb.readUByte() << 8) | gb.readUByte();
                    sarHeight = (gb.readUByte() << 8) | gb.readUByte();
                }
            }

            if(gb.readBoolean()) {
                // overscan_info_present_flag
                gb.readBoolean(); // overscan_appropriate_flag
            }
            if(gb.readBoolean()) {
                // video_signal_type_present_flag
                gb.readBits(4); // video_format & video_full_range_flag
                if(gb.readBoolean()) {
                    // colour_description_present_flag
                    gb.readBits(24); // colour_primaries & transfer_characteristics & matrix_coefficients
                }
            }
            if(gb.readBoolean()) {
                // chroma_loc_info_present_flag
                gb.readUEG(); // chroma_sample_loc_type_top_field
                gb.readUEG(); // chroma_sample_loc_type_bottom_field
            }
            if(gb.readBoolean()) {
                // timing_info_present_flag
                const numUnitsInTick = gb.readBits(32);
                const timeScale = gb.readBits(32);
                fpsFixed = gb.readBoolean(); // fixed_frameRate_flag

                fpsNum = timeScale;
                fpsDen = numUnitsInTick * 2;
                fps = fpsNum / fpsDen;
            }
        }

        let sarScale = 1;
        if(sarWidth !== 1 || sarHeight !== 1) {
            sarScale = sarWidth / sarHeight;
        }

        let cropUnitX = 0;
        let cropUnitY = 0;
        if(chromaFormatIdc === 0) {
            cropUnitX = 1;
            cropUnitY = 2 - frameMbsOnlyFlag;
        } else {
            const subWc = chromaFormatIdc === 3 ? 1 : 2;
            const subHc = chromaFormatIdc === 1 ? 2 : 1;
            cropUnitX = subWc;
            cropUnitY = subHc * (2 - frameMbsOnlyFlag);
        }

        let codecWidth = (picWidthInMbsMinus1 + 1) * 16;
        let codecHeight = (2 - frameMbsOnlyFlag) * ((picHeightInMapUnitsMinus1 + 1) * 16);

        codecWidth -= (frameCropLeftOffset + frameCropRightOffset) * cropUnitX;
        codecHeight -= (frameCropTopOffset + frameCropBottomOffset) * cropUnitY;

        const presentWidth = Math.ceil(codecWidth * sarScale);

        // gb.destroy();
        gb = null;

        return {
            profileString, // baseline, high, high10, ...
            levelString, // 3, 3.1, 4, 4.1, 5, 5.1, ...
            bitDepth, // 8bit, 10bit, ...
            refFrames,
            chromaFormat, // 4:2:0, 4:2:2, ...
            chromaFormatString: SPSParser.getChromaFormatString(chromaFormat),
            frameRate: {
                fixed: fpsFixed,
                fps,
                fpsDen,
                fpsNum
            },
            sarRatio: {
                width: sarWidth,
                height: sarHeight
            },
            codecSize: {
                width: codecWidth,
                height: codecHeight
            },
            presentSize: {
                width: presentWidth,
                height: codecHeight
            }
        };
    }

    static _skipScalingList(gb: ExpGolomb, count: number) {
        let lastScale = 8;
        let nextScale = 8;
        let deltaScale = 0;
        for(let i = 0; i < count; i++) {
            if(nextScale !== 0) {
                deltaScale = gb.readUEG();
                nextScale = (lastScale + deltaScale + 256) % 256;
            }
            lastScale = nextScale === 0 ? lastScale : nextScale;
        }
    }

    static getProfileString(profileIdc: number) {
        switch(profileIdc) {
        case 66:
            return 'Baseline';
        case 77:
            return 'Main';
        case 88:
            return 'Extended';
        case 100:
            return 'High';
        case 110:
            return 'High10';
        case 122:
            return 'High422';
        case 244:
            return 'High444';
        default:
            return 'Unknown';
        }
    }

    static getLevelString(levelIdc: number) {
        return (levelIdc / 10).toFixed(1);
    }

    static getChromaFormatString(chroma: number) {
        switch(chroma) {
        case 420:
            return '4:2:0';
        case 422:
            return '4:2:2';
        case 444:
            return '4:4:4';
        default:
            return 'Unknown';
        }
    }
}

export default SPSParser;
