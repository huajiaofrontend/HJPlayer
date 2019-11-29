/*
 * Copyright (C) 2016 Bilibili. All Rights Reserved.
 *
 * @author zheng qian <xqq@xqq.im>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* eslint no-param-reassign:0 */
/* eslint max-len:0 */

import EventEmitter from 'eventemitter3';
import Log from '../Utils/Logger';
import Browser from '../Utils/Browser';
import Events from '../Events/index';
import { IllegalStateException } from '../Utils/Exception';
import { MediaSegment, InitSegment } from '../Interfaces/Segment';
import IDRSampleList from '../Utils/IDRSampleList';

// Media Source Extensions controller

interface MSEControllerConfig {
    isLive: boolean
    autoCleanupSourceBuffer?: boolean
    autoCleanupMaxBackwardDuration: number
    autoCleanupMinBackwardDuration: number
}
interface MSEControllerE {
    onSourceOpen: () => void
    onSourceEnded: () => void
    onSourceClose: () => void
    onSourceBufferError: () => void
    onSourceBufferUpdateEnd: () => void
}
interface SourceBufferObj {
    video: SourceBuffer | null
    audio: SourceBuffer | null
    [key: string]: SourceBuffer | null
}

class MSEController {
    public TAG: string = 'MSEController'

    private _config: MSEControllerConfig

    private _emitter: EventEmitter = new EventEmitter()

    public on = this._emitter.on.bind(this._emitter)

    public off = this._emitter.off.bind(this._emitter)

    public e: MSEControllerE = {
        onSourceOpen: this._onSourceOpen.bind(this),
        onSourceEnded: this._onSourceEnded.bind(this),
        onSourceClose: this._onSourceClose.bind(this),
        onSourceBufferError: () => {},
        onSourceBufferUpdateEnd: this._onSourceBufferUpdateEnd.bind(this)
    }

    private _mediaSourceObjectURL: string | null = null

    private _mediaSource: MediaSource | null = null

    private _mediaElement: HTMLMediaElement | null = null

    private _isBufferFull: boolean = false

    private _hasPendingEos: boolean = false

    private _requireSetMediaDuration: boolean = false

    private _pendingMediaDuration: number = 0

    private _pendingSourceBufferInit: Array<InitSegment> = []

    private _mimeTypes: { [P in keyof SourceBufferObj]: string | null } = {
        video: null,
        audio: null
    }

    private _sourceBuffers: SourceBufferObj = {
        video: null,
        audio: null
    }

    private _lastInitSegments: Record<string, InitSegment | null> = {
        video: null,
        audio: null
    }

    private _pendingSegments: {
        [P in keyof SourceBufferObj]: Array<InitSegment | MediaSegment> | null
    } = {
        video: [],
        audio: []
    }

    private _pendingRemoveRanges: {
        [P in keyof SourceBufferObj]: Array<{ start: number; end: number }> | null
    } = {
        video: [],
        audio: []
    }

    private _idrList: IDRSampleList = new IDRSampleList()

    constructor(config: MSEControllerConfig) {
        this._config = config;
        if(this._config.isLive && this._config.autoCleanupSourceBuffer === undefined) {
            // For live stream, do auto cleanup by default
            this._config.autoCleanupSourceBuffer = true;
        }
    }

    destroy() {
        if(this._mediaElement || this._mediaSource) {
            this.detachMediaElement();
        }
        this._emitter.removeAllListeners();
        delete this._emitter;
        delete this.e;
    }

    attachMediaElement(mediaElement: HTMLMediaElement) {
        if(this._mediaSource) {
            throw new IllegalStateException('MediaSource has been attached to an HTMLMediaElement!');
        }

        const ms = new window.MediaSource();

        ms.addEventListener('sourceopen', this.e.onSourceOpen);
        ms.addEventListener('sourceended', this.e.onSourceEnded);
        ms.addEventListener('sourceclose', this.e.onSourceClose);

        this._mediaSource = ms;
        this._mediaElement = mediaElement;
        this._mediaSourceObjectURL = window.URL.createObjectURL(this._mediaSource);
        mediaElement.src = this._mediaSourceObjectURL;
    }

