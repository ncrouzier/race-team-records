// Finding the results in an arbitrary race results page.
//
// The old approach walked a list of table selectors and took the first table
// that matched, which breaks in three common ways: a layout or navigation table
// wins because it appears first in the markup; a page with several result tables
// (5K and 10K, or age-group breakdowns) silently yields the wrong one; and
// fixed-width <pre> results — still the house style on a lot of club sites,
// MCRRC included — are not tables at all and were missed entirely.
//
// Instead: gather every plausible candidate, score each on how much it looks
// like race results, and return them best-first. The caller takes the winner,
// and the UI can offer the rest when the guess is wrong.

const cheerio = require('cheerio');

// Header names that say "these are race results", and roughly how strongly.
const HEADER_SIGNALS = [
    { pattern: /^(name|runner|parkrunner|athlete|participant)$/i, weight: 12 },
    { pattern: /name/i, weight: 6 },
    { pattern: /(net|gun|chip|finish|elapsed)?\s*time$/i, weight: 12 },
    { pattern: /^(place|pos|position|overall|rank)$/i, weight: 8 },
    { pattern: /(place|rank|pos)/i, weight: 4 },
    { pattern: /(div|age\s*group|ag)\s*\/?\s*tot/i, weight: 6 },
    { pattern: /^(sex|gender|s|m\/f)$/i, weight: 4 },
    { pattern: /^(age|ag)$/i, weight: 4 },
    { pattern: /^(bib|no|num|number)$/i, weight: 3 },
    { pattern: /^pace$/i, weight: 3 },
    { pattern: /^(city|town|state|club|team)$/i, weight: 2 }
];

// h:mm:ss, mm:ss, with optional decimals — the strongest hint a row is a result
const TIME_PATTERN = /^\s*\d{1,2}:\d{2}(:\d{2})?([.,]\d+)?\s*$/;
const TIME_ANYWHERE = /\d{1,2}:\d{2}(:\d{2})?/;

// Table headers scraped from the wild are routinely blank or repeated. Rows are
// keyed by header name, so dropping blanks while still indexing cells
// positionally would shift every later column onto the wrong header. Keep every
// column, in place, under a unique name.
function normaliseTableHeaders(rawHeaders) {
    const taken = new Set();
    return rawHeaders.map(function (raw, index) {
        const base = (raw || '').trim() || 'Column ' + (index + 1);
        let name = base;
        let n = 2;
        // Guard against a source that already contains "Pace (2)" literally.
        while (taken.has(name)) {
            name = base + ' (' + n + ')';
            n++;
        }
        taken.add(name);
        return name;
    });
}

// A header row of nothing but numbers is really a data row.
function looksLikeHeaderRow(rawHeaders) {
    return rawHeaders.some(function (h) {
        return h && !/^\d+$/.test(h);
    });
}

// How much does this look like a table of race results? Headers alone are not
// enough — plenty of pages label a layout table "name" — so the data is sampled
// too, and a table with no time-shaped values anywhere is almost certainly not
// results.
function scoreCandidate(headers, rows) {
    if (!headers.length || !rows.length) return 0;

    let score = 0;
    const matched = new Set();
    headers.forEach(function (header) {
        HEADER_SIGNALS.forEach(function (signal, index) {
            if (!matched.has(index) && signal.pattern.test(header.trim())) {
                matched.add(index);
                score += signal.weight;
            }
        });
    });

    // Sample up to 20 rows: how many hold something time-shaped?
    const sample = rows.slice(0, 20);
    let rowsWithTime = 0;
    sample.forEach(function (row) {
        const hasTime = Object.keys(row).some(function (key) {
            return TIME_PATTERN.test(String(row[key]));
        });
        if (hasTime) rowsWithTime++;
    });
    const timeRatio = rowsWithTime / sample.length;
    score += Math.round(timeRatio * 30);

    // Results pages are lists. More rows is more likely to be the real thing,
    // but with diminishing returns so a 5000-row table cannot drown out signal.
    score += Math.min(20, Math.round(Math.log10(rows.length + 1) * 10));

    // Two columns cannot carry a name, a time and a place.
    if (headers.length < 3) score -= 15;

    // No time anywhere in the sample: almost certainly navigation or layout.
    if (rowsWithTime === 0) score -= 40;

    return score;
}

