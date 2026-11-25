/* MCRRC result extractor: a race's results, to the clipboard.

   Run as a bookmark on a race's results page, on:
   - athlinks.com (an address with /Event/<number>/Course/<number>/): asks
     Athlinks' results feed for every runner, 100 at a time, as the page
     itself does (app/athlinks.js reads the copy);
   - RunSignUp's system, on runsignup.com or a race's own domain
     (turkeychase.com/Race/Results/97804): asks that site's results feed for
     the result set the page shows, 2,500 runners at a time
     (app/runsignup.js reads the copy);
   - any other page (mcrrc.org's results, a timer's site, parkrun): the
     page's source with its address, as "view source" and paste would give,
     in one click (app/resultTableParser.js reads the copy).
   It then copies them for the result extractor's paste box. Nothing is sent
   anywhere but the site the page is on.

   The extractor page makes the bookmark from this file. Block comments only:
   it runs as one javascript: address. */
(function () {
    var box = document.getElementById('mcrrc-results') || document.createElement('div');
    box.id = 'mcrrc-results';
    box.setAttribute('style', 'position:fixed;top:16px;right:16px;z-index:2147483647;max-width:340px;' +
        'background:#fff;color:#222;border:2px solid #1b5e9e;border-radius:8px;padding:12px 14px;' +
        'font:14px/1.4 -apple-system,Segoe UI,Roboto,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.25)');

    function say(message) {
        if (!box.parentNode) document.body.appendChild(box);
        box.textContent = '';
        var title = document.createElement('strong');
        title.textContent = 'MCRRC results';
        box.appendChild(title);
        var line = document.createElement('div');
        line.textContent = message;
        box.appendChild(line);
    }

    function closeButton() {
        var close = document.createElement('button');
        close.textContent = 'Close';
        close.setAttribute('style', 'margin-top:8px');
        close.onclick = function () { box.remove(); };
        box.appendChild(close);
    }

    function fail(message) {
        say(message);
        closeButton();
    }

    function getJson(url) {
        return fetch(url, { headers: { Accept: 'application/json' } }).then(function (response) {
            if (!response.ok) throw new Error('the site answered HTTP ' + response.status);
            return response.json();
        });
    }

    /* The clipboard may refuse once the click is a few seconds old: then a
       button, whose own click lets the copy through */
    function copy(payload, what) {
        var text = JSON.stringify(payload);
        var copied = function () {
            say(what + ' copied. Paste into the result extractor\'s "Page source code" box.');
            closeButton();
        };
        var manual = function () {
            say(what + ' ready.');
            var button = document.createElement('button');
            button.textContent = 'Copy them';
            button.setAttribute('style', 'margin-top:8px;margin-right:8px');
            button.onclick = function () {
                navigator.clipboard.writeText(text).then(copied, function () {
                    var area = document.createElement('textarea');
                    area.value = text;
                    document.body.appendChild(area);
                    area.select();
                    document.execCommand('copy');
                    area.remove();
                    copied();
                });
            };
            box.appendChild(button);
            closeButton();
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(copied, manual);
        } else {
            manual();
        }
    }

    /* ---- Athlinks ---- */
    function athlinks(ids) {
        var PER_PAGE = 100;
        var MAX_PAGES = 300;
        var feed = 'https://reignite-api.athlinks.com/event/' + ids[1] + '/race/' + ids[2] + '/results';
        var payload = { mcrrcAthlinks: 1, url: location.href, eventId: ids[1], raceId: ids[2], results: [] };

        function runner(result) {
            var ranks = result.rankings || {};
            return {
                name: result.displayName,
                gender: result.gender,
                age: result.age,
                bib: result.bib,
                chipTime: result.chipTimeInMillis,
                start: result.startTimeInMillis,
                overall: ranks.overall,
                genderPlace: ranks.gender,
                divisionPlace: ranks.primary
            };
        }

        function done() {
            copy(payload, payload.results.length + ' runners of ' + (payload.raceName || 'this race'));
        }

        function page(number) {
            if (number >= MAX_PAGES) return done();
            var from = payload.results.length;
            say('Fetching runners ' + (from + 1) + '–' + (from + PER_PAGE) +
                (payload.total ? ' of ' + payload.total : '') + '…');
            return getJson(feed + '?from=' + from + '&limit=' + PER_PAGE).then(function (body) {
                var interval = body && body.intervals && body.intervals[0];
                if (number === 0) {
                    payload.raceName = body && body.race && body.race.name;
                    payload.total = body && body.division && body.division.totalAthletes;
                    payload.distance = interval && interval.distance;
                }
                var results = (interval && interval.results) || [];
                if (number === 0 && !results.length) {
                    return fail('Athlinks sent no results for this race. Is it the results page of one course?');
                }
                results.forEach(function (result) { payload.results.push(runner(result)); });
                if (!results.length || (payload.total && payload.results.length >= payload.total)) return done();
                return page(number + 1);
            });
        }

        return page(0);
    }

    /* ---- RunSignUp's system ---- */

    /* The result set the page shows: in the address (#resultSetId-123 or
       ?resultSetId=123, the last one), else picked in the page's list, else
       the newest year's only real one (virtual runs left out) */
    function resultSetId() {
        var named = (location.search + location.hash).match(/resultSetId[-=]\d+/gi);
        if (named) return named[named.length - 1].replace(/^\D+/, '');
        var select = document.getElementById('resultsSelect');
        if (!select) return null;
        if (/^\d+$/.test(select.value || '')) return select.value;
        var sets = [];
        Array.prototype.forEach.call(select.options || [], function (option) {
            if (/^\d+$/.test(option.value || '')) {
                sets.push({ id: option.value, year: parseInt(option.getAttribute('data-year'), 10) || 0, name: option.textContent || '' });
            }
        });
        var newest = Math.max.apply(null, sets.map(function (s) { return s.year; }).concat([0]));
        var real = sets.filter(function (s) { return s.year === newest && !/virtual/i.test(s.name); });
        return real.length === 1 ? real[0].id : null;
    }

    function runsignup(raceId) {
        var PER_PAGE = 2500;
        var MAX_PAGES = 20;
        var setId = resultSetId();
        if (!setId) {
            return fail('Pick the result set on the page first (the race has several), then click the bookmark again.');
        }
        var feed = location.origin + '/Race/Results/' + raceId + '/?format=json&resultSetId=' + setId + '&num=' + PER_PAGE + '&search=&page=';
        var payload = {
            mcrrcRunSignUp: 1, url: location.href, raceId: raceId, resultSetId: setId,
            pageTitle: (document.title || '').replace(/\s*results\s*$/i, '').trim(), results: []
        };

        function done() {
            copy(payload, payload.results.length + ' runners of ' + (payload.pageTitle || 'this race'));
        }

        function page(number) {
            if (number > MAX_PAGES) return done();
            say('Fetching runners ' + (payload.results.length + 1) + '…' + (payload.numResults ? ' of ' + payload.numResults : ''));
            return getJson(feed + number).then(function (body) {
                var set = body && body.resultSet;
                var results = (set && set.results) || [];
                if (number === 1) {
                    if (!set || !body.headings) return fail('This page\'s site sent no results for result set ' + setId + '.');
                    payload.headings = body.headings;
                    payload.numResults = set.numResults;
                    payload.eventId = set.setInfo && set.setInfo.race_category_id;
                    payload.setName = set.setInfo && set.setInfo.individual_result_set_name;
                }
                Array.prototype.push.apply(payload.results, results);
                if (!results.length || payload.results.length >= (payload.numResults || 0)) return done();
                return page(number + 1);
            });
        }

        return page(1);
    }

    /* ---- Any other page ---- */

    /* The page as the site sends it, asked again from here (the browser's
       own visit, so a site that refuses our server lets it through): every
       row, even where the page shows them a screen at a time. What is on
       screen when that fails or holds no table. */
    function wholePage() {
        say('Copying this page…');
        var onScreen = document.documentElement ? document.documentElement.outerHTML : '';
        var hasTable = function (html) { return /<table|<pre/i.test(html || ''); };
        return fetch(location.href, { credentials: 'same-origin' })
            .then(function (response) { return response.ok ? response.text() : ''; }, function () { return ''; })
            .then(function (html) {
                copy({ mcrrcPage: 1, url: location.href, html: hasTable(html) ? html : onScreen },
                    'The page "' + (document.title || location.hostname) + '"');
            });
    }

    /* ---- Which site ---- */
    var athlinksIds = /\/Event\/(\d+)\/Course\/(\d+)/i.exec(location.pathname);
    var runsignupRace = /^\/Race\/Results\/(\d+)/i.exec(location.pathname);
    var work;
    if (/(^|\.)athlinks\.com$/i.test(location.hostname) && athlinksIds) {
        work = athlinks(athlinksIds);
    } else if (runsignupRace) {
        work = runsignup(runsignupRace[1]);
    } else if (/(^|\.)athlinks\.com$/i.test(location.hostname)) {
        alert('Open one course\'s results on Athlinks first: an address with /Event/…/Course/… in it.');
        return;
    } else {
        work = wholePage();
    }
    Promise.resolve(work).catch(function (error) {
        fail('Could not fetch the results: ' + error.message);
    });
})();
