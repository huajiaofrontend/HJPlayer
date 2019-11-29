import { track } from '../Interface';

//  MP4 boxes generator for ISO BMFF (ISO Base Media File Format, defined in ISO/IEC 14496-12)
class MP4 {
    static types: Record<string, Array<number>>

    static HDLR_TYPES: Record<string, Uint8Array>

    static STTS: Uint8Array

    static STSC: Uint8Array

    static STCO: Uint8Array

    static STSZ: Uint8Array

    static VMHD: Uint8Array

    static SMHD: Uint8Array

    static STSD: Uint8Array

    static FTYP: Uint8Array

    static DINF: Uint8Array

    static STSD_PREFIX: Uint8Array

    static HDLR_VIDEO: Uint8Array

    static HDLR_AUDIO: Uint8Array

    static DREF: Uint8Array

    static init() {
        MP4.types = {
            avc1: [],
            avcC: [],
            btrt: [],
            dinf: [],
            dref: [],
            esds: [],
            ftyp: [],
            hdlr: [],
            mdat: [],
            mdhd: [],
            mdia: [],
            mfhd: [],
            minf: [],
            moof: [],
            moov: [],
            mp4a: [],
            mvex: [],
            mvhd: [],
            sdtp: [],
            stbl: [],
            stco: [],
            stsc: [],
            stsd: [],
            stsz: [],
            stts: [],
            tfdt: [],
            tfhd: [],
            traf: [],
            trak: [],
            trun: [],
            trex: [],
            tkhd: [],
            vmhd: [],
            smhd: [],
            '.mp3': []
        };

        Object.keys(MP4.types).forEach((type) => {
            MP4.types[type] = [
                type.charCodeAt(0),
                type.charCodeAt(1),
                type.charCodeAt(2),
                type.charCodeAt(3)
            ];
        });

        MP4.FTYP = new Uint8Array([
            0x69,
            0x73,
            0x6f,
            0x6d, // major_brand: isom
            0x0,
            0x0,
            0x0,
            0x1, // minor_version: 0x01
            0x69,
            0x73,
            0x6f,
            0x6d, // isom
            0x61,
            0x76,
            0x63,
            0x31 // avc1
        ]);

        MP4.STSD_PREFIX = new Uint8Array([
            0x00,
            0x00,
            0x00,
            0x00, // version(0) + flags
            0x00,
            0x00,
            0x00,
            0x01 // entry_count
        ]);

        MP4.STTS = new Uint8Array([
            0x00,
            0x00,
            0x00,
            0x00, // version(0) + flags
            0x00,
            0x00,
            0x00,
            0x00 // entry_count
        ]);
        MP4.STCO = MP4.STTS;
        MP4.STSC = MP4.STTS;

        MP4.STSZ = new Uint8Array([
            0x00,
            0x00,
            0x00,
            0x00, // version(0) + flags
            0x00,
            0x00,
            0x00,
            0x00, // sample_size
            0x00,
            0x00,
            0x00,
            0x00 // sample_count
        ]);

        MP4.HDLR_VIDEO = new Uint8Array([
            0x00,
            0x00,
            0x00,
            0x00, // version(0) + flags
            0x00,
            0x00,
            0x00,
            0x00, // pre_defined
            0x76,
            0x69,
            0x64,
            0x65, // handler_type: 'vide'
            0x00,
            0x00,
            0x00,
            0x00, // reserved: 3 * 4 bytes
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x56,
            0x69,
            0x64,
            0x65,
            0x6f,
            0x48,
            0x61,
            0x6e,
            0x64,
            0x6c,
            0x65,
            0x72,
            0x00 // name: VideoHandler
        ]);
        MP4.HDLR_AUDIO = new Uint8Array([
            0x00,
            0x00,
            0x00,
            0x00, // version(0) + flags
            0x00,
            0x00,
            0x00,
            0x00, // pre_defined
            0x73,
            0x6f,
            0x75,
            0x6e, // handler_type: 'soun'
            0x00,
            0x00,
            0x00,
            0x00, // reserved: 3 * 4 bytes
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x53,
            0x6f,
            0x75,
            0x6e,
            0x64,
            0x48,
            0x61,
            0x6e,
            0x64,
            0x6c,
            0x65,
            0x72,
            0x00 // name: SoundHandler
        ]);

        MP4.DREF = new Uint8Array([
            0x00,
            0x00,
            0x00,
            0x00, // version(0) + flags
            0x00,
            0x00,
            0x00,
            0x01, // entry_count
            0x00,
            0x00,
            0x00,
            0x0c, // entry_size
            0x75,
            0x72,
            0x6c,
            0x20, // type 'url '
            0x00,
            0x00,
            0x00,
            0x01 // version(0) + flags
        ]);

        // Sound media header
        MP4.SMHD = new Uint8Array([
            0x00,
            0x00,
            0x00,
            0x00, // version(0) + flags
            0x00,
            0x00,
            0x00,
            0x00 // balance(2) + reserved(2)
        ]);

        // video media header
        MP4.VMHD = new Uint8Array([
            0x00,
            0x00,
            0x00,
            0x01, // version(0) + flags
            0x00,
            0x00, // graphicsmode: 2 bytes
            0x00,
            0x00,
            0x00,
            0x00, // opcolor: 3 * 2 bytes
            0x00,
            0x00
        ]);
    }

