/**
 * Ranks team members by their best age grade at 5000m or longer, per year, and
 * reports how many clear each age-grade threshold.
 *
 * Standalone: talks to the site's public REST API, so it needs no database
 * credentials and no project dependencies — just Node 18+ for global fetch.
 *
 *   node scripts/agegrade-distribution.js
 *   node scripts/agegrade-distribution.js --url https://raceteam.mcrrc.org
 *   node scripts/agegrade-distribution.js --years 2026,2025,2024
 *   node scripts/agegrade-distribution.js --min-meters 10000 --thresholds 65,70,75
 *   node scripts/agegrade-distribution.js --by-category
 *   node scripts/agegrade-distribution.js --sex female --all
 *   node scripts/agegrade-distribution.js --csv > distribution.csv
 *
 * Flags
 *   --url          site base URL                    (default http://localhost:8090)
 *   --years        comma-separated years            (default 2026,2025,2024)
 *   --min-meters   minimum race distance in metres  (default 5000)
 *   --thresholds   age-grade cutoffs to report on   (default 70,71,72,73,74,75)
 *   --top N        how many ranked runners to print (default 25)
 *   --all          print every ranked runner
 *   --sex          male | female — restrict the pool
 *   --csv          emit the full ranking as CSV instead of tables
 *   --by-category  break every year down into Open M/F and Masters M/F
 *   --masters-age  age at which a runner counts as a master (default 40)
 *
 * Notes on what is counted
 *   - A runner's "best" is their single highest age grade that year over the distance
 *     floor. Each runner counts once per year, so the ratios are shares of people,
 *     not of races.
 *   - The denominator is everyone who was a team member during that year, whether or
 *     not they raced. Someone with no qualifying race counts in the denominator and
 *     in no threshold, which is what makes the shares reflect the whole roster.
 *     A member counts for a year if any of their membership periods overlaps it; an
 *     open-ended period counts as running to today.
 *   - Anyone with a qualifying result but no membership period covering that year is
 *     still included, and flagged, rather than silently dropped.
 *   - Category is fixed by where a runner stands on 31 December of that year, so
 *     someone who turns 40 mid-season counts as a master for the whole year rather
 *     than straddling two categories.
 *   - GET /api/results applies isRecordEligible=true whenever date filters are used,
 *     so these are record-eligible results only. That excludes things like relay legs
 *     and uncertified courses, and can differ slightly from the "max age grade" shown
 *     on the members page, which considers every result.
 */

