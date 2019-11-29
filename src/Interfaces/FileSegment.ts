type FileSegment = {
    duration: number
    filesize?: number
    url: string
    type: string
    [x: string]: any
}

export default FileSegment;
