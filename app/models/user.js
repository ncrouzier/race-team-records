var mongoose = require('mongoose');
var bcrypt   = require('bcrypt-nodejs');

// define the schema for our user model
var userSchema = mongoose.Schema({
    email        : String,
    password     : String,
    role         : String,
    createdAt: Date,
    updatedAt: Date
});

// methods ======================

// keep track of when users are updated and created
userSchema.pre('save', function(next, done) {
    if (this.isNew) {
        this.createdAt = Date.now();
    }
    this.updatedAt = Date.now();

    this.updateCategory();
    next();
});

// generating a hash
userSchema.methods.generateHash = function(password) {
    return bcrypt.hashSync(password, bcrypt.genSaltSync(8), null);
};

// checking if password is valid
userSchema.methods.validPassword = function(password) {
    return bcrypt.compareSync(password, this.password);
};

// create the model for users and expose it to our app
module.exports = mongoose.model('User', userSchema);