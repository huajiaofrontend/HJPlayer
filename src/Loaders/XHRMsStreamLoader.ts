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

import Log from '../Utils/Logger';
import BaseLoader from './BaseLoader';
import { RuntimeException } from '../Utils/Exception';
import LoaderStatus from './LoaderStatus';
import LoaderErrors from './LoaderErrors';
import UserConfig from '../Interfaces/UserConfig';
import MediaConfig from '../Interfaces/MediaConfig';
import SeekRange from '../Interfaces/SeekRange';
import SeekHandler from '../Interfaces/SeekHandler';
import getGlobal from '../Utils/getGlobalObject';
import ErrorData from '../Interfaces/ErrorData';
import HJPlayerConfig from '../Interfaces/HJPlayerConfig';

const GlobalEnvironment = getGlobal();

/* Notice: ms-stream may cause IE/Edge browser crash if seek too frequently!!!
 * The browser may crash in wininet.dll. Disable for now.
 *
 * For IE11/Edge browser by microsoft which supports `xhr.responseType = 'ms-stream'`
 * Notice that ms-stream API sucks. The buffer is always expanding along with downloading.
 *
 * We need to abort the xhr if buffer size exceeded limit size (e.g. 16 MiB), then do reconnect.
 * in order to release previous ArrayBuffer to avoid memory leak
 *
 * Otherwise, the ArrayBuffer will increase to a terrible size that equals final file size.
 */
class MSStreamLoader extends BaseLoader {
    public Tag: string = 'msstreamLoader'

    private _seekHandler: SeekHandler

    private _config: UserConfig

    public _needStash: boolean = true

    _xhr: XMLHttpRequest | null = null

    /**
     * 流数据读取器
     */
    _reader: ReadableStreamDefaultReader | null | any = null

    /**
     * 总的range
     */
    _totalRange: SeekRange = { from: 0, to: -1 }

    /**
     * 当前range
     */
    _currentRange: SeekRange | null = null

    /**
     * 请求链接
     */
    _currentRequestURL: string | null = null

    _currentRedirectedURL: string | null = null

    /**
     * 数据的长度
     */
    _contentLength: number | null = null

    /**
     * 接收到的数据长度
     */
    _receivedLength: number = 0

    /**
     * 允许收到的最大buffer
     */
    _bufferLimit: number = 16 * 1024 * 1024

    // 16MB
    /**
     * 最后一次收到buffer长度
     */
    _lastTimeBufferSize: number = 0

    /**
     * 是否处于连接
     */
    _isReconnecting: boolean = false

    /**
     * 请求流的配置
     */
    _dataSource: MediaConfig | null = null

    static isSupported(): boolean {
        try {
            if(
                typeof (GlobalEnvironment as any).MSStream === 'undefined'
                || typeof (GlobalEnvironment as any).MSStreamReader === 'undefined'
            ) {
                return false;
            }

            const xhr = new XMLHttpRequest();
            xhr.open('GET', 'https://example.com', true);
            xhr.responseType = <XMLHttpRequestResponseType>'ms-stream';
            return xhr.responseType === <XMLHttpRequestResponseType>'ms-stream';
        } catch (e) {
            Log.warn('msstreamLoader', e.message);
            return false;
        }
    }

    constructor(seekHandler: SeekHandler, config: HJPlayerConfig) {
        super('xhr-msstream-loader', 'ms flv');

        this._seekHandler = seekHandler;
        this._config = config;
    }

    destroy(): void | boolean {
        if(this.isWorking()) {
            this.abort();
        }
        if(!this._reader) {
            return false;
        }
        if(this._reader) {
            this._reader.onprogress = null;
            this._reader.onload = null;
            this._reader.onerror = null;
            this._reader = null;
        }
        if(this._xhr) {
            this._xhr.onreadystatechange = null;
            this._xhr = null;
        }
        super.destroy();
    }

    startLoad(dataSource: MediaConfig, range: SeekRange): void {
        this._internalOpen(dataSource, range, false);
    }

    _internalOpen(dataSource: MediaConfig, range: SeekRange, isSubrange: boolean): void {
        this._dataSource = dataSource;

        if(!isSubrange) {
            this._totalRange = range;
        } else {
            this._currentRange = range;
        }

        let sourceURL = dataSource.url;
        if(this._config.reuseRedirectedURL) {
            if(this._currentRedirectedURL) {
                sourceURL = this._currentRedirectedURL;
            } else if(dataSource.redirectedURL !== undefined) {
                sourceURL = dataSource.redirectedURL;
            }
        }

        const seekConfig = this._seekHandler.getConfig(sourceURL, range);
        this._currentRequestURL = seekConfig.url;
        this._reader = new (<any>GlobalEnvironment).MSStreamReader();
        const reader = this._reader;
        reader.onprogress = this._msrOnProgress.bind(this);
        reader.onload = this._msrOnLoad.bind(this);
        reader.onerror = this._msrOnError.bind(this);
        this._xhr = new XMLHttpRequest();
        const xhr = this._xhr;
        xhr.open('GET', seekConfig.url, true);
        xhr.responseType = <XMLHttpRequestResponseType>'ms-stream';
        xhr.onreadystatechange = this._xhrOnReadyStateChange.bind(this);
        xhr.onerror = this._xhrOnError.bind(this);

        if(dataSource.withCredentials) {
            xhr.withCredentials = true;
        }

        if(typeof seekConfig.headers === 'object') {
            const { headers } = seekConfig;
            Object.keys(headers).forEach((key) => {
                xhr.setRequestHeader(key, headers[key]);
            });
        }

        // add additional headers
        if(typeof this._config.headers === 'object') {
            const { headers } = this._config;
            Object.keys(headers).forEach((key) => {
                xhr.setRequestHeader(key, headers[key]);
            });
        }

        if(this._isReconnecting) {
            this._isReconnecting = false;
        } else {
            this._status = LoaderStatus.kConnecting;
        }
        xhr.send();
    }