    detachMediaElement() {
        if(this._mediaSource) {
            const ms = this._mediaSource;
            Object.keys(this._sourceBuffers).forEach((type: string) => {
                // pending segments should be discard
                const ps = this._pendingSegments[type];
                ps!.splice(0, ps!.length);
                this._pendingSegments[type] = null;
                this._pendingRemoveRanges[type] = null;
                this._lastInitSegments[type] = null;

                // remove all sourcebuffers
                const sb = this._sourceBuffers[type];
                if(sb) {
                    if(ms.readyState !== 'closed') {
                        // ms edge can throw an error: Unexpected call to method or property access
                        try {
                            ms.removeSourceBuffer(sb);
                        } catch (error) {
                            Log.error(this.TAG, error.message);
                        }
                        if(this.e) {
                            sb.removeEventListener('error', this.e.onSourceBufferError);
                            sb.removeEventListener('updateend', this.e.onSourceBufferUpdateEnd);
                        }
                    }
                    this._mimeTypes[type] = null;
                    this._sourceBuffers[type] = null;
                }
            });

            if(ms.readyState === 'open') {
                try {
                    ms.endOfStream();
                } catch (error) {
                    Log.error(this.TAG, error.message);
                }
            }
            if(this.e) {
                ms.removeEventListener('sourceopen', this.e.onSourceOpen);
                ms.removeEventListener('sourceended', this.e.onSourceEnded);
                ms.removeEventListener('sourceclose', this.e.onSourceClose);
            }

            this._pendingSourceBufferInit = [];
            this._isBufferFull = false;
            this._idrList.clear();
            this._mediaSource = null;
        }

        if(this._mediaElement) {
            this._mediaElement.src = '';
            this._mediaElement.removeAttribute('src');
            this._mediaElement = null;
        }
        if(this._mediaSourceObjectURL) {
            window.URL.revokeObjectURL(this._mediaSourceObjectURL);
            this._mediaSourceObjectURL = null;
        }
    }

    appendInitSegment(initSegment: InitSegment, deferred?: boolean) {
        if(!this._mediaSource || this._mediaSource.readyState !== 'open') {
            // sourcebuffer creation requires mediaSource.readyState === 'open'
            // so we defer the sourcebuffer creation, until sourceopen event triggered
            this._pendingSourceBufferInit.push(initSegment);
            // make sure that this InitSegment is in the front of pending segments queue
            this._pendingSegments[initSegment.type]!.push(initSegment);
            return;
        }

        const is = initSegment;
        let mimeType = `${is.container}`;
        if(is.codec && is.codec.length > 0) {
            mimeType += `;codecs=${is.codec}`;
        }

        let firstInitSegment = false;

        // Log.info(this.TAG, `Received Initialization Segment, mimeType: ${mimeType}`);
        this._lastInitSegments[is.type] = is;

        if(mimeType !== this._mimeTypes[is.type]) {
            if(!this._mimeTypes[is.type]) {
                // empty, first chance create sourcebuffer
                firstInitSegment = true;
                try {
                    const sb = this._mediaSource.addSourceBuffer(mimeType);
                    if(this.e) {
                        sb.addEventListener('error', this.e.onSourceBufferError);
                        sb.addEventListener('updateend', this.e.onSourceBufferUpdateEnd);
                    }

                    this._sourceBuffers[is.type] = sb;
                } catch (error) {
                    Log.error(this.TAG, error.message);
                    this._emitter.emit(Events.ERROR, {
                        code: error.code,
                        reason: error.message
                    });
                    return;
                }
            } else {
                Log.info(
                    this.TAG,
                    `Notice: ${is.type} mimeType changed, origin: ${
                        this._mimeTypes[is.type]
                    }, target: ${mimeType}`
                );
            }
            this._mimeTypes[is.type] = mimeType;
        }

        if(!deferred) {
            // deferred means this InitSegment has been pushed to pendingSegments queue
            this._pendingSegments[is.type]!.push(is);
        }
        if(!firstInitSegment) {
            // append immediately only if init segment in subsequence
            if(this._sourceBuffers[is.type] && !this._sourceBuffers[is.type]!.updating) {
                this._doAppendSegments();
            }
        }
        if(Browser.safari && is.container === 'audio/mpeg' && is.mediaDuration > 0) {
            // 'audio/mpeg' track under Safari may cause MediaElement's duration to be NaN
            // Manually correct MediaSource.duration to make progress bar seekable, and report right duration
            this._requireSetMediaDuration = true;
            this._pendingMediaDuration = is.mediaDuration / 1000; // in seconds
            this._updateMediaSourceDuration();
        }
    }

