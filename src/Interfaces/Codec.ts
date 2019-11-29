import BaseEvent from './BaseEvent';

interface Codec extends BaseEvent {
    type: string
    seek(time: number): void
    // probe(): boolean 此方法需为静态方法, 无法在interface中标明
    flushStashedSamples(): void
    insertDiscontinuity(): void
    bindDataSource(loaderIO: any): void
}
export default Codec;
