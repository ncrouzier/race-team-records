// Correction requests: a member suggests fixes to one of their own results,
// and an admin applies them through the usual edit modals. Every rule lives
// here: who may send one, which fields are on offer, what changed (old → new),
// and how saving an edit closes the request.
//
// Shared: Node requires it (app/correctionRoutes.js), and the browser bundle
// (scripts/build-js.mjs) gets window.CorrectionRequests, so the member's form
// highlights exactly the changes the server will record.
/* global module */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.CorrectionRequests = factory();
}(this, function () {
    'use strict';

    // The longest text a member may send in any field, the note included
    var MAX_TEXT = 500;

    // The race type surfaces (RacetypeCtrl)
    var SURFACES = ['road', 'track', 'trail', 'ultra', 'other', 'multiple', 'pool', 'open water'];

    // Every field a member may suggest a value for, in the form's order.
    // number: compared as numbers (times in centiseconds, places)
    var FIELDS = [
        // Not the category: the site works it out from the runner's age
        { key: 'time', label: 'Time', number: true },
        { key: 'resultlink', label: 'Result link' },
        { key: 'comments', label: 'Comments' },
        { key: 'overallrank', label: 'Overall place', number: true },
        { key: 'overalltotal', label: 'Overall out of', number: true },
        { key: 'genderrank', label: 'Gender place', number: true },
        { key: 'gendertotal', label: 'Gender out of', number: true },
        { key: 'agerank', label: 'Age group place', number: true },
        { key: 'agetotal', label: 'Age group out of', number: true },
        // The race: shared by everyone who ran it
        { key: 'racename', label: 'Race name', raceWide: true },
        { key: 'racedate', label: 'Date', raceWide: true },
        { key: 'country', label: 'Country', raceWide: true },
        { key: 'state', label: 'State', raceWide: true },
        { key: 'distance', label: 'Distance', raceWide: true },
        { key: 'surface', label: 'Surface', raceWide: true }
    ];

    function orNull(value) {
        return value === undefined ? null : value;
    }

    // What two values are compared as: text trimmed, empty as nothing,
    // numbers as numbers
    function normal(value, isNumber) {
        if (value === undefined || value === null) return null;
        if (typeof value === 'string') {
            value = value.trim();
            if (value === '') return null;
        }
        if (isNumber) {
            // Places and centiseconds are whole numbers; a stored time with a
            // rounding artefact (720399.9999) is the 720400 the form shows
            var n = Number(value);
            return isNaN(n) ? value : Math.round(n);
        }
        return typeof value === 'string' ? value : String(value);
    }

    // A race date as the day it is stored for (UTC midnight)
    function day(date) {
        if (!date) return null;
        var d = new Date(date);
        return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
    }

    function formValues(result) {
        var race = result.race || {};
        var racetype = race.racetype || {};
        var ranking = result.ranking || {};
        var location = race.location || {};
        return {
            time: orNull(result.time),
            resultlink: orNull(result.resultlink),
            comments: orNull(result.comments),
            overallrank: orNull(ranking.overallrank),
            overalltotal: orNull(ranking.overalltotal),
            genderrank: orNull(ranking.genderrank),
            gendertotal: orNull(ranking.gendertotal),
            agerank: orNull(ranking.agerank),
            agetotal: orNull(ranking.agetotal),
            racename: orNull(race.racename),
            racedate: day(race.racedate),
            country: orNull(location.country),
            state: orNull(location.state),
            distance: orNull(racetype.isVariable && race.distanceName ? race.distanceName : racetype.name),
            surface: orNull(racetype.surface),
            legs: (result.legs || []).slice().sort(function (a, b) { return a.order - b.order; }).map(function (leg) {
                return {
                    order: leg.order,
                    legName: orNull(leg.legName),
                    legType: orNull(leg.legType),
                    isTransition: !!leg.isTransition,
                    distance: leg.isTransition ? null : orNull(leg.distanceName),
                    time: orNull(leg.time)
                };
            })
        };
    }

    function changesBetween(current, suggested) {
        var changes = [];
        FIELDS.forEach(function (field) {
            var from = normal(current[field.key], field.number);
            var to = normal(suggested[field.key], field.number);
            if (from !== to) {
                changes.push({ field: field.key, label: field.label, from: from, to: to, raceWide: !!field.raceWide });
            }
        });
        // Legs: the same legs, matched by order; only their distance and time
        (current.legs || []).forEach(function (leg) {
            var other = (suggested.legs || []).filter(function (l) { return l.order === leg.order; })[0];
            if (!other) return;
            var parts = [{ key: 'time', number: true, label: 'time' }];
            if (!leg.isTransition) parts.push({ key: 'distance', label: 'distance' });
            parts.forEach(function (part) {
                var from = normal(leg[part.key], part.number);
                var to = normal(other[part.key], part.number);
                if (from !== to) {
                    changes.push({
                        field: 'leg.' + part.key, label: leg.legName + ' ' + part.label,
                        from: from, to: to, raceWide: false, legOrder: leg.order
                    });
                }
            });
        });
        return changes;
    }

    // A change's key, for the form's highlights: 'time', or 'leg:0:time' for
    // a leg (legs are numbered from 0 when the result form saves them)
    function changeKey(change) {
        return change.legOrder !== undefined && change.legOrder !== null ?
            'leg:' + change.legOrder + ':' + change.field.replace('leg.', '') : change.field;
    }

    // Values with a request's suggestions put back on them (reopening a
    // pending request)
    function applyChanges(values, changes) {
        var result = JSON.parse(JSON.stringify(values));
        (changes || []).forEach(function (change) {
            if (change.legOrder !== undefined && change.legOrder !== null) {
                var leg = result.legs.filter(function (l) { return l.order === change.legOrder; })[0];
                if (leg) leg[change.field.replace('leg.', '')] = change.to;
            } else {
                result[change.field] = change.to;
            }
        });
        return result;
    }

    function capped(value) {
        return typeof value === 'string' ? value.slice(0, MAX_TEXT) : value;
    }

    // What the member sent (only what they changed) onto the result as stored:
    // a field they did not send keeps its stored value, even if an admin edited
    // it after their form opened. Unknown keys are ignored; legs merge by order,
    // distance and time only.
    function mergeSuggestion(current, partial) {
        var merged = JSON.parse(JSON.stringify(current));
        partial = partial || {};
        FIELDS.forEach(function (field) {
            if (Object.prototype.hasOwnProperty.call(partial, field.key)) merged[field.key] = capped(partial[field.key]);
        });
        if (Array.isArray(partial.legs)) {
            partial.legs.forEach(function (sent) {
                var leg = sent && merged.legs.filter(function (l) { return l.order === sent.order; })[0];
                if (!leg) return;
                if (Object.prototype.hasOwnProperty.call(sent, 'time')) leg.time = sent.time;
                if (!leg.isTransition && Object.prototype.hasOwnProperty.call(sent, 'distance')) leg.distance = capped(sent.distance);
            });
        }
        return merged;
    }

    // The part of the member's values to send: only the changes
    function changedValues(changes) {
        var values = {};
        (changes || []).forEach(function (change) {
            if (change.legOrder !== undefined && change.legOrder !== null) {
                values.legs = values.legs || [];
                var leg = values.legs.filter(function (l) { return l.order === change.legOrder; })[0];
                if (!leg) values.legs.push(leg = { order: change.legOrder });
                leg[change.field.replace('leg.', '')] = change.to;
            } else {
                values[change.field] = change.to;
            }
        });
        return values;
    }

    function pad(n) {
        return n < 10 ? '0' + n : String(n);
    }

    // Centiseconds as H:MM:SS or M:SS, with .cc only when there are any
    function formatTime(cs) {
        var h = Math.floor(cs / 360000);
        var m = Math.floor((cs % 360000) / 6000);
        var s = Math.floor((cs % 6000) / 100);
        var c = Math.round(cs % 100);
        var text = h ? h + ':' + pad(m) + ':' + pad(s) : m + ':' + pad(s);
        return c ? text + '.' + pad(c) : text;
    }

    function shown(change, value) {
        if (value === null || value === undefined || value === '') return '—';
        if ((change.field === 'time' || change.field === 'leg.time') && typeof value === 'number') return formatTime(value);
        return String(value);
    }

    // One side of a change ('from' or 'to'), as describeChange shows it
    function changeValue(change, side) {
        return shown(change, change[side]);
    }

    function describeChange(change) {
        return change.label + ': ' + shown(change, change.from) + ' → ' + shown(change, change.to);
    }

    function idOf(x) {
        return x && x._id !== undefined ? String(x._id) : (x ? String(x) : null);
    }

    // Who this user is to this result. openRequest: the result's open
    // request, if there is one.
    function requestRole(user, result, openRequest) {
        if (!user) return 'none';
        if (user.role === 'admin') return 'admin';
        var me = idOf(user.member);
        if (!me) return 'none';
        var ran = (result.members || []).some(function (m) { return idOf(m) === me; });
        if (!ran) return 'none';
        if (openRequest) {
            var sender = openRequest.sender && openRequest.sender.member;
            return idOf(sender) === me ? 'own-pending' : 'other-pending';
        }
        return 'can-send';
    }

    // Which edit modals a request needs: the result's, the race's, or both
    function editKinds(changes) {
        return {
            result: (changes || []).some(function (c) { return !c.raceWide; }),
            race: (changes || []).some(function (c) { return c.raceWide; })
        };
    }

    // Whether "keep this request open" starts ticked when the admin opens
    // the `kind` edit ('result' or 'race'): yes while the other edit the
    // request needs has not been saved yet, so the first save does not close it
    function keepOpenDefault(request, kind) {
        var kinds = editKinds(request.changes);
        var other = kind === 'race' ? 'result' : 'race';
        return kinds.result && kinds.race && (request.savedKinds || []).indexOf(other) === -1;
    }

    // What an admin saving an edit from this request does to it; null when it
    // was closed meanwhile (another admin, or the member withdrew)
    function afterSave(request, kind, keepOpen, adminUser, now) {
        if (request.status !== 'open') return null;
        var savedKinds = (request.savedKinds || []).slice();
        if (savedKinds.indexOf(kind) === -1) savedKinds.push(kind);
        if (keepOpen) return { savedKinds: savedKinds };
        return {
            savedKinds: savedKinds,
            status: 'handled',
            closedAt: now,
            closedBy: { _id: adminUser._id, username: adminUser.username }
        };
    }

    return {
        SURFACES: SURFACES,
        MAX_TEXT: MAX_TEXT,
        FIELDS: FIELDS,
        formValues: formValues,
        changesBetween: changesBetween,
        describeChange: describeChange,
        changeValue: changeValue,
        changeKey: changeKey,
        applyChanges: applyChanges,
        mergeSuggestion: mergeSuggestion,
        changedValues: changedValues,
        formatTime: formatTime,
        requestRole: requestRole,
        editKinds: editKinds,
        keepOpenDefault: keepOpenDefault,
        afterSave: afterSave
    };
}));
