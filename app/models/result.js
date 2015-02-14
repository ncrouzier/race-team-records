var mongoose = require('mongoose');
var bcrypt = require('bcrypt-nodejs');


memberSchema = require('./member');

// define the schema for our user model
var resultSchema = mongoose.Schema({
    racename: String,
    racetype: {
        _id: mongoose.Schema.ObjectId,
        name: String,
        surface: String,
        meters: Number,
        miles: Number
    },
    racedate: Date,
    time: Number,
    members: [{
        _id: mongoose.Schema.ObjectId,
        firstname: String,
        lastname: String,
        sex: String,
        dateofbirth: Date
    }],
    category: String,
    comments: String,
    resultlink: String,
    is_accepted: Boolean,
    createdAt: Date,
    updatedAt: Date

});

// keep track of when results are updated and created
resultSchema.pre('save', function(next, done) {
    if (this.isNew) {
        this.createdAt = Date.now();
    }
    this.updatedAt = Date.now();

    this.updateCategory();
    next();
});

resultSchema.methods.updateCategory = function() {
    var membersLength = this.members.length;
    var isOpen = false;
    for (var i = 0; i < membersLength; i++) {
        if (getAddDateToDate(this.racedate,-40,0,0) < this.members[i].dateofbirth){
            isOpen = true;
            break;
        }
    }
    if (isOpen){
        this.category = "Open";
    }else{
        this.category = "Master";
    }
};

function getAddDateToDate(date, years, months, days) {
    var resDate = new Date(date);
    resDate.setFullYear(resDate.getFullYear() + years, resDate.getMonth() + months, resDate.getDay() + days);
    return resDate;
}


// create the model for users and expose it to our app
module.exports = mongoose.model('Result', resultSchema);
