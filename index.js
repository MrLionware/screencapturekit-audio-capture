// Main entry point for the ScreenCaptureKit addon
const path = require('path');

let addon;

try {
    // Try to load the compiled addon
    addon = require('./build/Release/screencapturekit_addon.node');
} catch (err) {
    try {
        // Fallback to Debug build
        addon = require('./build/Debug/screencapturekit_addon.node');
    } catch (err2) {
        throw new Error(
            'Could not load the native addon. Please run "npm install" or "npm run build" to compile the addon.\n' +
            'Original error: ' + err.message
        );
    }
}

module.exports = addon;
