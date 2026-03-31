const { join } = require('path');

/**
 * Store Chromium inside node_modules so it gets deployed with Firebase Cloud Functions
 */
module.exports = {
    cacheDirectory: join(__dirname, 'node_modules', '.cache', 'puppeteer'),
};
