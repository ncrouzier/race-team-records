// Result submissions: a runner reports a race result on the public page
// (public/views/submitResult.html), and an admin turns it into a result with the usual
// "Add result" form, filled in from the submission.
//
// Shared: Node requires it (app/resultSubmissionRoutes.js), and the browser
// bundle (scripts/build-js.mjs) gets window.ResultSubmissions, so the admin's
// form is filled in by the same rules the tests check.
/* global module */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.ResultSubmissions = factory();
}(this, function () {
    'use strict';

    // The longest text accepted in a free-text field (remarks, highlight)
    var MAX_TEXT = 1000;
    // Names, distances, links
    var MAX_SHORT = 300;
    // The result form's earliest date (views/modals/resultModal.html)
    var EARLIEST_DATE = '2013-01-01';

    var PLACES = [
        { rank: 'overallrank', total: 'overalltotal', label: 'Overall' },
        { rank: 'genderrank', total: 'gendertotal', label: 'Gender' },
        { rank: 'agerank', total: 'agetotal', label: 'Age group' }
    ];

    // "32:10", "1:25:00", "4:52.31" → centiseconds; null when it isn't a time.
    // Minutes and seconds past 59 are refused rather than read as something else.
    function parseTime(str) {
        var m = /^\s*(?:(\d{1,3}):)?(\d{1,3}):(\d{1,2})(?:\.(\d{1,2}))?\s*$/.exec(String(str || ''));
        if (!m) return null;
        var hours = m[1] === undefined ? 0 : Number(m[1]);
        var minutes = Number(m[2]);
        var seconds = Number(m[3]);
        if (seconds > 59 || (m[1] !== undefined && minutes > 59)) return null;
        // ".3" is three tenths, not three hundredths
        var hundredths = m[4] === undefined ? 0 : Number(m[4].length === 1 ? m[4] + '0' : m[4]);
        var cs = ((hours * 60 + minutes) * 60 + seconds) * 100 + hundredths;
        return cs > 0 ? cs : null;
    }

    function pad(n) {
        return n < 10 ? '0' + n : String(n);
    }

    // Centiseconds → "1:25:00", "32:10", "4:52.31"
    function formatTime(cs) {
        if (cs === null || cs === undefined || isNaN(cs)) return '';
        var hours = Math.floor(cs / 360000);
        var minutes = Math.floor((cs % 360000) / 6000);
        var seconds = Math.floor((cs % 6000) / 100);
        var hundredths = Math.round(cs % 100);
        var text = (hours ? hours + ':' + pad(minutes) : String(minutes)) + ':' + pad(seconds);
        return hundredths ? text + '.' + pad(hundredths) : text;
    }

    // Stopwatch-style typing on a phone keypad, which has no colon: the digits
    // fill in from the seconds up, so 3210 reads 32:10 and 12500 reads 1:25:00.
    // Anything after a dot is the hundredths (track times).
    function formatTimeDigits(value) {
        var text = String(value || '');
        var dot = text.indexOf('.');
        var whole = (dot === -1 ? text : text.slice(0, dot)).replace(/\D/g, '').slice(0, 6);
        var fraction = dot === -1 ? null : text.slice(dot + 1).replace(/\D/g, '').slice(0, 2);
        var formatted = whole;
        if (whole.length > 2) {
            var seconds = whole.slice(-2);
            var minutes = whole.slice(-4, -2);
            var hours = whole.slice(0, -4);
            formatted = (hours ? hours + ':' + (minutes.length < 2 ? '0' + minutes : minutes) : minutes) + ':' + seconds;
        }
        return fraction === null ? formatted : formatted + '.' + fraction;
    }

    // Runners paste "coolrunning.com/results/123" as often as full URLs. Accept
    // both, but only ever keep http(s): the admin page renders it as a link.
    function normalizeLink(value) {
        var raw = String(value || '').trim();
        if (!raw) return { ok: true, url: '' };
        var candidate = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : 'https://' + raw;
        var parsed;
        try {
            parsed = new URL(candidate);
        } catch (err) {
            return { ok: false };
        }
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return { ok: false };
        if (!parsed.hostname || parsed.hostname.indexOf('.') === -1) return { ok: false };
        return { ok: true, url: parsed.href };
    }

    function text(value, max) {
        return String(value === null || value === undefined ? '' : value).trim().slice(0, max);
    }

    // A place: a whole number from 1, or nothing
    function place(value) {
        if (value === null || value === undefined || String(value).trim() === '') return { ok: true, value: null };
        var n = Number(String(value).trim());
        if (!Number.isInteger(n) || n < 1) return { ok: false };
        return { ok: true, value: n };
    }

    // 'YYYY-MM-DD' (as typed) → that day at UTC midnight, how race dates are stored
    function parseDay(value) {
        var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
        if (!m) return null;
        var date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
        return date.getUTCDate() === Number(m[3]) ? date : null;
    }

    // The submitted form → the values to store, or the first problem found:
    // { error, field }. The member and race type ids are checked against the
    // database by the route; the codes against the lists given.
    // options: { today: 'YYYY-MM-DD' (the runner's own day, so a race run this
    // evening west of here is not "in the future"), countries, states }
    function clean(body, options) {
        body = body || {};
        options = options || {};
        function fail(field, error) { return { field: field, error: error }; }

        var values = {};

        var memberId = text(body.memberId, 50);
        var runnerName = text(body.runnerName, MAX_SHORT);
        if (memberId) values.memberId = memberId;
        else if (runnerName) values.runnerName = runnerName;
        else return fail('runner', 'Please pick your name, or type it if you are not on the list.');

        values.racename = text(body.racename, MAX_SHORT);
        if (!values.racename) return fail('racename', 'Please enter the race name.');
        // Picked from the races on the site: the route checks it exists
        var raceId = text(body.raceId, 50);
        if (raceId) values.raceId = raceId;

        values.racedate = parseDay(body.racedate);
        if (!values.racedate) return fail('racedate', 'Please enter the race date.');
        var latest = parseDay(options.today) || new Date();
        // A day of slack for the runner's time zone
        if (values.racedate.getTime() > latest.getTime() + 86400000) return fail('racedate', 'The race date can\'t be in the future.');
        if (values.racedate < parseDay(EARLIEST_DATE)) return fail('racedate', 'Results go back to 2013 on this site.');

        var country = text(body.country, 10).toUpperCase();
        if (!country || (options.countries && options.countries.indexOf(country) === -1)) {
            return fail('country', 'Please pick the country the race was in.');
        }
        values.location = { country: country, state: null };
        if (country === 'USA') {
            var state = text(body.state, 10).toUpperCase();
            if (!state || (options.states && options.states.indexOf(state) === -1)) {
                return fail('state', 'Please pick the state the race was in.');
            }
            values.location.state = state;
        }

        var racetypeId = text(body.racetypeId, 50);
        var distanceText = text(body.distanceText, MAX_SHORT);
        if (racetypeId && racetypeId !== 'other') values.racetypeId = racetypeId;
        else if (distanceText) values.distanceText = distanceText;
        else return fail('distance', racetypeId === 'other' ? 'Please describe the distance.' : 'Please pick the distance.');

        values.time = parseTime(body.time);
        if (!values.time) return fail('time', 'Please enter your finish time, e.g. 32:10 or 1:25:00 (minutes and seconds under 60).');
        values.splits = text(body.splits, MAX_SHORT) || null;

        values.ranking = {};
        for (var i = 0; i < PLACES.length; i++) {
            var p = PLACES[i];
            var rank = place(body[p.rank]);
            var total = place(body[p.total]);
            if (!rank.ok || !total.ok) return fail(p.rank, p.label + ' place: whole numbers only.');
            if (rank.value !== null && total.value !== null && rank.value > total.value) {
                return fail(p.rank, p.label + ' place: your place can\'t be more than the number of finishers.');
            }
            if (rank.value !== null) values.ranking[p.rank] = rank.value;
            if (total.value !== null) values.ranking[p.total] = total.value;
        }

        values.noResultLink = body.noResultLink === true;
        if (values.noResultLink) {
            values.resultlink = null;
        } else {
            var link = normalizeLink(body.resultlink);
            if (!link.ok) return fail('resultlink', 'The results link doesn\'t look like a web address.');
            if (!link.url) return fail('resultlink', 'Please paste the link to the official results, or tick "No results online".');
            values.resultlink = link.url;
        }

        var photo = normalizeLink(body.photoLink);
        if (!photo.ok) return fail('photoLink', 'The photo gallery link doesn\'t look like a web address.');
        values.photoLink = photo.url || null;

        values.highlight = text(body.highlight, MAX_TEXT) || null;
        values.comments = text(body.comments, MAX_TEXT) || null;

        return { values: values };
    }

    // The "Add result" form's starting values for a submission. Given an
    // existing race (a teammate's result is already in), the race details come
    // from it, so the new result joins that race instead of making a near copy.
    // racetype is the stored snapshot: the form swaps in its own list's entry.
    function formValues(submission, race) {
        var s = submission;
        var time = s.time || 0;
        var values = {
            race: race ? {
                racename: race.racename,
                racedate: new Date(race.racedate),
                order: race.order,
                isMultisport: !!race.isMultisport,
                distanceName: race.distanceName,
                location: { country: race.location && race.location.country, state: race.location && race.location.state },
                racetype: race.racetype || null
            } : {
                racename: s.racename,
                racedate: new Date(s.racedate),
                isMultisport: false,
                // "Other": the runner's words, for a variable race type's display name
                distanceName: s.racetype && s.racetype.name ? undefined : s.distanceText,
                location: { country: s.location && s.location.country, state: s.location && s.location.state },
                racetype: s.racetype && s.racetype._id ? s.racetype : null
            },
            time: {
                hours: Math.floor(time / 360000),
                minutes: Math.floor((time % 360000) / 6000),
                seconds: Math.floor((time % 6000) / 100),
                centiseconds: Math.round(time % 100)
            },
            ranking: {},
            resultlink: s.resultlink || undefined,
            comments: s.comments || undefined
        };
        var r = s.ranking || {};
        PLACES.forEach(function (p) {
            if (r[p.rank]) values.ranking[p.rank] = r[p.rank];
            if (r[p.total]) values.ranking[p.total] = r[p.total];
        });
        return values;
    }

    function runnerName(submission) {
        if (submission.member && submission.member._id) {
            return ((submission.member.firstname || '') + ' ' + (submission.member.lastname || '')).trim();
        }
        return submission.runnerName || '';
    }

    function distanceLabel(submission) {
        if (submission.racetype && submission.racetype.name) {
            return submission.racetype.name + (submission.racetype.surface ? ' (' + submission.racetype.surface + ')' : '');
        }
        return submission.distanceText || '';
    }

    // "3 / 125", "3", "of 125", or '' for one place on the admin page
    function placeText(ranking, which) {
        var p = PLACES.filter(function (x) { return x.rank === which; })[0];
        if (!p || !ranking) return '';
        var rank = ranking[p.rank];
        var total = ranking[p.total];
        if (rank && total) return rank + ' / ' + total;
        if (rank) return String(rank);
        if (total) return 'of ' + total;
        return '';
    }

    return {
        MAX_TEXT: MAX_TEXT,
        MAX_SHORT: MAX_SHORT,
        EARLIEST_DATE: EARLIEST_DATE,
        PLACES: PLACES,
        parseTime: parseTime,
        formatTime: formatTime,
        formatTimeDigits: formatTimeDigits,
        normalizeLink: normalizeLink,
        parseDay: parseDay,
        clean: clean,
        formValues: formValues,
        runnerName: runnerName,
        distanceLabel: distanceLabel,
        placeText: placeText
    };
}));
