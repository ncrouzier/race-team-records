var mongoose = require('mongoose');
var bcrypt   = require('bcrypt-nodejs');

// define the schema for our user model
var resultSchema = mongoose.Schema({
    racename		      : String,
    racetype		      : String,
  	date	            : Date,
    timeout           : Number, 
    member            : String,
  	member_category		: String,
    is_accepted       : Boolean
});

// keep track of when members are updated and created
resultSchema.pre('save', function(next, done){
  if (this.isNew) {
    this.createdAt = Date.now();
  }
  this.updatedAt = Date.now();
  next();
});

// create the model for users and expose it to our app
module.exports = mongoose.model('Result', resultSchema);