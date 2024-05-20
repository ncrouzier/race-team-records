var mongoose = require('mongoose');
var bcrypt = require('bcrypt-nodejs');
 const resultSchema = require('./result').schema

// define the schema for our user model
var memberSchema = mongoose.Schema({
    firstname: String,
    lastname: String,
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


    if (this.isNew) {
        this.createdAt = Date.now();
    }
    this.updatedAt = Date.now();
    next();
});



// create the model for users and expose it to our app
module.exports = mongoose.model('Member', memberSchema);
