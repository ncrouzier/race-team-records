// server.js

// set up ======================================================================
// get all the tools we need
var express = require('express');
var app = express();
var osipaddress = process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1';
var osport = process.env.OPENSHIFT_NODEJS_PORT || 8080;

var port = process.env.PORT || 8080;
var mongoose = require('mongoose');
var passport = require('passport');
var flash = require('connect-flash');

var morgan = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var session = require('express-session');
var bson = require('bson');
var crypto = require('crypto');
var async = require('async');

var nodemailer = require("nodemailer");
var favicon = require('serve-favicon');

var _ = require('underscore');

var qs = require('querystring');

process.env.TZ = 'UTC';
app.use(favicon(__dirname + '/public/images/favicon.ico'));

// configuration ===============================================================
// mongoose.connect(configDB.url); // connect to our database
if (process.env.MLAB_MONGODB_DB_URL) {
	mongoose.connect(process.env.MLAB_MONGODB_DB_URL + 'mcrrcrecords');
} else if (process.env.OPENSHIFT_MONGODB_DB_URL) {
    mongoose.connect(process.env.OPENSHIFT_MONGODB_DB_URL + 'records');
} else {
	// mongoose.connect(process.env.MLAB_MONGODB_URL);
    mongoose.connect('mongodb://127.0.0.1:27017/records'); // connect to our database
}


app.use(express.static(__dirname + '/public'));

require('./config/passport')(passport); // pass passport for configuration
var mail = require('./config/mail')(nodemailer);

// set up our express application
app.use(morgan('dev')); // log every request to the console
app.use(cookieParser()); // read cookies (needed for auth)
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json());

app.set('view engine', 'ejs'); // set up ejs for templating

// required for passport
app.use(session({
    secret: crypto.randomBytes(20).toString('hex')
})); // session secret
app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions
app.use(flash()); // use connect-flash for flash messages stored in session

// routes ======================================================================
require('./app/routes.js')(app, qs, passport, async, _); // load our routes and pass in our app and fully configured passport

// launch ======================================================================
// app.listen(port);
app.listen(osport, osipaddress, function() {
    console.log('The magic happens on port ' + port);
});