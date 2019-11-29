/**
 * 浏览器探测
 */
import getGlobal from './getGlobalObject';

const wg = getGlobal();

function detect() {
    // modified from jquery-browser-plugin

    const ua = wg.navigator.userAgent.toLowerCase();

    const match: any[] | RegExpExecArray = /(edge)\/([\w.]+)/.exec(ua)
        || /(opr)[/]([\w.]+)/.exec(ua)
        || /(chrome)[/]([\w.]+)/.exec(ua)
        || /(iemobile)[/]([\w.]+)/.exec(ua)
        || /(version)(applewebkit)[/]([\w.]+).*(safari)[/]([\w.]+)/.exec(ua)
        || /(webkit)[/]([\w.]+).*(version)[/]([\w.]+).*(safari)[/]([\w.]+)/.exec(ua)
        || /(webkit)[/]([\w.]+)/.exec(ua)
        || /(opera)(?:.*version|)[/]([\w.]+)/.exec(ua)
        || /(msie) ([\w.]+)/.exec(ua)
        || (ua.indexOf('trident') >= 0 && /(rv)(?::| )([\w.]+)/.exec(ua))
        || (ua.indexOf('compatible') < 0 && /(firefox)[/]([\w.]+)/.exec(ua))
        || [];

    const platformMatch: any[] | RegExpExecArray = /(ipad)/.exec(ua)
        || /(ipod)/.exec(ua)
        || /(windows phone)/.exec(ua)
        || /(iphone)/.exec(ua)
        || /(kindle)/.exec(ua)
        || /(android)/.exec(ua)
        || /(windows)/.exec(ua)
        || /(mac)/.exec(ua)
        || /(linux)/.exec(ua)
        || /(cros)/.exec(ua)
        || [];

    const matched = {
        browser: match[5] || match[3] || match[1] || '',
        version: match[2] || match[4] || '0',
        majorVersion: match[4] || match[2] || '0',
        platform: platformMatch[0] || ''
    };

    const browser = Object.create(null);

    if(matched.browser) {
        browser[matched.browser] = true;

        const versionArray = matched.majorVersion.split('.');
        browser.version = {
            major: parseInt(matched.majorVersion, 10),
            string: matched.version
        };
        if(versionArray.length > 1) {
            browser.version.minor = parseInt(versionArray[1], 10);
        }
        if(versionArray.length > 2) {
            browser.version.build = parseInt(versionArray[2], 10);
        }
    }

    if(matched.platform) {
        browser[matched.platform] = true;
    }

    if(browser.chrome || browser.opr || browser.safari) {
        browser.webkit = true;
    }

    // MSIE. IE11 has 'rv' identifer
    if(browser.rv || browser.iemobile) {
        if(browser.rv) {
            delete browser.rv;
        }
        const msie = 'msie';
        matched.browser = msie;
        browser[msie] = true;
    }

    // Microsoft Edge
    if(browser.edge) {
        delete browser.edge;
        const msedge = 'msedge';
        matched.browser = msedge;
        browser[msedge] = true;
    }

    // Opera 15+
    if(browser.opr) {
        const opera = 'opera';
        matched.browser = opera;
        browser[opera] = true;
    }

    // Stock android browsers are marked as Safari
    if(browser.safari && browser.android) {
        const android = 'android';
        matched.browser = android;
        browser[android] = true;
    }

    browser.name = matched.browser;
    browser.platform = matched.platform;

    return browser;
}

const Browser = detect();

export default Browser;
