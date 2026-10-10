// Google Analytics (GA4), through gtag.js. The one place the app talks to GA:
//
//   Analytics.event(name, params)  an interaction, e.g. 'view_records'
//   Analytics.pageView(stateName)  a page view; sent only by the transition
//                                  hook in app.js, once per page
//   Analytics.setUser(user)        the user_role user property
//
// gtag is only on the page in production (views/index.ejs, gaEnabled), so
// everything here is a no-op locally and in tests. Never send names,
// usernames or emails: GA's terms forbid personal information, so send ids
// and categories only.
angular.module('mcrrcApp').service('Analytics', ['$window', '$timeout', function ($window, $timeout) {

    function gtag() {
        if (typeof $window.gtag === 'function') {
            $window.gtag.apply($window, arguments);
        }
    }

    this.event = function (name, params) {
        gtag('event', name, params || {});
    };

    // An event that must go out before the page unloads (login reloads the
    // whole page): calls done() once GA has the hit, after at most a second,
    // or at once when GA is not on the page
    this.eventThen = function (name, params, done) {
        if (typeof $window.gtag !== 'function') {
            done();
            return;
        }
        var called = false;
        var finish = function () {
            if (!called) {
                called = true;
                done();
            }
        };
        $window.gtag('event', name, angular.extend({}, params, { event_callback: finish, event_timeout: 1000 }));
        $window.setTimeout(finish, 1200);
    };

    // For input that changes as it is typed (a search box, a date, a number):
    // one event once it settles, not one per keystroke. Calls with the same
    // key restart the wait; params is a function, read when the event goes.
    var soon = {};
    this.eventSoon = function (key, name, params, delay) {
        if (soon[key]) $timeout.cancel(soon[key]);
        soon[key] = $timeout(function () {
            delete soon[key];
            var values = params();
            if (values) gtag('event', name, values);
        }, delay || 1500, false);
    };

    // page_template is the route's name ('/results/result', not the result's
    // own URL), so every page of a kind can be reported together. Location
    // and title are passed in: the title can arrive after the reader has
    // already moved on (app.js).
    this.pageView = function (stateName, location, title) {
        gtag('event', 'page_view', {
            page_location: location || $window.location.href,
            page_title: title || $window.document.title,
            page_template: stateName
        });
    };

    this.setUser = function (user) {
        gtag('set', 'user_properties', {
            user_role: user && user.role ? user.role : 'anonymous'
        });
    };
}]);

// track-event="name" track-params="{...}": sends an event when the element is
// clicked, for links and buttons whose click does nothing else worth a line of
// controller code. track-params is evaluated on the element's scope.
//   <a ui-sref="/individualresults" track-event="view_switch"
//      track-params="{from: 'race_results', to: 'individual_results'}">
angular.module('mcrrcApp').directive('trackEvent', ['Analytics', function (Analytics) {
    return {
        restrict: 'A',
        link: function (scope, element, attrs) {
            element.on('click', function () {
                Analytics.event(attrs.trackEvent, scope.$eval(attrs.trackParams) || {});
            });
        }
    };
}]);
