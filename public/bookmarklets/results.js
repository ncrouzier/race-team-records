/* MCRRC result extractor: a race's results, to the clipboard.

   Run as a bookmark on a race's results page, on:
   - athlinks.com (an address with /Event/<number>/Course/<number>/): asks
     Athlinks' results feed for every runner, 100 at a time, as the page
     itself does (app/athlinks.js reads the copy);
   - RunSignUp's system, on runsignup.com or a race's own domain
     (turkeychase.com/Race/Results/97804): asks that site's results feed for
     the result set the page shows, 2,500 runners at a time
     (app/runsignup.js reads the copy);
   - parkrun: the results page as shown, with its address, and no request
     at all (parkrun refuses those it finds too many of);
   - mika:timing sites (Boston, Chicago, Berlin, London marathons and
     others): searches each team member's name (last name and first), reads
     the page of each finisher whose name could be theirs, and asks the totals their places are out of
     (app/mika.js reads the copy). It asks for the race date, then the team
     on that day from the team site (SITE below, written in by the extractor
     page when the bookmark is dragged: /api/bookmarklet/roster);
   - any other page (mcrrc.org's results, a timer's site): the page's source
     with its address, as "view source" and paste would give, in one click.
   app/resultTableParser.js reads those last two.
   It then copies them for the result extractor's paste box. Nothing is sent
   anywhere but the site the page is on (and, on mika:timing sites, the race
   date to the team site, for the roster).

   The extractor page makes the bookmark from this file. Block comments only:
   it runs as one javascript: address. */
