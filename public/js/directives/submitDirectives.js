// Shared by the submission pages (views/submitResult.html,
// views/submitVolunteer.html): who is submitting, and small date helpers.

// The runner, as the pages hold it: { memberId } from the roster, or
// { notListed: true, runnerName } typed. Remembered in this browser for the
// next visit, on either page.
angular.module('mcrrcApp').factory('SubmitPagesService', [function () {
    var KEY = 'mcrrc.submit.runner';
    var factory = {};

    // A signed-in member first; else whoever this browser sent last time
    factory.startingRunner = function (members, myMemberId) {
        if (myMemberId) return { memberId: myMemberId, notListed: false, runnerName: '' };
        var saved = null;
        try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { saved = null; }
        if (saved && saved.memberId && members.some(function (m) { return m._id === saved.memberId; })) {
            return { memberId: saved.memberId, notListed: false, runnerName: '' };
        }
        if (saved && saved.runnerName) return { memberId: '', notListed: true, runnerName: saved.runnerName };
        return { memberId: '', notListed: false, runnerName: '' };
    };

    factory.remember = function (runner) {
        try {
            localStorage.setItem(KEY, JSON.stringify(runner.notListed
                ? { runnerName: runner.runnerName.trim() } : { memberId: runner.memberId }));
        } catch (e) { /* a convenience only */ }
    };

    // What the server takes
    factory.payload = function (runner) {
        return {
            memberId: runner.notListed ? '' : runner.memberId,
            runnerName: runner.notListed ? runner.runnerName.trim() : ''
        };
    };

    factory.error = function (runner) {
        if (runner.notListed) return runner.runnerName.trim() ? '' : 'Please type your name.';
        return runner.memberId ? '' : 'Please pick your name from the list.';
    };

    factory.name = function (runner, members) {
        if (runner.notListed) return runner.runnerName.trim();
        var m = members.find(function (x) { return x._id === runner.memberId; });
        return m ? m.name : '';
    };

    // 'YYYY-MM-DD' ↔ the Date (local midnight) a date input holds
    factory.day = function (date) {
        if (!date) return '';
        var pad = function (n) { return n < 10 ? '0' + n : String(n); };
        return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
    };
    factory.date = function (day) {
        if (!day) return null;
        var p = day.split('-');
        return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    };

    // "Sat, Nov 8, 2026" for a 'YYYY-MM-DD'
    factory.dayLabel = function (day) {
        var date = factory.date(day);
        return date ? date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '';
    };

    // The first field with a message, into view
    factory.focusFirstError = function () {
        setTimeout(function () {
            var invalid = document.querySelector('.submit-page .has-error input, .submit-page .has-error textarea, .submit-page .has-error button, .submit-page .has-error select');
            if (invalid) {
                invalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
                invalid.focus({ preventScroll: true });
            }
        }, 0);
    };

    return factory;
}]);

// The "Who?" field: search the roster ("nic cro" finds Nicolas Crouzier), or
// type a name when not on it.
// <runner-picker runner="runner" members="members" error="errors.runner" on-change="check()">
angular.module('mcrrcApp').directive('runnerPicker', ['$timeout', function ($timeout) {
    return {
        restrict: 'E',
        scope: {
            runner: '=',
            members: '<',
            error: '=',
            onChange: '&'
        },
        templateUrl: 'views/templates/runnerPicker.html',
        link: function (scope, element) {
            // One object: the template's ng-if scopes write through to it
            scope.ui = { text: '', open: false, highlighted: 0 };

            // Every word typed starts a word of the name
            scope.matches = function () {
                var words = scope.ui.text.toLowerCase().split(/\s+/).filter(Boolean);
                if (!words.length) return [];
                return (scope.members || []).filter(function (m) {
                    var parts = m.name.toLowerCase().split(/[\s-]+/);
                    return words.every(function (w) { return parts.some(function (p) { return p.indexOf(w) === 0; }); });
                }).slice(0, 8);
            };

            scope.memberName = function () {
                var m = (scope.members || []).find(function (x) { return x._id === scope.runner.memberId; });
                return m ? m.name : '';
            };

            scope.typed = function () {
                scope.ui.open = true;
                scope.ui.highlighted = 0;
            };

            scope.keydown = function ($event) {
                var n = scope.matches().length;
                if ($event.keyCode === 40 || $event.keyCode === 38) {        // down, up
                    $event.preventDefault();
                    scope.ui.open = true;
                    if (n) scope.ui.highlighted = (scope.ui.highlighted + ($event.keyCode === 40 ? 1 : -1) + n) % n;
                } else if ($event.keyCode === 13) {                         // enter
                    $event.preventDefault();
                    if (scope.matches()[scope.ui.highlighted]) scope.pick(scope.matches()[scope.ui.highlighted]);
                } else if ($event.keyCode === 27) {                         // escape
                    scope.ui.open = false;
                }
            };

            scope.pick = function (m) {
                scope.runner.memberId = m._id;
                scope.ui.text = '';
                scope.ui.open = false;
                scope.error = '';
                scope.onChange();
            };

            // Leaving the box closes the list (a click on a name lands first:
            // the names take the mousedown, which keeps the focus here)
            scope.blurred = function () {
                $timeout(function () { scope.ui.open = false; }, 150);
            };

            function focus(selector) {
                $timeout(function () {
                    var input = element[0].querySelector(selector);
                    if (input) input.focus();
                });
            }

            scope.change = function () {
                scope.runner.memberId = '';
                scope.onChange();
                focus('.srf-runner-search');
            };

            scope.setNotListed = function (on) {
                scope.runner.notListed = on;
                scope.error = '';
                scope.onChange();
                focus(on ? '.srf-runner-name-input' : '.srf-runner-search');
            };

            scope.$watch('runner.runnerName', function (now, before) {
                if (now !== before) scope.error = '';
            });
        }
    };
}]);
