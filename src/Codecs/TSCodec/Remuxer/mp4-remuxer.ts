/**
 * fMP4 remuxer
 */

import EventEmitter from 'eventemitter3';
import AAC from './aac-helper';
import MP4 from './mp4-generator';
import Events from '../Events/index';
import { ErrorTypes, ErrorDetails } from '../errors';
import logger from '../../../Utils/Logger';
import SampleInfo from '../../../Utils/SampleInfo';

import {
    typeSupported,
    track,
    NALUnit,
    avcSample,
    TSAudioTrack,
    TSVideoTrack,
    TSId3Track,
    TSTextTrack,
    aacSample,
    TSVideoData,
    TSAudioData,
    agentInfo
} from '../TSCodecInterface';

// 10 seconds
const MAX_SILENT_FRAME_DURATION = 10 * 1000;

class MP4Remuxer {
    /**
     * 事件中心
     */
    emitter: EventEmitter

    /**
     * 设置
     */
    config: any

    /**
     * MediaSource 播放类型支持
     */
    typeSupported: typeSupported

    /**
     * 浏览器代理信息
     */
    agentInfo: agentInfo

    /**
     * 是否为safari浏览器
     */
    isSafari: boolean

    /**
     * initSegment 是否已经产生了
     */
    ISGenerated: boolean

    /**
     * 初始的PTS
     */
    private _initPTS: number | undefined

    /**
     * 初始的DTS时间
     */
    private _initDTS: number | undefined

    /**
     * 下一个AVC的DTS时间
     */
    nextAvcDts: number | undefined

    /**
     * 下一段音频的展示时间
     */
    nextAudioPts: number | undefined

    constructor(
        emitter: EventEmitter,
        config: any,
        typeSupported: typeSupported,
        agentInfo: agentInfo
    ) {
        this.emitter = emitter;
        this.config = config;
        this.typeSupported = typeSupported;
        this.agentInfo = agentInfo;
        const { userAgent } = agentInfo;
        this.isSafari = Boolean(
            agentInfo.vendor
                && agentInfo.vendor.indexOf('Apple') > -1
                && userAgent
                && !userAgent.match('CriOS')
        );
        this.ISGenerated = false;
        this._initPTS = undefined;
        this._initDTS = undefined;
        this.nextAvcDts = undefined;
        this.nextAudioPts = undefined;
    }

    static Tag: 'MP4Remuxer'

    destroy() {
        delete this.config;
        delete this.typeSupported;
        this.emitter.removeAllListeners();
        delete this.emitter;
        delete this.config;
        delete this.typeSupported;
        delete this.agentInfo;
    }

    resetTimeStamp(defaultTimeStamp: number | undefined) {
        this._initDTS = defaultTimeStamp;
        this._initPTS = defaultTimeStamp;
    }

    resetInitSegment() {
        this.ISGenerated = false;
    }

    remux(
        audioTrack: TSAudioTrack,
        videoTrack: TSVideoTrack,
        id3Track: TSId3Track,
        textTrack: TSTextTrack,
        timeOffset: number,
        contiguous: boolean,
        accurateTimeOffset: boolean
    ) {
        // generate Init Segment if needed
        if(!this.ISGenerated) {
            this.generateIS(audioTrack, videoTrack, timeOffset);
        }

        if(this.ISGenerated) {
            const nbAudioSamples = audioTrack.samples.length;
            const nbVideoSamples = videoTrack.samples.length;
            let audioTimeOffset = timeOffset;
            let videoTimeOffset = timeOffset;
            if(nbAudioSamples && nbVideoSamples) {
                // timeOffset is expected to be the offset of the first timestamp of this fragment (first DTS)
                // if first audio DTS is not aligned with first video DTS then we need to take that into account
                // when providing timeOffset to remuxAudio / remuxVideo. if we don't do that, there might be a permanent / small
                // drift between audio and video streams
                const audiovideoDeltaDts = (audioTrack.samples[0].pts - videoTrack.samples[0].pts)
                    / videoTrack.inputTimeScale;
                audioTimeOffset += Math.max(0, audiovideoDeltaDts);
                videoTimeOffset += Math.max(0, -audiovideoDeltaDts);
            }
            // Purposefully remuxing audio before video, so that remuxVideo can use nextAudioPts, which is
            // calculated in remuxAudio.
            // logger.log('nb AAC samples:' + audioTrack.samples.length);
            if(nbAudioSamples) {
                // if initSegment was generated without video samples, regenerate it again
                if(!audioTrack.timescale) {
                    logger.warn(MP4Remuxer.Tag, 'regenerate InitSegment as audio detected');
                    this.generateIS(audioTrack, videoTrack, timeOffset);
                }
                const audioData = this.remuxAudio(
                    audioTrack,
                    audioTimeOffset,
                    contiguous,
                    accurateTimeOffset
                );
                // logger.log('nb AVC samples:' + videoTrack.samples.length);
                if(nbVideoSamples) {
                    let audioTrackLength;
                    if(audioData) {
                        audioTrackLength = audioData.endPTS - audioData.startPTS;
                    }

                    // if initSegment was generated without video samples, regenerate it again
                    if(!videoTrack.timescale) {
                        logger.warn(MP4Remuxer.Tag, 'regenerate InitSegment as video detected');
                        this.generateIS(audioTrack, videoTrack, timeOffset);
                    }
                    this.remuxVideo(
                        videoTrack,
                        videoTimeOffset,
                        contiguous,
                        audioTrackLength,
                        accurateTimeOffset
                    );
                }
            } else {
                // logger.log('nb AVC samples:' + videoTrack.samples.length);
                if(nbVideoSamples) {
                    const videoData = this.remuxVideo(
                        videoTrack,
                        videoTimeOffset,
                        contiguous,
                        0,
                        accurateTimeOffset
                    );
                    if(videoData && audioTrack.codec) {
                        this.remuxEmptyAudio(audioTrack, audioTimeOffset, contiguous, videoData);
                    }
                }
            }
        }
        // logger.log('nb ID3 samples:' + audioTrack.samples.length);
        if(id3Track.samples.length) {
            this.remuxID3(id3Track);
        }

        // logger.log('nb ID3 samples:' + audioTrack.samples.length);
        if(textTrack.samples.length) {
            this.remuxText(textTrack);
        }

        // notify end of parsing
        this.emitter.emit(Events.FRAG_PARSED);
        // 加载下一个 Fragment
        this.emitter.emit(Events.LOAD_NEXT_FRAG);
    }

