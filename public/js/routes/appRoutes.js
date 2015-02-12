angular.module('appRoutes', []).config(function($stateProvider, $urlRouterProvider) {
    //
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
            url: "/members",
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
        }).state('/report', {
            url: "/report",
            templateUrl: "views/report.html",
            controller: 'ReportController'
        }).state('/pdf', {
            url: "/pdf",
            templateUrl: "views/pdf.html",
            controller: 'PdfGeneratorController'
        }).state('/contact', {
            url: "/contact",
            templateUrl: "views/contact.html",
            controller: 'ContactController'
        });

});
