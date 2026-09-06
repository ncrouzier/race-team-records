const mongoose = require('mongoose');
const crypto = require('crypto');

const compRaceFormResponseSchema = new mongoose.Schema({
    form: { type: mongoose.Schema.Types.ObjectId, ref: 'CompRaceForm', index: true, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member' },
    recentResult: {
        _id: { type: mongoose.Schema.Types.ObjectId, required: false },
        time: Number,
        agegrade: Number,
        isManual: { type: Boolean, default: false },
        race: {
            _id: { type: mongoose.Schema.Types.ObjectId, required: false },
            racename: String,
            racedate: Date,
            racetype: { name: String, surface: String }
        }
    },
    projectedTimeCentiseconds: { type: Number },
    projectedAgeGrade: Number,
    comments: String,
    submittedAt: { type: Date, default: Date.now }
});

const compRaceFormSchema = new mongoose.Schema({
    uniqueId: {
        type: String,
        index: true,
        unique: true,
        default: () => crypto.randomBytes(6).toString('hex')
    },
    title: { type: String, required: true },
    description: String,
    race: {
        linkedRace: { type: mongoose.Schema.Types.ObjectId, ref: 'Race' },
        racename: String,
        racedate: Date,
        racetype: { _id: mongoose.Schema.Types.ObjectId, name: String, surface: String, meters: Number, miles: Number }
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    isOpen: { type: Boolean, default: true },
    closesAt: { type: Date, default: null },
    numComps: { type: Number, default: 0 },
    numDiscounts: { type: Number, default: 0 },
    splitCompsByGender: { type: Boolean, default: false },
    splitDiscountsByGender: { type: Boolean, default: false },
    numCompsMale: { type: Number, default: 0 },
    numCompsFemale: { type: Number, default: 0 },
    numDiscountsMale: { type: Number, default: 0 },
    numDiscountsFemale: { type: Number, default: 0 },
    bannerImageUrl: { type: String, default: null },
    resultsLookbackMonths: { type: Number, default: 6 }
}, { timestamps: true });

module.exports = {
    CompRaceForm: mongoose.model('CompRaceForm', compRaceFormSchema),
    CompRaceFormResponse: mongoose.model('CompRaceFormResponse', compRaceFormResponseSchema)
};