    generateIS(audioTrack: TSAudioTrack, videoTrack: TSVideoTrack, timeOffset: number) {
        const { emitter } = this;
        const audioSamples = audioTrack.samples;
        const videoSamples = videoTrack.samples;
        const { typeSupported } = this;
        let container = 'audio/mp4';
        const tracks = Object.create(null);
        const data = { tracks };
        const computePTSDTS = this._initPTS === undefined;
        let initPTS: number | undefined;
        let initDTS: number | undefined;

        if(computePTSDTS) {
            initDTS = Infinity;
            initPTS = Infinity;
        }

        if(audioTrack.config && audioSamples.length) {
            // let's use audio sampling rate as MP4 time scale.
            // rationale is that there is a integer nb of audio frames per audio sample (1024 for AAC)
            // using audio sampling rate here helps having an integer MP4 frame duration
            // this avoids potential rounding issue and AV sync issue
            audioTrack.timescale = audioTrack.samplerate;
            logger.info(MP4Remuxer.Tag, `audio sampling rate : ${audioTrack.samplerate}`);
            if(!audioTrack.isAAC) {
                if(typeSupported.mpeg) {
                    // Chrome and Safari
                    container = 'audio/mpeg';
                    audioTrack.codec = '';
                } else if(typeSupported.mp3) {
                    // Firefox
                    audioTrack.codec = 'mp3';
                }
            }
            tracks.audio = {
                container,
                codec: audioTrack.codec,
                initSegment:
                    !audioTrack.isAAC && typeSupported.mpeg
                        ? new Uint8Array()
                        : MP4.initSegment([audioTrack]),
                metadata: {
                    channelCount: audioTrack.channelCount
                },
                mediaDuration: audioTrack.duration || 0
            };
            if(computePTSDTS) {
                // remember first PTS of this demuxing context. for audio, PTS = DTS
                initDTS = audioSamples[0].pts - audioTrack.inputTimeScale * timeOffset;
                initPTS = initDTS;
            }
        }

        if(videoTrack.sps && videoTrack.pps && videoSamples.length) {
            // let's use input time scale as MP4 video timescale
            // we use input time scale straight away to avoid rounding issues on frame duration / cts computation
            const { inputTimeScale } = videoTrack;
            videoTrack.timescale = inputTimeScale;
            tracks.video = {
                container: 'video/mp4',
                codec: videoTrack.codec,
                initSegment: MP4.initSegment([videoTrack]),
                metadata: {
                    width: videoTrack.width,
                    height: videoTrack.height
                },
                mediaDuration: videoTrack.duration
            };
            if(computePTSDTS) {
                initPTS = Math.min(
                    initPTS as number,
                    videoSamples[0].pts - inputTimeScale * timeOffset
                );
                initDTS = Math.min(
                    initDTS as number,
                    videoSamples[0].dts - inputTimeScale * timeOffset
                );
                this.emitter.emit(Events.INIT_PTS_FOUND, { initPTS });
            }
        }

        const trackNames: Array<string> = Object.keys(tracks);

        if(trackNames.length) {
            trackNames.forEach((trackName) => {
                const track = tracks[trackName];
                const { initSegment } = track;
                logger.debug(
                    MP4Remuxer.Tag,
                    `main track:${trackName},container:${track.container},codecs[level/parsed]=[${track.levelCodec}/${track.codec}]`
                );
                if(initSegment) {
                    // TODO mediaDuration 暂时写0
                    emitter.emit(Events.INIT_SEGMENT,
                        'initSegment',
                        {
                            type: trackName,
                            data: initSegment,
                            parent: 'main',
                            content: 'initSegment',
                            mediaDuration: track.mediaDuration,
                            codec: track.codec,
                            container: track.container
                        });
                }
                this.ISGenerated = true;
                if(computePTSDTS) {
                    this._initPTS = initPTS;
                    this._initDTS = initDTS;
                }
            });
        } else {
            emitter.emit(Events.ERROR, {
                type: ErrorTypes.MEDIA_ERROR,
                details: ErrorDetails.FRAG_PARSING_ERROR,
                fatal: false,
                reason: 'no audio/video samples found'
            });
        }
    }