// Pull every <table> out of the page, including nested ones, as candidates.
function tableCandidates($) {
    const candidates = [];

    $('table').each(function (tableIndex) {
        const element = $(this);

        // A table whose cells contain another table is a layout wrapper; the
        // inner one is picked up on its own pass.
        if (element.find('table').length > 0) return;

        let headerCells = [];
        let headerRow = element.find('thead tr').first();
        if (!headerRow.length) {
            headerRow = element.find('tr').first();
        }
        if (!headerRow.length) return;

        headerRow.find('th, td').each(function () {
            headerCells.push($(this).text().replace(/\s+/g, ' ').trim());
        });
        if (!headerCells.length || !looksLikeHeaderRow(headerCells)) return;

        const headers = normaliseTableHeaders(headerCells);

        // Every row that is not the header row we just used
        const rows = [];
        element.find('tr').each(function () {
            const row = $(this);
            if (row.is(headerRow)) return;

            const cells = row.find('td');
            if (!cells.length) return; // another header row

            const parsedRow = {};
            cells.each(function (index) {
                if (headers[index]) {
                    parsedRow[headers[index]] = $(this).text().replace(/\s+/g, ' ').trim();
                }
            });
            if (Object.keys(parsedRow).length > 0) {
                rows.push(parsedRow);
            }
        });

        if (!rows.length) return;

        const caption = element.find('caption').first().text().trim() ||
            element.prevAll('h1, h2, h3, h4').first().text().trim();

        candidates.push({
            source: 'table',
            index: tableIndex,
            label: caption || ('Table ' + (tableIndex + 1)),
            headers: headers,
            data: rows,
            score: scoreCandidate(headers, rows)
        });
    });

    return candidates;
}

// Fixed-width results inside <pre>, the classic club-site format:
//
//   Place Div/Tot  Name                  Ag S  Nettime  Pace
//   ===== ======== ===================== == =  =======  =====
//       1   1/25   John Smith            25 M    16:05   5:11
//
// The ruler line of ='s or -'s gives exact column boundaries, which is far more
// reliable than splitting on whitespace when names contain spaces.
function preCandidates($) {
    const candidates = [];

    $('pre').each(function (preIndex) {
        const text = $(this).text();
        const lines = text.split(/\r?\n/);

        // Find a ruler: a line of nothing but runs of = or - separated by spaces.
        // Runs of one are allowed — a sex column is a single character — but at
        // least one run must be long enough that prose like "a - b - c" is not
        // mistaken for a ruler.
        const rulerIndex = lines.findIndex(function (line) {
            if (!/^\s*[=-]+(\s+[=-]+)+\s*$/.test(line)) return false;
            return /[=-]{3,}/.test(line);
        });
        if (rulerIndex < 1) return;

        const ruler = lines[rulerIndex];
        const headerLine = lines[rulerIndex - 1];

        // Column spans come from the ruler's runs
        const spans = [];
        const runPattern = /[=-]+/g;
        let match;
        while ((match = runPattern.exec(ruler)) !== null) {
            spans.push({ start: match.index, end: match.index + match[0].length });
        }
        if (spans.length < 3) return;

        // The last column often runs past the ruler, so let it take the rest
        spans[spans.length - 1].end = Math.max(
            spans[spans.length - 1].end,
            ...lines.slice(rulerIndex + 1).map(function (line) { return line.length; })
        );

        const sliceColumns = function (line) {
            return spans.map(function (span) {
                return line.slice(span.start, span.end).trim();
            });
        };

        const rawHeaders = sliceColumns(headerLine);
        if (!looksLikeHeaderRow(rawHeaders)) return;
        const headers = normaliseTableHeaders(rawHeaders);

        const rows = [];
        lines.slice(rulerIndex + 1).forEach(function (line) {
            if (!line.trim()) return;
            const cells = sliceColumns(line);
            // A line that is blank in every column but one is a section title
            if (cells.filter(function (cell) { return cell; }).length < 2) return;

            const row = {};
            cells.forEach(function (cell, index) {
                row[headers[index]] = cell;
            });
            rows.push(row);
        });

        if (!rows.length) return;

        candidates.push({
            source: 'pre',
            index: preIndex,
            label: 'Preformatted block ' + (preIndex + 1),
            headers: headers,
            data: rows,
            score: scoreCandidate(headers, rows)
        });
    });

    return candidates;
}

// Every plausible results table on the page, best first.
function findResultTables(html) {
    const $ = cheerio.load(html);
    const candidates = tableCandidates($).concat(preCandidates($));

    // Anything with no time-like data and no result-ish headers is noise
    const plausible = candidates.filter(function (candidate) {
        return candidate.score > 0;
    });

    plausible.sort(function (a, b) {
        return b.score - a.score;
    });

    return {
        pageTitle: $('title').text().trim(),
        candidates: plausible
    };
}

// The best candidate, in the shape the extract endpoint returns. tableIndex
// picks a specific one instead, for when the top guess is wrong.
function parseResultsTableFromHtml(html, tableIndex) {
    const found = findResultTables(html);
    if (!found.candidates.length) return null;

    const chosen = (tableIndex !== undefined && tableIndex !== null && found.candidates[tableIndex]) ||
        found.candidates[0];

    return {
        headers: chosen.headers,
        data: chosen.data,
        pageTitle: found.pageTitle,
        // A summary of what else was on the page, so the admin can switch.
        tables: found.candidates.map(function (candidate, index) {
            return {
                index: index,
                label: candidate.label,
                rows: candidate.data.length,
                columns: candidate.headers.length,
                source: candidate.source,
                score: candidate.score
            };
        })
    };
}

module.exports = {
    findResultTables: findResultTables,
    parseResultsTableFromHtml: parseResultsTableFromHtml,
    normaliseTableHeaders: normaliseTableHeaders,
    looksLikeHeaderRow: looksLikeHeaderRow
};
