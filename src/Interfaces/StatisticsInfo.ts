type StatisticsInfoObject = {
    currentSegmentIndex?: number
    decodedFrames?: number
    droppedFrames?: number
    hasRedirect?: boolean
    loaderType?: string
    playerType?: string
    speed?: number
    totalSegmentCount?: number
    url?: string
}

export default StatisticsInfoObject;
