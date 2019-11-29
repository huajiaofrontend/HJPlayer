declare enum LoaderStatus {
    kIdle = 0,
    kConnecting = 1,
    kBuffering = 2,
    kError = 3,
    kComplete = 4
}
export default LoaderStatus;
