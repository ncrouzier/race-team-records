var mongoose = require('mongoose');
var bcrypt = require('bcrypt-nodejs');

// define the schema for our raceType model
var racetypeSchema = mongoose.Schema({
    name: String,
    surface: String,
    meters: Number,
    miles: Number,
    isVariable: Boolean,
    createdAt: Date,
    updatedAt: Date

});

// keep track of when racetypes are updated and created
racetypeSchema.pre('save', function(next, done) {
    if (this.isNew) {
        this.createdAt = Date.now();
    }
    this.updatedAt = Date.now();
    next();
});

// create the model for raceType and expose it to our app
module.exports = mongoose.model('Racetype', racetypeSchema);
