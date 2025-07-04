var mongoose = require('mongoose');
var bcrypt = require('bcrypt-nodejs');
 const resultSchema = require('./result').schema

// define the schema for our user model
var memberSchema = mongoose.Schema({
    firstname: String,
    lastname: String,
    username: { type: String },
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
    var currentDate = new Date();
    for (i = 0; i < this.membershipDates.length; i++) {
      if (this.membershipDates[i].end === undefined || (currentDate > this.membershipDates[i].start && currentDate < this.membershipDates[i].end)){
           this.memberStatus = 'current';
           break;
      }
    }

    // Set username if not defined
    if (!this.username || this.username.trim() === "") {
        this.username = ((this.firstname || "") + (this.lastname || "")).toLowerCase();
    }

    if (this.isNew) {
        this.createdAt = Date.now();
    }
    this.updatedAt = Date.now();
    next();
});

// Add a custom getter for username
memberSchema.path('username').get(function(value) {
    if (value && value.trim() !== "") {
        return value;
    }
    return ((this.firstname || "") + (this.lastname || "")).toLowerCase();
});

// Ensure virtuals and getters are included in output
memberSchema.set('toObject', { getters: true, virtuals: true });
memberSchema.set('toJSON', { getters: true, virtuals: true });

// create the model for users and expose it to our app
module.exports = mongoose.model('Member', memberSchema);
