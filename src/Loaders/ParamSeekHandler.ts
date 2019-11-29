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
import Headers from '../Interfaces/UserHeaders';
import SeekRange from '../Interfaces/SeekRange';

class ParamSeekHandler {
    _zeroStart: boolean

    _startName: string

    _endName: string

    constructor(zeroStart: boolean) {
        this._zeroStart = zeroStart || false;
        this._startName = '';
        this._endName = '';
    }

    getConfig(baseUrl: string, range: SeekRange): { url: string; headers: Headers } {
        const url = baseUrl;
        const headers: Headers = { Range: '' };

        if(range.from !== 0 || range.to !== -1) {
            let param;
            if(range.to !== -1) {
                param = `bytes=${range.from.toString()}-${range.to.toString()}`;
            } else {
                param = `bytes=${range.from.toString()}-`;
            }
            headers.Range = param;
        } else if(this._zeroStart) {
            headers.Range = 'bytes=0-';
        }

        return {
            url,
            headers
        };
    }

    removeURLParameters(seekedURL: string): string {
        const baseURL = seekedURL.split('?')[0];
        let params;

        const queryIndex = seekedURL.indexOf('?');
        if(queryIndex !== -1) {
            params = seekedURL.substring(queryIndex + 1);
        }

        let resultParams = '';

        if(params !== undefined && params.length > 0) {
            const pairs = params.split('&');

            for(let i = 0; i < pairs.length; i++) {
                const pair = pairs[i].split('=');
                const requireAnd = i > 0;

                if(pair[0] !== this._startName && pair[0] !== this._endName) {
                    if(requireAnd) {
                        resultParams += '&';
                    }
                    resultParams += pairs[i];
                }
            }
        }

        return resultParams.length === 0 ? baseURL : `${baseURL}?${resultParams}`;
    }
}

export default ParamSeekHandler;