    // Generate a box
    static box(type: Array<number>, ...args: Array<Uint8Array>) {
        let size = 8;
        let result = null;
        const datas = [...args];
        const arrayCount = datas.length;

        for(let i = 0; i < arrayCount; i++) {
            size += datas[i].byteLength;
        }

        result = new Uint8Array(size);
        result[0] = (size >>> 24) & 0xff; // size
        result[1] = (size >>> 16) & 0xff;
        result[2] = (size >>> 8) & 0xff;
        result[3] = size & 0xff;

        result.set(type, 4); // type

        let offset = 8;
        for(let i = 0; i < arrayCount; i++) {
            // data body
            result.set(datas[i], offset);
            offset += datas[i].byteLength;
        }

        return result;
    }

    // emit ftyp & moov
    static generateInitSegment(meta: track) {
        const ftyp = MP4.box(MP4.types.ftyp, MP4.FTYP);
        const moov = MP4.moov(meta);

        const result = new Uint8Array(ftyp.byteLength + moov.byteLength);
        result.set(ftyp, 0);
        result.set(moov, ftyp.byteLength);
        return result;
    }

    // Movie metadata box
    static moov(meta: track) {
        const mvhd = MP4.mvhd(meta.timescale, meta.duration);
        const trak = MP4.trak(meta);
        const mvex = MP4.mvex(meta);
        return MP4.box(MP4.types.moov, mvhd, trak, mvex);
    }

    // Movie header box
    static mvhd(timescale: number, duration: number = 0) {
        return MP4.box(
            MP4.types.mvhd,
            new Uint8Array([
                0x00,
                0x00,
                0x00,
                0x00, // version(0) + flags
                0x00,
                0x00,
                0x00,
                0x00, // creation_time
                0x00,
                0x00,
                0x00,
                0x00, // modification_time
                (timescale >>> 24) & 0xff, // timescale: 4 bytes
                (timescale >>> 16) & 0xff,
                (timescale >>> 8) & 0xff,
                timescale & 0xff,
                (duration >>> 24) & 0xff, // duration: 4 bytes
                (duration >>> 16) & 0xff,
                (duration >>> 8) & 0xff,
                duration & 0xff,
                0x00,
                0x01,
                0x00,
                0x00, // Preferred rate: 1.0
                0x01,
                0x00,
                0x00,
                0x00, // PreferredVolume(1.0, 2bytes) + reserved(2bytes)
                0x00,
                0x00,
                0x00,
                0x00, // reserved: 4 + 4 bytes
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x01,
                0x00,
                0x00, // ----begin composition matrix----
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x01,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x40,
                0x00,
                0x00,
                0x00, // ----end composition matrix----
                0x00,
                0x00,
                0x00,
                0x00, // ----begin pre_defined 6 * 4 bytes----
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00, // ----end pre_defined 6 * 4 bytes----
                0xff,
                0xff,
                0xff,
                0xff // next_track_ID
            ])
        );
    }

    // Track box
    static trak(meta: track) {
        return MP4.box(MP4.types.trak, MP4.tkhd(meta), MP4.mdia(meta));
    }