function argValue(name, fallback) {
    const i = process.argv.indexOf('--' + name);
    return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
function hasFlag(name) {
    return process.argv.indexOf('--' + name) !== -1;
}

const BASE_URL = argValue('url', 'http://localhost:8090').replace(/\/$/, '');
const YEARS = argValue('years', '2026,2025,2024').split(',').map(function (y) { return parseInt(y.trim(), 10); });
const MIN_METERS = parseInt(argValue('min-meters', '5000'), 10);
const THRESHOLDS = argValue('thresholds', '70,71,72,73,74,75').split(',').map(Number);
const TOP = hasFlag('all') ? Infinity : parseInt(argValue('top', '25'), 10);
const SEX = argValue('sex', null);
const AS_CSV = hasFlag('csv');
const BY_CATEGORY = hasFlag('by-category');
const MASTERS_AGE = parseInt(argValue('masters-age', '40'), 10);

// Open/Masters split by gender. "unspecified" catches anyone missing a usable sex or
// date of birth so nobody silently vanishes from the totals.
const CATEGORIES = [
    { key: 'openM', label: 'Open M', sex: 'male', masters: false },
    { key: 'openF', label: 'Open F', sex: 'female', masters: false },
    { key: 'mastersM', label: 'Masters M', sex: 'male', masters: true },
    { key: 'mastersF', label: 'Masters F', sex: 'female', masters: true },
    { key: 'unspecified', label: 'Unspecified', sex: null, masters: null }
];

// A runner is placed by the category they are in on 31 December of that year, so
// someone who turns 40 mid-season counts as a master for the whole of it and never
// straddles two categories. On 31 December everyone has already had their birthday,
// so their age that day is simply year - birthYear.
function categoryKeyFor(row, year) {
    const sex = String(row.sex || '').toLowerCase();
    if ((sex !== 'male' && sex !== 'female') || !row.dateofbirth) return 'unspecified';
    const birthYear = new Date(row.dateofbirth).getUTCFullYear();
    if (!birthYear) return 'unspecified';
    const ageOnDec31 = year - birthYear;
    const isMaster = ageOnDec31 >= MASTERS_AGE;
    if (sex === 'male') return isMaster ? 'mastersM' : 'openM';
    return isMaster ? 'mastersF' : 'openF';
}

async function fetchResultsForYear(year) {
    const filters = JSON.stringify({
        datefrom: year + '-01-01T00:00:00.000Z',
        dateto: year + '-12-31T23:59:59.999Z'
    });
    const url = BASE_URL + '/api/results?filters=' + encodeURIComponent(filters) + '&sort=' + encodeURIComponent('-agegrade');

    const res = await fetch(url);
    if (!res.ok) throw new Error('GET /api/results for ' + year + ' failed: ' + res.status + ' ' + res.statusText);

    const body = await res.json();
    if (!Array.isArray(body)) throw new Error('Unexpected response for ' + year + ': ' + JSON.stringify(body).slice(0, 200));
    return body;
}

async function fetchMembers() {
    // Exclusion-only projection: the route already applies one, and Mongo rejects
    // mixing inclusions with exclusions.
    const url = BASE_URL + '/api/members?filters%5BmemberStatus%5D=all' +
        '&select=' + encodeURIComponent('-bio -personalBests -achievements -pictureLink');

    const res = await fetch(url);
    if (!res.ok) throw new Error('GET /api/members failed: ' + res.status + ' ' + res.statusText);

    const body = await res.json();
    if (!Array.isArray(body)) throw new Error('Unexpected members response: ' + JSON.stringify(body).slice(0, 200));
    return body;
}

// A membership period overlaps the year if it began on or before 31 Dec and had not
// already ended before 1 Jan. No end date means still a member.
function wasMemberDuring(member, year) {
    const yearStart = Date.UTC(year, 0, 1);
    const yearEnd = Date.UTC(year, 11, 31, 23, 59, 59, 999);
    return (member.membershipDates || []).some(function (period) {
        if (!period || !period.start) return false;
        const start = new Date(period.start).getTime();
        if (start > yearEnd) return false;
        if (!period.end) return true;
        return new Date(period.end).getTime() >= yearStart;
    });
}

// Map of member id -> their best qualifying result that year. Ranking happens in
// buildPool, once the non-racing members have been folded in.
function bestByRunner(results) {
    const best = new Map();

    results.forEach(function (result) {
        const meters = result.race && result.race.racetype && result.race.racetype.meters;
        if (!meters || meters < MIN_METERS) return;
        if (!(result.agegrade > 0)) return;

        (result.members || []).forEach(function (member) {
            if (!member || !member._id) return;
            if (SEX && String(member.sex || '').toLowerCase() !== SEX.toLowerCase()) return;

            const key = String(member._id);
            const existing = best.get(key);
            if (existing) {
                existing.qualifyingRaces++;
                if (result.agegrade > existing.bestAgeGrade) {
                    Object.assign(existing, snapshot(result, member), { qualifyingRaces: existing.qualifyingRaces });
                }
            } else {
                best.set(key, Object.assign(snapshot(result, member), { qualifyingRaces: 1 }));
            }
        });
    });

    return best;
}

function snapshot(result, member) {
    return {
        _id: String(member._id),
        firstname: member.firstname || '',
        lastname: member.lastname || '',
        username: member.username || '',
        sex: member.sex || '',
        dateofbirth: member.dateofbirth || null,
        bestAgeGrade: result.agegrade,
        racename: (result.race && result.race.racename) || '',
        racedate: result.race && result.race.racedate,
        distance: (result.race && result.race.racetype && result.race.racetype.name) || '',
        meters: result.race && result.race.racetype && result.race.racetype.meters,
        time: result.time
    };
}

// The pool for a year: everyone on the roster, each carrying their best qualifying
// age grade if they had one. Racers with no membership period covering the year are
// appended and flagged rather than dropped.
function buildPool(members, bestMap, year) {
    const pool = [];
    const seen = new Set();

    members.forEach(function (member) {
        if (!wasMemberDuring(member, year)) return;
        if (SEX && String(member.sex || '').toLowerCase() !== SEX.toLowerCase()) return;

        const id = String(member._id);
        seen.add(id);
        const raced = bestMap.get(id);
        if (raced) {
            // The roster record wins for sex and date of birth — a result snapshot can
            // be years old, and those two fields decide the category.
            pool.push(Object.assign({}, raced, {
                sex: member.sex || raced.sex,
                dateofbirth: member.dateofbirth || raced.dateofbirth
            }));
            return;
        }
        pool.push({
            _id: id,
            firstname: member.firstname || '',
            lastname: member.lastname || '',
            username: member.username || '',
            sex: member.sex || '',
            dateofbirth: member.dateofbirth || null,
            bestAgeGrade: null,
            qualifyingRaces: 0
        });
    });

    bestMap.forEach(function (row, id) {
        if (seen.has(id)) return;
        if (SEX && String(row.sex || '').toLowerCase() !== SEX.toLowerCase()) return;
        pool.push(Object.assign({}, row, { offRoster: true }));
    });

    // Graded runners first, high to low; everyone else alphabetically after them
    pool.sort(function (a, b) {
        if (a.bestAgeGrade === null && b.bestAgeGrade === null) {
            return (a.lastname + a.firstname).localeCompare(b.lastname + b.firstname);
        }
        if (a.bestAgeGrade === null) return 1;
        if (b.bestAgeGrade === null) return -1;
        return b.bestAgeGrade - a.bestAgeGrade;
    });

    return pool;
}

function thresholdCounts(pool) {
    const total = pool.length;
    const racers = pool.filter(function (r) { return r.bestAgeGrade !== null; }).length;
    return THRESHOLDS.map(function (t) {
        const count = pool.filter(function (r) { return r.bestAgeGrade !== null && r.bestAgeGrade >= t; }).length;
        return {
            threshold: t,
            count: count,
            ratio: total ? count / total : 0,
            ratioOfRacers: racers ? count / racers : 0
        };
    });
}

// The four gendered Open/Masters buckets, plus Unspecified only when someone lands
// there. Each carries its own rows, ranked members and threshold counts.
function activeCategories(year) {
    return CATEGORIES.map(function (category) {
        const rows = year.pool.filter(function (r) { return r.categoryKey === category.key; });
        return {
            key: category.key,
            label: category.label,
            rows: rows,
            graded: rows.filter(function (r) { return r.bestAgeGrade !== null; }),
            buckets: thresholdCounts(rows)
        };
    }).filter(function (g) { return g.key !== 'unspecified' || g.rows.length > 0; });
}

function categoryLabel(key) {
    const found = CATEGORIES.find(function (c) { return c.key === key; });
    return found ? found.label : '?';
}

function medianOf(gradedRows) {
    if (!gradedRows.length) return '—';
    const values = gradedRows.map(function (r) { return r.bestAgeGrade; }).slice().sort(function (a, b) { return a - b; });
    const mid = Math.floor(values.length / 2);
    const median = values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
    return median.toFixed(1) + '%';
}

function centisToString(cs) {
    if (!cs) return '—';
    const totalSec = Math.floor(cs / 100);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const p = function (n) { return String(n).padStart(2, '0'); };
    return h > 0 ? h + ':' + p(m) + ':' + p(s) : m + ':' + p(s);
}

// Always leaves at least one trailing space, so truncated cells never run into the
// next column.
function pad(str, width) {
    str = String(str);
    if (str.length >= width) return str.slice(0, width - 1) + ' ';
    return str + ' '.repeat(width - str.length);
}
function padLeft(str, width) {
    str = String(str);
    return str.length >= width ? str : ' '.repeat(width - str.length) + str;
}

async function main() {
    const members = await fetchMembers();

    const perYear = [];
    for (const year of YEARS) {
        const results = await fetchResultsForYear(year);
        const bestMap = bestByRunner(results);
        const pool = buildPool(members, bestMap, year);
        pool.forEach(function (row) { row.categoryKey = categoryKeyFor(row, year); });
        const entry = {
            year: year,
            fetched: results.length,
            pool: pool,
            graded: pool.filter(function (r) { return r.bestAgeGrade !== null; }),
            unraced: pool.filter(function (r) { return r.bestAgeGrade === null; }),
            offRoster: pool.filter(function (r) { return r.offRoster; }),
            buckets: thresholdCounts(pool)
        };
        entry.categories = activeCategories(entry);
        perYear.push(entry);
    }

    if (AS_CSV) {
        console.log('year,rank,firstname,lastname,sex,best_age_grade,race,distance,meters,time,racedate,qualifying_races,on_roster,category');
        perYear.forEach(function (y) {
            y.pool.forEach(function (r, i) {
                console.log([
                    y.year,
                    r.bestAgeGrade === null ? '' : i + 1,
                    r.firstname, r.lastname, r.sex,
                    r.bestAgeGrade === null ? '' : r.bestAgeGrade,
                    '"' + String(r.racename || '').replace(/"/g, '""') + '"',
                    r.distance || '', r.meters || '',
                    r.bestAgeGrade === null ? '' : centisToString(r.time),
                    r.racedate ? String(r.racedate).split('T')[0] : '',
                    r.qualifyingRaces,
                    r.offRoster ? 'no' : 'yes',
                    categoryLabel(r.categoryKey)
                ].join(','));
            });
        });
        return;
    }

    const filters = ['distance >= ' + MIN_METERS + 'm', SEX ? 'sex = ' + SEX : null].filter(Boolean).join(', ');
    console.log('\n' + '='.repeat(78));
    console.log('BEST AGE GRADE PER RUNNER  (' + filters + ')');
    console.log('source: ' + BASE_URL + '  — record-eligible results only');
    console.log('='.repeat(78));

    perYear.forEach(function (y) {
        console.log('\n' + y.year + ' — ' + y.pool.length + ' team member(s); ' +
            y.graded.length + ' raced ' + MIN_METERS + 'm+, ' + y.unraced.length + ' did not' +
            '  (' + y.fetched + ' result(s) fetched)');
        console.log('-'.repeat(78));

        if (y.graded.length === 0) {
            console.log('  no qualifying results');
        } else {
            console.log('  ' + pad('#', 4) + pad('Runner', 22) +
                (BY_CATEGORY ? pad('Cat', 11) : '') + padLeft('Best AG', 8) + '  ' +
                pad('Race', BY_CATEGORY ? 17 : 26) + pad('Dist', 10) + 'Time');
            y.graded.slice(0, TOP).forEach(function (r, i) {
                console.log('  ' + pad(i + 1, 4) +
                    pad(r.firstname + ' ' + r.lastname + (r.offRoster ? ' *' : ''), 22) +
                    (BY_CATEGORY ? pad(categoryLabel(r.categoryKey), 11) : '') +
                    padLeft(r.bestAgeGrade.toFixed(2) + '%', 8) + '  ' +
                    pad(r.racename || '—', BY_CATEGORY ? 17 : 26) +
                    pad(r.distance || '—', 10) +
                    centisToString(r.time));
            });
            if (y.graded.length > TOP) {
                console.log('  … ' + (y.graded.length - TOP) + ' more (use --all to list everyone)');
            }
        }

        if (y.unraced.length > 0) {
            console.log('\n  No qualifying race (' + y.unraced.length + ') — counted in the denominator:');
            const names = y.unraced.map(function (r) { return r.firstname + ' ' + r.lastname; });
            let line = '   ';
            names.forEach(function (name) {
                if ((line + ' ' + name + ',').length > 76) { console.log(line); line = '   '; }
                line += ' ' + name + ',';
            });
            if (line.trim()) console.log(line.replace(/,$/, ''));
        }

        if (y.offRoster.length > 0) {
            console.log('\n  * ' + y.offRoster.length + ' runner(s) raced but have no membership period covering ' +
                y.year + ' — included anyway.');
        }

        console.log('\n  Threshold recap for ' + y.year);
        console.log('  ' + pad('At or above', 13) + padLeft('Members', 9) + padLeft('% of team', 11) + padLeft('% of racers', 13));
        y.buckets.forEach(function (b) {
            console.log('  ' + pad('>= ' + b.threshold + '%', 13) +
                padLeft(b.count, 9) +
                padLeft((b.ratio * 100).toFixed(1) + '%', 11) +
                padLeft((b.ratioOfRacers * 100).toFixed(1) + '%', 13));
        });
        console.log('  ' + pad('team size', 13) + padLeft(y.pool.length, 9));

        if (BY_CATEGORY) {
            const groups = y.categories;
            console.log('\n  ' + y.year + ' by category  (masters = age ' + MASTERS_AGE + '+ during the year)');
            console.log('  ' + pad('At or above', 15) + groups.map(function (g) { return padLeft(g.label, 15); }).join(''));
            THRESHOLDS.forEach(function (t) {
                console.log('  ' + pad('>= ' + t + '%', 15) + groups.map(function (g) {
                    const b = g.buckets.find(function (x) { return x.threshold === t; });
                    return padLeft(b.count + ' (' + (b.ratio * 100).toFixed(0) + '%)', 15);
                }).join(''));
            });
            console.log('  ' + pad('category size', 15) + groups.map(function (g) { return padLeft(g.rows.length, 15); }).join(''));
            console.log('  ' + pad('raced', 13) + groups.map(function (g) {
                return padLeft(g.graded.length + ' (' + (g.rows.length ? (g.graded.length / g.rows.length * 100).toFixed(0) : '0') + '%)', 15);
            }).join(''));
            console.log('  ' + pad('best AG', 13) + groups.map(function (g) {
                return padLeft(g.graded.length ? g.graded[0].bestAgeGrade.toFixed(1) + '%' : '—', 15);
            }).join(''));
            console.log('  ' + pad('median AG', 13) + groups.map(function (g) {
                return padLeft(medianOf(g.graded), 15);
            }).join(''));
        }
    });

    // Side by side, since comparing years is the point of asking for three of them
    console.log('\n' + '='.repeat(78));
    console.log('YEAR-OVER-YEAR');
    console.log('='.repeat(78));
    console.log('  ' + pad('At or above', 13) + YEARS.map(function (y) { return padLeft(y, 16); }).join(''));
    THRESHOLDS.forEach(function (t, ti) {
        console.log('  ' + pad('>= ' + t + '%', 13) + perYear.map(function (y) {
            const b = y.buckets[ti];
            return padLeft(b.count + ' (' + (b.ratio * 100).toFixed(1) + '%)', 16);
        }).join(''));
    });
    console.log('  ' + pad('team size', 13) + perYear.map(function (y) { return padLeft(y.pool.length, 16); }).join(''));
    console.log('  ' + pad('raced ' + MIN_METERS + 'm+', 13) + perYear.map(function (y) {
        return padLeft(y.graded.length + ' (' + (y.pool.length ? (y.graded.length / y.pool.length * 100).toFixed(1) : '0.0') + '%)', 16);
    }).join(''));
    console.log('\n  Shares above are of the whole roster for that year.');

    if (BY_CATEGORY) {
        // Any category that shows up in at least one year, in the canonical order
        const present = CATEGORIES.filter(function (category) {
            return perYear.some(function (y) {
                return y.categories.some(function (g) { return g.key === category.key; });
            });
        });

        console.log('\n' + '='.repeat(78));
        console.log('YEAR-OVER-YEAR BY CATEGORY  (masters = age ' + MASTERS_AGE + '+ on 31 Dec)');
        console.log('='.repeat(78));

        present.forEach(function (category) {
            const perYearGroup = perYear.map(function (y) {
                return y.categories.find(function (g) { return g.key === category.key; }) ||
                    { rows: [], graded: [], buckets: thresholdCounts([]) };
            });

            console.log('\n  ' + category.label);
            console.log('  ' + pad('At or above', 15) + YEARS.map(function (y) { return padLeft(y, 16); }).join(''));
            THRESHOLDS.forEach(function (t, ti) {
                console.log('  ' + pad('>= ' + t + '%', 15) + perYearGroup.map(function (g) {
                    const b = g.buckets[ti];
                    return padLeft(b.count + ' (' + (b.ratio * 100).toFixed(1) + '%)', 16);
                }).join(''));
            });
            console.log('  ' + pad('category size', 15) + perYearGroup.map(function (g) {
                return padLeft(g.rows.length, 16);
            }).join(''));
            console.log('  ' + pad('raced', 15) + perYearGroup.map(function (g) {
                return padLeft(g.graded.length + ' (' + (g.rows.length ? (g.graded.length / g.rows.length * 100).toFixed(1) : '0.0') + '%)', 16);
            }).join(''));
            console.log('  ' + pad('median AG', 15) + perYearGroup.map(function (g) {
                return padLeft(medianOf(g.graded), 16);
            }).join(''));
        });
        console.log('\n  Shares are of that category\'s size in that year.');
    }

    console.log('');
}

main().catch(function (err) {
    console.error('\n' + err.message);
    if (/fetch failed|ECONNREFUSED/i.test(err.message)) {
        console.error('Is the site running at ' + BASE_URL + '? Pass --url to point somewhere else.\n');
    }
    process.exit(1);
});
