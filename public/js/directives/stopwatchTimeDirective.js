// Stopwatch-style time entry, matching the public application form: the user
// types digits and the colons appear as they go (3210 -> 32:10, 12500 ->
// 1:25:00). Keeps the phone keypad numeric, which has no colon key.
angular.module('mcrrcApp').factory('StopwatchTime', [function () {
    var factory = {};

    // Punctuates a raw string into m:ss / h:mm:ss, filling from the seconds
    // up. An optional decimal fraction is preserved so track sprint times
    // like 12.55 still work.
    factory.format = function (value) {
        var raw = String(value === undefined || value === null ? '' : value);

        var dot = raw.indexOf('.');
        var frac = '';
        if (dot !== -1) {
            frac = '.' + raw.slice(dot + 1).replace(/\D/g, '').slice(0, 2);
            raw = raw.slice(0, dot);
        }

        var digits = raw.replace(/\D/g, '').slice(0, 6);
        if (digits.length <= 2) return digits + frac;

        var seconds = digits.slice(-2);
        var minutes = digits.slice(-4, -2);
        var hours = digits.slice(0, -4);

        var head = hours ? (hours + ':' + (minutes.length < 2 ? '0' + minutes : minutes)) : minutes;
        return head + ':' + seconds + frac;
    };

    // Returns total seconds, or null if the string isn't a usable time.
    // One or two bare digits read as seconds, not minutes — track sprints are
    // genuinely under a minute, and it matches how format() fills digits in.
    factory.parseSeconds = function (value) {
        if (value === undefined || value === null) return null;
        var str = String(value).trim();
        if (!str) return null;

        var parts = str.split(':');
        if (parts.length > 3) return null;

        var nums = [];
        for (var i = 0; i < parts.length; i++) {
            if (parts[i] === '') return null;
            var n = Number(parts[i]);
            if (isNaN(n) || n < 0) return null;
            nums.push(n);
        }

        if (nums.length === 1) return nums[0];
        if (nums.length === 2) {
            if (nums[1] >= 60) return null;
            return nums[0] * 60 + nums[1];
        }
        if (nums[1] >= 60 || nums[2] >= 60) return null;
        return nums[0] * 3600 + nums[1] * 60 + nums[2];
    };

    // m:ss / h:mm:ss for display. Fractional seconds are kept to two places
    // only when there is one, so 5K times don't grow a pointless ".00".
    factory.formatSeconds = function (totalSeconds) {
        if (totalSeconds === null || totalSeconds === undefined || isNaN(totalSeconds)) return '';
        var neg = totalSeconds < 0;
        var t = Math.abs(totalSeconds);

        var whole = Math.floor(t);
        var frac = t - whole;

        var h = Math.floor(whole / 3600);
        var m = Math.floor((whole % 3600) / 60);
        var s = whole % 60;

        var pad = function (n) { return n < 10 ? '0' + n : String(n); };
        var secText = pad(s);
        if (frac > 0.004) {
            secText = pad(s) + ('' + frac.toFixed(2)).slice(1);
        }

        var out = h > 0 ? (h + ':' + pad(m) + ':' + secText) : (m + ':' + secText);
        return (neg ? '-' : '') + out;
    };

    return factory;
}]);

angular.module('mcrrcApp').directive('stopwatchTime', ['StopwatchTime', function (StopwatchTime) {
    return {
        restrict: 'A',
        require: 'ngModel',
        link: function (scope, element, attrs, ngModel) {
            // Masking from inside a parser is safe here because format() is
            // idempotent — format(format(x)) === format(x) — so the re-entrant
            // pass this triggers settles immediately.
            ngModel.$parsers.push(function (viewValue) {
                var formatted = StopwatchTime.format(viewValue);
                if (formatted !== viewValue) {
                    ngModel.$setViewValue(formatted);
                    ngModel.$render();
                }
                return formatted;
            });

            // Nudge by a second with the arrow keys, like the pace tool.
            element.on('keydown', function (event) {
                if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
                var seconds = StopwatchTime.parseSeconds(ngModel.$viewValue);
                if (seconds === null) return;

                event.preventDefault();
                var next = event.key === 'ArrowUp' ? seconds + 1 : Math.max(0, seconds - 1);

                scope.$apply(function () {
                    ngModel.$setViewValue(StopwatchTime.formatSeconds(next));
                    ngModel.$render();
                });
            });
        }
    };
}]);
