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
import LoaderStatus from './LoaderStatus';
import LoaderErrors from './LoaderErrors';
import { RuntimeException } from '../Utils/Exception';
import MediaConfig from '../Interfaces/MediaConfig';
import getGlobal from '../Utils/getGlobalObject';

const GlobalEnvironment = getGlobal();

// For FLV over WebSocket live stream
class WebSocketLoader extends BaseLoader {
    _ws: WebSocket | null;

    _requestAbort: boolean;

    _receivedLength: number;

    static isSupported() {
        try {
            return (typeof (GlobalEnvironment as any).WebSocket !== 'undefined');
        } catch (e) {
            return false;
        }
    }

    constructor() {
        super('websocket-loader', 'flv');
        this._needStash = true;
        this._ws = null;
        this._requestAbort = false;
        this._receivedLength = 0;
    }

    destroy() {
        if(this._ws) {
            this.abort();
        }
        super.destroy();
    }

    startLoad(dataSource: MediaConfig) {
        try {
            this._ws = new (GlobalEnvironment as any).WebSocket(dataSource.url);
            const ws = this._ws;
            if(!ws) return;
            ws.binaryType = 'arraybuffer';
            ws.onopen = this._onWebSocketOpen.bind(this);
            ws.onclose = this._onWebSocketClose.bind(this);
            ws.onmessage = this._onWebSocketMessage.bind(this);
            ws.onerror = this._onWebSocketError.bind(this);
            this._status = LoaderStatus.kConnecting;
        } catch (e) {
            this._status = LoaderStatus.kError;

            const info = { code: e.code, reason: e.message };

            if(this._onError) {
                this._onError(LoaderErrors.EXCEPTION, info);
            } else {
                throw new RuntimeException(info.reason);
            }
        }
    }

    abort() {
        const ws = this._ws;
        if(ws && (ws.readyState === 0 || ws.readyState === 1)) { // CONNECTING || OPEN
            this._requestAbort = true;
            ws.close();
        }

        this._ws = null;
        this._status = LoaderStatus.kComplete;
    }

    _onWebSocketOpen() {
        this._status = LoaderStatus.kBuffering;
    }

    _onWebSocketClose() {
        if(this._requestAbort === true) {
            this._requestAbort = false;
            return;
        }

        this._status = LoaderStatus.kComplete;

        if(this._onComplete) {
            this._onComplete(0, this._receivedLength - 1);
        }
    }

    _onWebSocketMessage(e: MessageEvent) {
        if(e.data instanceof ArrayBuffer) {
            this._dispatchArrayBuffer(e.data);
        } else if(e.data instanceof Blob) {
            const reader = new FileReader();
            reader.onload = () => {
                this._dispatchArrayBuffer(<ArrayBuffer>reader.result);
            };
            reader.readAsArrayBuffer(e.data);
        } else {
            this._status = LoaderStatus.kError;
            const info = { code: -1, reason: `Unsupported WebSocket message type: ${e.data.constructor.name}` };

            if(this._onError) {
                this._onError(LoaderErrors.EXCEPTION, info);
            } else {
                throw new RuntimeException(info.reason);
            }
        }
    }

    _dispatchArrayBuffer(arraybuffer: ArrayBuffer) {
        const chunk = arraybuffer;
        const byteStart = this._receivedLength;
        this._receivedLength += chunk.byteLength;

        if(this._onDataArrival) {
            this._onDataArrival(chunk, byteStart, this._receivedLength);
        }
    }

    _onWebSocketError() {
        this._status = LoaderStatus.kError;

        const info = {
            code: -1,
            reason: 'websoket error'
        };

        if(this._onError) {
            this._onError(LoaderErrors.EXCEPTION, info);
        } else {
            throw new RuntimeException(info.reason);
        }
    }
}

export default WebSocketLoader;
