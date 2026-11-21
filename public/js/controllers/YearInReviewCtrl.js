// A year in review (views/yearInReview.html): a member's year
// (/members/:member/year-in-review/:year) or the team's, a Stats tab
// (/stats/year-in-review/:year). The figures come from the server
// (app/yearInReview.js), and so does the share image.
angular.module('mcrrcApp.members').controller('YearInReviewController', ['$scope', '$http', '$state', '$stateParams', '$window', 'PageTitleService', 'Analytics',
    function ($scope, $http, $state, $stateParams, $window, PageTitleService, Analytics) {

    $scope.isTeam = $state.current.name === '/stats/year-in-review';
    $scope.username = $stateParams.member;

    // No year asked for: early in the year, the one just finished
    function defaultYear() {
        var now = new Date();
        return now.getMonth() < 2 ? now.getFullYear() - 1 : now.getFullYear();
    }
    $scope.year = parseInt($stateParams.year, 10) || defaultYear();
    // The year picker's model ("picked" is the share image's picks)
    $scope.yearPicker = { year: $scope.year };
    $scope.today = new Date();
    $scope.loading = true;

    var api = $scope.isTeam
        ? '/api/year-in-review/team/' + $scope.year
        : '/api/year-in-review/members/' + encodeURIComponent($scope.username) + '/' + $scope.year;
    // The share image: the page shows the WebP (a tenth of the PNG's size);
    // the PNG is what gets shared and copied, made from it here (prepareShare)
    var imageQuery = '';
    function imageUrl(format) {
        return api + '/image.' + format + imageQuery;
    }
    $scope.imageUrl = imageUrl('webp');
    $scope.imagePngUrl = imageUrl('png');

    $http.get(api).then(function (res) {
        var y = res.data;
        $scope.y = y;
        $scope.loading = false;
        $scope.maxMonth = Math.max.apply(null, y.months.concat([1]));
        $scope.places = y.totals.states.length + y.totals.countries.filter(function (c) { return c.code !== 'USA'; }).length;
        // The years to pick from: the member's own, or every season; this one first
        $scope.years = y.years && y.years.length ? y.years.slice() : [$scope.year];
        if ($scope.years.indexOf($scope.year) === -1) $scope.years.unshift($scope.year);
        if ($scope.isTeam) {
            $scope.boards = [
                { title: 'Most races', list: y.leaders.races, unit: 'races' },
                { title: 'Most miles', list: y.leaders.miles, unit: 'mi' },
                { title: 'Most personal bests', list: y.leaders.pbs, unit: 'PBs' },
                { title: 'Best age grade', list: y.leaders.agegrade, unit: '%' }
            ];
            // Who joined, for the tile's tooltip
            var names = function (list) { return list.map(function (m) { return m.name; }).join(', '); };
            $scope.joinedTitle = (y.joined.new.length ? 'New: ' + names(y.joined.new) : '') +
                (y.joined.new.length && y.joined.returning.length ? '\n' : '') +
                (y.joined.returning.length ? 'Returning: ' + names(y.joined.returning) : '');
            PageTitleService.set($scope, 'Team ' + y.year + ' in Review');
        } else {
            $scope.member = y.member;
            PageTitleService.set($scope, y.member.firstname + ' ' + y.member.lastname + ': ' + y.year + ' in Review');
        }
        if (!$scope.isTeam) setUpPicks();
        prepareShare();
    }, function (res) {
        $scope.loading = false;
        $scope.notFound = res.status === 404;
        $scope.loadError = res.status !== 404;
    });

    $scope.pickYear = function () {
        if ($scope.yearPicker.year === $scope.year) return;
        Analytics.event('view_switch', { from: 'year_' + $scope.year, to: 'year_' + $scope.yearPicker.year });
        $state.go('.', { year: $scope.yearPicker.year, race: null, place: null, stat: null });
    };

    // "4h 12m" from centiseconds; whole hours past a day of racing
    $scope.hoursRacing = function (centiseconds) {
        var minutes = Math.round((centiseconds || 0) / 6000);
        var h = Math.floor(minutes / 60);
        var m = minutes % 60;
        if (h >= 24) return h + 'h';
        return h ? h + 'h ' + m + 'm' : m + 'm';
    };

    // +3 / −2 against last year, nothing when the same or no last year
    $scope.change = function (now, before, digits) {
        if (before == null || now == null) return '';
        var diff = Math.round((now - before) * Math.pow(10, digits || 0)) / Math.pow(10, digits || 0);
        if (!diff) return '';
        return (diff > 0 ? '+' : '−') + Math.abs(diff).toLocaleString('en-US') + ' vs ' + ($scope.year - 1);
    };

    // "6:12/mi" from seconds a mile
    $scope.paceText = function (seconds) {
        var s = Math.round(seconds || 0);
        return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2) + '/mi';
    };

    $scope.monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    $scope.hasHighlights = function (y) {
        return y && (y.bestAgeGrade || y.pbs.length || y.teamRecords.length || y.milestones.length || y.awards.length ||
            y.birthdayRaces.length || y.ranking.overallPodiums || y.ranking.genderPodiums || y.ranking.ageWins ||
            y.totals.newPlaces.length || y.firstYear);
    };

    // ---- The share image's picks: best race, which place, the food ----
    // In the address (?race=&place=&food=), so a link shared after picking
    // previews the same image; left out when they are the best guess.
    var PLACE_ORDER = ['overall', 'gender', 'age'];
    $scope.placeLabels = { overall: 'Overall', gender: 'Gender', age: 'Age group' };
    $scope.statIcons = { pbdrop: '⏱️', rank: '🏆', favorite: '❤️', agegrade: '📈', streak: '🔁', newplaces: '🗺️', teammates: '🤝', time: '⌛', miles: '👟' };
    $scope.picks = {};

    function choiceFor(resultId) {
        return ($scope.y.fun.raceChoices || []).filter(function (c) { return c.resultId === resultId; })[0] || null;
    }

    function setUpPicks() {
        var fun = $scope.y.fun;
        var guess = fun.bestRace || {};
        var race = choiceFor($stateParams.race) || choiceFor(guess.resultId);
        $scope.picks = {
            race: race ? race.resultId : null,
            place: race && race.places[$stateParams.place] ? $stateParams.place
                : (race && race.resultId === guess.resultId ? guess.place : (race ? PLACE_ORDER.filter(function (k) { return race.places[k]; })[0] : null)),
            food: ($scope.y.foods || []).some(function (f) { return f.key === $stateParams.food; }) ? $stateParams.food : 'poptart',
            stat: (fun.stats || []).some(function (x) { return x.key === $stateParams.stat; }) ? $stateParams.stat : (fun.stat ? fun.stat.key : null),
            bg: ($stateParams.bg === 'photo' && $scope.y.member.hasPhoto) || $stateParams.bg === 'plain' ? $stateParams.bg : 'calendar'
        };
        applyPicks(false);
    }

    // A race picked: its own best place (the guessed one for the guessed race)
    $scope.pickRace = function () {
        var race = choiceFor($scope.picks.race);
        var guess = $scope.y.fun.bestRace || {};
        if (race && !race.places[$scope.picks.place]) {
            $scope.picks.place = race.resultId === guess.resultId ? guess.place : PLACE_ORDER.filter(function (k) { return race.places[k]; })[0];
        }
        applyPicks(true);
    };

    $scope.pickPlace = function (place) {
        var race = choiceFor($scope.picks.race);
        if (!race || !race.places[place]) return;
        $scope.picks.place = place;
        applyPicks(true);
    };

    $scope.pickFood = function () { applyPicks(true); };
    $scope.pickStat = function () { applyPicks(true); };
    $scope.pickBackground = function (bg) {
        if ($scope.picks.bg === bg) return;
        $scope.picks.bg = bg;
        applyPicks(true);
    };

    $scope.pickedRaceHas = function (place) {
        var race = choiceFor($scope.picks.race);
        return !!(race && race.places[place]);
    };

    // The picked race and food as shown, worked out once per pick (not in
    // a watched function: a new object each time would never settle)
    $scope.picked = { race: null, food: null };
    function updatePicked() {
        var race = choiceFor($scope.picks.race);
        var p = race && race.places[$scope.picks.place];
        $scope.picked.race = p ? angular.extend({}, race, { place: $scope.picks.place, rank: p.rank, total: p.total }) : null;
        $scope.picked.food = ($scope.y.foods || []).filter(function (f) { return f.key === $scope.picks.food; })[0] || null;
        $scope.picked.placeText = $scope.placeText($scope.picked.race);
    }

    // "1st of 230 women", "2nd of 412 overall", "1st in age group"
    $scope.placeText = function (race) {
        if (!race) return '';
        var n = race.rank, v = n % 100;
        var ord = n + (v >= 11 && v <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'));
        var sex = $scope.y.member.sex;
        var group = race.place === 'overall' ? 'overall'
            : race.place === 'gender' ? (sex === 'Female' ? 'women' : sex === 'Male' ? 'men' : 'in gender') : 'in age group';
        return race.total ? ord + ' of ' + race.total.toLocaleString('en-US') + ' ' + group : ord + ' ' + group;
    };

    // The picks that differ from the guess, for the image's and page's address
    function pickParams() {
        var guess = ($scope.y.fun && $scope.y.fun.bestRace) || {};
        var out = { race: null, place: null, food: null, stat: null, bg: null };
        if ($scope.picks.bg && $scope.picks.bg !== 'calendar') out.bg = $scope.picks.bg;
        var statGuess = $scope.y.fun && $scope.y.fun.stat ? $scope.y.fun.stat.key : null;
        if ($scope.picks.stat && $scope.picks.stat !== statGuess) out.stat = $scope.picks.stat;
        if ($scope.picks.race && $scope.picks.race !== guess.resultId) out.race = $scope.picks.race;
        if ($scope.picks.place && (out.race || $scope.picks.place !== guess.place)) out.place = $scope.picks.place;
        if ($scope.picks.food && $scope.picks.food !== 'poptart') out.food = $scope.picks.food;
        return out;
    }

    function applyPicks(changed) {
        updatePicked();
        var params = pickParams();
        var query = Object.keys(params).filter(function (k) { return params[k]; })
            .map(function (k) { return k + '=' + encodeURIComponent(params[k]); }).join('&');
        imageQuery = query ? '?' + query : '';
        $scope.imageUrl = imageUrl('webp');
        $scope.imagePngUrl = imageUrl('png');
        if (changed) {
            $scope.copiedImage = false;
            $state.go('.', params, { location: 'replace' });
            prepareShare();
        }
    }

    // ---- Sharing ----
    // The page's address, for the share sheet and copying
    $scope.pageUrl = function () {
        // $state.params: the picks as they are now, not as the page opened
        return $window.location.origin + $state.href($state.current.name, angular.extend({}, $state.params, { year: $scope.year }));
    };

    function shareTitle() {
        var y = $scope.y;
        return $scope.isTeam ? 'MCRRC Racing Team – ' + y.year + ' in review'
            : y.member.firstname + ' ' + y.member.lastname + ' – ' + y.year + ' in review';
    }

    $scope.canShare = !!($window.navigator && $window.navigator.share);

    // Copying the image: where the browser can put an image on the clipboard
    $scope.canCopyImage = !!($window.ClipboardItem && $window.navigator.clipboard && $window.navigator.clipboard.write);

    // The image, ready once the page is in, before any tap: a phone opens
    // its share sheet (and Safari copies) only straight from the tap, not
    // after waiting for a download. A PNG, the one image format clipboards
    // take and every app opens, drawn from the WebP the page shows (the same
    // download); the server's PNG only if that fails.
    var shareFile = null;
    var imageBlob = null;

    function fetchBlob(url) {
        return $window.fetch(url).then(function (res) {
            if (!res.ok) throw new Error('No image');
            return res.blob();
        });
    }

    // A PNG of an image blob, through a canvas. Native promises throughout:
    // the ClipboardItem takes this one.
    function toPng(blob) {
        return new $window.Promise(function (resolve, reject) {
            var url = $window.URL.createObjectURL(blob);
            var img = new $window.Image();
            img.onload = function () {
                var canvas = $window.document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                canvas.getContext('2d').drawImage(img, 0, 0);
                $window.URL.revokeObjectURL(url);
                canvas.toBlob(function (png) {
                    if (png) resolve(png); else reject(new Error('Could not make the PNG'));
                }, 'image/png');
            };
            img.onerror = function () {
                $window.URL.revokeObjectURL(url);
                reject(new Error('Could not read the image'));
            };
            img.src = url;
        });
    }

    function prepareShare() {
        shareFile = null;
        imageBlob = null;
        if (!$window.Blob || (!$scope.canShare && !$scope.canCopyImage)) return;
        var pngUrl = $scope.imagePngUrl;
        imageBlob = fetchBlob($scope.imageUrl).then(toPng).catch(function () {
            return fetchBlob(pngUrl);
        }).then(function (blob) {
            var png = blob.type === 'image/png' ? blob : new $window.Blob([blob], { type: 'image/png' });
            if ($scope.canShare && $window.File) {
                var file = new $window.File([png], 'mcrrc-' + $scope.year + '-in-review.png', { type: 'image/png' });
                var nav = $window.navigator;
                if (nav.canShare && nav.canShare({ files: [file] })) shareFile = file;
            }
            return png;
        });
        imageBlob.catch(angular.noop);
    }

    // Onto the clipboard, to paste in a message, a post, an email. The
    // ClipboardItem takes the (native) promise of the image, as Safari wants
    // the copy started in the tap itself.
    $scope.copyImage = function () {
        $scope.copyImageError = false;
        Analytics.event('share', { content_type: 'year_in_review', method: 'copy_image', item_id: ($scope.isTeam ? 'team' : $scope.username) + '_' + $scope.year });
        if (!imageBlob) prepareShare();
        try {
            $window.navigator.clipboard.write([new $window.ClipboardItem({ 'image/png': imageBlob })]).then(function () {
                $scope.copiedImage = true;
                $scope.$applyAsync();
            }, function () {
                $scope.copyImageError = true;
                $scope.$applyAsync();
            });
        } catch (e) {
            $scope.copyImageError = true;
        }
    };

    // A phone's share sheet with the image (where it can take files), else
    // with the link; a computer: the image opens to save
    $scope.share = function () {
        var nav = $window.navigator;
        Analytics.event('share', { content_type: 'year_in_review', item_id: ($scope.isTeam ? 'team' : $scope.username) + '_' + $scope.year });
        if (!nav.share) {
            $window.open($scope.imagePngUrl, '_blank');
            return;
        }
        var title = shareTitle();
        var sharing = shareFile
            ? nav.share({ files: [shareFile], title: title, text: title + ' ' + $scope.pageUrl() })
            : nav.share({ title: title, url: $scope.pageUrl() });
        if (sharing && sharing.catch) sharing.catch(angular.noop);
    };

    $scope.copied = false;
    $scope.copyLink = function () {
        var url = $scope.pageUrl();
        var done = function () { $scope.copied = true; $scope.$applyAsync(); };
        if ($window.navigator.clipboard) $window.navigator.clipboard.writeText(url).then(done, angular.noop);
    };
}]);
