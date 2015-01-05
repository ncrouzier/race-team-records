var mongoose = require('mongoose');
var bcrypt   = require('bcrypt-nodejs');

// define the schema for our user model
var memberSchema = mongoose.Schema({
    firstname		: String,
    lastname		: String,
	dateofbirth		: Date
});

// create the model for users and expose it to our app
module.exports = mongoose.model('Member', memberSchema);