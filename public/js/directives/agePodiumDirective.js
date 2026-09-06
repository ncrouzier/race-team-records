// Podium graphic for the age grade calculator. Everything is drawn as inline
// SVG rather than shipped as an image: it stays crisp at any size, recolours
// itself per achievement level, needs no network request, and carries no
// third-party licensing.
//
// The three steps mirror the medal tiers the rest of the site already uses
// (70% bronze / 80% silver / 90% gold). Anything under 70% is "Local class",
// where the runner stands on the ground beside the podium.
angular.module('mcrrcApp').directive('agePodium', ['RunnerFigure', '$uibModal', function (RunnerFigure, $uibModal) {

    // cx / feet-y for each place, in SVG user units.
    var SPOTS = {
        local: { x: 36, y: 192 },
        regional: { x: 286, y: 150 },
        national: { x: 117, y: 128 },
        world: { x: 201, y: 100 }
    };

    function levelKeyFor(percent) {
        if (percent >= 90) return 'world';
        if (percent >= 80) return 'national';
        if (percent >= 70) return 'regional';
        return 'local';
    }

    // At this age grade the runner has earned the club kit rather than a
    // plain singlet.
    var TEAM_KIT_PERCENT = 72;

    // Resolved looks are held at module scope, not per-instance. The directive
    // lives inside an ng-if on the result, and typing a time briefly passes
    // through invalid states (1930 -> "1:93") that destroy and rebuild it —
    // resolving in link() would visibly re-roll anything set to random on
    // almost every keystroke.
    var lookCache = {};

    function lookFor(sexKey) {
        if (!lookCache[sexKey]) {
            lookCache[sexKey] = RunnerFigure.resolve(RunnerFigure.loadPrefs()[sexKey], sexKey);
        }
        return lookCache[sexKey];
    }


    // ---- Tier effects ----------------------------------------------------
    // Drawn in the runner's own coordinate space (feet at origin), so they
    // travel with the figure when it moves between steps.

    // Local: a participation rosette pinned to the chest, beside the bib.
    // Drawn in front of the figure, like the medal.
    //
    // Authored around a centre of (-5.2, -46.6) and moved into place with a
    // translate, because the two tails hang asymmetrically below it and
    // re-deriving their points per position is not worth it. The women's bib
    // sits higher and narrower than the men's, hence the two placements —
    // both land on the bib's upper outer corner.
    function rosette(cx, cy) {
        return '<g transform="translate(' + (cx + 5.2).toFixed(2) + ' ' + (cy + 46.6).toFixed(2) + ')">' +
            '<path class="ag-fx-ribbon-tail" d="M -6.8 -45 L -8.6 -35.6 L -6 -36.8 L -4.8 -44.6 Z" />' +
            '<path class="ag-fx-ribbon-tail" d="M -3.6 -45 L -2.6 -35.4 L -0.6 -37.2 L -1.6 -44.6 Z" />' +
            '<circle class="ag-fx-rosette-back" cx="-5.2" cy="-46.6" r="3.5" />' +
            '<circle class="ag-fx-rosette" cx="-5.2" cy="-46.6" r="2.4" />' +
            '<circle class="ag-fx-rosette-pip" cx="-5.2" cy="-46.6" r="0.9" />' +
            '</g>';
    }

    // Men's bib spans y -48 to -40.6, women's the higher -52 to -46.2.
    var FX_RIBBON_MALE = rosette(5.4, -48.4);
    var FX_RIBBON_FEMALE = rosette(4.8, -52.4);

    // Regional: bronze medal, worn over the bib the way runners actually wear
    // it, so this one is drawn in front of the figure. The cord runs all the
    // way up to the underside of the head (-58.9 on both figures) and narrows
    // as it goes, so it meets the neck instead of stopping short over the
    // chest with a gap above it.
    var FX_MEDAL =
        '<path class="ag-fx-ribbon" d="M -3.4 -58.7 L -0.9 -45.4 L 0.9 -45.4 L 3.4 -58.7' +
        ' L 1.8 -58.7 L 0 -48.4 L -1.8 -58.7 Z" />' +
        '<circle class="ag-fx-medal-disc" cx="0" cy="-42.6" r="3.6" />' +
        '<circle class="ag-fx-medal-face" cx="0" cy="-42.6" r="2.3" />' +
        '<path class="ag-fx-medal-star" d="M 0 -44.4 L 0.5 -43.1 L 1.9 -43 L 0.8 -42.1' +
        ' L 1.2 -40.8 L 0 -41.6 L -1.2 -40.8 L -0.8 -42.1 L -1.9 -43 L -0.5 -43.1 Z" />';

    // National: fireworks going off behind the figure. Each burst is a ring of
    // rays with a spark on each tip — one path cannot do the radial spacing.
    function firework(cx, cy, radius, rays, cls, delay) {
        var parts = '';
        for (var i = 0; i < rays; i++) {
            var a = (Math.PI * 2 * i) / rays;
            var x1 = cx + Math.cos(a) * radius * 0.34;
            var y1 = cy + Math.sin(a) * radius * 0.34;
            var x2 = cx + Math.cos(a) * radius;
            var y2 = cy + Math.sin(a) * radius;
            parts += '<line class="' + cls + '-ray" x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) +
                '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" />' +
                '<circle class="' + cls + '-spark" cx="' + x2.toFixed(1) + '" cy="' + y2.toFixed(1) + '" r="0.9" />';
        }
        return '<g class="ag-fx-burst" style="animation-delay: ' + delay + 's">' + parts + '</g>';
    }

    var FX_FIREWORKS =
        firework(-19, -74, 9.5, 10, 'ag-fx-fw1', 0) +
        firework(18, -83, 8, 9, 'ag-fx-fw2', 0.55) +
        firework(2, -93, 7, 8, 'ag-fx-fw3', 1.1) +
        firework(-25, -55, 6, 8, 'ag-fx-fw2', 1.5);

    // World: flames wrapping the figure in a rough oval, tips curling inward,
    // rather than straight spikes fanning outward. Each tongue is an S-curve
    // so the silhouette ripples the way fire actually does.
    // Bellies out on the away side and curls its tip back toward the runner.
    // The tip is a short arc rather than a meeting of two curves — coming to
    // a point reads as a spike instead of a flame.
    function tongue(x, baseY, h, w, curl, cls) {
        var tipX = x + curl;
        var tw = Math.max(1.4, w * 0.16);
        return '<path class="' + cls + '" d="M ' + x + ' ' + baseY +
            ' C ' + (x - w) + ' ' + (baseY - h * 0.28) +
            ' ' + (x - w * 0.78) + ' ' + (baseY - h * 0.68) +
            ' ' + (tipX - tw) + ' ' + (baseY - h * 0.93) +
            ' Q ' + tipX + ' ' + (baseY - h) + ' ' + (tipX + tw) + ' ' + (baseY - h * 0.88) +
            ' C ' + (x + w * 0.42) + ' ' + (baseY - h * 0.52) +
            ' ' + (x + w * 0.9) + ' ' + (baseY - h * 0.24) +
            ' ' + x + ' ' + baseY + ' Z" />';
    }

    var FX_FLAMES =
        '<defs>' +
        '  <linearGradient id="agAuraGrad" x1="0" y1="0" x2="0" y2="1">' +
        '    <stop offset="0%" stop-color="#ffd54a" />' +
        '    <stop offset="45%" stop-color="#ff8f1f" />' +
        '    <stop offset="100%" stop-color="#ff4d1a" />' +
        '  </linearGradient>' +
        '</defs>' +
        '<g class="ag-fx-flame-outer">' +
        tongue(-15, -2, 32, 10, 6, 'ag-fx-flame ag-fx-flame-a') +
        tongue(-22, -10, 40, 11, 9, 'ag-fx-flame ag-fx-flame-a') +
        tongue(-26, -26, 42, 11, 10, 'ag-fx-flame ag-fx-flame-a') +
        tongue(-24, -44, 38, 10, 11, 'ag-fx-flame ag-fx-flame-a') +
        tongue(-17, -60, 26, 9, 9, 'ag-fx-flame ag-fx-flame-a') +
        tongue(-9, -70, 18, 7, 6, 'ag-fx-flame ag-fx-flame-a') +
        tongue(15, -2, 34, 10, -6, 'ag-fx-flame ag-fx-flame-a') +
        tongue(22, -10, 42, 11, -9, 'ag-fx-flame ag-fx-flame-a') +
        tongue(26, -26, 44, 11, -10, 'ag-fx-flame ag-fx-flame-a') +
        tongue(24, -44, 40, 10, -11, 'ag-fx-flame ag-fx-flame-a') +
        tongue(17, -60, 28, 9, -9, 'ag-fx-flame ag-fx-flame-a') +
        tongue(9, -70, 19, 7, -6, 'ag-fx-flame ag-fx-flame-a') +
        '</g>' +
        '<g class="ag-fx-flame-inner">' +
        tongue(-19, -12, 30, 7, 7, 'ag-fx-flame ag-fx-flame-b') +
        tongue(-21, -32, 30, 7, 8, 'ag-fx-flame ag-fx-flame-b') +
        tongue(-16, -52, 22, 6, 7, 'ag-fx-flame ag-fx-flame-b') +
        tongue(19, -12, 31, 7, -7, 'ag-fx-flame ag-fx-flame-b') +
        tongue(21, -32, 31, 7, -8, 'ag-fx-flame ag-fx-flame-b') +
        tongue(16, -52, 23, 6, -7, 'ag-fx-flame ag-fx-flame-b') +
        '</g>' +
        // Embers drifting up through the aura
        '<g class="ag-fx-embers">' +
        '<circle class="ag-fx-ember" cx="-19" cy="-58" r="0.9" style="animation-delay: 0s" />' +
        '<circle class="ag-fx-ember" cx="16" cy="-46" r="0.8" style="animation-delay: 0.5s" />' +
        '<circle class="ag-fx-ember" cx="-17" cy="-34" r="0.7" style="animation-delay: 1s" />' +
        '<circle class="ag-fx-ember" cx="22" cy="-66" r="0.7" style="animation-delay: 1.4s" />' +
        '<circle class="ag-fx-ember" cx="-22" cy="-42" r="0.8" style="animation-delay: 1.9s" />' +
        '</g>';

    return {
        restrict: 'E',
        scope: {
            percent: '=',
            sex: '='
        },
        template:
            '<div class="ag-podium">' +
            '  <button type="button" class="mcrrc-btn ag-podium-shuffle" ng-click="openStylePicker()"' +
            '          title="Change the runner\'s look" aria-label="Change the runner\'s look">' +
            '    <i class="fa fa-paint-brush"></i> Style' +
            '  </button>' +
            '  <svg class="ag-podium-svg" viewBox="0 0 340 220" xmlns="http://www.w3.org/2000/svg"' +
            '       role="img" aria-label="{{ ariaLabel }}">' +

            // Ground line
            '    <line class="ag-podium-ground" x1="8" y1="192" x2="332" y2="192" />' +

            // Blocks — 2nd, 1st, 3rd, left to right, Olympic-style
            '    <g class="ag-podium-block" ng-class="{\'is-active\': activeKey === \'national\'}">' +
            '      <rect x="76" y="128" width="82" height="64" rx="3" class="ag-podium-face ag-podium-silver" />' +
            '      <text x="117" y="154" class="ag-podium-pct">80%</text>' +
            '    </g>' +
            '    <g class="ag-podium-block" ng-class="{\'is-active\': activeKey === \'world\'}">' +
            '      <rect x="160" y="100" width="82" height="92" rx="3" class="ag-podium-face ag-podium-gold" />' +
            '      <text x="201" y="130" class="ag-podium-pct">90%+</text>' +
            '    </g>' +
            '    <g class="ag-podium-block" ng-class="{\'is-active\': activeKey === \'regional\'}">' +
            '      <rect x="245" y="150" width="82" height="42" rx="3" class="ag-podium-face ag-podium-bronze" />' +
            '      <text x="286" y="174" class="ag-podium-pct">70%</text>' +
            '    </g>' +

            // Labels under the ground line
            '    <text x="36" y="208" class="ag-podium-label" ng-class="{\'is-active\': activeKey === \'local\'}">Local</text>' +
            '    <text x="117" y="208" class="ag-podium-label" ng-class="{\'is-active\': activeKey === \'national\'}">National</text>' +
            '    <text x="201" y="208" class="ag-podium-label" ng-class="{\'is-active\': activeKey === \'world\'}">World</text>' +
            '    <text x="286" y="208" class="ag-podium-label" ng-class="{\'is-active\': activeKey === \'regional\'}">Regional</text>' +

            '    <g class="ag-podium-runner"' +
            '       ng-class="[\'ag-runner-\' + activeKey, teamKit ? \'ag-kit-team\' : \'\']"' +
            '       ng-style="runnerStyle">' +
            '      <g class="ag-fx" ng-if="activeKey === \'world\'">' + FX_FLAMES + '</g>' +
            '      <g class="ag-fx" ng-if="activeKey === \'national\'">' + FX_FIREWORKS + '</g>' +
            '      <g ng-if="!showFemale">' + RunnerFigure.markup({ female: false }) + '</g>' +
            '      <g ng-if="showFemale">' + RunnerFigure.markup({ female: true }) + '</g>' +
            '      <g class="ag-fx" ng-if="activeKey === \'regional\'">' + FX_MEDAL + '</g>' +
            '      <g class="ag-fx" ng-if="activeKey === \'local\' && !showFemale">' + FX_RIBBON_MALE + '</g>' +
            '      <g class="ag-fx" ng-if="activeKey === \'local\' && showFemale">' + FX_RIBBON_FEMALE + '</g>' +
            '    </g>' +
            '  </svg>' +
            '</div>',

        link: function (scope) {
            function update() {
                var percent = Number(scope.percent);
                var key = isFinite(percent) ? levelKeyFor(percent) : 'local';
                var spot = SPOTS[key];

                scope.activeKey = key;
                // Set through CSS rather than the SVG transform attribute so
                // the runner animates between steps.
                scope.runnerStyle = { transform: 'translate(' + spot.x + 'px, ' + spot.y + 'px)' };

                scope.teamKit = isFinite(percent) && percent >= TEAM_KIT_PERCENT;
                // Powering-up stance is reserved for the top step.
                scope.powerPose = key === 'world';

                var sex = (scope.sex || '').toLowerCase();
                scope.showFemale = sex === 'female' || sex === 'f';
                scope.look = lookFor(scope.showFemale ? 'female' : 'male');

                scope.ariaLabel = isFinite(percent)
                    ? 'Podium showing ' + percent.toFixed(1) + '%, ' + key + ' class'
                    : 'Age grade podium';
            }

            scope.openStylePicker = function () {
                var sexKey = scope.showFemale ? 'female' : 'male';
                $uibModal.open({
                    templateUrl: 'views/modals/runnerStyleModal.html',
                    controller: 'RunnerStyleModalController',
                    size: 'lg',
                    resolve: {
                        sexKey: function () { return sexKey; },
                        teamKit: function () { return !!scope.teamKit; }
                    }
                }).result.then(function (pref) {
                    var prefs = RunnerFigure.loadPrefs();
                    prefs[sexKey] = pref;
                    RunnerFigure.savePrefs(prefs);
                    // Drop the cached look so the new preferences take effect,
                    // re-rolling anything still set to random.
                    delete lookCache[sexKey];
                    scope.look = lookFor(sexKey);
                }, function () { /* dismissed */ });
            };

            scope.$watch('percent', update);
            scope.$watch('sex', update);

            // A signed-in member's saved style may differ from whatever this
            // browser had cached. It arrives after the first paint, so drop
            // the resolved looks and redraw only when something was adopted.
            RunnerFigure.syncFromAccount().then(function (adopted) {
                if (!adopted) return;
                lookCache = {};
                update();
            });
        }
    };
}]);
