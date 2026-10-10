var mongoose = require('mongoose');
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
    achievements:[{
        name:String,
        text:String,
        value: mongoose.Schema.Types.Mixed        
      }],
      customOptions:[{
        name:String,
        value: mongoose.Schema.Types.Mixed,
        text:String,
        width:String,
        height:String
      }],
    photoLinks:[{
        url: String,
        label: String
      }],
    createdAt: Date,
    updatedAt: Date
 
});

// keep track of when results are updated and created
raceSchema.pre('save', function() {
    var date = Date.now();
    if (this.isNew) {
        this.createdAt = date;
    }
    this.updatedAt = date;

    this.updateSystemInfo('mcrrc',date);
});

//or deleted
raceSchema.post('deleteOne', function(doc) {
    var date = Date.now();
    if (this.isNew) {
        this.createdAt = date;
    }
    this.updatedAt = date;    
    raceSchema.methods.updateSystemInfo('mcrrc',date);
}); 


// A deleted race must not leave volunteer jobs pointing at it. They keep
// their event name and date, and simply stop being linked to a race. Covers
// both race.deleteOne() and Race.deleteOne({ _id }), which is how the routes
// remove races (including the automatic removal of a race left with no
// results). Merging a race into another moves its jobs first, so by the time
// the old race is deleted there is nothing left to unlink.
raceSchema.pre('deleteOne', { document: true, query: true }, async function () {
    const id = this instanceof mongoose.Query ? (this.getFilter() || {})._id : this._id;
    if (!id) return;
    const VolunteerJob = mongoose.model('VolunteerJob');
    const res = await VolunteerJob.updateMany({ 'race._id': id }, { $unset: { race: 1 } });
    if (res.modifiedCount > 0) {
        VolunteerJob.prototype.updateSystemInfo('mcrrc', Date.now());
    }
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
                    } else {
                        // Update the backend cache after saving
                        // const service = require('../service');
                        // service.updateSystemInfoCache();
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
