// server.js

// Load environment variables from .env file
require('dotenv').config();

if (!process.env.SESSION_SECRET) {
    console.error('FATAL: SESSION_SECRET environment variable is required');
    process.exit(1);
}

// set up ======================================================================
// get all the tools we need
var express = require('express');
const compression = require('compression');
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

const service = require('./app/service.js');
const schedule = require('node-schedule');

process.env.TZ = 'UTC';
app.use(favicon(__dirname + '/public/images/favicon.ico'));
if (process.env.DYNO) {
    app.use(sslRedirect());
}

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use(compression({
    threshold: 1024,
    level: 6
}));

// configuration ===============================================================

let mongourl;
if (process.env.MLAB_MONGODB_DB_URL) {
    mongourl = process.env.MLAB_MONGODB_DB_URL + 'mcrrcrecords';
    // mongoose.connect(process.env.MLAB_MONGODB_DB_URL + 'mcrrcrecords');
} else if (process.env.OPENSHIFT_MONGODB_DB_URL) {
    mongourl = process.env.OPENSHIFT_MONGODB_DB_URL + 'records';
    // mongoose.connect(process.env.OPENSHIFT_MONGODB_DB_URL + 'records');
} else {
    mongourl = process.env.MONGO_DEV_URL;
    // mongoose.connect('mongodb://127.0.0.1:27017/mcrrcrecords'); // connect to our database
}
//connect to mongodb
const clientP = mongoose.connect(mongourl).then(m => m.connection.getClient());

app.use(express.static(__dirname + '/public'));

require('./config/passport')(passport); // pass passport for configuration
var mail = require('./config/mail')(nodemailer);

// set up our express application
app.use(morgan('dev')); // log every request to the console
app.use(cookieParser(process.env.SESSION_SECRET)); // read cookies (needed for auth)
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json());

app.set('view engine', 'ejs'); // set up ejs for templating

// required for passport
app.use(session({
    cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000 // thirty day
    },
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: mongourl,
        stringify: false
    })
}));

app.use(passport.initialize());
app.use(passport.session({})); // persistent login sessions
app.use(flash()); // use connect-flash for flash messages stored in session

// Rate limiting for auth endpoints
const rateLimit = require('express-rate-limit');
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minute window
    max: 20,                   // limit each IP to 20 requests per window
    message: { error: 'Too many attempts, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});
app.post('/api/login', authLimiter);
app.post('/api/signup', authLimiter);
app.post('/api/forgot', authLimiter);
app.use('/api/reset', authLimiter);

// The team application form is public — cap submissions per IP
const applicationLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour window
    max: 5,
    message: { error: 'Too many applications submitted, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});
app.post('/api/team-applications', applicationLimiter);

// routes ======================================================================
require('./app/routes.js')(app, qs, passport, async, _); // load our routes and pass in our app and fully configured passport



// launch ======================================================================
// app.listen(port);
// app.listen(osport, osipaddress, function() {
//     console.log('The magic happens on port ' + port);
// });

//update at startup and every day
service.startUpUpdate();
const rule = new schedule.RecurrenceRule();
rule.hour = 0;
rule.minute = 1;
rule.tz = 'Etc/GMT+5';
const job = schedule.scheduleJob(rule, function () {
    console.log("team requirement stats updated");
    service.startUpUpdate();
});


// Close comp race forms whose closesAt deadline has passed
const { CompRaceForm } = require('./app/models/compraceform');
schedule.scheduleJob('* * * * *', async function () {
    try {
        const result = await CompRaceForm.updateMany(
            { isOpen: true, closesAt: { $lte: new Date() } },
            { $set: { isOpen: false } }
        );
        if (result.modifiedCount > 0) {
            console.log(`Auto-closed ${result.modifiedCount} comp race form(s) past their deadline`);
        }
    } catch (err) {
        console.error('Error auto-closing comp race forms:', err);
    }
});

var server = app.listen(port, function () {
    console.log('Node app is running on port', port);
});

