var mongoose = require('mongoose');
var bcrypt = require('bcryptjs');

// define the schema for our user model
var userSchema = mongoose.Schema({
    email: String,
    password: String,
    role: String,
    username: String,
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member' },
    enabled: { type: Boolean, default: false },
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    lastLogin: Date,
    lastActive: Date,
    createdAt: Date,
    updatedAt: Date
});

// methods ======================

// keep track of when users are updated and created
userSchema.pre('save', function (next, done) {
    if (this.isNew) {
        this.createdAt = Date.now();
    }
    this.updatedAt = Date.now();
    next();
});

// generating a hash (async — does not block the event loop)
userSchema.methods.generateHash = async function (password) {
    var salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
};

// checking if password is valid (async — does not block the event loop)
userSchema.methods.validPassword = async function (password) {
    return bcrypt.compare(password, this.password);
};

// create the model for users and expose it to our app
module.exports = mongoose.model('User', userSchema);