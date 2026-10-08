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
            controller: 'HomeController',
            onEnter: function () {
                gtag('set', 'page_path', '/home.html');
                gtag('event', 'page_view');
            }
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
            },
            onEnter: function () {
                gtag('set', 'page_path', '/members.html');
                gtag('event', 'page_view');
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
            controller: 'MembersController',
            onEnter: function () {
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
            onEnter: function () {
                gtag('set', 'page_path', '/memberStats.html');
                gtag('event', 'page_view');
            }
        })
        .state('/members/member/head-to-head-compare', {
            url: "/members/:member/head-to-head/:member2",
            params: {
                member: null,
                member2: null,
            },
            templateUrl: "views/memberHeadToHead.html",
            controller: 'HeadToHeadController',
            onEnter: function () {
                gtag('set', 'page_path', '/memberHeadToHead.html');
                gtag('event', 'page_view');
            }
        })
        .state('/members/member/head-to-head', {
            url: "/members/:member/head-to-head",
            params: {
                member: null,
            },
            templateUrl: "views/memberHeadToHead.html",
            controller: 'HeadToHeadController',
            onEnter: function () {
                gtag('set', 'page_path', '/memberHeadToHead.html');
                gtag('event', 'page_view');
            }
        })
        .state('/members/member/volunteer-jobs', {
            url: "/members/:member/volunteer-jobs",
            params: {
                member: null,
            },
            templateUrl: "views/memberVolunteerJobs.html",
            controller: 'MemberVolunteerJobsController',
            onEnter: function () {
                gtag('set', 'page_path', '/memberVolunteerJobs.html');
                gtag('event', 'page_view');
            }
        })

        .state('/members/head-to-head', {
            url: "/members/head-to-head/:member1/:member2?",
            params: {
                member1: null,
                member2: null,
            },
            templateUrl: "views/headToHead.html",
            controller: 'HeadToHeadController',
            onEnter: function () {
                gtag('set', 'page_path', '/headToHead.html');
                gtag('event', 'page_view');
            }
        })
        .state('/results', {
            // Filters live in the URL (see ResultsCtrl processStateParams)
            url: "/results?q&types&from&to&minmi&maxmi&agmin&agmax&missing&distance&country&state&runner&month&day",
            templateUrl: "views/results.html",
            controller: 'ResultsController',
            params: {
                // Older links: the filters as JSON, not in the URL
                search: { value: null, dynamic: true },
                q: { dynamic: true, squash: true, value: null },
                types: { dynamic: true, squash: true, value: null },
                from: { dynamic: true, squash: true, value: null },
                to: { dynamic: true, squash: true, value: null },
                minmi: { dynamic: true, squash: true, value: null },
                maxmi: { dynamic: true, squash: true, value: null },
                agmin: { dynamic: true, squash: true, value: null },
                agmax: { dynamic: true, squash: true, value: null },
                missing: { dynamic: true, squash: true, value: null },
                distance: { dynamic: true, squash: true, value: null },
                country: { dynamic: true, squash: true, value: null },
                state: { dynamic: true, squash: true, value: null },
                runner: { dynamic: true, squash: true, value: null },
                month: { dynamic: true, squash: true, value: null },
                day: { dynamic: true, squash: true, value: null }
            },
            onEnter: function () {
                gtag('set', 'page_path', '/results.html');
                gtag('event', 'page_view');
            }
        }).state('/individualresults', {
            // Team Results "By result". Every filter, the sort and the page
            // live in the URL, so a view can be linked to and lands as-is:
            //   q         search words            race      race id
            //   distance  e.g. 5k, marathon       surface   road, track, trail...
            //   year      e.g. 2024               runner    member username
            //   month     1-12                    day       1-31
            //             (combine freely: month=1&day=1 is every January 1,
            //             year=2024&month=3 is March 2024)
            //   sex       m/f (or men/women)      division  open/master
            //   age       exact age at the race   agemin / agemax  age range
            //   sort      date|time|pace|agegrade|place|age|name|race
            //   dir       asc|desc                page      1, 2, ...
            //   under     time cutoff, strictly under: 16:00, 1:30:00
            //   agmin     age grade at least, e.g. 80     agmax  at most
            //   (distance and surface can list several: distance=5k,5000m,
            //   surface=road,track)
            //   state     US state code, e.g. MD   country   country code, e.g. CAN
            //   variable  1: only variable distances (odd distances,
            //             multisport, swim)
            //   Advanced Filters panel:
            //   types     race types, name|surface: types=5k|road,1 mile|track
            //   from, to  date range, YYYY-MM-DD   minmi, maxmi  distance range
            //   missing   (admin) a missing-ranking option, e.g. overallrank
            //   runner, state and country take several, comma separated
            //   eligible  1: only results that count for team standings
            //             (record eligible, one runner, a time)
            //   win       1: only wins (1st overall or of their gender)
            //   highlight result id: opens on its page and marks the row
            // All dynamic: changing them updates the URL without a reload.
            url: "/individualresults?q&types&from&to&minmi&maxmi&missing&distance&surface&year&month&day&state&country&sex&division&race&runner&age&agemin&agemax&under&agmin&agmax&variable&eligible&win&sort&dir&page&highlight",
            templateUrl: "views/individualResultsPage.html",
            params: {
                q: { value: null, squash: true, dynamic: true },
                types: { value: null, squash: true, dynamic: true },
                from: { value: null, squash: true, dynamic: true },
                to: { value: null, squash: true, dynamic: true },
                minmi: { value: null, squash: true, dynamic: true },
                maxmi: { value: null, squash: true, dynamic: true },
                missing: { value: null, squash: true, dynamic: true },
                distance: { value: null, squash: true, dynamic: true },
                surface: { value: null, squash: true, dynamic: true },
                year: { value: null, squash: true, dynamic: true },
                month: { value: null, squash: true, dynamic: true },
                state: { value: null, squash: true, dynamic: true },
                country: { value: null, squash: true, dynamic: true },
                day: { value: null, squash: true, dynamic: true },
                sex: { value: null, squash: true, dynamic: true },
                division: { value: null, squash: true, dynamic: true },
                race: { value: null, squash: true, dynamic: true },
                runner: { value: null, squash: true, dynamic: true },
                age: { value: null, squash: true, dynamic: true },
                agemin: { value: null, squash: true, dynamic: true },
                agemax: { value: null, squash: true, dynamic: true },
                under: { value: null, squash: true, dynamic: true },
                agmin: { value: null, squash: true, dynamic: true },
                agmax: { value: null, squash: true, dynamic: true },
                win: { value: null, squash: true, dynamic: true },
                variable: { value: null, squash: true, dynamic: true },
                eligible: { value: null, squash: true, dynamic: true },
                highlight: { value: null, squash: true, dynamic: true },
                sort: { value: null, squash: true, dynamic: true },
                dir: { value: null, squash: true, dynamic: true },
                page: { value: null, squash: true, dynamic: true }
            },
            onEnter: function () {
                gtag('set', 'page_path', '/individualresults.html');
                gtag('event', 'page_view');
            }
        }).state('/about', {
            url: '/about',
            templateUrl: 'views/about.html',
        })
        .state('/races', {
            url: '/races/:raceId',
            params: {
                raceId: null,
            },
            templateUrl: 'views/raceDetail.html',
            controller: 'RaceDetailController',
            onEnter: function () {
                gtag('set', 'page_path', '/raceDetail.html');
                gtag('event', 'page_view');
            }
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
        }).state('/email-login', {
            url: "/email-login",
            templateUrl: "views/email-login.html",
            controller: 'EmailLoginController'
        }).state('/magic-login', {
            url: "/magic-login/:token",
            templateUrl: "views/magic-login.html",
            controller: 'MagicLoginController'
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
            controller: 'UsersController',
            onEnter: function () {
                gtag('set', 'page_path', '/users.html');
                gtag('event', 'page_view');
            }
        }).state('/banners', {
            url: "/banners",
            templateUrl: "views/banners.html",
            controller: 'BannersController',
            onEnter: function () {
                gtag('set', 'page_path', '/banners.html');
                gtag('event', 'page_view');
            }
        }).state('/activitylogs', {
            url: "/activitylogs",
            templateUrl: "views/activitylogs.html",
            controller: 'ActivityLogController',
            onEnter: function () {
                gtag('set', 'page_path', '/activitylogs.html');
                gtag('event', 'page_view');
            }
        }).state('/agegrading-tables', {
            url: "/agegrading-tables",
            templateUrl: "views/ageGradingTables.html",
            controller: 'AgeGradingTablesController',
            onEnter: function () {
                gtag('set', 'page_path', '/agegradingTables.html');
                gtag('event', 'page_view');
            }
        }).state('/volunteer-jobs', {
            url: "/volunteer-jobs",
            templateUrl: "views/volunteerJobs.html",
            controller: 'VolunteerJobsController',
            onEnter: function () {
                gtag('set', 'page_path', '/volunteerJobs.html');
                gtag('event', 'page_view');
            }
        }).state('/stats/requirements', {
            url: "/stats/requirements",
            templateUrl: "views/stats/requirements.html",
            controller: 'RequirementsController',
            onEnter: function () {
                gtag('set', 'page_path', '/stats/requirements.html');
                gtag('event', 'page_view');
            }
        }).state('/records', {
            url: "/records",
            templateUrl: "views/records.html",
            controller: 'RecordsController',
            onEnter: function () {
                gtag('set', 'page_path', '/records.html');
                gtag('event', 'page_view');
            }
        }).state('/records/age', {
            url: "/records/age",
            templateUrl: "views/ageRecords.html",
            controller: 'AgeRecordsController',
            onEnter: function () {
                gtag('set', 'page_path', '/records/age');
                gtag('event', 'page_view');
            }
        }).state('/records/year', {
            url: "/records/year",
            templateUrl: "views/yearRecords.html",
            controller: 'YearRecordsController',
            onEnter: function () {
                gtag('set', 'page_path', '/records/year');
                gtag('event', 'page_view');
            }
        }).state('/stats', {
            url: "/stats",
            redirectTo: '/stats/team'
        }).state('/stats/team', {
            url: "/stats/team",
            templateUrl: "views/stats/team.html",
            controller: 'StatsController',
            onEnter: function () {
                gtag('set', 'page_path', '/stats/team.html');
                gtag('event', 'page_view');
            }
        }).state('/stats/volunteering', {
            url: "/stats/volunteering",
            templateUrl: "views/stats/volunteering.html",
            controller: 'VolunteerStatsController',
            onEnter: function () {
                gtag('set', 'page_path', '/stats/volunteering.html');
                gtag('event', 'page_view');
            }
        }).state('/stats/us-map', {
            url: "/stats/us-map",
            templateUrl: "views/stats/us-map.html",
            controller: 'StatsController',
            onEnter: function () {
                gtag('set', 'page_path', '/stats/us-map.html');
                gtag('event', 'page_view');
            }
        }).state('/stats/world-map', {
            url: "/stats/world-map",
            templateUrl: "views/stats/world-map.html",
            controller: 'StatsController',
            onEnter: function () {
                gtag('set', 'page_path', '/stats/world-map.html');
                gtag('event', 'page_view');
            }
        }).state('/stats/participation', {
            url: "/stats/participation",
            templateUrl: "views/stats/participation.html",
            controller: 'StatsController',
            onEnter: function () {
                gtag('set', 'page_path', '/stats/participation.html');
                gtag('event', 'page_view');
            }
        }).state('/stats/members', {
            url: "/stats/members",
            templateUrl: "views/stats/members.html",
            controller: 'StatsController',
            onEnter: function () {
                gtag('set', 'page_path', '/stats/members.html');
                gtag('event', 'page_view');
            }
        }).state('/stats/progress-map', {
            url: "/stats/progress-map",
            templateUrl: "views/stats/progress-map.html",
            controller: 'ProgressMapController',
            onEnter: function () {
                gtag('set', 'page_path', '/stats/progress-map.html');
                gtag('event', 'page_view');
            }
        }).state('/stats/awards', {
            url: "/stats/awards",
            templateUrl: "views/stats/awards.html",
            controller: 'StatsController',
            onEnter: function () {
                gtag('set', 'page_path', '/stats/awards.html');
                gtag('event', 'page_view');
            }
        }).state('/tools', {
            url: "/tools",
            redirectTo: '/tools/agegrade'
        }).state('/tools/agegrade', {
            url: "/tools/agegrade",
            templateUrl: "views/agegrade.html",
            controller: 'AgeGradeController',
            onEnter: function () {
                gtag('set', 'page_path', '/agegrade.html');
                gtag('event', 'page_view');
            }
        }).state('/tools/paceAdjustment', {
            url: "/tools/paceAdjustment",
            templateUrl: "views/tempAdjustment.html",
            controller: 'TempAdjustmentController',
            onEnter: function () {
                gtag('set', 'page_path', '/tempAdjustment.html');
                gtag('event', 'page_view');
            }
        }).state('/tools/resultExtractor', {
            url: "/tools/result-extractor",
            templateUrl: "views/resultExtractor.html",
            controller: 'ResultExtractorController',
            resolve: {
                auth: function (AuthService) {
                    return AuthService.isLoggedIn();
                }
            },
            onEnter: function () {
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
            onEnter: function () {
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
        }).state('/submitresult', {
            url: "https://forms.gle/upXaECBdjt17WhwR9"
        })
        .state('/submitvolunteer', {
            url: "https://forms.gle/iqZVhUjg6WpgG8D97"
        })
        .state('/instagram', {
            url: "https://www.instagram.com/mcrrc_racing",
            onEnter: function () {
                gtag('set', 'page_path', '/instagram');
                gtag('event', 'page_view');
            }
        })
        .state('/notacult', {
            url: "/notacult",
            templateUrl: "views/notacult.html",
            controller: 'ParkrunStatsController'
        })
        .state('/comp-race-forms', {
            url: "/comp-race-forms",
            templateUrl: "views/compRaceForms.html",
            controller: 'CompRaceFormsController',
            onEnter: function () {
                gtag('set', 'page_path', '/comp-race-forms');
                gtag('event', 'page_view');
            }
        })
        .state('/comp-race-forms/detail', {
            url: "/comp-race-forms/detail?formId",
            templateUrl: "views/compRaceFormDetail.html",
            controller: 'CompRaceFormDetailController',
            onEnter: function () {
                gtag('set', 'page_path', '/comp-race-forms/detail');
                gtag('event', 'page_view');
            }
        })
        .state('/results/result', {
            url: "/results/:resultId",
            params: {
                resultId: null,
            },
            templateUrl: "views/resultDetail.html",
            controller: 'ResultDetailController',
            onEnter: function () {
                gtag('set', 'page_path', '/resultDetail.html');
                gtag('event', 'page_view');
            }
        })
        .state('/applications', {
            url: "/applications",
            templateUrl: "views/teamApplications.html",
            controller: 'TeamApplicationsController',
            onEnter: function () {
                gtag('set', 'page_path', '/applications');
                gtag('event', 'page_view');
            }
        });

});
