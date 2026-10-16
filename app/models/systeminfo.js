var mongoose = require('mongoose');

// define the schema for our user model
var systeminfoSchema = mongoose.Schema({
    name: String,
    resultUpdate        : Date,
    raceUpdate        : Date,
    racetypeUpdate        : Date,
    memberUpdate        : Date,
    volunteerJobUpdate  : Date,
    // Race series links (app/models/raceseries.js). Kept out of the "overall"
    // update, so a series change does not make browsers fetch the whole race
    // list again: the series index has a cache of its own.
    seriesUpdate        : Date,
    createdAt: Date,
    updatedAt: Date
});

// methods ======================

// keep track of when users are updated and created
systeminfoSchema.pre('save', function() {
    if (this.isNew) {
        this.createdAt = Date.now();
        this.resultUpdate = Date.now();
        this.race = Date.now();
        this.racetypeUpdate = Date.now();
        this.memberUpdate = Date.now();
        this.volunteerJobUpdate = Date.now();
    }
    this.updatedAt = Date.now();
});


// create the model for users and expose it to our app
module.exports = mongoose.model('SystemInfo', systeminfoSchema);