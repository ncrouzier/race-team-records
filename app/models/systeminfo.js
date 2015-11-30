var mongoose = require('mongoose');
var bcrypt   = require('bcrypt-nodejs');


// define the schema for our user model
var systeminfoSchema = mongoose.Schema({
    name: String,
    resultUpdate        : Date,
    racetypeUpdate        : Date,
    memberUpdate        : Date,
    createdAt: Date,
    updatedAt: Date
});

// methods ======================

// keep track of when users are updated and created
systeminfoSchema.pre('save', function(next, done) {
    if (this.isNew) {
        this.createdAt = Date.now();
        this.resultUpdate = Date.now();
        this.racetypeUpdate = Date.now();
        this.memberUpdate = Date.now();
    }
    this.updatedAt = Date.now();
    next();
});


// create the model for users and expose it to our app
module.exports = mongoose.model('SystemInfo', systeminfoSchema);