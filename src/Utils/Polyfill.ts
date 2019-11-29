const es6Promise = require('es6-promise');

class Polyfill {
    static install() {
        Polyfill.addIsNaN();
        Polyfill.addIsInfinite();
        Polyfill.addPromise();
    }

    static addIsNaN() {
        /* eslint-disable */
        Number.isNaN = Number.isNaN || self.isNaN;
    }

    static addIsInfinite() {
        Number.isFinite = Number.isFinite || self.isFinite;
    }

    static addPromise() {
        if (typeof self.Promise !== 'function') {
            es6Promise.polyfill();
        }
    }
}

export default Polyfill;