    // Track header box
    static tkhd(meta: track) {
        const trackId = meta.id;
        const duration = meta.duration || 0;
        const width = meta.presentWidth;
        const height = meta.presentHeight;

        return MP4.box(
            MP4.types.tkhd,
            new Uint8Array([
                0x00,
                0x00,
                0x00,
                0x07, // version(0) + flags
                0x00,
                0x00,
                0x00,
                0x00, // creation_time
                0x00,
                0x00,
                0x00,
                0x00, // modification_time
                (trackId >>> 24) & 0xff, // track_ID: 4 bytes
                (trackId >>> 16) & 0xff,
                (trackId >>> 8) & 0xff,
                trackId & 0xff,
                0x00,
                0x00,
                0x00,
                0x00, // reserved: 4 bytes
                (duration >>> 24) & 0xff, // duration: 4 bytes
                (duration >>> 16) & 0xff,
                (duration >>> 8) & 0xff,
                duration & 0xff,
                0x00,
                0x00,
                0x00,
                0x00, // reserved: 2 * 4 bytes
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00, // layer(2bytes) + alternate_group(2bytes)
                0x00,
                0x00,
                0x00,
                0x00, // volume(2bytes) + reserved(2bytes)
                0x00,
                0x01,
                0x00,
                0x00, // ----begin composition matrix----
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x01,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x40,
                0x00,
                0x00,
                0x00, // ----end composition matrix----
                (width >>> 8) & 0xff, // width and height
                width & 0xff,
                0x00,
                0x00,
                (height >>> 8) & 0xff,
                height & 0xff,
                0x00,
                0x00
            ])
        );
    }

    // Media Box
    static mdia(meta: track) {
        return MP4.box(MP4.types.mdia, MP4.mdhd(meta), MP4.hdlr(meta), MP4.minf(meta));
    }

    // Media header box
    static mdhd(meta: track) {
        const { timescale } = meta;
        const duration = meta.duration || 0;
        return MP4.box(
            MP4.types.mdhd,
            new Uint8Array([
                0x00,
                0x00,
                0x00,
                0x00, // version(0) + flags
                0x00,
                0x00,
                0x00,
                0x00, // creation_time
                0x00,
                0x00,
                0x00,
                0x00, // modification_time
                (timescale >>> 24) & 0xff, // timescale: 4 bytes
                (timescale >>> 16) & 0xff,
                (timescale >>> 8) & 0xff,
                timescale & 0xff,
                (duration >>> 24) & 0xff, // duration: 4 bytes
                (duration >>> 16) & 0xff,
                (duration >>> 8) & 0xff,
                duration & 0xff,
                0x55,
                0xc4, // language: und (undetermined)
                0x00,
                0x00 // pre_defined = 0
            ])
        );
    }

    // Media handler reference box
    static hdlr(meta: track) {
        let data = null;
        if(meta.type === 'audio') {
            data = MP4.HDLR_AUDIO;
        } else {
            data = MP4.HDLR_VIDEO;
        }
        return MP4.box(MP4.types.hdlr, data);
    }

    // Media infomation box
    static minf(meta: track) {
        let xmhd = null;
        if(meta.type === 'audio') {
            xmhd = MP4.box(MP4.types.smhd, MP4.SMHD);
        } else {
            xmhd = MP4.box(MP4.types.vmhd, MP4.VMHD);
        }
        return MP4.box(MP4.types.minf, xmhd, MP4.dinf(), MP4.stbl(meta));
    }

    // Data infomation box
    static dinf() {
        const result = MP4.box(MP4.types.dinf, MP4.box(MP4.types.dref, MP4.DREF));
        return result;
    }

    // Sample table box
    static stbl(meta: track) {
        const result = MP4.box(
            MP4.types.stbl, // type: stbl
            MP4.stsd(meta), // Sample Description Table
            MP4.box(MP4.types.stts, MP4.STTS), // Time-To-Sample
            MP4.box(MP4.types.stsc, MP4.STSC), // Sample-To-Chunk
            MP4.box(MP4.types.stsz, MP4.STSZ), // Sample size
            MP4.box(MP4.types.stco, MP4.STCO) // Chunk offset
        );
        return result;
    }

    // Sample description box
    static stsd(meta: track) {
        if(meta.type === 'audio') {
            if(meta.codec === 'mp3') {
                return MP4.box(MP4.types.stsd, MP4.STSD_PREFIX, MP4.mp3(meta));
            }
            // else: aac -> mp4a
            return MP4.box(MP4.types.stsd, MP4.STSD_PREFIX, MP4.mp4a(meta));
        }
        return MP4.box(MP4.types.stsd, MP4.STSD_PREFIX, MP4.avc1(meta));
    }

    static mp3(meta: track) {
        const { channelCount } = meta;
        const sampleRate = meta.audioSampleRate;

        const data = new Uint8Array([
            0x00,
            0x00,
            0x00,
            0x00, // reserved(4)
            0x00,
            0x00,
            0x00,
            0x01, // reserved(2) + data_reference_index(2)
            0x00,
            0x00,
            0x00,
            0x00, // reserved: 2 * 4 bytes
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            channelCount, // channelCount(2)
            0x00,
            0x10, // sampleSize(2)
            0x00,
            0x00,
            0x00,
            0x00, // reserved(4)
            (sampleRate >>> 8) & 0xff, // Audio sample rate
            sampleRate & 0xff,
            0x00,
            0x00
        ]);

        return MP4.box(MP4.types['.mp3'], data);
    }

