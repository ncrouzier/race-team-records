var mongoose = require('mongoose');
var bcrypt = require('bcryptjs');

// Appearance of the celebrating runner on the age grade podium. Each field is
// either the string 'random' — re-rolled on every visit — or a fixed value:
// a hex colour, or an index into the hairstyle list. Stored per gender so the
// men's and women's figures can be styled independently.
var runnerStylePrefSchema = new mongoose.Schema({
    hairStyle: mongoose.Schema.Types.Mixed,
    hair: String,
    skin: String,
    shorts: String,
    shoes: String
}, { _id: false });

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
    magicLoginTokenHash: String,
    magicLoginTokenExpires: Date,
    lastSeenActivityLogAt: Date,
    runnerStyle: {
        male: runnerStylePrefSchema,
        female: runnerStylePrefSchema
    },
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