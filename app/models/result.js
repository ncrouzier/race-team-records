var mongoose = require('mongoose');
var bcrypt = require('bcrypt-nodejs');


var SystemInfo = require('./systeminfo');



// define the schema for our user model
var resultSchema = mongoose.Schema({
    // racename: String,
    // racetype: {
    //     _id: mongoose.Schema.ObjectId,
    //     name: String,
    //     surface: String,
    //     meters: Number,
    //     miles: Number,
    //     isVariable: Boolean
    // },
    // racedate: Date,
    time: Number,
    ranking: {
        agerank: Number,
        agetotal: Number,
        genderrank: Number,
        gendertotal: Number,
        overallrank: Number,
        overalltotal: Number
    },
    members: [{
        _id: mongoose.Schema.ObjectId,
        firstname: String,
        lastname: String,
        sex: String,
        dateofbirth: Date
    }],
    race:{
        _id: mongoose.Schema.ObjectId,
        racename: String,
        racetype: {
            _id: mongoose.Schema.ObjectId,
            name: String,
            surface: String,
            meters: Number,
            miles: Number,
            isVariable: Boolean
        },
        racedate: Date
    },
    category: String,
    comments: String,
    resultlink: String,
    agegrade: Number,
    is_accepted: Boolean,
    createdAt: Date,
    updatedAt: Date

});


// keep track of when results are updated and created
resultSchema.pre('save', function(next, done) {
    var date = Date.now();
    if (this.isNew) {
        this.createdAt = date;
    }
    this.updatedAt = date;

    this.updateCategory();
    this.updateSystemInfo('mcrrc',date);
    next();
});

resultSchema.methods.updateCategory = function() {
    var membersLength = this.members.length;
    var isOpen = false;
    for (var i = 0; i < membersLength; i++) {
        if (getAddDateToDate(this.race.racedate, -40, 0, 0) < this.members[i].dateofbirth) {
            isOpen = true;
            break;
        }
    }
    if (isOpen) {
        this.category = "Open";
    } else {
        this.category = "Master";
    }
};

resultSchema.methods.updateSystemInfo = function(name,date) {
    SystemInfo.findOne({
        name: name
    }, function(err, systemInfo) {
        if (err)
            console.log("error fetching systemInfo")
        if (systemInfo) {           
            systemInfo.resultUpdate = date;
            systemInfo.save(function(err) {
                if (err) {
                    res.send(err);
                }
            });
        }

    });
};


function getAddDateToDate(date, years, months, days) {
    var resDate = new Date(date);
    resDate.setFullYear(resDate.getFullYear() + years, resDate.getMonth() + months, resDate.getDay() + days);
    return resDate;
}


// create the model for users and expose it to our app
module.exports = mongoose.model('Result', resultSchema);
