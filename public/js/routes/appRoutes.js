angular.module('appRoutes', []).config(function($stateProvider, $urlRouterProvider) {
  //
  // For any unmatched url, redirect to /state1
  $urlRouterProvider.otherwise("/");
  //
  // Now set up the states
  $stateProvider
    .state('/', {
      url: "/",
      controller: 'MainController',
      templateUrl: "views/home.html"
    }).state('/members', {
      url: "/members",
      templateUrl: "views/members.html",
      controller: 'MembersController'
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
    }).state('/admin', {
      url: "/admin",
      templateUrl: "views/admin.html",
      controller: 'AdminController'
    }).state('/records', {
      url: "/records",
      templateUrl: "views/records.html",
      controller: 'RecordController'
    });

});