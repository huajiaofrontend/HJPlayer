import EventEmitter from 'eventemitter3';

interface BaseEvent {
    Tag: string // 该实现类的标识
    eventEmitter: EventEmitter | null // 实现类的事件中心
    on(eventName: string, listener: EventEmitter.ListenerFn): void
    once(eventName: string, listener: EventEmitter.ListenerFn): void
    off(eventName: string, listener?: EventEmitter.ListenerFn): void
    destroy(): void // 实现类的自杀功能
}

export default BaseEvent;
