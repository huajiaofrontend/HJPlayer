import EventEmitter from 'eventemitter3';
import Log from '../../../Utils/Logger';
import Events from '../Events/index';
import MP4 from './mp4-generator';
import AAC from './aac-silent';
import Browser from './browser';
import { MediaSegmentInfo, MediaSegmentInfoList } from './media-segment-info';
import SampleInfo from '../../../Utils/SampleInfo';
import {
    track, audioTrack, videoTrack, avcSample, aacSample, AvcSampleData, DetailAacSample
} from '../Interface';

// Fragmented mp4 remuxer
class MP4Remuxer {
    TAG = 'MP4Remuxer'

    emitter: EventEmitter

    _config: Record<string, any>

    _isLive: boolean

    _dtsBase: number

    _dtsBaseInited: boolean

    _audioDtsBase: number

    _videoDtsBase: number

    _audioNextDts: number | undefined

    _videoNextDts: number | undefined

    _audioStashedLastSample: aacSample | null

    _videoStashedLastSample: AvcSampleData | null

    _audioMeta: track | null

    _videoMeta: track | null

    _audioSegmentInfoList: MediaSegmentInfoList | null

    _videoSegmentInfoList: MediaSegmentInfoList | null

    _onInitSegment: null

    _onMediaSegment: null

    // Workaround for chrome < 50: Always force first sample as a Random Access Point in media segment
    // see https://bugs.chromium.org/p/chromium/issues/detail?id=229412
    _forceFirstIDR: boolean

    // Workaround for IE11/Edge: Fill silent aac frame after keyframe-seeking
    // Make audio beginDts equals with video beginDts, in order to fix seek freeze
    _fillSilentAfterSeek: boolean

    // While only FireFox supports 'audio/mp4, codecs="mp3"', use 'audio/mpeg' for chrome, safari, ...
    _mp3UseMpegAudio: boolean

    _fillAudioTimestampGap: boolean

    _audioNextRefDts: any;

    constructor(emitter: EventEmitter, config: Record<string, any>) {
        this.TAG = 'MP4Remuxer';

        this.emitter = emitter;
        this._config = config;
        this._isLive = config.isLive === true;

        this._dtsBase = -1;
        this._dtsBaseInited = false;
        this._audioDtsBase = Infinity;
        this._videoDtsBase = Infinity;
        this._audioNextRefDts = undefined;
        this._audioNextDts = undefined;
        this._videoNextDts = undefined;
        this._audioStashedLastSample = null;
        this._videoStashedLastSample = null;
        this._audioMeta = null;
        this._videoMeta = null;

        this._audioSegmentInfoList = new MediaSegmentInfoList('audio');
        this._videoSegmentInfoList = new MediaSegmentInfoList('video');
        // Workaround for chrome < 50: Always force first sample as a Random Access Point in media segment
        // see https://bugs.chromium.org/p/chromium/issues/detail?id=229412
        this._forceFirstIDR = (Browser.chrome && (Browser.version.major < 50 || (Browser.version.major === 50 && Browser.version.build < 2661)));

        // Workaround for IE11/Edge: Fill silent aac frame after keyframe-seeking
        // Make audio beginDts equals with video beginDts, in order to fix seek freeze
        this._fillSilentAfterSeek = Browser.msedge || Browser.msie;

        // While only FireFox supports 'audio/mp4, codecs="mp3"', use 'audio/mpeg' for chrome, safari, ...
        this._mp3UseMpegAudio = !Browser.firefox;

        this._fillAudioTimestampGap = this._config.fixAudioTimestampGap;
    }

    destroy() {
        this._dtsBase = -1;
        this._dtsBaseInited = false;
        this._audioMeta = null;
        this._videoMeta = null;
        this._audioSegmentInfoList && this._audioSegmentInfoList.clear();
        this._audioSegmentInfoList = null;
        this._videoSegmentInfoList && this._videoSegmentInfoList.clear();
        this._videoSegmentInfoList = null;
    }

    insertDiscontinuity() {
        this._videoNextDts = undefined;
        this._audioNextDts = undefined;
    }

    seek() {
        this._audioStashedLastSample = null;
        this._videoStashedLastSample = null;
        this._videoSegmentInfoList && this._videoSegmentInfoList.clear();
        this._audioSegmentInfoList && this._audioSegmentInfoList.clear();
    }

