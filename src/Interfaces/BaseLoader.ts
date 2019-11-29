import BaseEvent from './BaseEvent';
import UserConfig from './UserConfig';
import SeekRange from './SeekRange';
import MediaConfig from './MediaConfig';

interface BaseLoader extends BaseEvent {
    // loader的类型
    _type: string
    // 该 loader 支持类型
    supportType: string
    // loader 当前的工作状态
    status: number
    // 是否需要存储 buffer
    needStashBuffer: boolean
    // 是否支持 此方法为静态方法, 不能在接口中规定, 需要在类中实现
    // isSupport(mediaType: string) {}
    /**
     * 开始加载
     * @param mediaConfig 媒体设置
     * @param byteStart 继续加载的位置
     */
    startLoad(mediaConfig: MediaConfig, range: SeekRange): void
    isWorking(): boolean
    abort(): void
    onContentLengthKnown: Function | null
    onURLRedirect: Function | null
    onDataArrival: Function | null
    onComplete: Function | null
    onError: Function | null
}

export default BaseLoader;
