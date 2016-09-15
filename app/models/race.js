var mongoose = require('mongoose');
var bcrypt = require('bcrypt-nodejs');


var SystemInfo = require('./systeminfo');



// define the schema for our user model
var raceSchema = mongoose.Schema({
    racename: String,
    distanceName: String,
    racetype: {
        _id: mongoose.Schema.ObjectId,
        name: String,
        surface: String,
        meters: Number,
        miles: Number,
        isVariable: Boolean
    },
    racedate: Date,
    createdAt: Date,
    updatedAt: Date

});

// keep track of when results are updated and created
raceSchema.pre('save', function(next, done) {
    var date = Date.now();
    if (this.isNew) {
        this.createdAt = date;
    }
    this.updatedAt = date;

    this.updateSystemInfo('mcrrc',date);
    next();
});


raceSchema.methods.updateSystemInfo = function(name,date) {
    SystemInfo.findOne({
        name: name
    }, function(err, systemInfo) {
        if (err)
            console.log("error fetching systemInfo")
        if (systemInfo) {           
            systemInfo.raceUpdate = date;
            systemInfo.save(function(err) {
                if (err) {
                    res.send(err);
                }
            });
        }

    });
};



// create the model for users and expose it to our app
module.exports = mongoose.model('Race', raceSchema);
