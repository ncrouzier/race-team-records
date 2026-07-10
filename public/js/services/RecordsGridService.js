angular.module('mcrrcApp.results').factory('RecordsGridService', ['$sce', function ($sce) {

    var SURFACE_GROUPS = {
        'Road': ['road'],
        'Ultra': ['ultra'],
        'Track': ['track'],
        'Trail': ['trail'],
        'Custom': ['road', 'ultra', 'track', 'trail']
    };

    var COLOR_PALETTE = [
        // indigo / violet
        '#312e81', '#3730a3', '#4338ca', '#4f46e5', '#6366f1',
        '#4c1d95', '#5b21b6', '#6d28d9', '#7c3aed', '#8b5cf6',
        '#7e22ce', '#9333ea',
        // fuchsia / purple-pink
        '#a855f7', '#86198f', '#a21caf', '#c026d3', '#d946ef',
        '#701a75', '#831843', '#9d174d',
        // pink / rose
        '#be185d', '#db2777', '#ec4899',
        '#881337', '#9f1239', '#be123c',
        // red
        '#e11d48', '#7f1d1d', '#991b1b', '#b91c1c', '#dc2626', '#ef4444', '#c62828',
        // orange / red-orange
        '#7c2d12', '#9a3412', '#c2410c', '#ea580c', '#f97316', '#bf360c', '#e64a19',
        // amber / warm orange
        '#78350f', '#92400e', '#b45309', '#d97706', '#f59e0b', '#e65100', '#ef6c00',
        // yellow / lime (dark shades)
        '#713f12', '#854d0e', '#a16207', '#ca8a04',
        '#365314', '#3f6212', '#4d7c0f', '#65a30d',
        // green
        '#14532d', '#166534', '#15803d', '#16a34a', '#1b5e20', '#2e7d32', '#388e3c', '#43a047',
        // emerald / jade
        '#064e3b', '#065f46', '#047857', '#059669', '#10b981', '#00695c', '#00796b',
        // teal
        '#134e4a', '#115e59', '#0f766e', '#0d9488', '#14b8a6', '#004d40', '#00897b',
        // cyan
        '#164e63', '#155e75', '#0e7490', '#0891b2', '#06b6d4', '#006064', '#00838f',
        // sky / blue
        '#0c4a6e', '#075985', '#0369a1', '#0284c7', '#0ea5e9',
        '#1e3a8a', '#1e40af', '#1d4ed8', '#2563eb',
        // blue (material)
        '#3b82f6', '#0d47a1', '#1565c0', '#1976d2', '#1e88e5', '#283593', '#303f9f', '#3949ab',
        // indigo / blue-gray
        '#5c6bc0', '#263238', '#37474f', '#455a64', '#0097a7', '#00acc1',
        // deep purple / magenta
        '#4a148c', '#6a1b9a', '#7b1fa2', '#8e24aa', '#880e4f', '#ad1457', '#c2185b', '#d81b60',
        // brown / warm neutral
        '#3e2723', '#4e342e', '#5d4037', '#6d4c41', '#78909c',
    ];

    var GROUP_LABELS = { 'road': 'Road', 'ultra': 'Ultra', 'track': 'Track', 'trail': 'Trail' };

    // ─── Public helpers ───────────────────────────────────────────────────────

    function getMemberKey(member) {
        return member.username || (member.firstname + member.lastname);
    }

    function getInitials(member) {
        return (member.firstname.charAt(0) + member.lastname.charAt(0)).toUpperCase();
    }

    function calculateAgeAtDate(birthday, date) {
        var bd = new Date(birthday);
        var d = new Date(date);
        var age = d.getUTCFullYear() - bd.getUTCFullYear();
        if (d.getUTCMonth() < bd.getUTCMonth() ||
            (d.getUTCMonth() === bd.getUTCMonth() && d.getUTCDate() < bd.getUTCDate())) {
            age--;
        }
        return Math.max(0, age);
    }

    // ─── processRaces ─────────────────────────────────────────────────────────
    // opts.getRowKey(race, member) → row key (age number or year number)
    // opts.requireDateOfBirth      → skip members without DOB when true
    // Returns { allRecordsByTime, allRecordsByAgeGrade, allDistances }

    function processRaces(races, opts) {
        var allRecordsByTime = {};
        var allRecordsByAgeGrade = {};
        var allDistances = {};

        races.forEach(function (race) {
            if (!race.racetype || race.racetype.isVariable) return;
            if (race.isMultisport) return;
            var surface = race.racetype.surface;
            if (['road', 'track', 'ultra', 'trail'].indexOf(surface) === -1) return;

            var distanceName = race.racetype.name;
            var distKey = surface + '|' + distanceName;

            if (!allDistances[distKey]) {
                allDistances[distKey] = {
                    name: distanceName,
                    meters: race.racetype.meters,
                    surface: surface,
                    key: distKey
                };
            }

            if (!race.results || !race.results.length) return;

            race.results.forEach(function (result) {
                if (!result.members || result.members.length !== 1) return;
                if (result.isRecordEligible === false) return;

                var member = result.members[0];
                if (opts.requireDateOfBirth && !member.dateofbirth) return;

                var rowKey = opts.getRowKey(race, member);
                var recordKey = surface + '|' + member.sex + '|' + rowKey + '|' + distanceName;

                if (result.time && result.time > 0) {
                    if (!allRecordsByTime[recordKey] || result.time < allRecordsByTime[recordKey].time) {
                        allRecordsByTime[recordKey] = {
                            time: result.time,
                            member: member,
                            racename: race.racename,
                            racedate: race.racedate,
                            raceid: race._id,
                            agegrade: result.agegrade,
                            rowKey: rowKey,
                            surface: surface,
                            racetype: race.racetype
                        };
                    }
                }

                if (result.agegrade && result.agegrade > 0) {
                    if (!allRecordsByAgeGrade[recordKey] || result.agegrade > allRecordsByAgeGrade[recordKey].agegrade) {
                        allRecordsByAgeGrade[recordKey] = {
                            time: result.time || 0,
                            member: member,
                            racename: race.racename,
                            racedate: race.racedate,
                            raceid: race._id,
                            agegrade: result.agegrade,
                            rowKey: rowKey,
                            surface: surface,
                            racetype: race.racetype
                        };
                    }
                }
            });
        });

        return { allRecordsByTime: allRecordsByTime, allRecordsByAgeGrade: allRecordsByAgeGrade, allDistances: allDistances };
    }

    // Session-stable random colors: assigned once per member key, randomised each page load
    var memberColorCache = {};
    var availableColorIndices = (function () {
        var idx = [];
        for (var i = 0; i < COLOR_PALETTE.length; i++) idx.push(i);
        // Fisher-Yates shuffle
        for (var j = idx.length - 1; j > 0; j--) {
            var k = Math.floor(Math.random() * (j + 1));
            var tmp = idx[j]; idx[j] = idx[k]; idx[k] = tmp;
        }
        return idx;
    }());
    var colorCursor = 0;

    function getRandomMemberColor(memberKey) {
        if (!memberColorCache[memberKey]) {
            var idx = availableColorIndices[colorCursor % availableColorIndices.length];
            colorCursor++;
            memberColorCache[memberKey] = COLOR_PALETTE[idx];
        }
        return memberColorCache[memberKey];
    }

    // ─── buildGrid ────────────────────────────────────────────────────────────
    // opts.surfaceFilter
    // opts.sexFilter
    // opts.customDistanceSelection  { distKey: true/false }
    // opts.customDistancesLoaded    boolean
    // opts.rowSort                  comparator for row keys
    // opts.valueMode                'time' (default) | 'agegrade'
    //
    // Returns a plain data bundle — no $scope mutations.

    function buildGrid(allRecords, allDistances, opts) {
        var combined = {};
        var distancesUsed = {};
        var allowedSurfaces = SURFACE_GROUPS[opts.surfaceFilter] || ['road'];
        var isAgeGrade = opts.valueMode === 'agegrade';

        var sexesToInclude = [];
        if (opts.sexFilter === 'Men' || opts.sexFilter === 'Both') sexesToInclude.push('Male');
        if (opts.sexFilter === 'Women' || opts.sexFilter === 'Both') sexesToInclude.push('Female');

        Object.keys(allRecords).forEach(function (key) {
            var parts = key.split('|');
            var surface = parts[0];
            var sex = parts[1];
            var rowKey = parts[2];
            var dist = parts[3];
            var distKey = surface + '|' + dist;

            if (allowedSurfaces.indexOf(surface) === -1) return;
            if (sexesToInclude.indexOf(sex) === -1) return;

            if (!combined[rowKey]) combined[rowKey] = {};
            var rec = allRecords[key];
            var isBetter = isAgeGrade
                ? (!combined[rowKey][distKey] || (rec.agegrade || 0) > (combined[rowKey][distKey].agegrade || 0))
                : (!combined[rowKey][distKey] || rec.time < combined[rowKey][distKey].time);
            if (isBetter) {
                combined[rowKey][distKey] = rec;
                distancesUsed[distKey] = true;
            }
        });

        // All-time row: best per distance regardless of row
        var allTimeRow = {};
        Object.keys(combined).forEach(function (rowKey) {
            Object.keys(combined[rowKey]).forEach(function (distKey) {
                var rec = combined[rowKey][distKey];
                var isBetter = isAgeGrade
                    ? (!allTimeRow[distKey] || (rec.agegrade || 0) > (allTimeRow[distKey].agegrade || 0))
                    : (!allTimeRow[distKey] || rec.time < allTimeRow[distKey].time);
                if (isBetter) allTimeRow[distKey] = rec;
            });
        });

        var rows = Object.keys(combined).map(Number).sort(opts.rowSort);

        var allSortedDistances = Object.keys(distancesUsed)
            .map(function (dk) { return allDistances[dk]; })
            .filter(Boolean)
            .sort(function (a, b) { return a.meters - b.meters; });

        // Custom distance handling
        var customDistanceSelection = opts.customDistanceSelection;
        var customDistancesLoaded = opts.customDistancesLoaded;
        var didInitCustomDistances = false;
        var allDistanceGroups = [];
        var distances = allSortedDistances;
        var totalCustomDistances = 0;

        if (opts.surfaceFilter === 'Custom') {
            var groups = {};
            allSortedDistances.forEach(function (d) {
                var label = GROUP_LABELS[d.surface] || d.surface;
                if (!groups[label]) groups[label] = [];
                groups[label].push(d);
            });
            allDistanceGroups = ['Road', 'Ultra', 'Track', 'Trail']
                .filter(function (label) { return !!groups[label]; })
                .map(function (label) { return { label: label, distances: groups[label] }; });

            if (!customDistancesLoaded) {
                customDistanceSelection = {};
                allSortedDistances.forEach(function (d) {
                    customDistanceSelection[d.key] = true;
                });
                didInitCustomDistances = true;
            }

            distances = allSortedDistances.filter(function (d) {
                return !!customDistanceSelection[d.key];
            });
            totalCustomDistances = allSortedDistances.length;
        }

        // Member colors (deterministic hash — same member always gets same color)
        var memberNames = {};
        Object.keys(combined).forEach(function (rowKey) {
            Object.keys(combined[rowKey]).forEach(function (distKey) {
                var rec = combined[rowKey][distKey];
                var k = getMemberKey(rec.member);
                if (!memberNames[k]) memberNames[k] = rec.member.firstname + ' ' + rec.member.lastname;
            });
        });
        var memberColors = {};
        Object.keys(memberNames).forEach(function (k) {
            memberColors[k] = getRandomMemberColor(k);
        });

        // Tooltips
        var tooltips = {};
        var allTimeTooltips = {};
        Object.keys(combined).forEach(function (rowKey) {
            tooltips[rowKey] = {};
            Object.keys(combined[rowKey]).forEach(function (distKey) {
                tooltips[rowKey][distKey] = buildTooltipHtml(combined[rowKey][distKey]);
            });
        });
        Object.keys(allTimeRow).forEach(function (distKey) {
            allTimeTooltips[distKey] = buildTooltipHtml(allTimeRow[distKey]);
        });

        // Member list (only visible distances)
        var visibleDistKeys = {};
        distances.forEach(function (d) { visibleDistKeys[d.key] = true; });
        var membersMap = {};
        Object.keys(combined).forEach(function (rowKey) {
            Object.keys(combined[rowKey]).forEach(function (distKey) {
                if (!visibleDistKeys[distKey]) return;
                var rec = combined[rowKey][distKey];
                var k = getMemberKey(rec.member);
                if (!membersMap[k]) {
                    membersMap[k] = {
                        key: k,
                        name: rec.member.firstname + ' ' + rec.member.lastname,
                        username: rec.member.username,
                        memberId: rec.member._id ? rec.member._id.toString() : null,
                        count: 0
                    };
                }
                membersMap[k].count++;
            });
        });
        var memberList = Object.keys(membersMap)
            .map(function (k) { return membersMap[k]; })
            .sort(function (a, b) { return b.count - a.count; });

        return {
            rows: rows,
            grid: combined,
            allTimeRow: allTimeRow,
            distances: distances,
            allDistanceGroups: allDistanceGroups,
            totalCustomDistances: totalCustomDistances,
            memberColors: memberColors,
            memberNames: memberNames,
            tooltips: tooltips,
            allTimeTooltips: allTimeTooltips,
            memberList: memberList,
            customDistanceSelection: customDistanceSelection,
            didInitCustomDistances: didInitCustomDistances
        };
    }

    // ─── Private ─────────────────────────────────────────────────────────────

    function buildTooltipHtml(record) {
        var dateStr = new Date(record.racedate).toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC'
        });
        var html = '<div class="age-record-tooltip">';
        html += '<div class="tt-name">' + record.member.firstname + ' ' + record.member.lastname + '</div>';
        html += '<div class="tt-race">' + record.racename + '</div>';
        html += '<div class="tt-date">' + dateStr + '</div>';
        html += '<div class="tt-time">' + secondsToTimeString(record.time) + '</div>';
        if (record.agegrade) html += '<div class="tt-ag">AG: ' + record.agegrade + '%</div>';
        if (record.rowKey !== undefined) html += '<div class="tt-age">Age ' + record.rowKey + '</div>';
        html += '</div>';
        return $sce.trustAsHtml(html);
    }

    return {
        SURFACE_GROUPS: SURFACE_GROUPS,
        getMemberKey: getMemberKey,
        getInitials: getInitials,
        calculateAgeAtDate: calculateAgeAtDate,
        processRaces: processRaces,
        buildGrid: buildGrid
    };
}]);