    remuxVideo(
        track: track,
        timeOffset: number,
        contiguous: boolean,
        audioTrackLength: number | undefined,
        accurateTimeOffset: boolean
    ): TSVideoData | undefined {
        let offset = 8;
        let mp4SampleDuration;
        let mdat;
        let firstPTS;
        let firstDTS;
        const timeScale: number = track.timescale;
        const inputSamples: Array<avcSample> = track.samples;
        const outputSamples = [];
        const nbSamples: number = inputSamples.length;
        const ptsNormalize = this._PTSNormalize;
        const initPTS = this._initPTS;
        let originalBeginDts = 0;
        let originalEndDts = 0;
        // if parsed fragment is contiguous with last one, let's use last DTS value as reference
        let { nextAvcDts } = this;
        const { isSafari } = this;
        const syncPoints: Array<SampleInfo> = [];
        if(nbSamples === 0) {
            return;
        }

        // Safari does not like overlapping DTS on consecutive fragments. let's use nextAvcDts to overcome this if fragments are consecutive
        if(isSafari) {
            // also consider consecutive fragments as being contiguous (even if a level switch occurs),
            // for sake of clarity:
            // consecutive fragments are frags with
            //  - less than 100ms gaps between new time offset (if accurate) and next expected PTS OR
            //  - less than 200 ms PTS gaps (timeScale/5)
            const judgement1 = accurateTimeOffset && Math.abs(timeOffset - <number>nextAvcDts / timeScale) < 0.1;
            const judgement2 = Math.abs(<number>inputSamples[0].pts - <number>nextAvcDts - <number>initPTS)
                < timeScale / 5;
            const tempContiguous: boolean = Boolean(
                inputSamples.length && nextAvcDts && (judgement1 || judgement2)
            );

            contiguous = tempContiguous || contiguous;
        }

        if(!contiguous) {
            // if not contiguous, let's use target timeOffset
            nextAvcDts = timeOffset * timeScale;
        }

        /**
         * 格式化segment输出而设置的值
         */
        originalBeginDts = (inputSamples[0].dts * 1000) / track.inputTimeScale;
        originalEndDts = (inputSamples[inputSamples.length - 1].dts * 1000) / track.inputTimeScale;

        // PTS is coded on 33bits, and can loop from -2^32 to 2^32
        // ptsNormalize will make PTS/DTS value monotonic, we use last known DTS value as reference value

        inputSamples.forEach((sample) => {
            sample.pts = ptsNormalize(<number>sample.pts - <number>initPTS, nextAvcDts);
            sample.dts = ptsNormalize(<number>sample.dts - <number>initPTS, nextAvcDts);
        });

        // sort video samples by DTS then PTS then demux id order
        inputSamples.sort((a, b) => {
            const deltadts = <number>a.dts - <number>b.dts;
            const deltapts = <number>a.pts - <number>b.pts;
            return deltadts || (deltapts || a.id - b.id);
        });

        // handle broken streams with PTS < DTS, tolerance up 200ms (18000 in 90kHz timescale)
        const PTSDTSshift = inputSamples.reduce(
            (prev, curr) => Math.max(Math.min(prev, curr.pts - curr.dts), -18000),
            0
        );
        if(PTSDTSshift < 0) {
            logger.warn(
                MP4Remuxer.Tag,
                `PTS < DTS detected in video samples, shifting DTS by ${Math.round(
                    PTSDTSshift / 90
                )} ms to overcome this issue`
            );
            for(let i = 0; i < inputSamples.length; i++) {
                inputSamples[i].dts += PTSDTSshift;
            }
        }

        // compute first DTS and last DTS, normalize them against reference value
        let sample = inputSamples[0];
        firstDTS = Math.max(sample.dts, 0);
        firstPTS = Math.max(sample.pts, 0);

        // check timestamp continuity accross consecutive fragments (this is to remove inter-fragment gap/hole)
        const delta = Math.round((firstDTS - (nextAvcDts as number)) / 90);
        // if fragment are contiguous, detect hole/overlapping between fragments
        if(contiguous) {
            if(delta) {
                if(delta > 1) {
                    logger.log(
                        MP4Remuxer.Tag,
                        `AVC:${delta} ms hole between fragments detected,filling it`
                    );
                } else if(delta < -1) {
                    logger.log(
                        MP4Remuxer.Tag,
                        `AVC:${-delta} ms overlapping between fragments detected`
                    );
                }

                // remove hole/gap : set DTS to next expected DTS
                firstDTS = nextAvcDts;
                inputSamples[0].dts = <number>firstDTS;
                // offset PTS as well, ensure that PTS is smaller or equal than new DTS
                firstPTS = Math.max(firstPTS - delta, nextAvcDts as number);
                inputSamples[0].pts = firstPTS;
                logger.log(
                    MP4Remuxer.Tag,
                    `Video/PTS/DTS adjusted: ${Math.round(firstPTS / 90)}/${Math.round(
                        <number>firstDTS / 90
                    )},delta:${delta} ms`
                );
            }
        }

        // compute lastPTS/lastDTS
        sample = inputSamples[inputSamples.length - 1];
        const lastDTS = Math.max(sample.dts, 0);
        const lastPTS = Math.max(sample.pts, 0, lastDTS);

        // on Safari let's signal the same sample duration for all samples
        // sample duration (as expected by trun MP4 boxes), should be the delta between sample DTS
        // set this constant duration as being the avg delta between consecutive DTS.
        if(isSafari) {
            mp4SampleDuration = Math.round((lastDTS - <number>firstDTS) / (inputSamples.length - 1));
        }

        let nbNalu = 0;
        let naluLen = 0;

        for(let i = 0; i < nbSamples; i++) {
            // compute total/avc sample length and nb of NAL units
            const sample = inputSamples[i];
            const { units } = sample;
            const nbUnits = units.length;
            let sampleLen = 0;
            for(let j = 0; j < nbUnits; j++) {
                sampleLen += units[j].data.length;
            }

            naluLen += sampleLen;
            nbNalu += nbUnits;
            sample.length = sampleLen;

            // normalize PTS/DTS
            if(isSafari) {
                // sample DTS is computed using a constant decoding offset (mp4SampleDuration) between samples
                sample.dts = <number>firstDTS + i * <number>mp4SampleDuration;
            } else {
                // ensure sample monotonic DTS
                sample.dts = Math.max(sample.dts, <number>firstDTS);
            }
            // ensure that computed value is greater or equal than sample DTS
            sample.pts = Math.max(sample.pts, sample.dts);
        }

        /* concatenate the video data and construct the mdat in place
      (need 8 more bytes to fill length and mpdat type) */
        const mdatSize = naluLen + 4 * nbNalu + 8;

        try {
            mdat = new Uint8Array(mdatSize);
        } catch (err) {
            this.emitter.emit(Events.ERROR, {
                type: ErrorTypes.MUX_ERROR,
                details: ErrorDetails.REMUX_ALLOC_ERROR,
                fatal: false,
                bytes: mdatSize,
                reason: `fail allocating video mdat ${mdatSize}`
            });
            return;
        }

        const view = new DataView(mdat.buffer);

        view.setUint32(0, mdatSize);

        mdat.set(MP4.types.mdat, 4);

        for(let i = 0; i < nbSamples; i++) {
            const avcSample: avcSample = inputSamples[i];
            const avcSampleUnits: Array<NALUnit> = avcSample.units;
            let mp4SampleLength = 0;
            let compositionTimeOffset;
            // convert NALU bitstream to MP4 format (prepend NALU with size field)
            for(let j = 0, nbUnits = avcSampleUnits.length; j < nbUnits; j++) {
                const unit = avcSampleUnits[j];
                const unitData = unit.data;
                const unitDataLen = unit.data.byteLength;
                view.setUint32(offset, unitDataLen);
                offset += 4;
                mdat.set(unitData, offset);
                offset += unitDataLen;
                mp4SampleLength += 4 + unitDataLen;
            }

            if(!isSafari) {
                // expected sample duration is the Decoding Timestamp diff of consecutive samples
                if(i < nbSamples - 1) {
                    mp4SampleDuration = inputSamples[i + 1].dts - avcSample.dts;
                } else {
                    const { config } = this;
                    const lastFrameDuration = avcSample.dts - inputSamples[i > 0 ? i - 1 : i].dts;
                    if(config.stretchShortVideoTrack) {
                        // In some cases, a segment's audio track duration may exceed the video track duration.
                        // Since we've already remuxed audio, and we know how long the audio track is, we look to
                        // see if the delta to the next segment is longer than maxBufferHole.
                        // If so, playback would potentially get stuck, so we artificially inflate
                        // the duration of the last frame to minimize any potential gap between segments.
                        const { maxBufferHole } = config;
                        const gapTolerance = Math.floor(maxBufferHole * timeScale);
                        const deltaToFrameEnd = (audioTrackLength
                            ? firstPTS + audioTrackLength * timeScale
                            : <number> this.nextAudioPts) - avcSample.pts;

                        if(deltaToFrameEnd > gapTolerance) {
                            // We subtract lastFrameDuration from deltaToFrameEnd to try to prevent any video
                            // frame overlap. maxBufferHole should be >> lastFrameDuration anyway.
                            mp4SampleDuration = deltaToFrameEnd - lastFrameDuration;
                            if(mp4SampleDuration < 0) {
                                mp4SampleDuration = lastFrameDuration;
                            }

                            logger.log(
                                MP4Remuxer.Tag,
                                `It is approximately ${deltaToFrameEnd
                                    / 90} ms to the next segment; using duration ${mp4SampleDuration
                                    / 90} ms for the last video frame.`
                            );
                        } else {
                            mp4SampleDuration = lastFrameDuration;
                        }
                    } else {
                        mp4SampleDuration = lastFrameDuration;
                    }
                }
                compositionTimeOffset = Math.round(avcSample.pts - avcSample.dts);
            } else {
                compositionTimeOffset = Math.max(
                    0,
                    <number>mp4SampleDuration
                        * Math.round((avcSample.pts - avcSample.dts) / <number>mp4SampleDuration)
                );
            }

            outputSamples.push({
                size: mp4SampleLength,
                // constant duration
                duration: mp4SampleDuration,
                cts: compositionTimeOffset,
                dts: avcSample.dts,
                pts: avcSample.pts,
                keyframe: avcSample.key && avcSample.frame,
                originalDts: avcSample.dts,
                flags: {
                    isLeading: 0,
                    isDependedOn: 0,
                    hasRedundancy: 0,
                    degradPrio: 0,
                    dependsOn: avcSample.key ? 2 : 1,
                    isNonSync: avcSample.key ? 0 : 1
                }
            });
        }
        // next AVC sample DTS should be equal to last sample DTS + last sample duration (in PES timescale)
        this.nextAvcDts = lastDTS + <number>mp4SampleDuration;
        const { dropped } = track;
        track.nbNalu = 0;
        track.dropped = 0;
        if(outputSamples.length && navigator.userAgent.toLowerCase().indexOf('chrome') > -1) {
            const { flags } = outputSamples[0];
            // chrome workaround, mark first sample as being a Random Access Point to avoid sourcebuffer append issue
            // https://code.google.com/p/chromium/issues/detail?id=229412
            flags.dependsOn = 2;
            flags.isNonSync = 0;
        }
        track.samples = outputSamples;
        outputSamples.forEach((sample) => {
            if(sample.keyframe) {
                // 关键帧
                syncPoints.push(
                    new SampleInfo(
                        (sample.dts * 1000) / track.inputTimeScale,
                        (sample.pts * 1000) / track.inputTimeScale,
                        0,
                        Math.ceil((sample.pts * 1000) / track.inputTimeScale),
                        true
                    )
                );
            }
        });
        const firstSample = new SampleInfo(
            outputSamples[0].dts,
            outputSamples[0].pts,
            <number>outputSamples[0].duration,
            outputSamples[0].originalDts,
            false
        );
        const lastSample = new SampleInfo(
            outputSamples[outputSamples.length - 1].dts,
            outputSamples[outputSamples.length - 1].pts,
            <number>outputSamples[outputSamples.length - 1].duration,
            outputSamples[outputSamples.length - 1].originalDts,
            false
        );

        const moof = MP4.moof(track.sequenceNumber++, <number>firstDTS, track);
        track.samples = [];
        const mergeData = this._mergeBoxes(moof, mdat);
        const data: TSVideoData = {
            data1: moof,
            data2: mdat,
            startPTS: firstPTS / timeScale,
            endPTS: (lastPTS + <number>mp4SampleDuration) / timeScale,
            startDTS: <number>firstDTS / timeScale,
            endDTS: this.nextAvcDts / timeScale,
            type: 'video',
            hasAudio: false,
            hasVideo: true,
            nb: outputSamples.length,
            dropped
        };

        const segment = {
            type: 'video',
            data: mergeData,
            sampleCount: nbSamples,
            info: {
                beginDts: <number>firstDTS / timeScale,
                beginPts: firstPTS / timeScale,
                endDts: this.nextAvcDts / timeScale,
                endPts: (lastPTS + <number>mp4SampleDuration) / timeScale,
                originalBeginDts,
                originalEndDts,
                syncPoints,
                firstSample,
                lastSample
            }
        };
        this.emitter.emit(Events.MEDIA_SEGMENT, 'video', segment);
        return data;
    }

