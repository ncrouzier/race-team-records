angular.module('appRoutes', []).config(function($stateProvider, $urlRouterProvider, $locationProvider) {
    //
    $locationProvider.html5Mode({
        enabled: true,
        requireBase: true, 
        rewriteLinks: false
    });
    // For any unmatched url, redirect to /state1
    $urlRouterProvider.otherwise("/");
    //
    // Now set up the states
    $stateProvider
        .state('/', {
            url: "/",
            templateUrl: "views/home.html",
            controller: 'HomeController',
            onEnter: function() {
                gtag('set', 'page_path', '/home.html');
                gtag('event', 'page_view');
            }
        }).state('/members', {
            url: "/members?member",
            params: {
                member: null,
            },
            templateUrl: "views/members.html",
            controller: 'MembersController',
            onEnter: function() {
                gtag('set', 'page_path', '/members.html');
                gtag('event', 'page_view');
            }
        })
        .state('/members/member', {
            url: "/members/:member",
            params: {
                member: null,
            },
            templateUrl: "views/members.html",
            controller: 'MembersController',
            onEnter: function() {
                gtag('set', 'page_path', '/members.html');
                gtag('event', 'page_view');
            }
        }).state('/results', {
            url: "/results?search",
            templateUrl: "views/results.html",
            controller: 'ResultsController',
            onEnter: function() {
                gtag('set', 'page_path', '/results.html');
                gtag('event', 'page_view');
            }
        }).state('/about', {  
            url: '/about',
            templateUrl: 'views/about.html',          
        })        
        .state('/races', {
            url: '/races/:raceId',
            templateUrl: 'views/results.html',
            controller: 'ResultsController'
        })
        .state('/login', {
            url: "/login",
            templateUrl: "views/login.html",
            controller: 'LoginController'
        }).state('/signup', {
            url: "/signup",
            templateUrl: "views/signup.html",
            controller: 'SignUpController'
        }).state('/profile', {
            url: "/profile",
            templateUrl: "views/profile.html",
            controller: 'ProfileController'
        }).state('/racetypes', {
            url: "/racetypes",
            templateUrl: "views/racetypes.html",
            controller: 'RaceTypeController'
        }).state('/records', {
            url: "/records",
            templateUrl: "views/records.html",
            controller: 'RecordsController',
            onEnter: function() {
                gtag('set', 'page_path', '/records.html');
                gtag('event', 'page_view');
            }
        }).state('/stats', {
            url: "/stats",
            templateUrl: "views/stats.html",
            controller: 'StatsController',
            onEnter: function() {
                gtag('set', 'page_path', '/stats.html');
                gtag('event', 'page_view');
            }
        }).state('/report', {
            url: "/report",
            templateUrl: "views/report.html",
            controller: 'ReportController'
        }).state('/pdf', {
            url: "/pdf",
            templateUrl: "views/pdf.html",
            controller: 'PdfGeneratorController'
        }).state('/gallery', {
            url: "/gallery",
            templateUrl: "views/gallery.html",
            controller: 'GalleryController'
        }).state('/contact', {
            url: "/contact",
            templateUrl: "views/contact.html",
            controller: 'ContactController',
            onEnter: function() {
                gtag('set', 'page_path', '/contact.html');
                gtag('event', 'page_view');
            }
        }).state('/bulk', {
            url: "/bulk",
            templateUrl: "views/bulkOperations.html",
            controller: 'BulkOperationsController'
        }).state('/mcrrcreport', {
            url: "/mcrrcreport?from&to",
            templateUrl: "views/mcrrcreport.html",
            controller: 'TableReportController'
        }).state('/submit', {
            url: "http://bit.ly/reportresult"
        }).state('/instagram', {
            url: "https://www.instagram.com/mcrrc_racing",
            onEnter: function() {
                gtag('set', 'page_path', '/instagram');
                gtag('event', 'page_view');
            }
        });

});