    appendMediaSegment(mediaSegment: MediaSegment) {
        const ms = mediaSegment;
        this._pendingSegments[ms.type]!.push(ms);

        if(this._config.autoCleanupSourceBuffer && this._needCleanupSourceBuffer()) {
            this._doCleanupSourceBuffer();
        }

        const sb = this._sourceBuffers[ms.type];
        if(sb && !sb.updating && !this._hasPendingRemoveRanges()) {
            this._doAppendSegments();
        }
    }

    seek() {
        // remove all appended buffers
        Object.keys(this._sourceBuffers).forEach((type) => {
            if(!this._sourceBuffers[type]) {
                return;
            }

            // abort current buffer append algorithm
            const sb = this._sourceBuffers[type];
            if(this._mediaSource!.readyState === 'open') {
                try {
                    // If range removal algorithm is running, InvalidStateError will be throwed
                    // Ignore it.
                    sb!.abort();
                } catch (error) {
                    Log.error(this.TAG, error.message);
                }
            }

            // IDRList should be clear
            this._idrList.clear();

            // pending segments should be discard
            const ps = this._pendingSegments[type];
            ps!.splice(0, ps!.length);

            if(this._mediaSource!.readyState === 'closed') {
                // Parent MediaSource object has been detached from HTMLMediaElement
                return;
            }

            // record ranges to be remove from SourceBuffer
            for(let i = 0; i < sb!.buffered.length; i++) {
                const start = sb!.buffered.start(i);
                const end = sb!.buffered.end(i);
                this._pendingRemoveRanges[type]!.push({ start, end });
            }

            // if sb is not updating, let's remove ranges now!
            if(!sb!.updating) {
                this._doRemoveRanges();
            }

            // Safari 10 may get InvalidStateError in the later appendBuffer() after SourceBuffer.remove() call
            // Internal parser's state may be invalid at this time. Re-append last InitSegment to workaround.
            // Related issue: https://bugs.webkit.org/show_bug.cgi?id=159230
            if(Browser.safari) {
                const lastInitSegment = this._lastInitSegments[type];
                if(lastInitSegment) {
                    this._pendingSegments[type]!.push(lastInitSegment);
                    if(!sb!.updating) {
                        this._doAppendSegments();
                    }
                }
            }
        });
    }

    endOfStream() {
        const ms = this._mediaSource;
        const sb = this._sourceBuffers;
        if(!ms || ms.readyState !== 'open') {
            if(ms && ms.readyState === 'closed' && this._hasPendingSegments()) {
                // If MediaSource hasn't turned into open state, and there're pending segments
                // Mark pending endOfStream, defer call until all pending segments appended complete
                this._hasPendingEos = true;
            }
            return;
        }
        if((sb.video && sb.video.updating) || (sb.audio && sb.audio.updating)) {
            // If any sourcebuffer is updating, defer endOfStream operation
            // See _onSourceBufferUpdateEnd()
            this._hasPendingEos = true;
        } else {
            this._hasPendingEos = false;
            // Notify media data loading complete
            // This is helpful for correcting total duration to match last media segment
            // Otherwise MediaElement's ended event may not be triggered
            ms.endOfStream();
        }
    }

