import EventEmitter from 'eventemitter3';
import BaseLoaderInterface from '../Interfaces/BaseLoader';
import { NotImplementedException } from '../Utils/Exception';
import LoaderStatus from './LoaderStatus';
import SeekRange from '../Interfaces/SeekRange';
import MediaConfig from '../Interfaces/MediaConfig';

class BaseLoader implements BaseLoaderInterface {
    Tag: string

    supportType: string

    _type: string

    _needStash: boolean

    _onContentLengthKnown: Function | null

    _onDataArrival: Function | null

    _onError: Function | null

    _onComplete: Function | null

    _status: number

    _onURLRedirect: Function | null

    eventEmitter: EventEmitter

    constructor(type: string, supportType: string) {
        this.Tag = 'BaseLoader';
        this.supportType = supportType;
        this._type = type || 'undefined';
        this._status = LoaderStatus.kIdle;
        this._needStash = false;
        // callbacks
        this._onContentLengthKnown = null;
        this._onURLRedirect = null;
        this._onDataArrival = null;
        this._onError = null;
        this._onComplete = null;
        this.eventEmitter = new EventEmitter();
    }

    on(eventName: string, callback: EventEmitter.ListenerFn): void {
        this.eventEmitter.on(eventName, callback);
    }

    once(eventName: string, callback: EventEmitter.ListenerFn): void {
        this.eventEmitter.once(eventName, callback);
    }

    off(eventName: string, callback?: EventEmitter.ListenerFn): void {
        this.eventEmitter.off(eventName, callback);
    }

    destroy() {
        this.eventEmitter.removeAllListeners();
        delete this.eventEmitter;
        this._status = LoaderStatus.kIdle;
        this._onContentLengthKnown = null;
        this._onURLRedirect = null;
        this._onDataArrival = null;
        this._onError = null;
        this._onComplete = null;
    }

    isWorking() {
        return this._status === LoaderStatus.kConnecting || this._status === LoaderStatus.kBuffering;
    }

    get type() {
        return this._type;
    }

    get status() {
        return this._status;
    }

    get needStashBuffer() {
        return this._needStash;
    }

    get onContentLengthKnown() {
        return this._onContentLengthKnown;
    }

    set onContentLengthKnown(callback) {
        this._onContentLengthKnown = callback;
    }

    get onURLRedirect() {
        return this._onURLRedirect;
    }

    set onURLRedirect(callback) {
        this._onURLRedirect = callback;
    }

    get onDataArrival() {
        return this._onDataArrival;
    }

    set onDataArrival(callback) {
        this._onDataArrival = callback;
    }

    get onError() {
        return this._onError;
    }

    set onError(callback) {
        this._onError = callback;
    }

    get onComplete() {
        return this._onComplete;
    }

    set onComplete(callback) {
        this._onComplete = callback;
    }

    startLoad(mediaConfig: MediaConfig, range: SeekRange) {
        throw new NotImplementedException('Unimplemented abstract function!');
    }

    abort() {
        throw new NotImplementedException('Unimplemented abstract function!');
    }
}

export default BaseLoader;
