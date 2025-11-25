try {
    const lib = require('../dist/index.js');
    console.log('Library imported successfully:', Object.keys(lib));
} catch (err) {
    console.error('Failed to import library:', err);
}