    getNearestKeyframe(dts: number) {
        return this._idrList.getLastSyncPointBeforeDts(dts);
    }

    private _needCleanupSourceBuffer() {
        let res = false;
        if(!this._config.autoCleanupSourceBuffer) {
            return res;
        }

        const { currentTime } = this._mediaElement || { currentTime: 0 };

        Object.keys(this._sourceBuffers).some((type) => {
            const sb = this._sourceBuffers[type];
            if(sb) {
                const { buffered } = sb;
                if(buffered.length >= 1) {
                    if(
                        currentTime - buffered.start(0)
                        >= this._config.autoCleanupMaxBackwardDuration
                    ) {
                        res = true;
                    }
                }
            }
            return res;
        });

        return res;
    }

    private _doCleanupSourceBuffer() {
        const { currentTime } = this._mediaElement || { currentTime: 0 };
        Object.keys(this._sourceBuffers).forEach((type) => {
            const sb = this._sourceBuffers[type];
            if(sb) {
                const { buffered } = sb;
                let doRemove = false;

                for(let i = 0; i < buffered.length; i++) {
                    const start = buffered.start(i);
                    const end = buffered.end(i);

                    if(start <= currentTime && currentTime < end + 3) {
                        // padding 3 seconds
                        if(currentTime - start >= this._config.autoCleanupMaxBackwardDuration) {
                            doRemove = true;
                            const removeEnd = currentTime - this._config.autoCleanupMinBackwardDuration;
                            this._pendingRemoveRanges[type]!.push({
                                start,
                                end: removeEnd
                            });
                        }
                    } else if(end < currentTime) {
                        doRemove = true;
                        this._pendingRemoveRanges[type]!.push({ start, end });
                    }
                }

                if(doRemove && !sb.updating) {
                    this._doRemoveRanges();
                }
            }
        });
    }

    private _updateMediaSourceDuration() {
        const sb = this._sourceBuffers;
        if(
            this._mediaElement
            && (this._mediaElement.readyState === 0 || this._mediaSource!.readyState !== 'open')
        ) {
            return;
        }
        if((sb.video && sb.video.updating) || (sb.audio && sb.audio.updating)) {
            return;
        }

        const current = this._mediaSource!.duration;
        const target = this._pendingMediaDuration;
        if(target > 0 && (Number.isNaN(current) || target > current)) {
            Log.info(this.TAG, `Update MediaSource duration from ${current} to ${target}`);
            this._mediaSource!.duration = target;
        }

        this._requireSetMediaDuration = false;
        this._pendingMediaDuration = 0;
    }

    private _doRemoveRanges() {
        Object.keys(this._pendingRemoveRanges).forEach((type: string) => {
            if(!this._sourceBuffers[type] || this._sourceBuffers[type]!.updating) {
                return;
            }
            const sb = this._sourceBuffers[type];
            const ranges = this._pendingRemoveRanges[type];
            while(ranges && ranges.length && !sb!.updating) {
                const range = ranges.shift();
                sb!.remove(range!.start, range!.end);
            }
        });
    }

