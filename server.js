// server.js

// set up ======================================================================
// get all the tools we need
var express = require('express');
const sslRedirect = require('heroku-ssl-redirect').default
var app = express();
var osipaddress = process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1';
var osport = process.env.OPENSHIFT_NODEJS_PORT || 8080;


var port = process.env.PORT || 8090;
var session = require('express-session');
const MongoStore = require('connect-mongo');
var mongoose = require('mongoose');
var passport = require('passport');
var flash = require('connect-flash');

var morgan = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var bson = require('bson');
var crypto = require('crypto');
var async = require('async');

var nodemailer = require("nodemailer");
var favicon = require('serve-favicon');

var _ = require('underscore');

var qs = require('querystring');

process.env.TZ = 'UTC';
app.use(favicon(__dirname + '/public/images/favicon.ico'));
app.use(sslRedirect());

// configuration ===============================================================

let mongourl;
if (process.env.MLAB_MONGODB_DB_URL) {
    mongourl = process.env.MLAB_MONGODB_DB_URL + 'mcrrcrecords';
	// mongoose.connect(process.env.MLAB_MONGODB_DB_URL + 'mcrrcrecords');
} else if (process.env.OPENSHIFT_MONGODB_DB_URL) {
    mongourl = process.env.OPENSHIFT_MONGODB_DB_URL + 'records';
    // mongoose.connect(process.env.OPENSHIFT_MONGODB_DB_URL + 'records');
} else {
    mongourl = 'mongodb://127.0.0.1:27017/mcrrcrecords';
    // mongoose.connect('mongodb://127.0.0.1:27017/mcrrcrecords'); // connect to our database
}
//connect to mongodb
const clientP = mongoose.connect(mongourl).then(m => m.connection.getClient());

app.use(express.static(__dirname + '/public'));

require('./config/passport')(passport); // pass passport for configuration
var mail = require('./config/mail')(nodemailer);

// set up our express application
app.use(morgan('dev')); // log every request to the console
app.use(cookieParser("cheatshoes")); // read cookies (needed for auth)
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json());

app.set('view engine', 'ejs'); // set up ejs for templating

// required for passport
app.use(session({
    cookie: {
        maxAge:  1* 24 * 60 * 60 * 1000 // one day
    },
    secret: "cheatshoes",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl :  mongourl,
        stringify: false        
      })
}));

app.use(passport.initialize());
app.use(passport.session({})); // persistent login sessions
app.use(flash()); // use connect-flash for flash messages stored in session

// routes ======================================================================
require('./app/routes.js')(app, qs, passport, async, _); // load our routes and pass in our app and fully configured passport

// launch ======================================================================
// app.listen(port);
// app.listen(osport, osipaddress, function() {
//     console.log('The magic happens on port ' + port);
// });
var server = app.listen(port, function() {
  console.log('Node app is running on port', port);
});
server.timeout = 60000;
