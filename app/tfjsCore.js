// What face-api gets when it asks for '@tensorflow/tfjs' (app/faceDetector.js):
// @tensorflow/tfjs-core, plus the "chained" tensor methods — tensor.as3D(),
// tensor.expandDims()... The full @tensorflow/tfjs package adds those
// (inlined in its dist/tf.node.js), but it is a ~230 MB devDependency and not
// in the production image; tfjs-core only ships them as ES modules. These
// are the same 127 methods, defined the same way: method(...args) calls the
// op of the same name on the tensor.
const tf = require('@tensorflow/tfjs-core');

// tensor.op(...args) → tf.op(tensor, ...args)
const SAME_NAME = [
    'abs', 'acos', 'acosh', 'add', 'all', 'any', 'argMax', 'argMin', 'asin', 'asinh', 'atan',
    'atan2', 'atanh', 'batchToSpaceND', 'batchNorm', 'broadcastTo', 'cast', 'ceil',
    'clipByValue', 'conv1d', 'cos', 'cosh', 'cumprod', 'cumsum', 'depthToSpace', 'divNoNan',
    'div', 'dot', 'elu', 'equal', 'erf', 'euclideanNorm', 'exp', 'expandDims', 'expm1', 'fft',
    'floor', 'floorDiv', 'gather', 'greaterEqual', 'greater', 'ifft', 'irfft', 'isInf',
    'leakyRelu', 'lessEqual', 'less', 'logSigmoid', 'logSoftmax', 'logSumExp', 'log', 'log1p',
    'logicalAnd', 'logicalNot', 'logicalOr', 'logicalXor', 'max', 'maximum', 'min', 'minimum',
    'mirrorPad', 'mod', 'mul', 'neg', 'norm', 'notEqual', 'onesLike', 'pad', 'pool', 'pow',
    'prelu', 'prod', 'reciprocal', 'relu', 'relu6', 'reshape', 'reverse', 'rfft', 'round',
    'rsqrt', 'selu', 'sigmoid', 'sign', 'sin', 'sinh', 'slice', 'softmax', 'softplus',
    'spaceToBatchND', 'split', 'sqrt', 'square', 'squaredDifference', 'squeeze', 'step',
    'stridedSlice', 'sub', 'sum', 'tan', 'tanh', 'tile', 'topk', 'transpose', 'unique',
    'unstack', 'zerosLike'
];

const SPECIAL = {
    asType(dtype) { return tf.cast(this, dtype); },
    asScalar() {
        if (this.size !== 1) throw new Error('The array must have only 1 element.');
        return tf.reshape(this, []);
    },
    as1D() { return tf.reshape(this, [this.size]); },
    as2D(rows, columns) { return tf.reshape(this, [rows, columns]); },
    as3D(rows, columns, depth) { return tf.reshape(this, [rows, columns, depth]); },
    as4D(rows, columns, depth, depth2) { return tf.reshape(this, [rows, columns, depth, depth2]); },
    as5D(rows, columns, depth, depth2, depth3) { return tf.reshape(this, [rows, columns, depth, depth2, depth3]); },
    concat(x, axis) { return tf.concat([this].concat(x instanceof tf.Tensor ? [x] : x), axis); },
    conv2d(filter, strides, pad, dataFormat, dilations, dimRoundingMode) {
        return tf.conv2d(this, filter, strides, pad, dataFormat, dilations, dimRoundingMode);
    },
    flatten() { return tf.reshape(this, [this.size]); },
    isFinite() { return tf.isFinite(this); },
    isNaN() { return tf.isNaN(this); },
    matMul(b, transposeA, transposeB) { return tf.matMul(this, b, transposeA, transposeB); },
    mean(axis, keepDims) { return tf.mean(this, axis, keepDims); },
    oneHot(depth, onValue, offValue) { return tf.oneHot(this, depth, onValue == null ? 1 : onValue, offValue == null ? 0 : offValue); },
    reshapeAs(x) { return tf.reshape(this, x.shape); },
    stack(x, axis) { return tf.stack(x instanceof tf.Tensor ? [this, x] : [this].concat(x), axis); },
    toBool() { return tf.cast(this, 'bool'); },
    toFloat() { return tf.cast(this, 'float32'); },
    toInt() { return tf.cast(this, 'int32'); },
    where(condition, x) { return tf.where(condition, this, x); }
};

const proto = tf.Tensor.prototype;
SAME_NAME.forEach((name) => {
    if (proto[name]) return;
    proto[name] = function () {
        this.throwIfDisposed();
        return tf[name].apply(null, [this].concat(Array.prototype.slice.call(arguments)));
    };
});
Object.keys(SPECIAL).forEach((name) => {
    if (proto[name]) return;
    const fn = SPECIAL[name];
    proto[name] = function () {
        this.throwIfDisposed();
        return fn.apply(this, arguments);
    };
});

module.exports = tf;
