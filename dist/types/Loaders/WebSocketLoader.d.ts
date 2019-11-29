import BaseLoader from './BaseLoader';
import MediaConfig from '../Interfaces/MediaConfig';
declare class WebSocketLoader extends BaseLoader {
    _ws: WebSocket | null;
    _requestAbort: boolean;
    _receivedLength: number;
    static isSupported(): boolean;
    constructor();
    destroy(): void;
    startLoad(dataSource: MediaConfig): void;
    abort(): void;
    _onWebSocketOpen(): void;
    _onWebSocketClose(): void;
    _onWebSocketMessage(e: MessageEvent): void;
    _dispatchArrayBuffer(arraybuffer: ArrayBuffer): void;
    _onWebSocketError(): void;
}
export default WebSocketLoader;