    remux(audioTrack: audioTrack, videoTrack: videoTrack) {
        if(!this._dtsBaseInited) {
            this._calculateDtsBase(audioTrack, videoTrack);
        }
        this._remuxVideo(videoTrack);
        this._remuxAudio(audioTrack);
    }

    _onTrackMetadataReceived(type: string, metadata: track) {
        let metabox = null;
        let container = 'mp4';
        let { codec } = metadata;

        if(type === 'audio') {
            this._audioMeta = metadata;
            if(metadata.codec === 'mp3' && this._mp3UseMpegAudio) {
                // 'audio/mpeg' for MP3 audio track
                container = 'mpeg';
                codec = '';
                metabox = new Uint8Array();
            } else {
                // 'audio/mp4, codecs="codec"'
                metabox = MP4.generateInitSegment(metadata);
            }
        } else if(type === 'video') {
            this._videoMeta = metadata;
            metabox = MP4.generateInitSegment(metadata);
        } else {
            return;
        }

        this.emitter.emit(Events.INIT_SEGMENT,
            type,
            {
                type,
                data: metabox.buffer,
                codec,
                container: `${type}/${container}`,
                mediaDuration: metadata.duration // in timescale 1000 (milliseconds)
            });
    }

    /**
     * 从音频序列和视频序列中取他们第一个sample的dts比较, 最小的为dts基准值
     * @param audioTrack 音频序列
     * @param videoTrack 视频序列
     */
    _calculateDtsBase(audioTrack: audioTrack, videoTrack: videoTrack) {
        if(this._dtsBaseInited) {
            return;
        }

        if(audioTrack.samples && audioTrack.samples.length) {
            this._audioDtsBase = audioTrack.samples[0].dts;
        }
        if(videoTrack.samples && videoTrack.samples.length) {
            this._videoDtsBase = videoTrack.samples[0].dts;
        }

        this._dtsBase = Math.min(this._audioDtsBase, this._videoDtsBase);
        this._dtsBaseInited = true;
    }

    flushStashedSamples() {
        const videoSample = this._videoStashedLastSample;
        const audioSample = this._audioStashedLastSample;

        const videoTrack: videoTrack = {
            type: 'video',
            id: 1,
            sequenceNumber: 0,
            samples: [],
            length: 0
        };

        if(videoSample != null) {
            videoTrack.samples.push(videoSample);
            videoTrack.length = videoSample.length;
        }

        const audioTrack: audioTrack = {
            type: 'audio',
            id: 2,
            sequenceNumber: 0,
            samples: [],
            length: 0
        };

        if(audioSample != null) {
            audioTrack.samples.push(audioSample);
            audioTrack.length = audioSample.length;
        }

        this._videoStashedLastSample = null;
        this._audioStashedLastSample = null;

        this._remuxVideo(videoTrack, true);
        this._remuxAudio(audioTrack, true);
    }