    remuxAudio(
        track: TSAudioTrack,
        timeOffset: number,
        contiguous: boolean,
        accurateTimeOffset?: boolean
    ): TSAudioData | null {
        const { inputTimeScale } = track;
        const mp4timeScale = track.timescale;
        const scaleFactor = inputTimeScale / mp4timeScale;
        const mp4SampleDuration = track.isAAC ? 1024 : 1152;
        const inputSampleDuration = mp4SampleDuration * scaleFactor;
        const ptsNormalize = this._PTSNormalize;
        const initPTS = this._initPTS;
        const rawMPEG = !track.isAAC && this.typeSupported.mpeg;

        let mp4Sample = Object.create(null);
        let fillFrame;
        let mdat;
        let moof;
        let firstPTS;
        let lastPTS;
        let offset = rawMPEG ? 0 : 8;
        let inputSamples = track.samples;
        const outputSamples = [];
        let nextAudioPts = <number> this.nextAudioPts;

        // for audio samples, also consider consecutive fragments as being contiguous (even if a level switch occurs),
        // for sake of clarity:
        // consecutive fragments are frags with
        //  - less than 100ms gaps between new time offset (if accurate) and next expected PTS OR
        //  - less than 20 audio frames distance
        // contiguous fragments are consecutive fragments from same quality level (same level, new SN = old SN + 1)
        // this helps ensuring audio continuity
        // and this also avoids audio glitches/cut when switching quality, or reporting wrong duration on first audio frame
        const judgement1 = accurateTimeOffset && Math.abs(timeOffset - <number>nextAudioPts / inputTimeScale) < 0.1;
        const judgement2 = Math.abs(inputSamples[0].pts - <number>nextAudioPts - <number>initPTS)
            < 20 * inputSampleDuration;

        contiguous = Boolean(
            contiguous || (inputSamples.length && nextAudioPts && (judgement1 || judgement2))
        );

        // compute normalized PTS
        inputSamples.forEach((sample: aacSample) => {
            sample.dts = ptsNormalize(
                sample.pts - <number>initPTS,
                timeOffset * inputTimeScale
            );
            sample.pts = sample.dts;
        });

        // filter out sample with negative PTS that are not playable anyway
        // if we don't remove these negative samples, they will shift all audio samples forward.
        // leading to audio overlap between current / next fragment
        inputSamples = inputSamples.filter((sample: aacSample) => sample.pts >= 0);

        // in case all samples have negative PTS, and have been filtered out, return now
        if(inputSamples.length === 0) {
            return null;
        }
        const originalBeginDts = inputSamples[0].dts;
        const originalEndDts = inputSamples[inputSamples.length - 1].dts;

        if(!contiguous) {
            if(!accurateTimeOffset) {
                // if frag are mot contiguous and if we cant trust time offset, let's use first sample PTS as next audio PTS
                nextAudioPts = inputSamples[0].pts;
            } else {
                // if timeOffset is accurate, let's use it as predicted next audio PTS
                nextAudioPts = timeOffset * inputTimeScale;
            }
        }

        // If the audio track is missing samples, the frames seem to get "left-shifted" within the
        // resulting mp4 segment, causing sync issues and leaving gaps at the end of the audio segment.
        // In an effort to prevent this from happening, we inject frames here where there are gaps.
        // When possible, we inject a silent frame; when that's not possible, we duplicate the last
        // frame.

        if(track.isAAC) {
            const { maxAudioFramesDrift } = this.config;
            for(let i = 0, nextPts = nextAudioPts; i < inputSamples.length;) {
                // First, let's see how far off this frame is from where we expect it to be
                const sample = inputSamples[i];
                const { pts } = sample;
                const delta = pts - nextPts;

                const duration = Math.abs((1000 * delta) / inputTimeScale);

                // If we're overlapping by more than a duration, drop this sample
                if(delta <= -maxAudioFramesDrift * inputSampleDuration) {
                    logger.warn(
                        MP4Remuxer.Tag,
                        `Dropping 1 audio frame @ ${(nextPts / inputTimeScale).toFixed(
                            3
                        )}s due to ${Math.round(duration)} ms overlap.`
                    );
                    inputSamples.splice(i, 1);
                    // Don't touch nextPtsNorm or i
                } // eslint-disable-line brace-style

                // Insert missing frames if:
                // 1: We're more than maxAudioFramesDrift frame away
                // 2: Not more than MAX_SILENT_FRAME_DURATION away
                // 3: currentTime (aka nextPtsNorm) is not 0
                else if(
                    delta >= maxAudioFramesDrift * inputSampleDuration
                    && duration < MAX_SILENT_FRAME_DURATION
                    && nextPts
                ) {
                    const missing = Math.round(delta / inputSampleDuration);
                    logger.warn(
                        MP4Remuxer.Tag,
                        `Injecting ${missing} audio frame @ ${(nextPts / inputTimeScale).toFixed(
                            3
                        )}s due to ${Math.round((1000 * delta) / inputTimeScale)} ms gap.`
                    );
                    for(let j = 0; j < missing; j++) {
                        const newStamp = Math.max(nextPts, 0);
                        fillFrame = AAC.getSilentFrame(
                            track.manifestCodec || track.codec,
                            track.channelCount
                        );
                        if(!fillFrame) {
                            logger.log(
                                MP4Remuxer.Tag,
                                'Unable to get silent frame for given audio codec; duplicating last frame instead.'
                            );
                            fillFrame = sample.unit.subarray(0); // 新标准begin是可以选择不传的
                        }
                        inputSamples.splice(i, 0, { unit: fillFrame, pts: newStamp, dts: newStamp });
                        nextPts += inputSampleDuration;
                        i++;
                    }

                    // Adjust sample to next expected pts
                    sample.dts = nextPts;
                    sample.pts = nextPts;
                    nextPts += inputSampleDuration;
                    i++;
                } else {
                    // Otherwise, just adjust pts
                    if(Math.abs(delta) > 0.1 * inputSampleDuration) {
                        // logger.log(`Invalid frame delta ${Math.round(delta + inputSampleDuration)} at PTS ${Math.round(pts / 90)} (should be ${Math.round(inputSampleDuration)}).`);
                    }
                    sample.dts = nextPts;
                    sample.pts = nextPts;
                    nextPts += inputSampleDuration;
                    i++;
                }
            }
        }

        // compute mdat size, as we eventually filtered/added some samples
        let nbSamples = inputSamples.length;
        let mdatSize = 0;
        while(nbSamples--) {
            mdatSize += inputSamples[nbSamples].unit.byteLength;
        }

        for(let j = 0, nbSamples = inputSamples.length; j < nbSamples; j++) {
            const audioSample = inputSamples[j];
            const { unit } = audioSample;
            let { pts } = audioSample;
            // logger.log(`Audio/PTS:${Math.round(pts/90)}`);
            // if not first sample
            if(lastPTS !== undefined) {
                mp4Sample.duration = Math.round((pts - lastPTS) / scaleFactor);
            } else {
                const delta = Math.round((1000 * (pts - <number>nextAudioPts)) / inputTimeScale);
                let numMissingFrames = 0;
                // if fragment are contiguous, detect hole/overlapping between fragments
                // contiguous fragments are consecutive fragments from same quality level (same level, new SN = old SN + 1)
                if(contiguous && track.isAAC) {
                    // log delta
                    if(delta) {
                        if(delta > 0 && delta < MAX_SILENT_FRAME_DURATION) {
                            numMissingFrames = Math.round(
                                (pts - nextAudioPts) / inputSampleDuration
                            );
                            logger.log(
                                MP4Remuxer.Tag,
                                `${delta} ms hole between AAC samples detected,filling it`
                            );
                            if(numMissingFrames > 0) {
                                fillFrame = AAC.getSilentFrame(
                                    track.manifestCodec || track.codec,
                                    track.channelCount
                                );
                                if(!fillFrame) {
                                    fillFrame = unit.subarray(0);
                                }

                                mdatSize += numMissingFrames * fillFrame.length;
                            }
                            // if we have frame overlap, overlapping for more than half a frame duraion
                        } else if(delta < -12) {
                            // drop overlapping audio frames... browser will deal with it
                            logger.log(
                                MP4Remuxer.Tag,
                                `drop overlapping AAC sample, expected/parsed/delta:${(
                                    nextAudioPts / inputTimeScale
                                ).toFixed(3)}s/${(pts / inputTimeScale).toFixed(3)}s/${-delta}ms`
                            );
                            mdatSize -= unit.byteLength;
                            continue;
                        }
                        // set PTS/DTS to expected PTS/DTS
                        pts = nextAudioPts;
                    }
                }
                // remember first PTS of our audioSamples
                firstPTS = pts;
                if(mdatSize > 0) {
                    mdatSize += offset;
                    try {
                        mdat = new Uint8Array(mdatSize);
                    } catch (err) {
                        this.emitter.emit(Events.ERROR, {
                            type: ErrorTypes.MUX_ERROR,
                            details: ErrorDetails.REMUX_ALLOC_ERROR,
                            fatal: false,
                            bytes: mdatSize,
                            reason: `fail allocating audio mdat ${mdatSize}`
                        });
                        return null;
                    }
                    if(!rawMPEG) {
                        const view = new DataView(mdat.buffer);
                        view.setUint32(0, mdatSize);
                        mdat.set(MP4.types.mdat, 4);
                    }
                } else {
                    // no audio samples
                    return null;
                }

                for(let i = 0; i < numMissingFrames; i++) {
                    fillFrame = AAC.getSilentFrame(
                        track.manifestCodec || track.codec,
                        track.channelCount
                    );
                    if(!fillFrame) {
                        logger.log(
                            MP4Remuxer.Tag,
                            'Unable to get silent frame for given audio codec; duplicating this frame instead.'
                        );
                        fillFrame = unit.subarray(0);
                    }
                    mdat.set(fillFrame, offset);
                    offset += fillFrame.byteLength;
                    mp4Sample = {
                        size: fillFrame.byteLength,
                        cts: 0,
                        duration: 1024,
                        flags: {
                            isLeading: 0,
                            isDependedOn: 0,
                            hasRedundancy: 0,
                            degradPrio: 0,
                            dependsOn: 1
                        }
                    };
                    outputSamples.push(mp4Sample);
                }
            }
            mdat && mdat.set(unit, offset);
            const unitLen = unit.byteLength;
            offset += unitLen;
            mp4Sample = {
                size: unitLen,
                cts: 0,
                duration: 0,
                flags: {
                    isLeading: 0,
                    isDependedOn: 0,
                    hasRedundancy: 0,
                    degradPrio: 0,
                    dependsOn: 1
                }
            };
            outputSamples.push(mp4Sample);
            lastPTS = pts;
        }
        let lastSampleDuration = 0;
        nbSamples = outputSamples.length;
        // set last sample duration as being identical to previous sample
        if(nbSamples >= 2) {
            lastSampleDuration = outputSamples[nbSamples - 2].duration;
            mp4Sample.duration = lastSampleDuration;
        }
        if(nbSamples) {
            // next audio sample PTS should be equal to last sample PTS + duration
            nextAudioPts = <number>lastPTS + scaleFactor * lastSampleDuration;
            this.nextAudioPts = nextAudioPts;
            // logger.log('Audio/PTS/PTSend:' + audioSample.pts.toFixed(0) + '/' + this.nextAacDts.toFixed(0));
            track.samples = outputSamples;

            if(rawMPEG) {
                moof = new Uint8Array();
            } else {
                moof = MP4.moof(track.sequenceNumber++, <number>firstPTS / scaleFactor, track);
            }
            track.samples = [];
            const start = <number>firstPTS / inputTimeScale;
            const end = nextAudioPts / inputTimeScale;
            const audioData: TSAudioData = {
                data1: moof,
                data2: <Uint8Array>mdat,
                startPTS: start,
                endPTS: end,
                startDTS: start,
                endDTS: end,
                type: 'audio',
                hasAudio: true,
                hasVideo: false,
                nb: nbSamples
            };
            // 格式化为flv.js中segment的格式再发出
            const syncPoints: Array<SampleInfo> = [];
            const segment = {
                data: this._mergeBoxes(moof, <Uint8Array>mdat),
                sampleCount: nbSamples,
                type: 'audio',
                info: {
                    beginDts: start,
                    beginPts: start,
                    endDts: end,
                    endPts: end,
                    syncPoints, // 音频无同步点, 一直为空数组
                    originalBeginDts,
                    originalEndDts
                }
            };
            this.emitter.emit(Events.MEDIA_SEGMENT, 'audio', segment);
            return audioData;
        }
        return null;
    }

