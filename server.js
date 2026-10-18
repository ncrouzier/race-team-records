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

// Errors in async route handlers answer that request with a 500 instead of
// stopping the server (app/asyncErrors.js). Before any route is registered.
require('./app/asyncErrors')(app);

// A promise chain a route does not return can still reject unhandled; Node
// would stop the server for it. One request failing must not take the site
// down for everyone: log it and carry on.
process.on('unhandledRejection', function (reason) {
    console.error('Unhandled promise rejection:', reason);
});
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

// On Heroku the dyno terminated TLS itself, so the app had to do the redirect.
// Behind Dokploy's Traefik the proxy does it, and DYNO is unset there, so this
// stays dormant. It is kept only so a Heroku rollback still redirects.
if (process.env.DYNO) {
    app.use(sslRedirect());
}

// Number of reverse proxies in front of the app. Must be 1 under Dokploy:
// without it every request appears to originate from Traefik, so the per-IP
// rate limits further down would pool all users into a single bucket and lock
// everyone out together. Left at 0 locally, where there is no proxy.
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || 0));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use(compression({
    threshold: 1024,
    level: 6
}));

// Liveness probe for the container healthcheck and for Traefik. Registered
// before the session middleware on purpose: a probe every 30s should not be
// minting session documents in Mongo. Reports 503 rather than 200 while the
// database connection is down, so a container that is up but cannot reach
// Mongo is not treated as healthy.
app.get('/api/health', function (req, res) {
    var connected = mongoose.connection.readyState === 1;
    res.status(connected ? 200 : 503).json({
        status: connected ? 'ok' : 'degraded',
        db: connected ? 'connected' : 'disconnected',
        uptime: Math.round(process.uptime()),
        // Lets a deploy be confirmed from the command line without loading the
        // site: curl -s .../api/health | jq .version
        version: process.env.APP_VERSION || 'dev',
        builtAt: process.env.BUILD_DATE || null
    });
});

// configuration ===============================================================

let mongourl;
if (process.env.MONGODB_URI) {
    // The standard name, and the one Dokploy hands out for its own database
    // services. Takes precedence over everything below it.
    mongourl = process.env.MONGODB_URI;
} else if (process.env.MLAB_MONGODB_DB_URL) {
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

// Team records are rebuilt per race type after each result change
// (service.updateAllTeamRecordAchievements): results by race type, in date
// order. Created here rather than on the schema, which members embed.
// Does nothing when it exists.
// The races: by name and date (finding a result's race when it is saved,
// app/raceMatch.js) and by location and date (its first race,
// service.updateAllLocationAchievements). Both on races only, for the same
// reason: results embed the race schema.
clientP.then(function () {
    const db = mongoose.connection;
    return Promise.all([
        db.collection('results').createIndex(
            { 'race.racetype._id': 1, 'race.racedate': 1, 'race.order': 1 },
            { name: 'racetype_date_order' }),
        db.collection('races').createIndex({ racename: 1, racedate: 1 }, { name: 'name_date' }),
        db.collection('races').createIndex(
            { 'location.country': 1, 'location.state': 1, racedate: 1, order: 1 },
            { name: 'location_date_order' })
    ]);
}).catch(function (err) {
    console.error('Could not create the race and result indexes:', err.message);
});

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

// Piggybacks the unseen-activity-log count onto every API response for a
// logged-in admin (as a header, not a body change) so the nav badge can stay
// live from whatever the admin is already doing — heartbeat, page loads,
// any API call — instead of needing its own dedicated poll.
//
// The three counts are remembered for a few seconds per admin: a page load
// makes many API calls, and each used to count again. Any write (or data
// change) forgets them, so a badge never lags behind what was just done.
const ADMIN_COUNTS_MS = 5000;
const adminCounts = new Map();     // user id → { at, activity, series, corrections }
service.onDataChange(function () { adminCounts.clear(); });
app.use(async function (req, res, next) {
    if (req.user && req.user.role === 'admin' && req.path.indexOf('/api/') === 0) {
        try {
            if (req.method !== 'GET') adminCounts.clear();
            const key = String(req.user._id);
            let counts = adminCounts.get(key);
            if (!counts || Date.now() - counts.at > ADMIN_COUNTS_MS) {
                const RaceSeries = require('./app/models/raceseries');
                // Members' correction requests waiting for an admin
                const CorrectionRequest = require('./app/models/correctionrequest');
                const found = await Promise.all([
                    service.getUnseenActivityLogCount(req.user),
                    RaceSeries.countDocuments({ 'races.status': 'suggested' }),
                    CorrectionRequest.countDocuments({ status: 'open' })
                ]);
                counts = { at: Date.now(), activity: found[0], series: found[1], corrections: found[2] };
                adminCounts.set(key, counts);
            }
            res.set('X-Unseen-Activity-Count', String(counts.activity));
            res.set('X-Pending-Series-Count', String(counts.series));
            res.set('X-Pending-Corrections-Count', String(counts.corrections));
        } catch (err) {
            console.error('Error setting unseen activity count header:', err);
        }
    }
    next();
});

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
app.use('/api/login/magic', authLimiter);

// The team application form is public — cap submissions per IP
const applicationLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour window
    max: 5,
    message: { error: 'Too many applications submitted, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});
app.post('/api/team-applications', applicationLimiter);

// The weather lookup is public and fans out to a third-party API, so cap it
// per IP. Generous enough for real use (the tool fetches once per click).
const weatherLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minute window
    max: 60,
    message: { error: 'Too many weather lookups, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});
app.get('/api/weather/current', weatherLimiter);

// routes ======================================================================
// Before routes.js, which ends with the catch-all that serves the app for any GET
require('./app/raceSeriesRoutes.js')(app);
require('./app/correctionRoutes.js')(app);
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

