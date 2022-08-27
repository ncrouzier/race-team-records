angular.module('appRoutes', []).config(function($stateProvider, $urlRouterProvider, $locationProvider) {
    //
    $locationProvider.html5Mode({
        enabled: true,
        requireBase: false,
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
            controller: 'HomeController'
        }).state('/members', {
            url: "/members?member",
            params: {
                member: null,
            },
            templateUrl: "views/members.html",
            controller: 'MembersController'
        }).state('/results', {
            url: "/results",
            templateUrl: "views/results.html",
            controller: 'ResultsController'
        }).state('/login', {
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
            controller: 'RecordsController'
        }).state('/stats', {
            url: "/stats",
            templateUrl: "views/stats.html",
            controller: 'StatsController'
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
            controller: 'ContactController'
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
            url: "https://www.instagram.com/mcrrc"
        });

});
