// The browser tab title: "<page> | MCRRC Racing Team" on every page.
//
// Most pages have a fixed title, from TITLES below by route. Pages about one
// thing get its name: a member's pages look the member up by the username in
// the URL; a race or a result page sets its own title with set() once its data
// has loaded.
//
// forTransition() is called on every page change (app.js). It sets the title
// and resolves once the title is final, which is when the page view goes to
// Google Analytics, so reports show "Boston Marathon (2014)" and not the site
// name.
angular.module('mcrrcApp').service('PageTitleService', ['$document', '$q', '$timeout', 'MembersService',
    function ($document, $q, $timeout, MembersService) {
    var SITE_TITLE = 'MCRRC Racing Team';

    // Fixed titles by route. Missing ones show the site title alone.
    var TITLES = {
        '/': 'Home',
        '/members': 'Team Members',
        '/results': 'Race Results',
        '/individualresults': 'Individual Results',
        '/races': 'Race',
        '/results/result': 'Result',
        '/about': 'About',
        '/login': 'Log In',
        '/forgot-password': 'Forgot Password',
        '/reset-password': 'Reset Password',
        '/email-login': 'Email Log In',
        '/magic-login': 'Log In',
        '/signup': 'Sign Up',
        '/profile': 'Profile',
        '/racetypes': 'Race Types',
        '/users': 'Users',
        '/banners': 'Banners',
        '/activitylogs': 'Activity Log',
        '/agegrading-tables': 'Age Grading Tables',
        '/volunteer-jobs': 'Volunteer Jobs',
        '/stats/requirements': 'Team Requirements',
        '/records': 'Records: Best Performances',
        '/records/age': 'Records by Age',
        '/records/year': 'Records by Year',
        '/stats/team': 'Racing Stats',
        '/stats/volunteering': 'Volunteering Stats',
        '/stats/us-map': 'US Map',
        '/stats/world-map': 'World Map',
        '/stats/participation': 'Participation',
        '/stats/members': 'Member Stats',
        '/stats/progress-map': 'Progress Map',
        '/stats/awards': 'Awards',
        '/tools/agegrade': 'Age Grade Calculator',
        '/tools/paceAdjustment': 'Pace Adjustment Calculator',
        '/tools/resultExtractor': 'Result Extractor',
        '/report': 'Report',
        '/pdf': 'PDF Report',
        '/gallery': 'Gallery',
        '/contact': 'Contact',
        '/bulk': 'Bulk Edit',
        '/mcrrcreport': 'MCRRC Report',
        '/submitresult': 'Submit a Result',
        '/submitvolunteer': 'Submit a Volunteer Job',
        '/instagram': 'Instagram',
        '/notacult': 'Not a Cult',
        '/comp-race-forms': 'Competitive Race Forms',
        '/comp-race-forms/detail': 'Competitive Race Form',
        '/applications': 'Team Applications'
    };

    // A member's pages: "<name>" plus what the page shows. member2 is the
    // other runner on a head-to-head.
    var MEMBER_TITLES = {
        '/members/member/bio': function (a) { return a; },
        '/members/member/stats': function (a) { return a + ' – Stats'; },
        '/members/member/head-to-head': function (a) { return a + ' – Head to Head'; },
        '/members/member/head-to-head-compare': function (a, b) { return a + ' vs ' + (b || '?'); },
        '/members/member/volunteer-jobs': function (a) { return a + ' – Volunteer Jobs'; },
        '/members/head-to-head': function (a, b) { return b ? a + ' vs ' + b : a + ' – Head to Head'; }
    };

    // Pages that call set() themselves once their data is in
    var SET_BY_PAGE = { '/races': true, '/results/result': true };

    // How long a page view waits for a title that is still loading
    var WAIT_MS = 4000;

    var doc = $document[0];
    var pending = null;    // the page whose title set() will complete
    var earlyTitle = null; // a set() that came before forTransition()

    function full(title) {
        return title ? title + ' | ' + SITE_TITLE : SITE_TITLE;
    }

    // The member list is usually in memory already (same query as the
    // results lists), so this rarely costs a request
    function memberName(username) {
        if (!username) return $q.when(null);
        return $q.when(MembersService.getMembersWithCacheSupport({
            sort: 'memberStatus firstname',
            select: '-bio -personalBests -teamRequirementStats'
        })).then(function (members) {
            var m = (members || []).find(function (x) {
                return x.username && x.username.toLowerCase() === String(username).toLowerCase();
            });
            return m ? m.firstname + ' ' + m.lastname : null;
        }, function () { return null; });
    }

    // A page change is starting (app.js, onStart): forget the last page's
    // early title
    this.begin = function () {
        earlyTitle = null;
        pending = null;
    };

    // Sets this page change's title; resolves with the final title when it
    // is known, or after WAIT_MS with whatever is there by then
    this.forTransition = function (transition) {
        var name = transition.to().name;
        var params = transition.params();
        if (SET_BY_PAGE[name] && earlyTitle) {
            // The page had its data at once (from cache) and set it already
            doc.title = earlyTitle;
            return $q.when(earlyTitle);
        }
        doc.title = full(TITLES[name]);
        pending = null;

        if (MEMBER_TITLES[name]) {
            var a = params.member || params.member1;
            return $q.all([memberName(a), memberName(params.member2)]).then(function (names) {
                var title = MEMBER_TITLES[name](names[0] || a, names[1] || params.member2);
                // Unless the reader has already moved on
                if (transition.router.globals.current.name === name) doc.title = full(title);
                return full(title);
            });
        }

        if (SET_BY_PAGE[name]) {
            var waiting = pending = $q.defer();
            $timeout(function () {
                // Still waiting on this page: take what is there. Moved on:
                // this page's route title, not the next page's.
                waiting.resolve(pending === waiting ? doc.title : full(TITLES[name]));
            }, WAIT_MS, false);
            return waiting.promise;
        }

        return $q.when(doc.title);
    };

    // A race or result page's own title, once its data is in. Puts the route's
    // title back when that page goes away (unless the next page has already
    // set its own).
    this.set = function (scope, title) {
        var text = full(title);
        doc.title = text;
        if (pending) {
            pending.resolve(text);
            pending = null;
        } else {
            earlyTitle = text;
        }
        scope.$on('$destroy', function () {
            if (doc.title === text) {
                doc.title = SITE_TITLE;
            }
        });
    };
}]);