    static mp4a(meta: track) {
        const { channelCount } = meta;
        const sampleRate = meta.audioSampleRate;

        const data = new Uint8Array([
            0x00,
            0x00,
            0x00,
            0x00, // reserved(4)
            0x00,
            0x00,
            0x00,
            0x01, // reserved(2) + data_reference_index(2)
            0x00,
            0x00,
            0x00,
            0x00, // reserved: 2 * 4 bytes
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            channelCount, // channelCount(2)
            0x00,
            0x10, // sampleSize(2)
            0x00,
            0x00,
            0x00,
            0x00, // reserved(4)
            (sampleRate >>> 8) & 0xff, // Audio sample rate
            sampleRate & 0xff,
            0x00,
            0x00
        ]);

        return MP4.box(MP4.types.mp4a, data, MP4.esds(meta));
    }

    static esds(meta: track) {
        const config = meta.config || [];
        const configSize = config.length;
        const data = new Uint8Array(
            [
                0x00,
                0x00,
                0x00,
                0x00, // version 0 + flags

                0x03, // descriptor_type
                0x17 + configSize, // length3
                0x00,
                0x01, // es_id
                0x00, // stream_priority

                0x04, // descriptor_type
                0x0f + configSize, // length
                0x40, // codec: mpeg4_audio
                0x15, // stream_type: Audio
                0x00,
                0x00,
                0x00, // buffer_size
                0x00,
                0x00,
                0x00,
                0x00, // maxBitrate
                0x00,
                0x00,
                0x00,
                0x00, // avgBitrate

                0x05 // descriptor_type
            ]
                .concat([configSize])
                .concat(config)
                .concat([
                    0x06,
                    0x01,
                    0x02 // GASpecificConfig
                ])
        );
        return MP4.box(MP4.types.esds, data);
    }

    static avc1(meta: track) {
        const { avcc } = meta;
        const width = meta.codecWidth;
        const height = meta.codecHeight;

        const data = new Uint8Array([
            0x00,
            0x00,
            0x00,
            0x00, // reserved(4)
            0x00,
            0x00,
            0x00,
            0x01, // reserved(2) + data_reference_index(2)
            0x00,
            0x00,
            0x00,
            0x00, // pre_defined(2) + reserved(2)
            0x00,
            0x00,
            0x00,
            0x00, // pre_defined: 3 * 4 bytes
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            (width >>> 8) & 0xff, // width: 2 bytes
            width & 0xff,
            (height >>> 8) & 0xff, // height: 2 bytes
            height & 0xff,
            0x00,
            0x48,
            0x00,
            0x00, // horizresolution: 4 bytes
            0x00,
            0x48,
            0x00,
            0x00, // vertresolution: 4 bytes
            0x00,
            0x00,
            0x00,
            0x00, // reserved: 4 bytes
            0x00,
            0x01, // frame_count
            0x0a, // strlen
            0x78,
            0x71,
            0x71,
            0x2f, // compressorname: 32 bytes
            0x66,
            0x6c,
            0x76,
            0x2e,
            0x6a,
            0x73,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x18, // depth
            0xff,
            0xff // pre_defined = -1
        ]);
        return MP4.box(MP4.types.avc1, data, MP4.box(MP4.types.avcC, avcc));
    }

    // Movie Extends box
    static mvex(meta: track) {
        return MP4.box(MP4.types.mvex, MP4.trex(meta));
    }

    // Track Extends box
    static trex(meta: track) {
        const trackId = meta.id;
        const data = new Uint8Array([
            0x00,
            0x00,
            0x00,
            0x00, // version(0) + flags
            (trackId >>> 24) & 0xff, // track_ID
            (trackId >>> 16) & 0xff,
            (trackId >>> 8) & 0xff,
            trackId & 0xff,
            0x00,
            0x00,
            0x00,
            0x01, // default_sample_description_index
            0x00,
            0x00,
            0x00,
            0x00, // default_sample_duration
            0x00,
            0x00,
            0x00,
            0x00, // default_sample_size
            0x00,
            0x01,
            0x00,
            0x01 // default_sample_flags
        ]);
        return MP4.box(MP4.types.trex, data);
    }

