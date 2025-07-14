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
            templateUrl: "views/memberList.html",
            controller: 'MembersController',
            redirectTo: function(transition) {
                //backward compatibility
                var member = transition.params().member;
                if (member) {
                    return transition.router.stateService.target('/members/member/bio', { member: member });
                }
                return null; // No redirect, stay on current state
            },
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
            redirectTo: function(transition) {
                var member = transition.params().member;
                return transition.router.stateService.target('/members/member/bio', { member: member });
            }
        })
        .state('/members/member/bio', {
            url: "/members/:member/bio",
            params: {
                member: null,
            },
            templateUrl: "views/memberDetail.html",
            controller: 'MembersController',
            onEnter: function() {
                gtag('set', 'page_path', '/memberDetail.html');
                gtag('event', 'page_view');
            }
        })
        .state('/members/member/stats', {
            url: "/members/:member/stats",
            params: {
                member: null,
            },
            templateUrl: "views/memberStats.html",
            controller: 'MemberStatsController',
            onEnter: function() {
                gtag('set', 'page_path', '/memberStats.html');
                gtag('event', 'page_view');
            }
        }).state('/results', {
            url: "/results",
            templateUrl: "views/results.html",
            controller: 'ResultsController',
            params: {
                search: null
            },
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
        }).state('/tools', {
            url: "/tools",
            redirectTo: '/tools/agegrade'
        }).state('/tools/agegrade', {
            url: "/tools/agegrade",
            templateUrl: "views/agegrade.html",
            controller: 'AgeGradeController',
            onEnter: function() {
                gtag('set', 'page_path', '/agegrade.html');
                gtag('event', 'page_view');
            }
        }).state('/tools/paceAdjustment', {
            url: "/tools/paceAdjustment",
            templateUrl: "views/tempAdjustment.html",
            controller: 'TempAdjustmentController',
            onEnter: function() {
                gtag('set', 'page_path', '/tempAdjustment.html');
                gtag('event', 'page_view');
            }
        }).state('/tools/resultExtractor', {
            url: "/tools/result-extractor",
            templateUrl: "views/resultExtractor.html",
            controller: 'ResultExtractorController',
            resolve: {
                auth: function(AuthService) {
                    return AuthService.isLoggedIn();
                }
            },
            onEnter: function() {
                gtag('set', 'page_path', '/resultExtractor.html');
                gtag('event', 'page_view');
            }
        }).state('/moist', {
            url: "/moist",
            redirectTo: '/tools/paceAdjustment'
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
