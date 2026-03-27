angular.module('appRoutes', []).config(function ($stateProvider, $urlRouterProvider, $locationProvider) {
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
            controller: 'HomeController'
        }).state('/members', {
            url: "/members?member",
            templateUrl: "views/memberList.html",
            controller: 'MembersController',
            redirectTo: function (transition) {
                //backward compatibility
                var member = transition.params().member;
                if (member) {
                    return transition.router.stateService.target('/members/member/bio', { member: member });
                }
                return null; // No redirect, stay on current state
            }
        })
        .state('/members/member', {
            url: "/members/:member",
            params: {
                member: null,
            },
            redirectTo: function (transition) {
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
            controller: 'MembersController'
        })
        .state('/members/member/stats', {
            url: "/members/:member/stats",
            params: {
                member: null,
            },
            templateUrl: "views/memberStats.html",
            controller: 'MemberStatsController'
        })
        .state('/members/member/head-to-head-compare', {
            url: "/members/:member/head-to-head/:member2",
            params: {
                member: null,
                member2: null,
            },
            templateUrl: "views/memberHeadToHead.html",
            controller: 'HeadToHeadController'
        })
        .state('/members/member/head-to-head', {
            url: "/members/:member/head-to-head",
            params: {
                member: null,
            },
            templateUrl: "views/memberHeadToHead.html",
            controller: 'HeadToHeadController'
        })
        .state('/members/member/volunteer-jobs', {
            url: "/members/:member/volunteer-jobs",
            params: {
                member: null,
            },
            templateUrl: "views/memberVolunteerJobs.html",
            controller: 'MemberVolunteerJobsController'
        })

        .state('/members/head-to-head', {
            url: "/members/head-to-head/:member1/:member2?",
            params: {
                member1: null,
                member2: null,
            },
            templateUrl: "views/headToHead.html",
            controller: 'HeadToHeadController'
        })
        .state('/results', {
            url: "/results",
            templateUrl: "views/results.html",
            controller: 'ResultsController',
            params: {
                search: null
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
        }).state('/forgot-password', {
            url: "/forgot-password",
            templateUrl: "views/forgot-password.html",
            controller: 'ForgotPasswordController'
        }).state('/reset-password', {
            url: "/reset-password/:token",
            templateUrl: "views/reset-password.html",
            controller: 'ResetPasswordController'
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
        }).state('/users', {
            url: "/users",
            templateUrl: "views/users.html",
            controller: 'UsersController'
        }).state('/activitylogs', {
            url: "/activitylogs",
            templateUrl: "views/activitylogs.html",
            controller: 'ActivityLogController'
        }).state('/volunteer-jobs', {
            url: "/volunteer-jobs",
            templateUrl: "views/volunteerJobs.html",
            controller: 'VolunteerJobsController'
        }).state('/stats/requirements', {
            url: "/stats/requirements",
            templateUrl: "views/stats/requirements.html",
            controller: 'RequirementsController'
        }).state('/records', {
            url: "/records",
            templateUrl: "views/records.html",
            controller: 'RecordsController'
        }).state('/stats', {
            url: "/stats",
            redirectTo: '/stats/team'
        }).state('/stats/team', {
            url: "/stats/team",
            templateUrl: "views/stats/team.html",
            controller: 'StatsController'
        }).state('/stats/us-map', {
            url: "/stats/us-map",
            templateUrl: "views/stats/us-map.html",
            controller: 'StatsController'
        }).state('/stats/world-map', {
            url: "/stats/world-map",
            templateUrl: "views/stats/world-map.html",
            controller: 'StatsController'
        }).state('/stats/participation', {
            url: "/stats/participation",
            templateUrl: "views/stats/participation.html",
            controller: 'StatsController'
        }).state('/stats/members', {
            url: "/stats/members",
            templateUrl: "views/stats/members.html",
            controller: 'StatsController'
        }).state('/stats/progress-map', {
            url: "/stats/progress-map",
            templateUrl: "views/stats/progress-map.html",
            controller: 'ProgressMapController'
        }).state('/stats/awards', {
            url: "/stats/awards",
            templateUrl: "views/stats/awards.html",
            controller: 'StatsController'
        }).state('/tools', {
            url: "/tools",
            redirectTo: '/tools/agegrade'
        }).state('/tools/agegrade', {
            url: "/tools/agegrade",
            templateUrl: "views/agegrade.html",
            controller: 'AgeGradeController'
        }).state('/tools/paceAdjustment', {
            url: "/tools/paceAdjustment",
            templateUrl: "views/tempAdjustment.html",
            controller: 'TempAdjustmentController'
        }).state('/tools/resultExtractor', {
            url: "/tools/result-extractor",
            templateUrl: "views/resultExtractor.html",
            controller: 'ResultExtractorController',
            resolve: {
                auth: function (AuthService) {
                    return AuthService.isLoggedIn();
                }
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
            controller: 'ContactController'
        }).state('/bulk', {
            url: "/bulk",
            templateUrl: "views/bulkOperations.html",
            controller: 'BulkOperationsController'
        }).state('/mcrrcreport', {
            url: "/mcrrcreport?from&to",
            templateUrl: "views/mcrrcreport.html",
            controller: 'TableReportController'
        }).state('/submitresult', {
            url: "https://forms.gle/upXaECBdjt17WhwR9"
        })
        .state('/submitvolunteer', {
            url: "https://forms.gle/iqZVhUjg6WpgG8D97"
        })
        .state('/instagram', {
            url: "https://www.instagram.com/mcrrc_racing"
        })
        .state('/notacult', {
            url: "/notacult",
            templateUrl: "views/notacult.html",
            controller: 'ParkrunStatsController'
        });

});
