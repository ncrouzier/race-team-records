var mongoose = require('mongoose');
var bcrypt = require('bcrypt-nodejs');

// define the schema for our user model
var memberSchema = mongoose.Schema({
    firstname: String,
    lastname: String,
    sex: String,
    dateofbirth: Date,
    bio: String,
    memberStatus: String,
    pictureLink: String,
    createdAt: Date,
    updatedAt: Date
});

// keep track of when members are updated and created
memberSchema.pre('save', function(next, done) {
    if (this.isNew) {
        this.createdAt = Date.now();
    }
    this.updatedAt = Date.now();
    next();
});



// create the model for users and expose it to our app
module.exports = mongoose.model('Member', memberSchema);
