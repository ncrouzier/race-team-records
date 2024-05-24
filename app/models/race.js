var mongoose = require('mongoose');
var bcrypt = require('bcrypt-nodejs');
const racetype = require('./racetype');
const racetypeSchema = require('./racetype').schema

var SystemInfo = require('./systeminfo');


// define the schema for our user model
var raceSchema = mongoose.Schema({
    racename: String,
    distanceName: String,
    racedate: Date,
    order: Number, //order in case multiple races on same day, 0 earliest increases as day goes on
    isMultisport: Boolean,
    racetype: racetypeSchema,
    location:{
      country: String,
      state: String
    },
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

//or deleted
raceSchema.post('deleteOne', function(doc, next) {
    var date = Date.now();
    if (this.isNew) {
        this.createdAt = date;
    }
    this.updatedAt = date;    
    raceSchema.methods.updateSystemInfo('mcrrc',date);
    next();
}); 


raceSchema.methods.updateSystemInfo = function(name,date) {
    try{
        SystemInfo.findOne({
            name: name
        }).then(systemInfo =>{
            if (systemInfo) {
                systemInfo.raceUpdate = date;
                systemInfo.save().then(err => {
                    if (!err) {
                        console.log("error fetching systemInfo", err);
                    }
                });
            }
    
        });
    }catch(SystemInfoFindOneErr){
        console.log("error fetching systemInfo")
    }
    
};



// create the model for users and expose it to our app
module.exports = mongoose.model('Race', raceSchema);
