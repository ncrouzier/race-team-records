var mongoose = require('mongoose');
var bcrypt = require('bcrypt-nodejs');

// define the schema for our user model
var agegradingSchema = mongoose.Schema({
    type: String,
    sex: String,
    age: Number,
    '1500m': Number,
    '1 mile': Number,
    '2000m': Number,
    '3000m': Number,
    '2 miles': Number,
    '4000m': Number,
    '3 miles': Number,
    '5000m': Number,
    '6000m': Number,
    '4 miles': Number,
    '8000m': Number,
    '5 miles': Number,
    '10000m': Number,
    '5k': Number,
    '5k': Number,
    '6k': Number,
    '8k': Number,
    '10k': Number,
    '12k': Number,
    '15k': Number,
    '10 miles': Number,
    '20k': Number,
    'half marathon': Number,
    '25k': Number,
    '30k': Number,
    'marathon': Number,
    '50k': Number,
    '50 miles': Number,
    '100k': Number,
    '150k': Number,
    '100 miles': Number,
    '200k': Number,
    createdAt: Date,
    updatedAt: Date
});

// keep track of when members are updated and created
agegradingSchema.pre('save', function(next, done) {
    if (this.isNew) {
        this.createdAt = Date.now();
    }
    this.updatedAt = Date.now();
    next();
});



// create the model for users and expose it to our app
module.exports = mongoose.model('agegrading', agegradingSchema);
