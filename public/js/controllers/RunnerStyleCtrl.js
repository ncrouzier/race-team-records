// Style picker for the age grade podium runner. Every field can be left on
// "Random", which re-rolls on each visit, or pinned to a swatch or a custom
// colour.
angular.module('mcrrcApp.tools').controller('RunnerStyleModalController', [
    '$scope', '$uibModalInstance', 'RunnerFigure', 'sexKey', 'teamKit',
    function ($scope, $uibModalInstance, RunnerFigure, sexKey, teamKit) {

        $scope.sexKey = sexKey;
        $scope.isFemale = sexKey === 'female';
        $scope.teamKit = teamKit;

        $scope.skinTones = RunnerFigure.skinTones;
        $scope.hairColours = RunnerFigure.hairColours;
        $scope.shortsColours = RunnerFigure.shortsColours;
        $scope.shoeColours = RunnerFigure.shoeColours;
        $scope.hairStyles = RunnerFigure.hairFor(sexKey);

        var prefs = RunnerFigure.loadPrefs();
        // Copied, so dismissing the dialog leaves the saved prefs untouched.
        $scope.pref = angular.extend(RunnerFigure.defaultPref(), prefs[sexKey] || {});

        // Custom-colour inputs need a concrete value even while the field is
        // set to Random, or the native picker opens on black.
        $scope.custom = {
            skin: $scope.pref.skin === 'random' ? RunnerFigure.skinTones[1] : $scope.pref.skin,
            hair: $scope.pref.hair === 'random' ? RunnerFigure.hairColours[2] : $scope.pref.hair,
            shorts: $scope.pref.shorts === 'random' ? RunnerFigure.shortsColours[0] : $scope.pref.shorts,
            shoes: $scope.pref.shoes === 'random' ? RunnerFigure.shoeColours[0] : $scope.pref.shoes
        };

        // The preview resolves the same way the podium does, so "Random"
        // shows one representative roll rather than a blank.
        function refreshPreview() {
            $scope.preview = RunnerFigure.resolve($scope.pref, sexKey);
        }
        refreshPreview();

        $scope.isRandom = function (field) {
            return $scope.pref[field] === 'random';
        };

        $scope.setRandom = function (field) {
            $scope.pref[field] = 'random';
            refreshPreview();
        };

        $scope.setColour = function (field, colour) {
            $scope.pref[field] = colour;
            $scope.custom[field] = colour;
            refreshPreview();
        };

        // Fired by the native colour input.
        $scope.applyCustom = function (field) {
            $scope.pref[field] = $scope.custom[field];
            refreshPreview();
        };

        $scope.isSelectedColour = function (field, colour) {
            return $scope.pref[field] === colour;
        };

        $scope.setHairStyle = function (index) {
            $scope.pref.hairStyle = index;
            refreshPreview();
        };

        $scope.isSelectedHair = function (index) {
            return $scope.pref.hairStyle === index;
        };

        // Re-roll only the fields still set to random, so a pinned colour is
        // never overwritten by the shuffle.
        $scope.shufflePreview = function () {
            refreshPreview();
        };

        $scope.resetAll = function () {
            $scope.pref = RunnerFigure.defaultPref();
            refreshPreview();
        };

        $scope.save = function () {
            $uibModalInstance.close($scope.pref);
        };

        $scope.cancel = function () {
            $uibModalInstance.dismiss('cancel');
        };
    }
]);

// Full-figure preview for the picker. Both variants are baked into the
// template at registration time, exactly as the podium does — building SVG
// from a string at runtime and appending it lands the nodes in the HTML
// namespace, where they render as nothing.
angular.module('mcrrcApp.tools').directive('runnerPreview', ['RunnerFigure', function (RunnerFigure) {
    return {
        restrict: 'E',
        scope: { look: '=', female: '=', teamKit: '=' },
        template:
            '<svg class="rs-preview-svg" viewBox="-26 -86 52 92" xmlns="http://www.w3.org/2000/svg">' +
            // Carries the club-kit class so the preview picks up the orange
            // singlet, the same way the podium runner group does.
            '  <g ng-class="teamKit ? \'ag-kit-team\' : \'\'">' +
            '  <g ng-if="!female">' +
            RunnerFigure.markup({ female: false, look: 'look', teamKit: 'teamKit', pose: 'false' }) +
            '  </g>' +
            '  <g ng-if="female">' +
            RunnerFigure.markup({ female: true, look: 'look', teamKit: 'teamKit', pose: 'false' }) +
            '  </g>' +
            '  </g>' +
            '</svg>'
    };
}]);

// Renders one hair style as a small head-and-shoulders thumbnail for the
// picker. Uses the same path data as the figure so the two can't drift.
angular.module('mcrrcApp.tools').directive('hairThumb', ['RunnerFigure', function (RunnerFigure) {
    return {
        restrict: 'E',
        scope: { style: '=', skin: '=', hair: '=', female: '=' },
        template:
            '<svg class="rs-thumb-svg" viewBox="-13 -82 26 26">' +
            '  <path ng-if="style.back" ng-attr-fill="{{ hair }}" ng-attr-d="{{ style.back }}" />' +
            '  <ellipse ng-attr-fill="{{ skin }}" cx="0" cy="-66.5" ng-attr-rx="{{ female ? 6.8 : 7 }}" ry="7.6" />' +
            '  <ellipse class="ag-runner-eye" cx="-2.7" cy="-67.6" ng-attr-rx="{{ female ? 1.3 : 1.15 }}"' +
            '           ng-attr-ry="{{ female ? 1.5 : 1.35 }}" />' +
            '  <ellipse class="ag-runner-eye" cx="2.7" cy="-67.6" ng-attr-rx="{{ female ? 1.3 : 1.15 }}"' +
            '           ng-attr-ry="{{ female ? 1.5 : 1.35 }}" />' +
            '  <path class="ag-runner-smile" d="M -2.2 -63.8 Q 0 -62.1 2.2 -63.8" />' +
            '  <path ng-attr-fill="{{ hair }}" ng-attr-d="{{ style.front }}" />' +
            '</svg>'
    };
}]);