    /**
     * 添加静默音频帧
     * @param track
     * @param timeOffset
     * @param contiguous
     * @param videoData
     */
    remuxEmptyAudio(
        track: TSAudioTrack,
        timeOffset: number,
        contiguous: boolean,
        videoData: TSVideoData
    ) {
        const { inputTimeScale } = track;
        const mp4timeScale = track.samplerate ? track.samplerate : inputTimeScale;
        const scaleFactor = inputTimeScale / mp4timeScale;
        const { nextAudioPts } = this;
        // sync with video's timestamp
        const startDTS = (nextAudioPts !== undefined ? nextAudioPts : videoData.startDTS * inputTimeScale)
                + <number> this._initDTS;
        const endDTS = videoData.endDTS * inputTimeScale + <number> this._initDTS;
        // one sample's duration value
        const sampleDuration = 1024;
        const frameDuration = scaleFactor * sampleDuration;
        // samples count of this segment's duration
        const nbSamples = Math.ceil((endDTS - startDTS) / frameDuration);
        // silent frame
        const silentFrame = AAC.getSilentFrame(track.manifestCodec || track.codec, track.channelCount);

        logger.warn(MP4Remuxer.Tag, 'remux empty Audio');
        // Can't remux if we can't generate a silent frame...
        if(!silentFrame) {
            logger.info(
                MP4Remuxer.Tag,
                'Unable to remuxEmptyAudio since we were unable to get a silent frame for given audio codec!'
            );
            return;
        }

        const samples = [];
        for(let i = 0; i < nbSamples; i++) {
            const stamp = startDTS + i * frameDuration;
            samples.push({ unit: silentFrame, pts: stamp, dts: stamp });
        }
        track.samples = samples;

        this.remuxAudio(track, timeOffset, contiguous);
    }