(function (SITE) {
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

    function getText(url) {
        return fetch(url, { credentials: 'same-origin' }).then(function (response) {
            if (!response.ok) throw new Error('the site answered HTTP ' + response.status);
            return response.text();
        });
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

    /* parkrun: every runner is in the page as shown, so no second visit */
    function parkrunPage() {
        var html = document.documentElement ? document.documentElement.outerHTML : '';
        if (!/Results-header/.test(html)) {
            fail('This parkrun page has no results: open an event\'s results (…/results/latestresults/ or …/results/<number>/).');
            return;
        }
        copy({ mcrrcPage: 1, url: location.href, html: html },
            'The results of "' + (document.title || 'this parkrun') + '"');
    }

    /* ---- mika:timing (results.baa.org, results.chicagomarathon.com,
       berlin.r.mikatiming.com, results.tcslondonmarathon.com, ...) ----

       Every such site has the same pages, set up differently: its own codes
       for sex and age group (Boston's 45-49 is 9, Chicago's 45), its own
       columns (Chicago gives no age group place, Berlin no gender place).
       So nothing here is per site: the codes come from the site's own list
       (getSearchFields, what its search form fills its menus from), the
       columns from the list's headings. */

    function decode(text) {
        return String(text || '').replace(/<[^>]+>/g, '')
            .replace(/&ndash;|&mdash;/g, '-').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
            .replace(/&#(\d+);/g, function (m, n) { return String.fromCharCode(+n); }).trim();
    }

    /* What a place heading counts: the age group, the gender, or overall */
    function placeKind(label) {
        /* Berlin's "Pl.AC" with its dot: "Place" holds "plac" too */
        if (/divis|categ|\bage\b|class|\bac\b|pl\.\s*ac/i.test(label)) return 'group';
        if (/gender|sex|\(g\)/i.test(label)) return 'gender';
        return 'overall';
    }

    /* The finish time among a row's times: net, else the one called finish,
       else any but the gun time and splits */
    function finishOf(times) {
        var labels = Object.keys(times);
        var pick = labels.filter(function (l) { return /net|chip/i.test(l); })[0] ||
            labels.filter(function (l) { return /^finish$/i.test(l); })[0] ||
            labels.filter(function (l) { return /finish|time/i.test(l) && !/gun|half|split|actual/i.test(l); })[0];
        var value = pick ? times[pick] : '';
        return /\d:\d\d/.test(value) ? value : '';
    }

    /* A list page: its runners, as {places: {overall, gender, group}, name,
       href, group, bib, time, half} */
    function mikaRows(html) {
        var head = /<li class="[^"]*list-group-header[^"]*"[^>]*>([\s\S]*?)<\/li>/.exec(html);
        var kinds = [];
        if (head) {
            head[1].replace(/<div class="[^"]*type-place[^"]*"[^>]*>([\s\S]*?)<\/div>/g, function (m, label) {
                kinds.push(placeKind(decode(label)));
            });
        }
        var rows = [];
        var rowPattern = /<li class="[^"]*list-group-item row[^"]*"[^>]*>([\s\S]*?)<\/li>\s*(?=<li|<\/ul)/g;
        var match;
        while ((match = rowPattern.exec(html))) {
            var cell = match[1];
            var row = { places: {}, times: {} };
            var i = 0;
            cell.replace(/type-place[^"]*"[^>]*>([^<]*)</g, function (m, value) {
                var place = parseInt(decode(value).replace(/\D/g, ''), 10);
                var kind = kinds[i++] || (i === 1 ? 'overall' : null);
                if (kind && place > 0 && !row.places[kind]) row.places[kind] = place;
            });
            var name = /type-fullname[^>]*>\s*<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/.exec(cell);
            if (!name) continue;
            row.href = decode(name[1]);
            row.name = decode(name[2]);
            cell.replace(/<div class="[^"]*list-field (type-[\w-]+)[^"]*"[^>]*><div[^>]*list-label[^>]*>([\s\S]*?)<\/div>([\s\S]*?)<\/div>/g,
                function (m, type, label, value) {
                    label = decode(label);
                    value = decode(value);
                    if (type === 'type-age_class') row.group = value === '-' ? '' : value;
                    else if (type === 'type-time' || type === 'type-actual_ranking_time') row.times[label] = value;
                    else if (/bib|number|start/i.test(label)) row.bib = value;
                });
            row.time = finishOf(row.times);
            var half = Object.keys(row.times).filter(function (l) { return /half/i.test(l); })[0];
            row.half = half ? row.times[half] : '';
            delete row.times;
            rows.push(row);
        }
        return rows;
    }

    /* A runner's id on the site (idp=9TGHS6FF1ADAE2), else the whole link */
    function runnerId(href) {
        var idp = /[?&]idp=([^&]+)/.exec(href || '');
        return idp ? idp[1] : href;
    }

    /* "Last, First (USA)" -> {last, first, nation} */
    function splitName(name) {
        var nation = /\(([A-Z]{2,3})\)\s*$/.exec(name);
        var bare = name.replace(/\s*\([^)]*\)\s*$/, '');
        var comma = bare.indexOf(',');
        return {
            last: comma > -1 ? bare.slice(0, comma).trim() : bare.split(/\s+/).slice(-1)[0],
            first: comma > -1 ? bare.slice(comma + 1).trim() : bare.split(/\s+/).slice(0, -1).join(' '),
            nation: nation ? nation[1] : ''
        };
    }

    function letters(text) {
        return String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '');
    }

    /* How well a runner's name fits a member: 0 not at all, else the same
       last name (one may hold the other: hyphenated, married names) and 1
       the same first initial, 2 one first name starting the other (Ann,
       Anne), 3 the same first name. The extractor matches names properly;
       this keeps the copy small and gives each runner the likeliest
       member's sex. */
    function fit(runner, member) {
        var last = letters(runner.last);
        var memberLast = letters(member[1]);
        if (!last || !memberLast || (last.indexOf(memberLast) === -1 && memberLast.indexOf(last) === -1)) return 0;
        var first = letters(runner.first.split(/\s+/)[0]);
        var memberFirst = letters(String(member[0]).split(/\s+/)[0]);
        if (!first || first.charAt(0) !== memberFirst.charAt(0)) return 0;
        if (first === memberFirst) return 3;
        return first.indexOf(memberFirst) === 0 || memberFirst.indexOf(first) === 0 ? 2 : 1;
    }

    function likeliestMember(runner, team) {
        var best = null;
        var bestFit = 0;
        team.forEach(function (member) {
            var f = fit(runner, member);
            if (f > bestFit) { best = member; bestFit = f; }
        });
        return best;
    }

    /* How many runners a list holds: the count it prints (Boston, London),
       else from its pages (Chicago, Berlin print none): the last page's
       number, and that page's rows */
    var PER_COUNT_PAGE = 25;
    function countOf(listUrl) {
        var url = listUrl + '&num_results=' + PER_COUNT_PAGE;
        return getText(url).then(function (html) {
            var printed = /str_num[^>]*>\s*([\d.,]+)/.exec(html);
            if (printed) return parseInt(printed[1].replace(/\D/g, ''), 10);
            var pager = /<ul class="pagination[^"]*"[^>]*>([\s\S]*?)<\/ul>/.exec(html);
            var pages = 1;
            if (pager) {
                pager[1].replace(/>\s*(\d+)\s*<\/a>/g, function (m, n) { pages = Math.max(pages, +n); });
            }
            if (pages === 1) return mikaRows(html).length;
            return getText(url + '&page=' + pages).then(function (last) {
                return (pages - 1) * PER_COUNT_PAGE + mikaRows(last).length;
            });
        });
    }

    /* A runner's own page: its fields by the platform's names (the same on
       every site seen: f-place_nosex overall, f-place_all gender,
       f-place_age age group, f-_type_sex, f-_type_age_class or
       f-age_class_desc, f-state or f-__city_state), first value of each */
    function detailFields(html) {
        var fields = {};
        var rowPattern = /<tr class="([^"]*)"[^>]*>\s*<th[^>]*>[\s\S]*?<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>/g;
        var match;
        while ((match = rowPattern.exec(html))) {
            var name = /\bf-([\w]+)/.exec(match[1]);
            var value = decode(match[2]);
            if (name && !(name[1] in fields)) fields[name[1]] = value === '-' ? '' : value;
        }
        return fields;
    }

    /* Run tasks a few at a time: quicker than one by one, gentler than all */
    function inTurn(items, work, atOnce) {
        var results = new Array(items.length);
        var next = 0;
        function worker() {
            if (next >= items.length) return Promise.resolve();
            var index = next++;
            return Promise.resolve(work(items[index], index)).then(function (out) {
                results[index] = out;
                return worker();
            });
        }
        var workers = [];
        for (var w = 0; w < Math.min(atOnce, items.length); w++) workers.push(worker());
        return Promise.all(workers).then(function () { return results; });
    }

    /* The race date, asked in the box: a date picker (kept to the year of
       the results shown), Today, Search, Cancel. Enter searches, Escape
       cancels. Resolves with "2025-04-21", or null when cancelled. */
    var BUTTON = 'font:inherit;padding:5px 12px;border-radius:6px;cursor:pointer;border:1px solid #b8c4d0;background:#f3f6f9;color:#222';
    var PRIMARY = 'font:inherit;padding:5px 14px;border-radius:6px;cursor:pointer;border:1px solid #1b5e9e;background:#1b5e9e;color:#fff;font-weight:600';
    function askDate(year) {
        return new Promise(function (resolve) {
            var today = new Date();
            var todayText = today.getFullYear() + '-' + ('0' + (today.getMonth() + 1)).slice(-2) + '-' + ('0' + today.getDate()).slice(-2);
            say('');
            box.textContent = '';
            var title = document.createElement('strong');
            title.textContent = 'MCRRC results';
            title.setAttribute('style', 'display:block;margin-bottom:4px');
            box.appendChild(title);

            var form = document.createElement('form');
            form.setAttribute('style', 'margin:0');
            var label = document.createElement('label');
            label.setAttribute('for', 'mcrrc-race-day');
            label.setAttribute('style', 'display:block;font-weight:600');
            label.textContent = 'Race date';
            form.appendChild(label);
            var hint = document.createElement('div');
            hint.setAttribute('style', 'color:#5f6b76;font-size:12px;margin-bottom:6px');
            hint.textContent = 'Searches for the members on the team that day.';
            form.appendChild(hint);

            var row = document.createElement('div');
            row.setAttribute('style', 'display:flex;gap:6px;align-items:center;margin-bottom:8px');
            var input = document.createElement('input');
            input.type = 'date';
            input.id = 'mcrrc-race-day';
            input.required = true;
            input.setAttribute('style', 'flex:1;min-width:0;font:inherit;padding:5px 8px;border:1px solid #b8c4d0;border-radius:6px;color:#222;background:#fff');
            if (year) {
                input.min = year + '-01-01';
                input.max = year + '-12-31';
            }
            if (!year || year === todayText.slice(0, 4)) input.value = todayText;
            row.appendChild(input);
            var todayButton = document.createElement('button');
            todayButton.type = 'button';
            todayButton.textContent = 'Today';
            todayButton.setAttribute('style', BUTTON);
            todayButton.onclick = function () { input.value = todayText; error.textContent = ''; input.focus(); };
            row.appendChild(todayButton);
            form.appendChild(row);

            var error = document.createElement('div');
            error.setAttribute('style', 'color:#b3261e;font-size:13px;margin-bottom:6px');
            form.appendChild(error);

            var actions = document.createElement('div');
            actions.setAttribute('style', 'display:flex;gap:6px;justify-content:flex-end');
            var cancel = document.createElement('button');
            cancel.type = 'button';
            cancel.textContent = 'Cancel';
            cancel.setAttribute('style', BUTTON);
            var search = document.createElement('button');
            search.type = 'submit';
            search.textContent = 'Search';
            search.setAttribute('style', PRIMARY);
            actions.appendChild(cancel);
            actions.appendChild(search);
            form.appendChild(actions);

            var finish = function (day) {
                if (!day) box.remove();
                resolve(day);
            };
            cancel.onclick = function () { finish(null); };
            form.onkeydown = function (event) { if (event.key === 'Escape') finish(null); };
            form.onsubmit = function (event) {
                if (event && event.preventDefault) event.preventDefault();
                var day = String(input.value || '').trim();
                if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || isNaN(Date.parse(day))) {
                    error.textContent = 'Pick a date' + (year ? ' in ' + year : '') + '.';
                    return;
                }
                finish(day);
            };
            box.appendChild(form);
            if (input.focus) input.focus();
        });
    }

    function mika() {
        if (!SITE) {
            return fail('This bookmark does not know the team site. Drag "Results → clipboard" again from the result extractor, then click it here.');
        }
        /* The race date: whose team to search for, and the result's date */
        var urlYear = (/\/(\d{4})\//.exec(location.pathname) || [])[1];
        return askDate(urlYear).then(function (day) {
            if (!day) return;
            /* The team that day, as the team site has it now */
            say('Getting the team on ' + day + ' from ' + SITE.replace(/^https?:\/\//, '') + '…');
            return fetch(SITE + '/api/bookmarklet/roster?date=' + day, { credentials: 'omit' }).then(function (response) {
                if (!response.ok) throw new Error('it answered HTTP ' + response.status);
                return response.json();
            }).then(function (roster) {
                var team = (roster && roster.team) || [];
                if (!team.length) return fail('No one was on the team on ' + day + '.');
                return searchTeam(day, team);
            }, function (error) {
                fail('Could not get the team from ' + SITE + ' (' + error.message + '). Is the site up, and this bookmark dragged from it?');
            });
        });
    }

    function searchTeam(day, team) {
        var base = location.origin + location.pathname.replace(/[^/]*$/, '');
        var params = {};
        location.search.replace(/^\?/, '').split('&').forEach(function (pair) {
            var kv = pair.split('=');
            if (kv[0]) params[decodeURIComponent(kv[0])] = decodeURIComponent((kv[1] || '').replace(/\+/g, ' '));
        });
        var payload = {
            mcrrcMika: 1, url: location.href, host: location.hostname, base: base,
            year: (/\/(\d{4})\//.exec(location.pathname) || [])[1] || null,
            pageTitle: document.title || '', runners: [], totals: { gender: {}, groups: {} },
            raceDay: day, teamSize: team.length
        };

        say('Reading this site\'s age groups…');
        return getJson(base + 'index.php?content=ajax2&func=getSearchFields&options%5Blang%5D=EN_CAP&options%5Bpid%5D=start')
            .then(function (fields) {
                var branches = (fields && fields.branches) || {};
                var lists = (branches.lists && branches.lists.fields) || {};
                var search = (branches.search && branches.search.fields) || {};
                var options = function (field) {
                    return ((lists[field] || search[field] || {}).data || [])
                        .map(function (d) { return { code: String(d.v[0]), label: decode(d.v[1]) }; })
                        .filter(function (o) { return o.code !== '%'; });
                };
                var events = options('event');
                var event = params.event || (events[0] && events[0].code) || '';
                payload.event = event;
                payload.eventName = (events.filter(function (e) { return e.code === event; })[0] || {}).label || '';
                payload.sexes = options('sex');
                payload.groups = options('age_class');
                var common = 'lang=EN_CAP' + (event ? '&event=' + encodeURIComponent(event) : '') +
                    (params.event_main_group ? '&event_main_group=' + encodeURIComponent(params.event_main_group) : '');
                var sexCode = function (sex) {
                    var men = /^(m|men|man|male|herren|m.nner)$/i;
                    var women = /^(w|f|women|woman|female|damen|frauen)$/i;
                    var wanted = sex === 'Female' ? women : men;
                    var found = payload.sexes.filter(function (o) { return wanted.test(o.label) || wanted.test(o.code); })[0];
                    return found ? found.code : (sex === 'Female' ? 'W' : 'M');
                };

                /* 1. Each team name: last name and the start of the first
                   (the sites match a first name as a prefix: "Ann" finds
                   Anne), so only that member's namesakes come back */
                var searches = [];
                team.forEach(function (member) {
                    var first = String(member[0] || '').split(/\s+/)[0];
                    var key = letters(first) + '|' + letters(member[1]);
                    if (member[1] && first && !searches.some(function (q) { return q.key === key; })) {
                        searches.push({ key: key, first: first, last: member[1] });
                    }
                });
                var done = 0;
                return inTurn(searches, function (q) {
                    return getText(base + '?pid=search&' + common + '&num_results=100&search%5Bname%5D=' +
                        encodeURIComponent(q.last) + '&search%5Bfirstname%5D=' + encodeURIComponent(q.first) +
                        '&search_sort=name').then(function (html) {
                        say('Searching the team\'s names: ' + (++done) + ' of ' + searches.length + '…');
                        mikaRows(html).forEach(function (row) {
                            if (!row.time) return; /* no finish time: not a finisher */
                            var name = splitName(row.name);
                            var member = likeliestMember(name, team);
                            /* the same first name, or one starting the other */
                            if (!member || fit(name, member) < 2) return;
                            /* Found once: two searches (a member's other name,
                               "Meg" and "Megan") find the same runner, under
                               links that differ by the search, not the id */
                            var id = runnerId(row.href);
                            if (payload.runners.some(function (r) { return r.id === id; })) return;
                            payload.runners.push({
                                name: name.first + ' ' + name.last, first: name.first, last: name.last, nation: name.nation,
                                bib: row.bib || '', sex: member[2] || '', sexCode: sexCode(member[2]),
                                group: row.group || '', overall: row.places.overall || null,
                                genderPlace: row.places.gender || null, groupPlace: row.places.group || null,
                                time: row.time, half: row.half, href: row.href, id: id
                            });
                        });
                    });
                }, 4).then(function () {
                    /* 2. Each runner's own page: all three places, which
                       some lists leave out (Chicago's age group place,
                       Berlin's gender place), the age group (not in
                       Boston's list), the sex the site gives, the hometown */
                    var read = 0;
                    return inTurn(payload.runners, function (runner) {
                        return getText(base + runner.href).then(function (html) {
                            say('Reading the runners\' own pages: ' + (++read) + ' of ' + payload.runners.length + '…');
                            var f = detailFields(html);
                            var place = function (value) { return parseInt(String(value || '').replace(/\D/g, ''), 10) || null; };
                            runner.overall = place(f.place_nosex) || runner.overall;
                            runner.genderPlace = place(f.place_all) || runner.genderPlace;
                            runner.groupPlace = place(f.place_age) || runner.groupPlace;
                            runner.group = runner.group || f._type_age_class || f.age_class_desc || '';
                            runner.home = f.__city_state || f.state || f.city || '';
                            var siteSex = (f._type_sex || '').toLowerCase();
                            var sex = siteSex && payload.sexes.filter(function (o) {
                                return o.label.toLowerCase() === siteSex || o.code.toLowerCase() === siteSex;
                            })[0];
                            if (sex) {
                                runner.sexCode = sex.code;
                                if (/^(w|f)/i.test(sex.label)) runner.sex = 'Female';
                                else if (/^m/i.test(sex.label)) runner.sex = 'Male';
                                else runner.sex = sex.label;
                            }
                        }, function () { /* the list's values stay */ });
                    }, 4);
                }).then(function () {
                    /* 3. What the places are out of: overall, each sex, and
                       each sex's age group, for the runners found only */
                    var list = base + '?pid=list&' + common;
                    var counts = [{ key: 'overall', url: list }];
                    payload.runners.forEach(function (r) {
                        var group = payload.groups.filter(function (g) { return g.label === r.group || g.code === r.group; })[0];
                        r.groupCode = group ? group.code : null;
                        if (!counts.some(function (c) { return c.key === 'gender|' + r.sexCode; })) {
                            counts.push({ key: 'gender|' + r.sexCode, url: list + '&search%5Bsex%5D=' + encodeURIComponent(r.sexCode) });
                        }
                        if (group && !counts.some(function (c) { return c.key === 'group|' + r.sexCode + '|' + group.code; })) {
                            counts.push({ key: 'group|' + r.sexCode + '|' + group.code,
                                url: list + '&search%5Bsex%5D=' + encodeURIComponent(r.sexCode) + '&search%5Bage_class%5D=' + encodeURIComponent(group.code) });
                        }
                    });
                    var counted = 0;
                    return inTurn(counts, function (c) {
                        return countOf(c.url).then(function (n) {
                            say('Counting the field: ' + (++counted) + ' of ' + counts.length + '…');
                            var parts = c.key.split('|');
                            if (parts[0] === 'overall') payload.totals.overall = n;
                            else if (parts[0] === 'gender') payload.totals.gender[parts[1]] = n;
                            else payload.totals.groups[parts[1] + '|' + parts[2]] = n;
                        }, function () { /* that total stays unknown */ });
                    }, 4);
                }).then(function () {
                    payload.searched = searches.length;
                    if (!payload.runners.length) {
                        return fail('No runner here has a team member\'s name (' + searches.length + ' names searched, ' +
                            (payload.eventName || event || 'this race') + ').');
                    }
                    copy(payload, payload.runners.length + ' possible team runners of ' + (payload.eventName || 'this race'));
                });
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
    } else if (/(^|\.)mikatiming\.(com|net|de)$/i.test(location.hostname) ||
        (document.querySelector && document.querySelector('script[src*="content=ajax2"]'))) {
        work = mika();
    } else if (/(^|\.)parkrun\.(com?\.)?[a-z]{2,3}(\.[a-z]{2})?$/i.test(location.hostname)) {
        work = parkrunPage();
    } else if (/(^|\.)athlinks\.com$/i.test(location.hostname)) {
        alert('Open one course\'s results on Athlinks first: an address with /Event/…/Course/… in it.');
        return;
    } else {
        work = wholePage();
    }
    Promise.resolve(work).catch(function (error) {
        fail('Could not fetch the results: ' + error.message);
    });
/* The extractor page puts its own address here (https://raceteam.mcrrc.org),
   where mika() asks for the team on the race date */
})(/*MCRRC_SITE*/'');
