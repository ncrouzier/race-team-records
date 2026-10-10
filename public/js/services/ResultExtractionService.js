// Shared result-scraping logic.
//
// The result extractor page builds brand new races from a results URL; the race
// edit modal points at the same URL to fill in ranking data that is already
// stored but incomplete. Both need the same three things: guess what each column
// of the scraped table means, turn a row into a time and a set of rankings, and
// work out which team member a row belongs to.
angular.module('mcrrcApp').factory('ResultExtractionService', ['$http', function ($http) {

    var factory = {};

    // The fields a scraped column can be mapped to. Shared so the extractor page
    // and the race edit modal offer exactly the same choices.
    factory.mappableFields = [
        { value: 'place', label: 'Overall Ranking' },
        { value: 'genderRank', label: 'Gender Ranking' },
        { value: 'ageRank', label: 'Age Ranking' },
        { value: 'name', label: 'Full Name' },
        { value: 'firstname', label: 'First Name' },
        { value: 'lastname', label: 'Last Name' },
        { value: 'time', label: 'Time' },
        { value: 'gender', label: 'Gender/Sex' },
        { value: 'ageGroup', label: 'Age/Division Group' }
    ];

    // Fields still free to assign to this header: a field already mapped to a
    // different column is not offered twice.
    factory.availableFieldsFor = function (columnMapping, header) {
        return factory.mappableFields.filter(function (field) {
            if (columnMapping[header] === field.value) return true;
            return !Object.keys(columnMapping).some(function (other) {
                return other !== header && columnMapping[other] === field.value;
            });
        });
    };

    // Scrape a results table. Mirrors what the extractor page posts.
    // tableIndex picks a specific one of the tables found on the page; leave it
    // out for the best guess.
    factory.fetchTable = function (url, tableIndex) {
        return $http.post('/api/extract-table', {
            url: url,
            tableIndex: tableIndex
        }).then(function (response) {
            return response.data;
        });
    };

    // Same parsing, but on page source the admin pasted in. For hosts that
    // refuse server-side requests (Cloudflare 403), the browser can still load
    // the page, so pasting its source is the way through.
    factory.parseHtmlSource = function (htmlSource, tableIndex) {
        return $http.post('/api/extract-table', {
            htmlSource: htmlSource,
            tableIndex: tableIndex
        }).then(function (response) {
            return response.data;
        });
    };

    // Guess which scraped column holds which field. The rank columns are tested
    // before the plain gender/sex check: MCRRC writes the gender rank as
    // "Sex/Tot", which contains "sex" and would otherwise be claimed as the
    // gender column.
    // options.fallbackToGenericHeaders maps by common header names when the URL
    // is not a site we know. The extractor page leaves this off — it has a
    // mapping UI and has always started blank for unknown sites — while the race
    // edit modal turns it on, having no such UI of its own.
    factory.guessColumnMapping = function (url, headers, options) {
        var mapping = {};
        if (!headers) return mapping;
        url = url || '';
        options = options || {};

        headers.forEach(function (header) {
            var headerLower = header.toLowerCase();

            if (url.includes('runsignup.com')) {
                if (headerLower.includes('name')) {
                    mapping[header] = 'name';
                } else if (headerLower.includes('chip time') || headerLower.includes('finish')) {
                    mapping[header] = 'time';
                } else if (headerLower === 'place' || headerLower.includes('overall')) {
                    mapping[header] = 'place';
                } else if (headerLower.includes('gender place') || headerLower.includes('gender rank')) {
                    mapping[header] = 'genderRank';
                } else if (headerLower.includes('gender') || headerLower.includes('sex')) {
                    mapping[header] = 'gender';
                } else if (headerLower.includes('age place') || headerLower.includes('age rank')) {
                    mapping[header] = 'ageRank';
                }
            } else if (url.includes('parkrun.')) {
                if (headerLower.includes('name') || headerLower.includes('runner') || headerLower.includes('parkrunner')) {
                    mapping[header] = 'name';
                } else if (headerLower.includes('time') || headerLower.includes('finish')) {
                    mapping[header] = 'time';
                } else if (headerLower.includes('position') || headerLower.includes('place')) {
                    mapping[header] = 'place';
                } else if (headerLower === 'gender') {
                    mapping[header] = 'gender';
                } else if (headerLower === 'gender rank') {
                    mapping[header] = 'genderRank';
                } else if (headerLower.includes('age position') || headerLower.includes('age place')) {
                    mapping[header] = 'ageRank';
                }
            } else if (url.includes('mcrrc.org')) {
                if (headerLower === 'name') {
                    mapping[header] = 'name';
                } else if (headerLower === 'net time') {
                    mapping[header] = 'time';
                } else if (headerLower.includes('place') || headerLower.includes('overall')) {
                    mapping[header] = 'place';
                } else if (headerLower.includes('gen/tot') || headerLower.includes('sex/tot') || headerLower.includes('gender place') || headerLower.includes('gender rank')) {
                    mapping[header] = 'genderRank';
                } else if (headerLower.includes('div/tot') || headerLower.includes('age place') || headerLower.includes('age rank')) {
                    mapping[header] = 'ageRank';
                } else if (headerLower.includes('gender') || headerLower.includes('sex')) {
                    mapping[header] = 'gender';
                }
            } else if (url.includes('athlinks.com')) {
                if (headerLower === 'name') {
                    mapping[header] = 'name';
                } else if (headerLower === 'time') {
                    mapping[header] = 'time';
                } else if (headerLower === 'place') {
                    mapping[header] = 'place';
                } else if (headerLower === 'gender') {
                    mapping[header] = 'gender';
                } else if (headerLower === 'gender place') {
                    mapping[header] = 'genderRank';
                } else if (headerLower === 'division place') {
                    mapping[header] = 'ageRank';
                }
            }
        });

        if (options.fallbackToGenericHeaders) {
            applyGenericMapping(mapping, headers);
        }

        return mapping;
    };

    // Header spellings seen in the wild, with a priority so the best match wins
    // rather than whichever rule happened to be tested first. Without this,
    // "Gun Time" could claim the time column ahead of "Net Time", and a results
    // table with both "Sex" and "Sex/Tot" could map either to either.
    var GENERIC_RULES = [
        { field: 'name', priority: 30, pattern: /^(name|runner|parkrunner|athlete|participant)$/ },
        { field: 'name', priority: 20, pattern: /name/ },
        { field: 'firstname', priority: 32, pattern: /^(first\s*name|first|given\s*name)$/ },
        { field: 'lastname', priority: 32, pattern: /^(last\s*name|last|surname|family\s*name)$/ },

        // Net and chip time are the same idea and both beat gun time
        { field: 'time', priority: 30, pattern: /(net|chip)\s*time/ },
        { field: 'time', priority: 25, pattern: /^time$/ },
        { field: 'time', priority: 22, pattern: /finish/ },
        { field: 'time', priority: 20, pattern: /time/ },
        { field: 'time', priority: 15, pattern: /gun\s*time/ },

        { field: 'place', priority: 30, pattern: /^(place|pos|position|overall|rank|#)$/ },
        { field: 'place', priority: 18, pattern: /^overall\s*(place|pos|rank)$/ },

        // "12/345" columns, which carry the rank and the field size together
        { field: 'genderRank', priority: 32, pattern: /(gen|sex)\s*\/\s*tot/ },
        { field: 'genderRank', priority: 28, pattern: /(gender|sex)\s*(place|rank|pos)/ },
        { field: 'ageRank', priority: 32, pattern: /(div|age)\s*\/\s*tot/ },
        { field: 'ageRank', priority: 28, pattern: /(age|division|div)\s*(place|rank|pos)/ },

        // Plain group columns, used to derive a rank when no rank column exists
        { field: 'gender', priority: 26, pattern: /^(sex|gender|s|m\/f)$/ },
        { field: 'gender', priority: 12, pattern: /(gender|sex)/ },
        { field: 'ageGroup', priority: 24, pattern: /^(div|division|age\s*group|category|cat)$/ }
    ];

    // Each header takes at most the one field it matches best, then each field
    // takes the header that matched it most strongly. A bare "Age" holding a
    // number is deliberately left unmapped — treating it as an age group would
    // invent age-group ranks out of single ages.
    function applyGenericMapping(mapping, headers) {
        var best = {};

        headers.forEach(function (header) {
            if (mapping[header]) return; // already claimed by a site-specific rule
            var normalised = header.toLowerCase().replace(/\s+/g, ' ').trim();

            var match = null;
            GENERIC_RULES.forEach(function (rule) {
                if (!rule.pattern.test(normalised)) return;
                if (!match || rule.priority > match.priority) {
                    match = rule;
                }
            });
            if (!match) return;

            if (!best[match.field] || match.priority > best[match.field].priority) {
                best[match.field] = { header: header, priority: match.priority };
            }
        });

        Object.keys(best).forEach(function (field) {
            mapping[best[field].header] = field;
        });
    }

    factory.columnFor = function (columnMapping, field) {
        return Object.keys(columnMapping || {}).find(function (key) {
            return columnMapping[key] === field;
        });
    };

    factory.cleanTime = function (timeStr) {
        if (!timeStr) return 0;
        // Remove any non-numeric characters except for colons and periods
        timeStr = timeStr.toString().replace(/[^0-9:.]/g, '');

        if (timeStr.includes(':')) {
            var parts = timeStr.split(':');
            if (parts.length === 2) {
                // MM:SS
                return (parseInt(parts[0]) * 60 + parseFloat(parts[1])) * 100;
            } else if (parts.length === 3) {
                // HH:MM:SS
                return (parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2])) * 100;
            }
        }
        // If it's just a number, assume it's seconds
        return parseFloat(timeStr) * 100;
    };

    // "12/345" -> {rank: 12, total: 345}; "12" -> {rank: 12}
    function parseRankCell(value) {
        var parsed = {};
        var text = value.toString().trim();
        if (text.includes('/')) {
            var parts = text.split('/');
            var rank = parseInt(parts[0]);
            var total = parseInt(parts[1]);
            if (!isNaN(rank)) parsed.rank = rank;
            if (!isNaN(total)) parsed.total = total;
        } else {
            var single = parseInt(text);
            if (!isNaN(single)) parsed.rank = single;
        }
        return parsed;
    }

    // Count rows sharing a value in a column, and the row's position among them.
    // Used when a site gives a group (gender, age band) but no rank within it.
    function rankWithinGroup(tableData, row, column, stripDigits) {
        var valueOf = function (candidate) {
            var text = (candidate[column] || '').toString();
            return (stripDigits ? text.replace(/[0-9]/g, '') : text).trim();
        };
        var value = valueOf(row);
        var group = tableData.filter(function (candidate) {
            return valueOf(candidate) === value;
        });
        var index = group.indexOf(row);
        return index < 0 ? null : { rank: index + 1, total: group.length };
    }

    // Turn one scraped row into {firstname, lastname, time, ranking}. Returns
    // null when the row has no usable name or time.
    // options.stripDigitsFromGender is for parkrun, which writes "Male12".
    factory.parseRow = function (row, columnMapping, tableData, options) {
        options = options || {};
        var col = function (field) { return factory.columnFor(columnMapping, field); };
        var parsed = { ranking: {} };

        var nameColumn = col('name');
        var firstNameColumn = col('firstname');
        var lastNameColumn = col('lastname');
        if (nameColumn && row[nameColumn]) {
            var nameParts = row[nameColumn].toString().trim().split(/\s+/);
            if (nameParts.length < 2) return null;
            parsed.firstname = nameParts[0];
            parsed.lastname = nameParts.slice(1).join(' ');
        } else if (firstNameColumn && lastNameColumn && row[firstNameColumn] && row[lastNameColumn]) {
            parsed.firstname = row[firstNameColumn].toString().trim();
            parsed.lastname = row[lastNameColumn].toString().trim();
        } else {
            return null;
        }

        var timeColumn = col('time');
        if (!timeColumn || !row[timeColumn]) return null;
        var timeStr = row[timeColumn].toString().trim();
        if (options.stripPersonalBest) {
            timeStr = timeStr.split('PB')[0].trim();
        }
        parsed.time = factory.cleanTime(timeStr);

        // Gender rank, either given directly or derived from the gender column
        var genderRankColumn = col('genderRank');
        var genderColumn = col('gender');
        if (genderRankColumn && row[genderRankColumn]) {
            var gender = parseRankCell(row[genderRankColumn]);
            if (gender.rank !== undefined) parsed.ranking.genderrank = gender.rank;
            if (gender.total !== undefined) {
                parsed.ranking.gendertotal = gender.total;
            } else if (gender.rank !== undefined && genderColumn && row[genderColumn]) {
                var sameGender = rankWithinGroup(tableData, row, genderColumn, options.stripDigitsFromGender);
                if (sameGender) parsed.ranking.gendertotal = sameGender.total;
            }
        } else if (genderColumn && row[genderColumn]) {
            var genderGroup = rankWithinGroup(tableData, row, genderColumn, options.stripDigitsFromGender);
            if (genderGroup) {
                parsed.ranking.genderrank = genderGroup.rank;
                parsed.ranking.gendertotal = genderGroup.total;
            }
        }

        // Age group rank, same two shapes
        var ageRankColumn = col('ageRank');
        var ageGroupColumn = col('ageGroup');
        if (ageRankColumn && row[ageRankColumn]) {
            var age = parseRankCell(row[ageRankColumn]);
            if (age.rank !== undefined) parsed.ranking.agerank = age.rank;
            if (age.total !== undefined) {
                parsed.ranking.agetotal = age.total;
            } else if (age.rank !== undefined && ageGroupColumn && row[ageGroupColumn]) {
                var sameAge = rankWithinGroup(tableData, row, ageGroupColumn, false);
                if (sameAge) parsed.ranking.agetotal = sameAge.total;
            }
        } else if (ageGroupColumn && row[ageGroupColumn]) {
            var ageGroup = rankWithinGroup(tableData, row, ageGroupColumn, false);
            if (ageGroup) {
                parsed.ranking.agerank = ageGroup.rank;
                parsed.ranking.agetotal = ageGroup.total;
            }
        }

        // Overall place, with the field size taken from the biggest place in the
        // table — the last finisher's place is the number of finishers.
        var placeColumn = col('place');
        if (placeColumn) {
            if (row[placeColumn]) {
                var place = parseInt(row[placeColumn]);
                if (!isNaN(place)) parsed.ranking.overallrank = place;
            }
            var fieldSize = Math.max.apply(null, tableData.map(function (candidate) {
                var candidatePlace = parseInt(candidate[placeColumn]);
                return isNaN(candidatePlace) ? 0 : candidatePlace;
            }));
            if (fieldSize > 0) parsed.ranking.overalltotal = fieldSize;
        }

        return parsed;
    };

    factory.normalizeName = function (name) {
        return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    };

    // Fuzzy full-name match, including a member's recorded alternate names.
    factory.matchMember = function (firstname, lastname, members) {
        var resultFullName = factory.normalizeName(firstname + ' ' + lastname);
        if (!resultFullName) return null;

        return (members || []).find(function (member) {
            var memberFullName = factory.normalizeName(member.firstname + ' ' + member.lastname);
            if (resultFullName === memberFullName ||
                resultFullName.includes(memberFullName) ||
                memberFullName.includes(resultFullName)) {
                return true;
            }
            if (member.alternateFullNames && member.alternateFullNames.length > 0) {
                return member.alternateFullNames.some(function (altName) {
                    var normalizedAltName = factory.normalizeName(altName);
                    return normalizedAltName && (resultFullName === normalizedAltName ||
                        resultFullName.includes(normalizedAltName) ||
                        normalizedAltName.includes(resultFullName));
                });
            }
            return false;
        }) || null;
    };

    // Was this member on the team on a given day? An open-ended membership
    // period runs to today. Matching a race against the roster of the day keeps
    // a 2014 race from being matched to someone who joined in 2022 — and keeps
    // members who have since left from being missed.
    factory.wasActiveOn = function (member, date) {
        if (!member || !date) return false;
        var when = new Date(date).getTime();
        if (isNaN(when)) return false;
        if (!member.membershipDates || member.membershipDates.length === 0) {
            return false;
        }
        return member.membershipDates.some(function (period) {
            if (!period.start) return false;
            var start = new Date(period.start).getTime();
            var end = period.end ? new Date(period.end).getTime() : Date.now();
            return when >= start && when <= end;
        });
    };

    factory.membersActiveOn = function (members, date) {
        return (members || []).filter(function (member) {
            return factory.wasActiveOn(member, date);
        });
    };

    return factory;
}]);
