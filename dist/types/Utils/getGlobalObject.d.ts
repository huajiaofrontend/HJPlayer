/**
 * 获取全局, 在web worker环境中时, 不存在window对象
 */
export default function getGlobalObject(): Window;
