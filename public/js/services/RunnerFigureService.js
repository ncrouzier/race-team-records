// Shared definition of the celebrating runner used by the age grade podium
// and by the style picker's live preview. Everything is inline SVG: crisp at
// any size, recolourable, no network request and no third-party licensing.
angular.module('mcrrcApp').factory('RunnerFigure', ['localStorageService', '$http', '$q', 'AuthService',
    function (localStorageService, $http, $q, AuthService) {

    var factory = {};

    var STORE_KEY = 'tools.agegrade.runner';

    // ---- Palettes --------------------------------------------------------

    factory.skinTones = ['#f7d7bb', '#eec091', '#dda874', '#c68a56', '#a4693c', '#7a4a28', '#513121'];
    factory.hairColours = ['#1c1410', '#2f2119', '#4a3122', '#6b4423', '#8c5a2b', '#c9a227', '#d8cfc4', '#8a8a8a'];
    factory.shortsColours = ['#2f3a45', '#1b1b1b', '#123a6b', '#5c1f2e', '#1f5c4a', '#4a3b6b', '#6b6b6b'];
    factory.shoeColours = ['#1f262e', '#f0f2f4', '#d64545', '#2f7fbf', '#d9e021', '#e07a1f', '#7a4a8c'];

    // ---- Hair ------------------------------------------------------------

    // The head spans y -74.1 (crown) to -58.9 (chin), x ±7. Every style wraps
    // down the sides of the skull to roughly ear level and closes with a
    // hairline across the brow, so hair sits on the head rather than perching
    // on top of it like a cap.
    factory.maleHair = [
        {
            name: 'Short crop',
            front: 'M -7.1 -64.6 Q -7.7 -70.8 -6 -73.5 Q -3.1 -76.1 0 -76' +
                   ' Q 3.1 -76.1 6 -73.5 Q 7.7 -70.8 7.1 -64.6' +
                   ' Q 6.2 -63.8 5.4 -65 Q 6.3 -68.9 5 -70.7 Q 2.6 -72.1 0 -71.5' +
                   ' Q -2.6 -72.1 -5 -70.7 Q -6.3 -68.9 -5.4 -65 Q -6.2 -63.8 -7.1 -64.6 Z'
        },
        {
            name: 'Buzz cut',
            front: 'M -7 -65.6 Q -7.4 -70.9 -5.8 -73.2 Q -3 -75.3 0 -75.2' +
                   ' Q 3 -75.3 5.8 -73.2 Q 7.4 -70.9 7 -65.6' +
                   ' Q 6.3 -64.9 5.7 -65.8 Q 6.3 -69.3 5.2 -70.9 Q 2.6 -72.2 0 -71.8' +
                   ' Q -2.6 -72.2 -5.2 -70.9 Q -6.3 -69.3 -5.7 -65.8 Q -6.3 -64.9 -7 -65.6 Z'
        },
        {
            name: 'Side part',
            front: 'M -7.1 -64.6 Q -8 -71.4 -6.2 -74.2 Q -2.4 -77.4 1.8 -76.6' +
                   ' Q 6.2 -75.6 7.3 -70.4 Q 7.6 -67.2 7.1 -64.6' +
                   ' Q 6.2 -63.8 5.5 -65 Q 6.1 -68.2 5.6 -70.4 Q 2.2 -72.6 -1.4 -71.6' +
                   ' Q -3.6 -71 -5 -70.6 Q -6.3 -68.9 -5.4 -65 Q -6.2 -63.8 -7.1 -64.6 Z'
        },
        {
            // The scalloped outline comes from overlapping discs around the
            // crown — a single smooth dome just reads as a bob. The discs must
            // wind the same way as the dome (sweep-flag 1): under the default
            // nonzero fill rule, opposing winding punches holes instead.
            name: 'Curls',
            front: 'M -7.8 -64.9 Q -9.4 -70.6 -8.2 -74 Q -4.4 -78.2 0 -78 Q 4.4 -78.2 8.2 -74' +
                   ' Q 9.4 -70.6 7.8 -64.9 Q 6.9 -64.1 6.1 -65.3 Q 7.3 -69.8 5.9 -71.7' +
                   ' Q 3 -73.4 0 -73 Q -3 -73.4 -5.9 -71.7 Q -7.3 -69.8 -6.1 -65.3' +
                   ' Q -6.9 -64.1 -7.8 -64.9 Z' +
                   ' M -7.9 -71.8 m -2.3 0 a 2.3 2.3 0 1 1 4.6 0 a 2.3 2.3 0 1 1 -4.6 0 Z' +
                   ' M -5.4 -76 m -2.5 0 a 2.5 2.5 0 1 1 5 0 a 2.5 2.5 0 1 1 -5 0 Z' +
                   ' M -1.4 -78.4 m -2.6 0 a 2.6 2.6 0 1 1 5.2 0 a 2.6 2.6 0 1 1 -5.2 0 Z' +
                   ' M 2.8 -78.2 m -2.6 0 a 2.6 2.6 0 1 1 5.2 0 a 2.6 2.6 0 1 1 -5.2 0 Z' +
                   ' M 6.4 -75.4 m -2.5 0 a 2.5 2.5 0 1 1 5 0 a 2.5 2.5 0 1 1 -5 0 Z' +
                   ' M 8.2 -71.2 m -2.3 0 a 2.3 2.3 0 1 1 4.6 0 a 2.3 2.3 0 1 1 -4.6 0 Z'
        }
    ];

    // Comes further down the sides than the men's, framing the cheekbones.
    var FEMALE_HAIRLINE =
        'M -7.2 -62.6 Q -8.3 -70.2 -6.4 -73.6 Q -3.2 -76.9 0 -76.8' +
        ' Q 3.2 -76.9 6.4 -73.6 Q 8.3 -70.2 7.2 -62.6' +
        ' Q 6.2 -61.7 5.2 -63 Q 6.5 -68.7 5.4 -70.9 Q 2.8 -72.7 0 -72.3' +
        ' Q -2.8 -72.7 -5.4 -70.9 Q -6.5 -68.7 -5.2 -63 Q -6.2 -61.7 -7.2 -62.6 Z';

    factory.femaleHair = [
        {
            name: 'Ponytail',
            back: 'M 4.4 -73.8 Q 12.6 -73 12.8 -64.2 Q 12.8 -57.4 9.3 -53' +
                  ' Q 11.3 -58.6 10.7 -63.5 Q 9.9 -69.9 4 -70.8 Z',
            front: FEMALE_HAIRLINE
        },
        {
            name: 'Top knot',
            back: 'M 0 -78.9 m -4.6 0 a 4.6 4.6 0 1 0 9.2 0 a 4.6 4.6 0 1 0 -9.2 0 Z',
            front: FEMALE_HAIRLINE
        },
        {
            name: 'Long',
            back: 'M -6.6 -74.6 Q -11.7 -68 -10.9 -54 Q -10.7 -49.8 -9 -47.8' +
                  ' L -4.6 -49.2 Q -5.9 -56 -5.6 -62.4 L 5.6 -62.4' +
                  ' Q 5.9 -56 4.6 -49.2 L 9 -47.8 Q 10.7 -49.8 10.9 -54' +
                  ' Q 11.7 -68 6.6 -74.6 Z',
            front: FEMALE_HAIRLINE
        },
        {
            name: 'Bob',
            back: 'M -7 -74.4 Q -10.8 -68 -10 -60 Q -9.8 -57.2 -8.4 -55.8' +
                  ' L -4.8 -57 Q -5.9 -60.6 -5.7 -63.4 L 5.7 -63.4' +
                  ' Q 5.9 -60.6 4.8 -57 L 8.4 -55.8 Q 9.8 -57.2 10 -60' +
                  ' Q 10.8 -68 7 -74.4 Z',
            front: FEMALE_HAIRLINE
        },
        {
            name: 'Braid',
            back: 'M 4.4 -73.8 Q 11.8 -72.6 11.6 -63.8 Q 11.4 -56.8 9.7 -50.2' +
                  ' L 6.6 -50.8 Q 8.3 -57.2 8.5 -62.8 Q 8.7 -68.8 4 -70.6 Z',
            front: FEMALE_HAIRLINE
        }
    ];

    factory.hairFor = function (sexKey) {
        return sexKey === 'female' ? factory.femaleHair : factory.maleHair;
    };

    // ---- Preferences -----------------------------------------------------

    // 'random' on any field means re-roll it each visit; anything else is a
    // literal colour, or an index into the hair list.
    function defaultPref() {
        return { hairStyle: 'random', hair: 'random', skin: 'random', shorts: 'random', shoes: 'random' };
    }

    factory.defaultPref = defaultPref;

    function normalise(stored) {
        stored = stored || {};
        return {
            male: angular.extend(defaultPref(), stored.male || {}),
            female: angular.extend(defaultPref(), stored.female || {})
        };
    }

    // Synchronous on purpose: the podium renders the moment a result appears,
    // so local storage stays the immediate source. The account copy is folded
    // in by syncFromAccount() once it arrives.
    factory.loadPrefs = function () {
        return normalise(localStorageService.get(STORE_KEY));
    };

    factory.savePrefs = function (prefs) {
        localStorageService.set(STORE_KEY, prefs);

        // Signed-in members get their style carried across browsers. A failed
        // write is not surfaced — the local copy already holds the change.
        if (AuthService.isLoggedIn()) {
            $http.put('/api/users/me/runner-style', { runnerStyle: prefs })
                .catch(function () { /* keeps the local copy */ });
        }
    };

    // Pulls the account's saved style into local storage, once per page load.
    // Resolves true when something was actually adopted, so the caller knows
    // to re-resolve and redraw.
    var syncPromise = null;

    factory.syncFromAccount = function () {
        if (syncPromise) return syncPromise;

        if (!AuthService.isLoggedIn()) {
            syncPromise = $q.when(false);
            return syncPromise;
        }

        syncPromise = $http.get('/api/users/me/runner-style').then(function (res) {
            var remote = res.data && res.data.runnerStyle;
            if (!remote || (!remote.male && !remote.female)) return false;

            var merged = normalise(localStorageService.get(STORE_KEY));
            if (remote.male) merged.male = angular.extend(defaultPref(), remote.male);
            if (remote.female) merged.female = angular.extend(defaultPref(), remote.female);

            localStorageService.set(STORE_KEY, merged);
            return true;
        }, function () {
            return false;
        });

        return syncPromise;
    };

    function pick(list) {
        return list[Math.floor(Math.random() * list.length)];
    }

    factory.pick = pick;

    // Turns a preference set into concrete values, rolling anything left on
    // 'random'.
    factory.resolve = function (pref, sexKey) {
        pref = pref || defaultPref();
        var styles = factory.hairFor(sexKey);
        var style = (pref.hairStyle === 'random' || !styles[pref.hairStyle])
            ? pick(styles)
            : styles[pref.hairStyle];

        return {
            skin: pref.skin === 'random' ? pick(factory.skinTones) : pref.skin,
            hair: pref.hair === 'random' ? pick(factory.hairColours) : pref.hair,
            shorts: pref.shorts === 'random' ? pick(factory.shortsColours) : pref.shorts,
            shoes: pref.shoes === 'random' ? pick(factory.shoeColours) : pref.shoes,
            hairFront: style.front,
            hairBack: style.back || null
        };
    };

    factory.sameLook = function (a, b) {
        return !!a && !!b && a.skin === b.skin && a.hair === b.hair &&
            a.shorts === b.shorts && a.shoes === b.shoes && a.hairFront === b.hairFront;
    };

    // ---- Figure ----------------------------------------------------------

    // `look` and `teamKit` are scope expressions rather than fixed names, so
    // the podium and the picker preview can bind the same markup to different
    // scope properties.
    factory.markup = function (options) {
        var o = options || {};
        var female = !!o.female;
        var L = o.look || 'look';
        var T = o.teamKit || 'teamKit';
        // Scope expression that turns on the powering-up stance.
        var P = o.pose || 'powerPose';

        function fist(cx, cy, r) {
            return '<circle class="ag-runner-fist" ng-attr-fill="{{ ' + L + '.skin }}"' +
                ' cx="' + cx + '" cy="' + cy + '" r="' + r + '" />';
        }

        // Two arm poses, both emitted and switched by ng-if: the markup is
        // baked into each directive's template at registration, so this cannot
        // be chosen in JS at render time.
        //   celebration — thrown up, used on every tier
        //   power       — spread down and out, fists clenched (World only)
        var celebrationArms =
            '<g ng-if="!(' + P + ')">' +
            '<path class="ag-runner-limb" ng-attr-stroke="{{ ' + L + '.skin }}" d="M -9 -54 L -21 -70" />' +
            '<path class="ag-runner-limb" ng-attr-stroke="{{ ' + L + '.skin }}" d="M 9 -54 L 21 -70" />' +
            fist(-21.5, -71, 3.2) +
            fist(21.5, -71, 3.2) +
            '</g>';

        // The powering-up stance: arms spread wide to the sides and lifted a
        // little past the shoulder, the way a figure is drawn levitating. The
        // control point sits below both ends so the arm sags at the elbow and
        // rises again into the hand — held dead straight it reads as a
        // scarecrow, and folded up by the chest it read as a shrug.
        var powerArms =
            '<g ng-if="' + P + '">' +
            '<path class="ag-runner-limb" ng-attr-stroke="{{ ' + L + '.skin }}"' +
            ' d="M -8.6 -55 Q -18.2 -52.6 -25 -61" />' +
            '<path class="ag-runner-limb" ng-attr-stroke="{{ ' + L + '.skin }}"' +
            ' d="M 8.6 -55 Q 18.2 -52.6 25 -61" />' +
            fist(-25.7, -62, 3.5) +
            fist(25.7, -62, 3.5) +
            '</g>';

        var armsAndLegs =
            celebrationArms + powerArms +
            '<path class="ag-runner-leg" ng-attr-stroke="{{ ' + L + '.skin }}" d="M -4 -25 L -5.2 -6" />' +
            '<path class="ag-runner-leg" ng-attr-stroke="{{ ' + L + '.skin }}" d="M 4 -25 L 5.2 -6" />' +
            '<rect ng-attr-fill="{{ ' + L + '.shoes }}" x="-10.6" y="-6" width="10" height="6" rx="2.6" />' +
            '<rect ng-attr-fill="{{ ' + L + '.shoes }}" x="0.6" y="-6" width="10" height="6" rx="2.6" />' +
            '<rect class="ag-runner-sole" x="-10.6" y="-2.2" width="10" height="2.2" rx="1.1" />' +
            '<rect class="ag-runner-sole" x="0.6" y="-2.2" width="10" height="2.2" rx="1.1" />';

        var eyeRx = female ? 1.3 : 1.15;
        var eyeRy = female ? 1.5 : 1.35;

        // Calm: round eyes and a small smile. Shouting: narrowed eyes, angled
        // brows and an open mouth — brows read as intensity here, which is
        // wanted, unlike on the resting face where they just look cross.
        var faceMarks =
            '<g ng-if="!(' + P + ')">' +
            '<ellipse class="ag-runner-eye" cx="-2.7" cy="-67.6" rx="' + eyeRx + '" ry="' + eyeRy + '" />' +
            '<ellipse class="ag-runner-eye" cx="2.7" cy="-67.6" rx="' + eyeRx + '" ry="' + eyeRy + '" />' +
            '<path class="ag-runner-smile" d="M -2.2 -63.8 Q 0 -62.1 2.2 -63.8" />' +
            '</g>' +
            '<g ng-if="' + P + '">' +
            '<ellipse class="ag-runner-eye" cx="-2.9" cy="-67.9" rx="1.35" ry="1" />' +
            '<ellipse class="ag-runner-eye" cx="2.9" cy="-67.9" rx="1.35" ry="1" />' +
            '<path class="ag-runner-brow" d="M -4.5 -70.2 L -1.5 -69.1" />' +
            '<path class="ag-runner-brow" d="M 4.5 -70.2 L 1.5 -69.1" />' +
            '<ellipse class="ag-runner-shout" cx="0" cy="-63.4" rx="1.7" ry="2.2" />' +
            '</g>';

        function clubBadge(cy, r) {
            return '<circle class="ag-kit-badge-ring" cx="0" cy="' + cy + '" r="' + r + '" />' +
                '<circle class="ag-kit-badge-face" cx="0" cy="' + cy + '" r="' + (r * 0.62).toFixed(2) + '" />' +
                '<path class="ag-kit-badge-mark" d="M ' + (-r * 0.38).toFixed(2) + ' ' + (cy + r * 0.12).toFixed(2) +
                ' q ' + (r * 0.38).toFixed(2) + ' ' + (-r * 0.5).toFixed(2) + ' ' + (r * 0.76).toFixed(2) + ' 0" />';
        }

        var chest = female
            ? '<g ng-if="!' + T + '">' +
              '<rect class="ag-runner-bib" x="-4.1" y="-52" width="8.2" height="5.8" rx="1" />' +
              '<path class="ag-runner-bib-line" d="M -2.4 -49.2 L 2.4 -49.2" />' +
              '</g>' +
              // No side stripes here: the crop top is too short for them to
              // read as kit trim, and the curve they were drawn on ran outside
              // the garment edge, so they showed as two loose marks floating
              // beside the torso.
              '<g ng-if="' + T + '">' +
              clubBadge(-50.4, 1.9) +
              '<rect class="ag-runner-bib" x="-3.8" y="-48.3" width="7.6" height="3.2" rx="0.8" />' +
              '</g>'
            : '<g ng-if="!' + T + '">' +
              '<rect class="ag-runner-bib" x="-4.8" y="-48" width="9.6" height="7.4" rx="1.2" />' +
              '<path class="ag-runner-bib-line" d="M -2.8 -44.6 L 2.8 -44.6" />' +
              '</g>' +
              '<g ng-if="' + T + '">' +
              '<path class="ag-kit-accent" d="M -8.7 -47.5 Q -9.8 -41.5 -8.9 -36" />' +
              '<path class="ag-kit-accent" d="M 8.7 -47.5 Q 9.8 -41.5 8.9 -36" />' +
              clubBadge(-48.2, 2.4) +
              '<rect class="ag-runner-bib" x="-4.6" y="-44.6" width="9.2" height="6.6" rx="1.1" />' +
              '<path class="ag-runner-bib-line" d="M -2.7 -41.5 L 2.7 -41.5" />' +
              '</g>';

        var hairBack =
            '<path class="ag-runner-hair" ng-if="' + L + '.hairBack" ng-attr-fill="{{ ' + L + '.hair }}"' +
            ' ng-attr-d="{{ ' + L + '.hairBack }}" />';
        var hairFront =
            '<path class="ag-runner-hair" ng-attr-fill="{{ ' + L + '.hair }}" ng-attr-d="{{ ' + L + '.hairFront }}" />';

        if (female) {
            return '<g class="ag-runner-figure">' +
                armsAndLegs +
                '<rect ng-attr-fill="{{ ' + L + '.skin }}" x="-2.4" y="-61" width="4.8" height="6" />' +
                // Bare torso, so the midriff shows between the crop top and the
                // shorts. Curves in at the waist and out at the hip.
                '<path ng-attr-fill="{{ ' + L + '.skin }}" d="M -8.2 -56 C -8.6 -50 -6.9 -46.5 -6.9 -42' +
                ' C -6.9 -38 -9.7 -36 -9.7 -33 L 9.7 -33 C 9.7 -36 6.9 -38 6.9 -42' +
                ' C 6.9 -46.5 8.6 -50 8.2 -56 Z" />' +
                '<path class="ag-runner-navel" d="M -0.75 -40.2 Q 0 -39.1 0.75 -40.2" />' +
                // Waistband nipped in to sit on the waist rather than standing
                // off it, then curving out over the hip to the leg openings.
                '<path ng-attr-fill="{{ ' + L + '.shorts }}" d="M -9.4 -37 Q -10.7 -30.5 -10.4 -24 L -1.2 -24' +
                ' L 0 -28.5 L 1.2 -24 L 10.4 -24 Q 10.7 -30.5 9.4 -37 Z" />' +
                // Crop top: narrower shoulders, hem cut above the waist
                '<path class="ag-runner-singlet" d="M -8.8 -57 Q -10.2 -50 -7.5 -44.6 L 7.5 -44.6' +
                ' Q 10.2 -50 8.8 -57 Q 4.6 -59.2 3.2 -55.8 Q 0 -52.4 -3.2 -55.8 Q -4.6 -59.2 -8.8 -57 Z" />' +
                chest + hairBack +
                '<ellipse ng-attr-fill="{{ ' + L + '.skin }}" cx="0" cy="-66.5" rx="6.8" ry="7.6" />' +
                faceMarks + hairFront +
                '</g>';
        }

        return '<g class="ag-runner-figure">' +
            armsAndLegs +
            '<rect ng-attr-fill="{{ ' + L + '.skin }}" x="-2.7" y="-61" width="5.4" height="6" />' +
            // Bare torso beneath the kit, so the singlet's cutaway armholes and
            // scooped neck show chest rather than the background behind them.
            '<path ng-attr-fill="{{ ' + L + '.skin }}" d="M -8.5 -58 Q -9.6 -46 -8.7 -34 L 8.7 -34' +
            ' Q 9.6 -46 8.5 -58 Z" />' +
            '<path ng-attr-fill="{{ ' + L + '.shorts }}" d="M -9 -37 L 9 -37 L 9.5 -24 L 1.2 -24 L 0 -29' +
            ' L -1.2 -24 L -9.5 -24 Z" />' +
            // Racing singlet: narrow straps, deep-cut armholes, scooped neck
            '<path class="ag-runner-singlet" d="M -9.1 -35 Q -10.3 -45 -8.8 -48 Q -5.15 -52.5 -7.5 -58' +
            ' L -5 -58 Q -4.2 -53 -1.65 -51.5 Q 0 -50.8 1.65 -51.5 Q 4.2 -53 5 -58 L 7.5 -58' +
            ' Q 5.15 -52.5 8.8 -48 Q 10.3 -45 9.1 -35 Z" />' +
            chest + hairBack +
            '<ellipse ng-attr-fill="{{ ' + L + '.skin }}" cx="0" cy="-66.5" rx="7" ry="7.6" />' +
            faceMarks + hairFront +
            '</g>';
    };

    return factory;
}]);
