var mongoose = require('mongoose');
var bcrypt = require('bcrypt-nodejs');
 const resultSchema = require('./result').schema
 const SystemInfo = require('./systeminfo');


// define the schema for our user model
var memberSchema = mongoose.Schema({
    firstname: String,
    lastname: String,
    username:  String ,
    alternateFullNames : [String],
    sex: String,
    dateofbirth: Date,
    bio: String,
    memberStatus: String,
    membershipDates: [{
        start: Date,
        end: Date
    }],
    pictureLink: String,
    personalBests: [{
        result: resultSchema,
        name: String,
        surface: String,
        distance: Number,
        time: Number,
        source: String
    }],
    teamRequirementStats:{
        year: Number,
        raceCount: Number,
        maxAgeGrade: mongoose.Schema.Types.Mixed
    },
    createdAt: Date,
    updatedAt: Date
});

// keep track of when members are updated and created
memberSchema.pre('save', function(next, done) {

    //set memberStatus
    this.memberStatus = 'past';
    var currentDate = Date.now();
    for (i = 0; i < this.membershipDates.length; i++) {
      if (this.membershipDates[i].end === undefined || (currentDate > this.membershipDates[i].start && currentDate < this.membershipDates[i].end)){
           this.memberStatus = 'current';
           break;
      }
    }

    // Set username if not defined
    // console.log(this.username + "--"); 
    if (!this.username || this.username.trim() === "") {
        this.username = ((this.firstname || "") + (this.lastname || ""))
            .toLowerCase()
            .normalize('NFD')  // Decompose accented characters
            .replace(/[\u0300-\u036f]/g, '')  // Remove diacritics (accents)
            .replace(/[^a-z]/g, '');  // Remove all non-letter characters
    }

    if (this.isNew) {
        this.createdAt =currentDate;
    }
    this.updatedAt = currentDate;
    memberSchema.methods.updateSystemInfo('mcrrc',currentDate);
    next();
});

memberSchema.methods.updateSystemInfo = function(name,date) {
    try{
        SystemInfo.findOne({
            name: name
        }).then(systemInfo =>{
            if (systemInfo) {
                systemInfo.memberUpdate = date;
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
module.exports = mongoose.model('Member', memberSchema);
