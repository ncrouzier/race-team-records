// <advanced-filter-panel>: the Advanced Filters panel shared by Team Results
// "By race" and "By result". It has no scope of its own — it binds straight to
// its host's (filters, available options, applyFilters...), which is how the
// same markup serves both. See AdvancedFiltersService for what a host provides.
//
// It also owns the two range sliders, distance and age grade: each created
// once the markup is in, and kept in step with the host's range for it, which
// is only known once the races have loaded.
//
//   hide-active-filters="true"  leave the "Active Filters" tags to the host
angular.module('mcrrcApp').directive('advancedFilterPanel', ['$timeout', function ($timeout) {
    return {
        restrict: 'E',
        scope: false,
        templateUrl: 'views/directives/advancedFilterPanel.html',
        link: function (scope, element, attrs) {
            scope.hideAdvancedFilterTags = attrs.hideActiveFilters === 'true';

            // One range slider: its element, the host's range object, and the
            // filters fields it drives (min, max, and the inputs' *UI copies)
            function rangeSlider(id, rangeName, minKey, maxKey, filterType) {
                var el = null;
                // Set while the slider is being re-ranged: the update events it
                // fires then carry stale handle values, not a user's choice
                var quiet = false;

                // The inputs beside the slider show what it is set to
                function showValues() {
                    var values = el.noUiSlider.get();
                    scope.filters[minKey + 'UI'] = parseFloat(values[0]);
                    scope.filters[maxKey + 'UI'] = parseFloat(values[1]);
                }

                function create() {
                    el = element[0].querySelector('#' + id);
                    if (!el || typeof noUiSlider === 'undefined' || el.noUiSlider) return;
                    var range = scope[rangeName];
                    noUiSlider.create(el, {
                        start: [scope.filters[minKey], scope.filters[maxKey]],
                        connect: true,
                        range: { 'min': range.min, 'max': range.max },
                        step: 0.1,
                        format: {
                            to: function (value) {
                                return Math.round(value * 10) / 10;
                            },
                            from: function (value) {
                                return Math.round(value * 10) / 10;
                            }
                        }
                    });

                    // Update Angular model when slider changes (real-time
                    // updates). A drag arrives outside Angular and needs $apply;
                    // a set() from code (Clear, the number inputs) arrives inside
                    // a digest already. Only the root scope carries $$phase.
                    el.noUiSlider.on('update', function (values) {
                        if (quiet) return;
                        var update = function () {
                            scope.filters[minKey + 'UI'] = parseFloat(values[0]);
                            scope.filters[maxKey + 'UI'] = parseFloat(values[1]);
                            scope.filters[minKey] = scope.filters[minKey + 'UI'];
                            scope.filters[maxKey] = scope.filters[maxKey + 'UI'];
                            scope.applyFilters();
                        };
                        if (scope.$root.$$phase) {
                            update();
                        } else {
                            scope.$apply(update);
                        }
                    });
                    // A drag let go (not a set() from code): one analytics
                    // event for the range chosen
                    el.noUiSlider.on('change', function (values) {
                        scope.trackFilter(filterType, parseFloat(values[0]) + '-' + parseFloat(values[1]));
                    });
                    showValues();
                }

                // The range is a placeholder until the host has its races;
                // follow it, and the host's own min/max, as they arrive
                scope.$watch(rangeName + '.max', function (max) {
                    if (!max) return;
                    if (!el || !el.noUiSlider) {
                        $timeout(create);
                        return;
                    }
                    // Changing the range fires the slider's update with its old
                    // handle values, which would overwrite the host's (a
                    // placeholder max, say, or a range read from the URL), so
                    // those events are ignored and the wanted values put back
                    var wanted = [scope.filters[minKey], scope.filters[maxKey]];
                    quiet = true;
                    try {
                        el.noUiSlider.updateOptions({ range: { 'min': scope[rangeName].min, 'max': max } });
                        el.noUiSlider.set(wanted);
                    } finally {
                        quiet = false;
                    }
                    showValues();
                });

                scope.$on('$destroy', function () {
                    if (el && el.noUiSlider) el.noUiSlider.destroy();
                });
            }

            rangeSlider('distance-slider', 'distanceRange', 'distanceMin', 'distanceMax', 'distance');
            rangeSlider('agegrade-slider', 'ageGradeRange', 'agMin', 'agMax', 'age_grade');
        }
    };
}]);