    private _doAppendSegments() {
        const pendingSegments = this._pendingSegments;
        Object.keys(pendingSegments).forEach((type) => {
            if(!this._sourceBuffers[type] || this._sourceBuffers[type]!.updating) {
                return;
            }

            if(pendingSegments[type]!.length > 0) {
                const segment = pendingSegments[type]!.shift();

                if(segment && (segment as any).timestampOffset) {
                    // For MPEG audio stream in MSE, if unbuffered-seeking occurred
                    // We need explicitly set timestampOffset to the desired point in timeline for mpeg SourceBuffer.
                    const currentOffset = this._sourceBuffers[type]!.timestampOffset;
                    const targetOffset = (segment as any).timestampOffset / 1000; // in seconds
                    const delta = Math.abs(currentOffset - targetOffset);
                    if(delta > 0.1) {
                        // If time delta > 100ms
                        Log.info(
                            this.TAG,
                            `Update MPEG audio timestampOffset from ${currentOffset} to ${targetOffset}`
                        );
                        this._sourceBuffers[type]!.timestampOffset = targetOffset;
                    }
                    delete (segment as any).timestampOffset;
                }

                if(!segment!.data || segment!.data.byteLength === 0) {
                    // Ignore empty buffer
                    return;
                }

                try {
                    this._sourceBuffers[type]!.appendBuffer(segment!.data);
                    this._isBufferFull = false;
                    if(type === 'video' && Object.prototype.hasOwnProperty.call(segment, 'info')) {
                        this._idrList.appendArray((segment as MediaSegment).info.syncPoints);
                    }
                } catch (error) {
                    this._pendingSegments[type]!.unshift(segment!);
                    if(error.code === 22) {
                        // QuotaExceededError
                        /* Notice that FireFox may not throw QuotaExceededError if SourceBuffer is full
                         * Currently we can only do lazy-load to avoid SourceBuffer become scattered.
                         * SourceBuffer eviction policy may be changed in future version of FireFox.
                         *
                         * Related issues:
                         * https://bugzilla.mozilla.org/show_bug.cgi?id=1279885
                         * https://bugzilla.mozilla.org/show_bug.cgi?id=1280023
                         */

                        // report buffer full, abort network IO
                        if(!this._isBufferFull) {
                            this._emitter.emit(Events.BUFFER_FULL);
                        }
                        this._isBufferFull = true;
                    } else {
                        Log.error(this.TAG, error.message);
                        this._emitter.emit(Events.ERROR, {
                            code: error.code,
                            reason: error.message
                        });
                    }
                }
            }
        });
    }

    private _onSourceOpen() {
        Log.info(this.TAG, 'MediaSource onSourceOpen');

        if(this.e) {
            this._mediaSource!.removeEventListener('sourceopen', this.e.onSourceOpen);
        }

        // deferred sourcebuffer creation / initialization
        if(this._pendingSourceBufferInit.length > 0) {
            const pendings = this._pendingSourceBufferInit;
            while(pendings.length) {
                const segment = pendings.shift();
                this.appendInitSegment(segment!, true);
            }
        }
        // there may be some pending media segments, append them
        if(this._hasPendingSegments()) {
            this._doAppendSegments();
        }
        this._emitter.emit(Events.SOURCE_OPEN);
    }

    private _onSourceEnded() {
        // fired on endOfStream
        Log.info(this.TAG, 'MediaSource onSourceEnded');
    }

    private _onSourceClose() {
        // fired on detaching from media element
        Log.info(this.TAG, 'MediaSource onSourceClose');
        if(this._mediaSource && this.e != null) {
            this._mediaSource.removeEventListener('sourceopen', this.e.onSourceOpen);
            this._mediaSource.removeEventListener('sourceended', this.e.onSourceEnded);
            this._mediaSource.removeEventListener('sourceclose', this.e.onSourceClose);
        }
    }

    private _hasPendingSegments() {
        const ps = this._pendingSegments;
        return ps.video!.length > 0 || ps.audio!.length > 0;
    }

    private _hasPendingRemoveRanges() {
        const prr = this._pendingRemoveRanges;
        return prr.video!.length > 0 || prr.audio!.length > 0;
    }

    private _onSourceBufferUpdateEnd() {
        if(this._requireSetMediaDuration) {
            this._updateMediaSourceDuration();
        } else if(this._hasPendingRemoveRanges()) {
            this._doRemoveRanges();
        } else if(this._hasPendingSegments()) {
            this._doAppendSegments();
        } else if(this._hasPendingEos) {
            this.endOfStream();
        }
        this._emitter.emit(Events.UPDATE_END);
    }

    setMediaSourceDuration(duration: number) {
        this._mediaSource!.duration = duration;
    }
}

export default MSEController;
