var mongoose = require('mongoose');
var bcrypt = require('bcrypt-nodejs');

// define the schema for our raceType model
var raceTypeSchema = mongoose.Schema({
    name: String,
    surface: String,
    meters: Number,
    miles: Number,
    createdAt: Date,
    updatedAt: Date

});

// keep track of when racetypes are updated and created
raceTypeSchema.pre('save', function(next, done) {
    if (this.isNew) {
        this.createdAt = Date.now();
    }
    this.updatedAt = Date.now();
    next();
});

// create the model for raceType and expose it to our app
module.exports = mongoose.model('RaceType', raceTypeSchema);