    abort() {
        this._internalAbort();
        this._status = LoaderStatus.kComplete;
    }

    _internalAbort() {
        if(this._reader) {
            if(this._reader.readyState === 1) {
                // LOADING
                this._reader.abort();
            }
            this._reader.onprogress = null;
            this._reader.onload = null;
            this._reader.onerror = null;
            this._reader = null;
        }
        if(this._xhr) {
            this._xhr.abort();
            this._xhr.onreadystatechange = null;
            this._xhr = null;
        }
    }

    _xhrOnReadyStateChange(e: Event) {
        const xhr = <XMLHttpRequest>e.target;

        if(xhr.readyState === 2) {
            // HEADERS_RECEIVED
            if(xhr.status >= 200 && xhr.status <= 299) {
                this._status = LoaderStatus.kBuffering;

                if(xhr.responseURL !== undefined) {
                    const redirectedURL = this._seekHandler.removeURLParameters(xhr.responseURL);
                    if(
                        xhr.responseURL !== this._currentRequestURL
                        && redirectedURL !== this._currentRedirectedURL
                    ) {
                        this._currentRedirectedURL = redirectedURL;
                        if(this._onURLRedirect) {
                            this._onURLRedirect(redirectedURL);
                        }
                    }
                }

                const lengthHeader = xhr.getResponseHeader('Content-Length');

                if(lengthHeader !== null && this._contentLength === null) {
                    const length = parseInt(lengthHeader, 10);
                    if(length > 0) {
                        this._contentLength = length;
                        if(this._onContentLengthKnown) {
                            this._onContentLengthKnown(this._contentLength);
                        }
                    }
                }
            } else {
                this._status = LoaderStatus.kError;
                if(this._onError) {
                    this._onError(LoaderErrors.HTTP_STATUS_CODE_INVALID, {
                        code: xhr.status,
                        reason: xhr.statusText
                    });
                } else {
                    throw new RuntimeException(
                        `MSStreamLoader: Http code invalid, ${xhr.status} ${xhr.statusText}`
                    );
                }
            }
        } else if(xhr.readyState === 3) {
            // LOADING
            if(xhr.status >= 200 && xhr.status <= 299) {
                this._status = LoaderStatus.kBuffering;

                const msstream = xhr.response;
                this._reader.readAsArrayBuffer(msstream);
            }
        }
    }

    _xhrOnError(e: Event) {
        this._status = LoaderStatus.kError;
        const type = LoaderErrors.EXCEPTION;
        const info = { code: -1, reason: `${e.constructor.name} ${e.type}` };

        if(this._onError) {
            this._onError(type, info);
        } else {
            throw new RuntimeException(info.reason);
        }
    }

    _msrOnProgress(e: any): void {
        const reader = e.target;
        const bigbuffer = reader.result;

        if(bigbuffer == null) {
            // result may be null, workaround for buggy M$
            this._doReconnectIfNeeded();
            return;
        }

        const slice: ArrayBuffer = bigbuffer.slice(this._lastTimeBufferSize);
        this._lastTimeBufferSize = bigbuffer.byteLength;
        const byteStart = this._totalRange.from + this._receivedLength;
        this._receivedLength += slice.byteLength;

        if(this._onDataArrival) {
            this._onDataArrival(slice, byteStart, this._receivedLength);
        }

        if(bigbuffer.byteLength >= this._bufferLimit) {
            Log.info(
                this.Tag,
                `MSStream buffer exceeded max size near ${byteStart
                    + slice.byteLength}, reconnecting...`
            );
            this._doReconnectIfNeeded();
        }
    }

    /**
     * 重新连接
     */
    _doReconnectIfNeeded() {
        if(this._contentLength == null || this._receivedLength < this._contentLength) {
            this._isReconnecting = true;
            this._lastTimeBufferSize = 0;
            this._internalAbort();

            const range = {
                from: this._totalRange.from + this._receivedLength,
                to: -1
            };
            this._internalOpen(<MediaConfig> this._dataSource, range, true);
        }
    }

    _msrOnLoad(e: Event) {
        // actually it is onComplete event
        this._status = LoaderStatus.kComplete;
        if(this._onComplete) {
            this._onComplete(
                this._totalRange.from,
                this._totalRange.from + this._receivedLength - 1
            );
        }
    }

    _msrOnError(e: ErrorEvent) {
        this._status = LoaderStatus.kError;
        let type: string | number = 0;
        let info:ErrorData | null = null;

        if(this._contentLength && this._receivedLength < this._contentLength) {
            type = LoaderErrors.EARLY_EOF;
            info = { code: -1, reason: 'MSStream meet Early-Eof' };
        } else {
            type = LoaderErrors.EARLY_EOF;
            info = { code: -1, reason: `${e.constructor.name} ${e.type}` };
        }

        if(this._onError) {
            this._onError(type, info);
        } else {
            throw new RuntimeException(info.reason);
        }
    }
}

export default MSStreamLoader;