    _remuxAudio(audioTrack: audioTrack, force?: boolean) {
        if(this._audioMeta == null) {
            return;
        }

        const track = audioTrack;
        const { samples } = track;
        let dtsCorrection;
        let firstDts = -1;
        let lastDts = -1;
        const lastPts = -1;
        const { refSampleDuration } = this._audioMeta;

        const mpegRawTrack = this._audioMeta.codec === 'mp3' && this._mp3UseMpegAudio;
        const firstSegmentAfterSeek = this._dtsBaseInited && this._audioNextDts === undefined;

        let insertPrefixSilentFrame = false;

        if(!samples || samples.length === 0) {
            return;
        }

        if(samples.length === 1 && !force) {
            // If [sample count in current batch] === 1 && (force != true)
            // Ignore and keep in demuxer's queue
            return;
        } // else if (force === true) do remux

        let offset = 0;
        let mdatbox = null;
        let mdatBytes = 0;

        // calculate initial mdat size
        if(mpegRawTrack) {
            // for raw mpeg buffer
            offset = 0;
            mdatBytes = track.length;
        } else {
            // for fmp4 mdat box
            offset = 8; // size + type
            mdatBytes = 8 + track.length;
        }


        let lastSample = null;

        // Pop the lastSample and waiting for stash
        if(samples.length > 1) {
            lastSample = samples.pop();
            lastSample && (mdatBytes -= lastSample.length);
        }

        // Insert [stashed lastSample in the previous batch] to the front
        if(this._audioStashedLastSample != null) {
            const sample = this._audioStashedLastSample;
            this._audioStashedLastSample = null;
            samples.unshift(sample);
            mdatBytes += sample.length;
        }

        // Stash the lastSample of current batch, waiting for next batch
        if(lastSample != null) {
            this._audioStashedLastSample = lastSample;
        }


        const firstSampleOriginalDts = samples[0].dts - this._dtsBase;

        // calculate dtsCorrection
        if(this._audioNextDts) {
            dtsCorrection = firstSampleOriginalDts - this._audioNextDts;
        } else { // this._audioNextDts == undefined
            if(this._audioSegmentInfoList && this._audioSegmentInfoList.isEmpty()) {
                dtsCorrection = 0;
                if(this._fillSilentAfterSeek && this._videoSegmentInfoList && !this._videoSegmentInfoList.isEmpty()) {
                    if(this._audioMeta.originalCodec !== 'mp3') {
                        insertPrefixSilentFrame = true;
                    }
                }
            } else {
                const lastSample = this._audioSegmentInfoList!.getLastSampleBefore(firstSampleOriginalDts);
                if(lastSample != null) {
                    let distance = (firstSampleOriginalDts - (lastSample.originalDts + lastSample.duration));
                    if(distance <= 3) {
                        distance = 0;
                    }
                    const expectedDts = lastSample.dts + lastSample.duration + distance;
                    dtsCorrection = firstSampleOriginalDts - expectedDts;
                } else { // lastSample == null, cannot found
                    dtsCorrection = 0;
                }
            }
        }

        if(insertPrefixSilentFrame) {
            // align audio segment beginDts to match with current video segment's beginDts
            const firstSampleDts = firstSampleOriginalDts - dtsCorrection;
            const videoSegment = this._videoSegmentInfoList!.getLastSegmentBefore(firstSampleOriginalDts);
            if(videoSegment != null && videoSegment.beginDts < firstSampleDts) {
                const silentUnit = AAC.getSilentFrame(this._audioMeta.originalCodec, this._audioMeta.channelCount);
                if(silentUnit) {
                    const dts = videoSegment.beginDts;
                    const silentFrameDuration = firstSampleDts - videoSegment.beginDts;
                    Log.info(this.TAG, `InsertPrefixSilentAudio: dts: ${dts}, duration: ${silentFrameDuration}`);
                    samples.unshift({
                        unit: silentUnit, dts, pts: dts, cts: 0, length: silentUnit.byteLength
                    });
                    mdatBytes += silentUnit.byteLength;
                } // silentUnit == null: Cannot generate, skip
            } else {
                insertPrefixSilentFrame = false;
            }
        }

        let mp4Samples: Array<DetailAacSample> = [];

        // Correct dts for each sample, and calculate sample duration. Then output to mp4Samples
        for(let i = 0; i < samples.length; i++) {
            const sample = samples[i];
            const { unit } = sample;
            const originalDts = sample.dts - this._dtsBase;
            let dts = originalDts;
            let needFillSilentFrames = false;
            let silentFrames = null;
            let sampleDuration = 0;

            if(originalDts < -0.001) {
                continue; // pass the first sample with the invalid dts
            }

            if(this._audioMeta.codec !== 'mp3') {
                // for AAC codec, we need to keep dts increase based on refSampleDuration
                let curRefDts = originalDts;
                const maxAudioFramesDrift = 3;
                if(this._audioNextRefDts) {
                    curRefDts = this._audioNextRefDts;
                }

                const delta = originalDts - curRefDts;
                if(delta <= -maxAudioFramesDrift * refSampleDuration) {
                    // If we're overlapping by more than maxAudioFramesDrift number of frame, drop this sample
                    Log.warn(this.TAG, `Dropping 1 audio frame (originalDts: ${originalDts} ms ,curRefDts: ${curRefDts} ms)  due to delta: ${delta} ms overlap.`);
                    continue;
                } else if(delta >= maxAudioFramesDrift * refSampleDuration && this._fillAudioTimestampGap && !Browser.safari) {
                    // Silent frame generation, if large timestamp gap detected && config.fixAudioTimestampGap
                    needFillSilentFrames = true;
                    // We need to insert silent frames to fill timestamp gap
                    const frameCount = Math.floor(delta / refSampleDuration);
                    Log.warn(this.TAG, `Large audio timestamp gap detected, may cause AV sync to drift. Silent frames will be generated to avoid unsync. originalDts: ${originalDts} ms, curRefDts: ${curRefDts} ms, delta: ${Math.round(delta)} ms, generate: ${frameCount} frames`);
                    dts = Math.floor(curRefDts);
                    sampleDuration = Math.floor(curRefDts + refSampleDuration) - dts;
                    curRefDts += refSampleDuration;

                    let silentUnit = AAC.getSilentFrame(this._audioMeta.originalCodec, this._audioMeta.channelCount);
                    if(silentUnit == null) {
                        Log.warn(this.TAG, `Unable to generate silent frame for ${this._audioMeta.originalCodec} with ${this._audioMeta.channelCount} channels, repeat last frame`);
                        // Repeat last frame
                        silentUnit = unit;
                    }
                    silentFrames = [];

                    for(let j = 0; j < frameCount; j++) {
                        const intDts = Math.floor(curRefDts); // change to integer
                        const intDuration = Math.floor(curRefDts + refSampleDuration) - intDts;
                        const frame = {
                            dts: intDts,
                            pts: intDts,
                            cts: 0,
                            unit: silentUnit,
                            size: silentUnit.byteLength,
                            duration: intDuration, // wait for next sample
                            originalDts,
                            flags: {
                                isLeading: 0,
                                dependsOn: 1,
                                isDependedOn: 0,
                                hasRedundancy: 0
                            }
                        };
                        silentFrames.push(frame);
                        mdatBytes += unit.byteLength;
                        curRefDts += refSampleDuration;
                    }

                    this._audioNextRefDts = curRefDts + refSampleDuration;
                } else {
                    dts = Math.floor(curRefDts);
                    sampleDuration = Math.floor(curRefDts + refSampleDuration) - dts;
                    this._audioNextRefDts = curRefDts + refSampleDuration;
                }
            } else {
                // keep the original dts calculate algorithm for mp3
                dts = originalDts - dtsCorrection;

                if(i !== samples.length - 1) {
                    const nextDts = samples[i + 1].dts - this._dtsBase - dtsCorrection;
                    sampleDuration = nextDts - dts;
                } else { // the last sample
                    if(lastSample != null) { // use stashed sample's dts to calculate sample duration
                        const nextDts = lastSample.dts - this._dtsBase - dtsCorrection;
                        sampleDuration = nextDts - dts;
                    } else if(mp4Samples.length >= 1) { // use second last sample duration
                        sampleDuration = mp4Samples[mp4Samples.length - 1].duration;
                    } else { // the only one sample, use reference sample duration
                        sampleDuration = Math.floor(refSampleDuration);
                    }
                }
            }

            if(firstDts === -1) {
                firstDts = dts;
            }

            mp4Samples.push({
                dts,
                pts: dts,
                cts: 0,
                unit: sample.unit,
                size: sample.unit.byteLength,
                duration: sampleDuration,
                originalDts,
                flags: {
                    isLeading: 0,
                    dependsOn: 1,
                    isDependedOn: 0,
                    hasRedundancy: 0
                }
            });

            if(needFillSilentFrames) {
                // Silent frames should be inserted after wrong-duration frame
                // mp4Samples.push.apply(mp4Samples, silentFrames);
                mp4Samples = [...mp4Samples, ...silentFrames];
            }
        }

        if(mp4Samples.length === 0) { // no samples need to remux
            track.samples = [];
            track.length = 0;
            return;
        }

        // allocate mdatbox
        if(mpegRawTrack) {
            // allocate for raw mpeg buffer
            mdatbox = new Uint8Array(mdatBytes);
        } else {
            // allocate for fmp4 mdat box
            mdatbox = new Uint8Array(mdatBytes);
            // size field
            mdatbox[0] = (mdatBytes >>> 24) & 0xFF;
            mdatbox[1] = (mdatBytes >>> 16) & 0xFF;
            mdatbox[2] = (mdatBytes >>> 8) & 0xFF;
            mdatbox[3] = (mdatBytes) & 0xFF;
            // type field (fourCC)
            mdatbox.set(MP4.types.mdat, 4);
        }

        // Write samples into mdatbox
        for(let i = 0; i < mp4Samples.length; i++) {
            const { unit } = mp4Samples[i];
            mdatbox.set(unit, offset);
            offset += unit.byteLength;
        }

        const latest = mp4Samples[mp4Samples.length - 1];
        lastDts = latest.dts + latest.duration;
        this._audioNextDts = lastDts;

        // fill media segment info & add to info list
        const info = new MediaSegmentInfo();
        info.beginDts = firstDts;
        info.endDts = lastDts;
        info.beginPts = firstDts;
        info.endPts = lastDts;
        info.originalBeginDts = mp4Samples[0].originalDts;
        info.originalEndDts = latest.originalDts + latest.duration;
        info.firstSample = new SampleInfo(mp4Samples[0].dts,
            mp4Samples[0].pts,
            mp4Samples[0].duration,
            mp4Samples[0].originalDts,
            false);
        info.lastSample = new SampleInfo(latest.dts,
            latest.pts,
            latest.duration,
            latest.originalDts,
            false);
        if(!this._isLive) {
            this._audioSegmentInfoList!.append(info);
        }

        track.samples = mp4Samples as any;
        track.sequenceNumber++;

        let moofbox = null;

        if(mpegRawTrack) {
            // Generate empty buffer, because useless for raw mpeg
            moofbox = new Uint8Array();
        } else {
            // Generate moof for fmp4 segment
            moofbox = MP4.moof(track, firstDts);
        }

        track.samples = [];
        track.length = 0;

        let segment;
        if(mpegRawTrack && firstSegmentAfterSeek) {
            // For MPEG audio stream in MSE, if seeking occurred, before appending new buffer
            // We need explicitly set timestampOffset to the desired point in timeline for mpeg SourceBuffer.
            segment = {
                type: 'audio',
                data: this._mergeBoxes(moofbox, mdatbox).buffer,
                sampleCount: mp4Samples.length,
                info,
                timestampOffset: firstDts
            };
        } else {
            segment = {
                type: 'audio',
                data: this._mergeBoxes(moofbox, mdatbox).buffer,
                sampleCount: mp4Samples.length,
                info,
            };
        }
        this.emitter.emit(Events.MEDIA_SEGMENT, 'audio', segment);
        // this._onMediaSegment('audio', segment)
    }