    // Movie fragment box
    static moof(track: track, baseMediaDecodeTime: number) {
        return MP4.box(
            MP4.types.moof,
            MP4.mfhd(track.sequenceNumber),
            MP4.traf(track, baseMediaDecodeTime)
        );
    }

    static mfhd(sequenceNumber: number) {
        const data = new Uint8Array([
            0x00,
            0x00,
            0x00,
            0x00,
            (sequenceNumber >>> 24) & 0xff, // sequence_number: int32
            (sequenceNumber >>> 16) & 0xff,
            (sequenceNumber >>> 8) & 0xff,
            sequenceNumber & 0xff
        ]);
        return MP4.box(MP4.types.mfhd, data);
    }

    // Track fragment box
    static traf(track: track, baseMediaDecodeTime: number) {
        const trackId = track.id;

        // Track fragment header box
        const tfhd = MP4.box(
            MP4.types.tfhd,
            new Uint8Array([
                0x00,
                0x00,
                0x00,
                0x00, // version(0) & flags
                (trackId >>> 24) & 0xff, // track_ID
                (trackId >>> 16) & 0xff,
                (trackId >>> 8) & 0xff,
                trackId & 0xff
            ])
        );
        // Track Fragment Decode Time
        const tfdt = MP4.box(
            MP4.types.tfdt,
            new Uint8Array([
                0x00,
                0x00,
                0x00,
                0x00, // version(0) & flags
                (baseMediaDecodeTime >>> 24) & 0xff, // baseMediaDecodeTime: int32
                (baseMediaDecodeTime >>> 16) & 0xff,
                (baseMediaDecodeTime >>> 8) & 0xff,
                baseMediaDecodeTime & 0xff
            ])
        );
        const sdtp = MP4.sdtp(track);
        const trun = MP4.trun(track, sdtp.byteLength + 16 + 16 + 8 + 16 + 8 + 8);

        return MP4.box(MP4.types.traf, tfhd, tfdt, trun, sdtp);
    }

    // Sample Dependency Type box
    static sdtp(track: track) {
        const samples = track.samples || [];
        const sampleCount = samples.length;
        const data = new Uint8Array(4 + sampleCount);
        // 0~4 bytes: version(0) & flags
        for(let i = 0; i < sampleCount; i++) {
            const { flags } = samples[i];
            data[i + 4] = (flags.isLeading << 6) // is_leading: 2 (bit)
                | (flags.dependsOn << 4) // sample_depends_on
                | (flags.isDependedOn << 2) // sample_is_depended_on
                | flags.hasRedundancy; // sample_has_redundancy
        }
        return MP4.box(MP4.types.sdtp, data);
    }

    // Track fragment run box
    static trun(track: track, offset: number) {
        const samples = track.samples || [];
        const sampleCount = samples.length;
        const dataSize = 12 + 16 * sampleCount;
        const data = new Uint8Array(dataSize);
        offset += 8 + dataSize;

        data.set(
            [
                0x00,
                0x00,
                0x0f,
                0x01, // version(0) & flags
                (sampleCount >>> 24) & 0xff, // sample_count
                (sampleCount >>> 16) & 0xff,
                (sampleCount >>> 8) & 0xff,
                sampleCount & 0xff,
                (offset >>> 24) & 0xff, // data_offset
                (offset >>> 16) & 0xff,
                (offset >>> 8) & 0xff,
                offset & 0xff
            ],
            0
        );

        for(let i = 0; i < sampleCount; i++) {
            const { duration } = samples[i];
            const { size } = samples[i];
            const { flags } = samples[i];
            const { cts } = samples[i];
            data.set(
                [
                    (duration >>> 24) & 0xff, // sample_duration
                    (duration >>> 16) & 0xff,
                    (duration >>> 8) & 0xff,
                    duration & 0xff,
                    (size >>> 24) & 0xff, // sample_size
                    (size >>> 16) & 0xff,
                    (size >>> 8) & 0xff,
                    size & 0xff,
                    (flags.isLeading << 2) | flags.dependsOn, // sample_flags
                    (flags.isDependedOn << 6) | (flags.hasRedundancy << 4) | flags.isNonSync,
                    0x00,
                    0x00, // sample_degradation_priority
                    (cts >>> 24) & 0xff, // sample_composition_time_offset
                    (cts >>> 16) & 0xff,
                    (cts >>> 8) & 0xff,
                    cts & 0xff
                ],
                12 + 16 * i
            );
        }
        return MP4.box(MP4.types.trun, data);
    }

    static mdat(data: any) {
        return MP4.box(MP4.types.mdat, data);
    }
}

MP4.init();

export default MP4;
