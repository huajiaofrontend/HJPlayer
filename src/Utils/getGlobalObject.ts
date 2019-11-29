/**
 * 获取全局, 在web worker环境中时, 不存在window对象
 */
/* eslint-disable */
export default function getGlobalObject(): Window {
    if(typeof window === 'undefined') {
        return self;
    }
    return window;
}
/* eslint-enable */