    remuxID3(track: TSId3Track) {
        const { length } = track.samples;
        let sample;
        const { inputTimeScale } = track;
        const initPTS = this._initPTS;
        const initDTS = this._initDTS;
        // consume samples
        if(length) {
            for(let index = 0; index < length; index++) {
                sample = track.samples[index];
                // setting id3 pts, dts to relative time
                // using this._initPTS and this._initDTS to calculate relative time
                sample.pts = (<number>sample.pts - (initPTS as number)) / inputTimeScale;
                sample.dts = (<number>sample.dts - (initPTS as number)) / inputTimeScale;
            }
            this.emitter.emit(Events.FRAG_PARSING_METADATA, {
                samples: track.samples
            });
        }

        track.samples = [];
    }

    /**
     * 封装文本序列
     * @param track 文本序列
     */
    remuxText(track: TSTextTrack) {
        track.samples.sort((a, b) => <number>a.pts - <number>b.pts);

        const { length } = track.samples;
        let sample;
        const { inputTimeScale } = track;
        const initPTS = this._initPTS;
        // consume samples
        if(length) {
            for(let index = 0; index < length; index++) {
                sample = track.samples[index];
                // setting text pts, dts to relative time
                // using this._initPTS and this._initDTS to calculate relative time
                sample.pts = (<number>sample.pts - <number>initPTS) / inputTimeScale;
            }
            this.emitter.emit(Events.FRAG_PARSING_USERDATA, {
                samples: track.samples
            });
        }
        track.samples = [];
    }

    /**
     * 格式化PTS值
     * @param value pts值,
     * @param reference
     */
    _PTSNormalize(value: number, reference: number | undefined) {
        let offset;
        if(reference === undefined) {
            return value;
        }

        if(reference < value) {
            // - 2^33
            offset = -8589934592;
        } else {
            // + 2^33
            offset = 8589934592;
        }
        /* PTS is 33bit (from 0 to 2^33 -1)
      if diff between value and reference is bigger than half of the amplitude (2^32) then it means that
      PTS looping occured. fill the gap */
        while(Math.abs(value - reference) > 4294967296) {
            value += offset;
        }

        return value;
    }

    /**
     * 将moof和mdat的数据合成一个media segment 发送出去
     * @param moof moof BOX的数据
     * @param mdat mdat BOX的数据
     */
    _mergeBoxes(moof: Uint8Array, mdat: Uint8Array) {
        const result = new Uint8Array(moof.byteLength + mdat.byteLength);
        result.set(moof, 0);
        result.set(mdat, moof.byteLength);
        return result;
    }
}

export default MP4Remuxer;
