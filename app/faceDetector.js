// The face detector shared by profile thumbnails (app/profileThumbnails.js)
// and banners (app/bannerRender.js): face-api's SSD MobileNet model on the
// lightweight WASM backend (@tensorflow/tfjs-core + tfjs-backend-wasm, not
// the full @tensorflow/tfjs package), loaded once.
const path = require('path');

const root = path.join(__dirname, '..');

// face-api's WASM build asks for the full @tensorflow/tfjs package, which is
// only a devDependency (~230 MB with what it pulls in) and so is not in the
// production image (npm prune --omit=dev). What face-api uses from it is the
// core plus the chained tensor methods: while face-api loads,
// '@tensorflow/tfjs' resolves to app/tfjsCore.js, which is exactly that.
function requireFaceApi() {
    const Module = require('module');
    const resolve = Module._resolveFilename;
    const core = require.resolve('./tfjsCore');
    Module._resolveFilename = function (request) {
        if (request === '@tensorflow/tfjs') return core;
        return resolve.apply(this, arguments);
    };
    try {
        return require('@vladmandic/face-api/dist/face-api.node-wasm.js');
    } finally {
        Module._resolveFilename = resolve;
    }
}

// Loads exactly once, however many calls arrive concurrently — a second call
// while the first is still loading gets the same in-flight promise. A failed
// load is not cached, so the next call tries again instead of failing forever.
let faceDetectorPromise = null;
function initFaceDetector() {
    if (!faceDetectorPromise) {
        faceDetectorPromise = (async () => {
            const tf = require('@tensorflow/tfjs-core');
            require('@tensorflow/tfjs-backend-wasm');
            const { setWasmPaths } = require('@tensorflow/tfjs-backend-wasm');
            const faceapi = requireFaceApi();
            setWasmPaths(path.join(root, 'node_modules/@tensorflow/tfjs-backend-wasm/dist/'));
            await tf.setBackend('wasm');
            await tf.ready();
            await faceapi.nets.ssdMobilenetv1.loadFromDisk(path.join(root, 'node_modules/@vladmandic/face-api/model'));
            return { tf, faceapi };
        })().catch(err => {
            faceDetectorPromise = null; // let the next call try again
            throw err;
        });
    }
    return faceDetectorPromise;
}

// The faces in raw RGB pixels ({ data, info } from sharp's .raw()), largest
// first, as { x, y, width, height } in those pixels
async function detectFaces(data, info, minConfidence) {
    const { tf, faceapi } = await initFaceDetector();
    const tensor = tf.tensor3d(new Uint8Array(data), [info.height, info.width, 3], 'int32');
    try {
        const detections = await faceapi.detectAllFaces(tensor, new faceapi.SsdMobilenetv1Options({ minConfidence: minConfidence || 0.3 }));
        return detections.map(d => ({ x: d.box.x, y: d.box.y, width: d.box.width, height: d.box.height }))
            .sort((a, b) => b.width - a.width);
    } finally {
        tensor.dispose();
    }
}

module.exports = { initFaceDetector, detectFaces };