    _remuxVideo(videoTrack: videoTrack, force?: boolean) {
        if(this._videoMeta == null) {
            return;
        }

        const track = videoTrack;
        const { samples } = track;
        let dtsCorrection;
        let firstDts = -1;
        let lastDts = -1;
        let firstPts = -1;
        let lastPts = -1;

        if(!samples || samples.length === 0) {
            return;
        }
        if(samples.length === 1 && !force) {
            // If [sample count in current batch] === 1 && (force != true)
            // Ignore and keep in demuxer's queue
            return;
        } // else if (force === true) do remux

        let offset = 8;
        let mdatbox = null;
        let mdatBytes = 8 + videoTrack.length;

        let lastSample = null;

        // Pop the lastSample and waiting for stash
        if(samples.length > 1) {
            lastSample = samples.pop();
            lastSample && (mdatBytes -= lastSample.length);
        }

        // Insert [stashed lastSample in the previous batch] to the front
        if(this._videoStashedLastSample != null) {
            const sample = this._videoStashedLastSample;
            this._videoStashedLastSample = null;
            samples.unshift(sample);
            mdatBytes += sample.length;
        }

        // Stash the lastSample of current batch, waiting for next batch
        if(lastSample != null) {
            this._videoStashedLastSample = lastSample;
        }

        const firstSampleOriginalDts = samples[0].dts - this._dtsBase;

        // calculate dtsCorrection
        if(this._videoNextDts) {
            dtsCorrection = firstSampleOriginalDts - this._videoNextDts;
        } else {
            // this._videoNextDts == undefined
            if(this._videoSegmentInfoList && this._videoSegmentInfoList.isEmpty()) {
                dtsCorrection = 0;
            } else {
                const lastSample = this._videoSegmentInfoList
                    && this._videoSegmentInfoList.getLastSampleBefore(firstSampleOriginalDts);
                if(lastSample != null) {
                    let distance = firstSampleOriginalDts - (lastSample.originalDts + lastSample.duration);
                    if(distance <= 3) {
                        distance = 0;
                    }
                    const expectedDts = lastSample.dts + lastSample.duration + distance;
                    dtsCorrection = firstSampleOriginalDts - expectedDts;
                } else {
                    // lastSample == null, cannot found
                    dtsCorrection = 0;
                }
            }
        }

        const info = new MediaSegmentInfo();
        const mp4Samples = [];

        // Correct dts for each sample, and calculate sample duration. Then output to mp4Samples
        for(let i = 0; i < samples.length; i++) {
            const sample = samples[i];
            const originalDts = sample.dts - this._dtsBase;
            const { isKeyframe } = sample;
            const dts = originalDts - dtsCorrection;
            const { cts } = sample;
            const pts = dts + cts;

            if(firstDts === -1) {
                firstDts = dts;
                firstPts = pts;
            }

            let sampleDuration = 0;

            if(i !== samples.length - 1) {
                const nextDts = samples[i + 1].dts - this._dtsBase - dtsCorrection;
                sampleDuration = nextDts - dts;
            } else {
                // the last sample
                if(lastSample != null) {
                    // use stashed sample's dts to calculate sample duration
                    const nextDts = lastSample.dts - this._dtsBase - dtsCorrection;
                    sampleDuration = nextDts - dts;
                } else if(mp4Samples.length >= 1) {
                    // use second last sample duration
                    sampleDuration = mp4Samples[mp4Samples.length - 1].duration;
                } else {
                    // the only one sample, use reference sample duration
                    sampleDuration = Math.floor(this._videoMeta.refSampleDuration);
                }
            }

            if(isKeyframe) {
                const syncPoint = new SampleInfo(dts, pts, sampleDuration, sample.dts, true);
                syncPoint.fileposition = <number>sample.fileposition;
                info.appendSyncPoint(syncPoint);
            }

            mp4Samples.push({
                dts,
                pts,
                cts,
                isKeyframe,
                originalDts,
                units: sample.units,
                size: sample.length,
                duration: sampleDuration,
                flags: {
                    isLeading: 0,
                    dependsOn: isKeyframe ? 2 : 1,
                    isDependedOn: isKeyframe ? 1 : 0,
                    hasRedundancy: 0,
                    isNonSync: isKeyframe ? 0 : 1
                }
            });
        }

        // allocate mdatbox
        mdatbox = new Uint8Array(mdatBytes);
        mdatbox[0] = (mdatBytes >>> 24) & 0xff;
        mdatbox[1] = (mdatBytes >>> 16) & 0xff;
        mdatbox[2] = (mdatBytes >>> 8) & 0xff;
        mdatbox[3] = mdatBytes & 0xff;
        mdatbox.set(MP4.types.mdat, 4);

        // Write samples into mdatbox
        for(let i = 0; i < mp4Samples.length; i++) {
            const { units } = mp4Samples[i];
            while(units.length) {
                const unit = units.shift();
                const { data } = unit!;
                mdatbox.set(data, offset);
                offset += data.byteLength;
            }
        }

        const latest = mp4Samples[mp4Samples.length - 1];
        lastDts = latest.dts + latest.duration;
        lastPts = latest.pts + latest.duration;
        this._videoNextDts = lastDts;

        // fill media segment info & add to info list
        info.beginDts = firstDts;
        info.endDts = lastDts;
        info.beginPts = firstPts;
        info.endPts = lastPts;
        info.originalBeginDts = mp4Samples[0].originalDts;
        info.originalEndDts = latest.originalDts + latest.duration;
        info.firstSample = new SampleInfo(
            mp4Samples[0].dts,
            mp4Samples[0].pts,
            mp4Samples[0].duration,
            mp4Samples[0].originalDts,
            mp4Samples[0].isKeyframe
        );
        info.lastSample = new SampleInfo(
            latest.dts,
            latest.pts,
            latest.duration,
            latest.originalDts,
            latest.isKeyframe
        );
        if(!this._isLive) {
            this._videoSegmentInfoList && this._videoSegmentInfoList.append(info);
        }

        track.samples = mp4Samples as Array<any>;
        track.sequenceNumber++;

        // workaround for chrome < 50: force first sample as a random access point
        // see https://bugs.chromium.org/p/chromium/issues/detail?id=229412
        if(this._forceFirstIDR) {
            const { flags } = mp4Samples[0];
            flags.dependsOn = 2;
            flags.isNonSync = 0;
        }

        const moofbox = MP4.moof(track, firstDts);
        track.samples = [];
        track.length = 0;
        this.emitter.emit(Events.MEDIA_SEGMENT,
            'video',
            {
                type: 'video',
                data: this._mergeBoxes(moofbox, mdatbox).buffer,
                sampleCount: mp4Samples.length,
                info
            });
    }

    /**
     * 将两个MP4 BOX合并成一个 Uint8Array 并返回
     * @param moof moof 盒子
     * @param mdat mdat盒子
     */
    _mergeBoxes(moof: Uint8Array, mdat: Uint8Array): Uint8Array {
        const result = new Uint8Array(moof.byteLength + mdat.byteLength);
        result.set(moof, 0);
        result.set(mdat, moof.byteLength);
        return result;
    }
}

export default MP4Remuxer;
