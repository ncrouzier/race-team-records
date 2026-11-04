var mongoose = require('mongoose');
const bumpStamp = require('./stamp');
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
    // A small (160x160) JPEG cropped from pictureLink, generated server-side
    // by app/profileThumbnails.js and kept here rather than on disk — the
    // app container has no persistent volume, so anything written to the
    // filesystem at runtime is gone on the next deploy. `select: false` so
    // the ~5-15KB of image bytes never ride along on list/bio queries;
    // callers that need it ask for it explicitly (`.select('+profileThumb')`).
    profileThumb: {
        type: {
            data: Buffer,
            contentType: String,
            sourceHash: String, // sha1 of pictureLink when this was generated
            generatedAt: Date,
            error: String // set instead of data when the fetch/resize failed
        },
        select: false
    },
    // An admin's choice of which square of the photo makes the thumbnail,
    // instead of face detection. Fractions of the (upright) photo: left and
    // top of its width and height, size of its shorter side. Only applies to
    // the photo it was chosen on (sourceHash), so a new photo starts automatic.
    profileThumbCrop: {
        left: Number,
        top: Number,
        size: Number,
        sourceHash: String
    },
    achievements: [{
        name: String,
        text: String,
        value: mongoose.Schema.Types.Mixed
    }],
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
        maxAgeGrade: mongoose.Schema.Types.Mixed,
        volunteerJobCount: Number
    },
    createdAt: Date,
    updatedAt: Date
});

// keep track of when members are updated and created
memberSchema.pre('save', function() {

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
    // The race list embeds each runner's name, username, sex and date of
    // birth: only a change to one of those is a race-data change. Anything
    // else (bio, photo, dates, achievements, a new member) only changes
    // member lists, so it stamps memberProfileUpdate and leaves the race
    // list, and every browser's copy of it, alone.
    var raceDataChanged = !this.isNew && RACE_LIST_FIELDS.some(function (field) {
        return this.isModified(field);
    }, this);
    return raceDataChanged
        ? bumpStamp('memberUpdate', currentDate)
        : bumpStamp('memberProfileUpdate', currentDate, { quiet: true });
});

var RACE_LIST_FIELDS = ['firstname', 'lastname', 'username', 'sex', 'dateofbirth'];


// create the model for users and expose it to our app
module.exports = mongoose.model('Member', memberSchema);
