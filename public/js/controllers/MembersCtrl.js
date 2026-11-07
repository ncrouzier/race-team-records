angular.module('mcrrcApp.members').controller('MembersController', ['$scope', '$location', '$timeout', '$state', '$stateParams', '$http', 'Analytics', 'AuthService', 'MembersService', 'ResultsService', 'dialogs', '$filter', 'localStorageService', 'UtilsService', 'TeamRequirementsConfig', 'AdvancedFiltersService', function ($scope, $location, $timeout, $state, $stateParams, $http, Analytics, AuthService, MembersService, ResultsService, dialogs, $filter, localStorageService, UtilsService, TeamRequirementsConfig, AdvancedFiltersService) {

    $scope.authService = AuthService;
    $scope.reqConfig = TeamRequirementsConfig.getForYear(new Date().getFullYear());
    $scope.$watch('authService.isLoggedIn()', function (user) {
        $scope.user = user;
    });

    $scope.$watch('paramModel', function (user) {
        localStorageService.set('members.options', $scope.paramModel);
    }, true);

    $scope.sortBy = function (criteria) {
        if ($scope.sortCriteria === criteria) {
            $scope.sortDirection = $scope.sortDirection === true ? false : true;
        } else {
            $scope.sortCriteria = criteria;
            $scope.sortDirection = true;
        }
        //sortDirection true = asc, false = desc
        $scope.currentMemberResultList.sort(customResultSort($scope.currentMemberResultList, $scope.sortCriteria, $scope.sortDirection));
    };

    function customResultSort(arr, field, order) {
        return (result1, result2) => {
            if (field === 'race.racedate') {
                if (result1.race.racedate < result2.race.racedate) {
                    return order === true ? -1 : 1;
                } else if (result1.race.racedate > result2.race.racedate) {
                    return order === true ? 1 : -1;
                }

                if (result1.race.order < result2.race.order) {
                    return order === true ? -1 : 1;
                } else if (result1.race.order > result2.race.order) {
                    return order === true ? 1 : -1;
                }

                if (result1.race.racename < result2.race.racename) {
                    return order === true ? -1 : 1;
                } else if (result1.race.racename > result2.race.racename) {
                    return order === true ? 1 : -1;
                }

                if (result1.time < result2.time) {
                    return order === true ? -1 : 1;
                } else if (result1.time > result2.time) {
                    return order === true ? 1 : -1;
                }

                return 0;
            }

            if (field === 'pace') {
                //if result is multisport, put at the end
                if (result1.race.isMultisport) {
                    return 1;
                }
                if (result2.race.isMultisport) {
                    return -1;
                }
                if (result1.time / result1.race.racetype.miles < result2.time / result2.race.racetype.miles) {
                    return order === true ? -1 : 1;
                } else if (result1.time / result1.race.racetype.miles > result2.time / result2.race.racetype.miles) {
                    return order === true ? 1 : -1;
                }
                return 0;
            }

            if (field === 'time') {
                if (result1.time < result2.time) {
                    return order === true ? -1 : 1;
                } else if (result1.time > result2.time) {
                    return order === true ? 1 : -1;
                }
                return 0;
            }

            if (field === 'agegrade') {
                //if result has no agegrade, put at the end    
                if (result1.agegrade === undefined) {
                    return 1;
                }
                if (result2.agegrade === undefined) {
                    return -1;
                }
                if (result1.agegrade < result2.agegrade) {
                    return order === true ? -1 : 1;
                } else if (result1.agegrade > result2.agegrade) {
                    return order === true ? 1 : -1;
                }
                return 0;
            }
        };
    }

    $scope.membersList = [];
    $scope.query = "";

    // =====================================
    // FILTER PARAMS CONFIG ================
    // =====================================

    if (localStorageService.get('members.options')) {
        $scope.paramModel = localStorageService.get('members.options');
    } else {
        $scope.paramModel = {};
        $scope.paramModel.memberStatus = 'current';
    }
    // The list always loads both sexes and categories; the group buttons
    // filter in the page. (Older saved options may still carry narrower ones.)
    $scope.paramModel.sex = '.*';
    $scope.paramModel.category = '.*';
    $scope.paramModel.view = $scope.paramModel.view || 'sections';
    if ($scope.paramModel.group === undefined) {
        $scope.paramModel.group = 'all';
    }

    // =====================================
    // ADMIN CONFIG ==================
    // =====================================
    $scope.adminDivisCollapsed = true;
    $scope.adminEditMode = false; //edit or add


    $scope.open = function ($event) {
        $event.preventDefault();
        $event.stopPropagation();
        $scope.opened = true;
    };



    // =====================================
    // ADMIN OPTIONS ====================
    // =====================================

    $scope.showAddMemberModal = function (resultSource) {
        MembersService.showAddMemberModal(resultSource).then(function (member) {
            if (member !== null) {
                $scope.membersList.push(member);
            }
        });
    };

    // select a member after checking it
    $scope.retrieveMemberForEdit = function (member) {
        MembersService.retrieveMemberForEdit(member).then(function () { });
    };

    $scope.editMyBio = function (member) {
        MembersService.showEditBioModal(member);
    };

    $scope.editMyPhoto = function (member) {
        MembersService.showEditPhotoModal(member);
    };

    $scope.removeMember = function (member) {
        var dlg = dialogs.confirm("Remove Member?", "Are you sure you want to remove this member?");
        dlg.result.then(function (btn) {
            MembersService.deleteMember(member).then(function () {
                var index = $scope.membersList.indexOf(member);
                if (index > -1) $scope.membersList.splice(index, 1);
            });
        }, function (btn) { });
    };

    $scope.onSelectMember = function (item, model) {
        $scope.setMember(model);
    };

    $scope.getRaceTypeClass = function (s) {
        if (s !== undefined) {
            return s.replace(/ /g, '') + '-col';
        }
    };

    $scope.filterRaceType = function () {
        // console.log("call");
    };

    $scope.imageLoaded = function () {
        $scope.imageLoading = false;
    };

    // set the current member to the display panel
    $scope.setMember = async function (member_param) {
        if (member_param === undefined) return;

        $scope.currentMember = null;
        $scope.imageLoading = true;

        $scope.sortCriteria = "race.racedate";
        $scope.sortDirection = '-';

        //reset resultpage to 1
        $scope.pagination = {
            current: 1
        };
        //reset race type selection
        $scope.paramModelMember = {};

        // get the member details if this is just a "light member object"
        let fullMember;
        if (member_param.bio === undefined) {
            fullMember = await MembersService.getMember(member_param._id);
        } else {
            fullMember = member_param;
        }


        // Use cached race results and extract member results
        ResultsService.getRaceResultsWithCacheSupport({
            "sort": '-racedate -order racename',
            "preload": false
        }).then(function (raceList) {
            // Extract results for the current member from the cached race data
            $scope.currentMemberResultList = [];

            raceList.forEach(race => {
                if (race.results && race.results.length > 0) {
                    race.results.forEach(result => {
                        if (result.members) {
                            result.members.forEach(member => {
                                if (member._id === fullMember._id) {
                                    $scope.currentMemberResultList.push({
                                        ...result,
                                        race: race
                                    });
                                }
                            });
                        }
                    });
                }
            });

            // Sort by race date
            $scope.currentMemberResultList.sort((a, b) => new Date(b.race.racedate) - new Date(a.race.racedate));

            // get racetypes from these results
            $scope.racetypesList = Object.values($scope.currentMemberResultList.reduce((racetypes, result) => {
                const { _id, race } = result;
                if (!racetypes[race.racetype._id]) {
                    racetypes[race.racetype._id] = race.racetype;
                }
                return racetypes;
            }, {})).sort((a, b) => a.meters - b.meters);

            $scope.currentMember = fullMember;

            // Navigate to member detail page (bio tab by default)
            $state.go('/members/member/bio', { member: $scope.currentMember.username });

        });
        if (!$scope.$$phase) {
            $scope.$apply();
        }
    };

    // Navigate back to member list
    $scope.goToMemberList = function () {
        $state.go('/members');
    };

    // Load member data without navigation (for direct URL access)
    $scope.loadMemberData = async function (member_param) {
        if (member_param === undefined) return;

        $scope.currentMember = null;
        $scope.imageLoading = true;

        $scope.sortCriteria = "race.racedate";
        $scope.sortDirection = '-';

        //reset resultpage to 1
        $scope.pagination = {
            current: 1
        };
        //reset race type selection
        $scope.paramModelMember = {};

        // get the member details if this is just a "light member object"
        let fullMember;
        if (member_param.bio === undefined) {
            fullMember = await MembersService.getMember(member_param._id);
        } else {
            fullMember = member_param;
        }


        // Use cached race results and extract member results
        ResultsService.getRaceResultsWithCacheSupport({
            "sort": '-racedate -order racename',
            "preload": false
        }).then(function (raceList) {
            // Extract results for the current member from the cached race data
            $scope.currentMemberResultList = [];

            raceList.forEach(race => {
                if (race.results && race.results.length > 0) {
                    race.results.forEach(result => {
                        if (result.members) {
                            result.members.forEach(member => {
                                if (member._id === fullMember._id) {
                                    $scope.currentMemberResultList.push({
                                        ...result,
                                        race: race
                                    });
                                }
                            });
                        }
                    });
                }
            });

            // Sort by race date
            $scope.currentMemberResultList.sort((a, b) => new Date(b.race.racedate) - new Date(a.race.racedate));

            // get racetypes from these results
            $scope.racetypesList = Object.values($scope.currentMemberResultList.reduce((racetypes, result) => {
                const { _id, race } = result;
                if (!racetypes[race.racetype._id]) {
                    racetypes[race.racetype._id] = race.racetype;
                }
                return racetypes;
            }, {})).sort((a, b) => a.meters - b.meters);

            $scope.currentMember = fullMember;

            if (!$scope.$$phase) {
                $scope.$apply();
            }
        });
    };



    function getCatergory(dob) {
        return $filter('categoryFilter')(dob);
    }

    $scope.memberListcolumns = [];

    // Returns undefined for anything that isn't male/female — the list has four
    // gendered columns and nowhere else to put them. Callers must handle that.
    function getMemberListColumnIndexForType(member) {
        var sex = (member.sex || '').toLowerCase();
        if (sex === 'male' && getCatergory(member.dateofbirth) === 'Open') {
            return 0;
        } else if (sex === 'female' && getCatergory(member.dateofbirth) === 'Open') {
            return 1;
        } else if (sex === 'male' && getCatergory(member.dateofbirth) === 'Master') {
            return 2;
        } else if (sex === 'female' && getCatergory(member.dateofbirth) === 'Master') {
            return 3;
        }
    }

    // The site's one cached list of all members, thumbnails embedded (the
    // Cards view's photos, and every avatar elsewhere), filtered here by
    // status rather than asked of the server per filter
    $scope.getMembers = async function (params_) {
        var status = (params_ || $scope.paramModel).memberStatus || 'current';

        await MembersService.getAllMembersWithThumbs().then(function (members) {
            $scope.membersList = (members || []).filter(function (m) {
                return status === 'all' || m.memberStatus === status;
            });
            $scope.memberListcolumns = [];
            for (var i = 0; i < 4; i++) {
                $scope.memberListcolumns.push([]);
            }
            $scope.membersList.forEach(function (person) {
                var columnIndex = getMemberListColumnIndexForType(person);
                // A member with no usable sex has no column to go in — skip them
                // rather than throwing and taking the whole list down with it.
                if (columnIndex === undefined) {
                    console.warn('Member not shown in list — unrecognised sex value:', person.sex, person.username);
                    return;
                }
                $scope.memberListcolumns[columnIndex].push(person);
            });

        });


    };

    // =====================================
    // MEMBER LIST VIEWS ===================
    // =====================================
    // Three ways to show the same list: by group (sections), as photo cards,
    // or A–Z. All filtered here by the group buttons and the search box.

    $scope.memberGroups = [
        // compact: the filter button's label when the window is too narrow
        // for the full one (the filter row never wraps)
        { index: 1, label: 'Open Women', short: 'OW', compact: 'Open W' },
        { index: 0, label: 'Open Men', short: 'OM', compact: 'Open M' },
        { index: 3, label: 'Masters Women', short: 'MW', compact: 'Masters W' },
        { index: 2, label: 'Masters Men', short: 'MM', compact: 'Masters M' }
    ];
    $scope.memberSearch = { text: '' };
    $scope.memberView = { sections: [], cards: [], letters: [], count: 0 };

    function lastName(member) {
        var parts = (member.lastname || '').trim().split(/\s+/);
        return (parts[parts.length - 1] || member.firstname || '').toLowerCase();
    }

    function byLastName(a, b) {
        return lastName(a).localeCompare(lastName(b)) ||
            (a.firstname || '').localeCompare(b.firstname || '');
    }

    function matchesSearch(member, text) {
        if (!text) return true;
        return ((member.firstname || '') + ' ' + (member.lastname || '')).toLowerCase().indexOf(text) !== -1;
    }

    // Rebuilt only when the members, the group or the search change, so the
    // templates repeat over stable arrays.
    function rebuildMemberView() {
        var text = ($scope.memberSearch.text || '').trim().toLowerCase();
        var group = $scope.paramModel.group;
        var sections = [];
        var all = [];
        $scope.memberGroups.forEach(function (g) {
            if (group !== 'all' && group !== g.index) return;
            var members = ($scope.memberListcolumns[g.index] || []).filter(function (m) {
                m.$group = g;
                return matchesSearch(m, text);
            }).sort(byLastName);
            sections.push({ group: g, members: members, column: $scope.memberListcolumns[g.index] || [] });
            all = all.concat(members);
        });
        all.sort(byLastName);

        var letters = [];
        var byLetter = {};
        all.forEach(function (m) {
            var letter = (lastName(m).charAt(0) || '#').toUpperCase();
            if (!byLetter[letter]) {
                byLetter[letter] = { letter: letter, members: [] };
                letters.push(byLetter[letter]);
            }
            byLetter[letter].members.push(m);
        });

        $scope.memberView = {
            sections: sections.filter(function (s) { return s.members.length > 0; }),
            cards: all,
            letters: letters,
            count: all.length
        };
    }

    $scope.$watchGroup(['memberListcolumns', 'paramModel.group', 'memberSearch.text'], rebuildMemberView);

    $scope.setMemberView = function (view) {
        $scope.paramModel.view = view;
    };

    $scope.setMemberGroup = function (group) {
        $scope.paramModel.group = group;
    };

    $scope.scrollToLetter = function (letter) {
        var el = document.getElementById('members-letter-' + letter);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    $scope.memberInitials = function (member) {
        return ((member.firstname || '').charAt(0) + (member.lastname || '').charAt(0)).toUpperCase();
    };

    $scope.isMyMember = function (member) {
        return !!($scope.user && $scope.user.member && $scope.user.member._id && member._id === $scope.user.member._id);
    };

    $scope.getMaxColumnSize = function () {
        var maxColumnSize = 0;

        $scope.memberListcolumns.forEach(function (column) {
            if (column.length > maxColumnSize) {
                maxColumnSize = column.length;
            }
        });
        return maxColumnSize;
    };

    $scope.retrieveResultForEdit = function (result) {
        ResultsService.retrieveResultForEdit(result).then(function (result) { });
    };


    $scope.hasTeamRequirementFulfilled = function (member) {
        var reqConfig = TeamRequirementsConfig.getForYear(new Date().getFullYear());
        if (member.teamRequirementStats &&
            member.teamRequirementStats.raceCount >= reqConfig.minRaceCount &&
            member.teamRequirementStats.maxAgeGrade >= reqConfig.minAgeGrade) {
            return true;
        } else {
            return false;
        }
    };

    $scope.getListOfMembersWithRequirementFulfilled = function (list) {
        if (list) {
            return list.filter(member => $scope.hasTeamRequirementFulfilled(member));
        }
    };

    $scope.getMemberHeaderTooltip = function (list) {
        if (list) {
            return (list.filter(member => $scope.hasTeamRequirementFulfilled(member)).length * 100 / list.length).toFixed(2) + "%" + " have all of team requirements fulfilled";
        }
    };


    $scope.removeResult = function (result) {
        var dlg = dialogs.confirm("Remove Result?", "Are you sure you want to remove this result?");
        dlg.result.then(function (btn) {
            ResultsService.deleteResult(result).then(function () {
                var index = $scope.currentMemberResultList.indexOf(result);
                if (index > -1) $scope.currentMemberResultList.splice(index, 1);
            });
        }, function (btn) { });
    };


    // $scope.defaultPBdistances = ["1 mile","5k", "10k", "10 miles", "Half Marathon","Marathon"];

    // $scope.pbTableProperties = {};
    // $scope.pbTableProperties.surface = "road";
    // $scope.surfaceTypes = ["road", "track","cross country", "ultra"];
    // $scope.isAllDistancesPresent = () => {
    // return $scope.currentMember.personalBests.every(pb => $scope.defaultPBdistances.includes(pb.name));
    // };


    // =====================================
    // MEMBER API CALLS ====================
    // =====================================

    // $scope.user = data.user;
    // when landing on the page, get all members and show them



    // Set the active view based on the current route
    if ($state.current.name === '/members/member/bio') {
        $scope.activeMemberView = 'bio';
    } else if ($state.current.name === '/members/member/stats') {
        $scope.activeMemberView = 'stats';
    } else {
        $scope.activeMemberView = 'bio'; // default
    }

    // var defaultParams = {
    //     "filters[sex]": $scope.paramModel.sex,
    //     "filters[category]": $scope.paramModel.category,
    //     "filters[memberStatus]": $scope.paramModel.memberStatus,
    //     select: '-bio -personalBests',
    //     sort: 'firstname',
    //     limit: $scope.paramModel.limit
    //     };

    async function initialLoad() {
        // wait for async call to finish       
        await $scope.getMembers($scope.paramModel);

        if ($stateParams.member && $stateParams.member.trim() !== '') {
            MembersService.getMembersWithCacheSupport().then(function (allMembers) {
                // Find the current member
                const member = allMembers.find(m => m.username === $stateParams.member);
                if (member) {
                    // Load member data without navigating
                    $scope.loadMemberData(member);

                    // Set the correct view based on the current route
                    if ($state.current.name === '/members/member/bio') {
                        $scope.activeMemberView = 'bio';
                    } else if ($state.current.name === '/members/member/stats') {
                        $scope.activeMemberView = 'stats';
                    } else {
                        $scope.activeMemberView = 'bio'; // default
                    }
                } else {
                }
            }).catch(function (error) {
                console.error('Error loading member:', error);
            });
        } else {
        }
    }

    $scope.showRaceModal = function (race) {
        if (race) {
            ResultsService.showRaceFromResultModal(race._id).then(function (result) {
            });
        }
    };

    // Clicking anywhere on a result row opens that result's own page; the
    // race name inside it still goes to the race, so it stops the click from
    // reaching here.
    $scope.goToResult = function (result) {
        if (result && result._id) {
            $state.go('/results/result', { resultId: result._id });
        }
    };

    $scope.showResultDetailsModal = function (result) {
        ResultsService.showResultDetailsModal(result).then(function (result) { });
    };

    $scope.goToResultsWithQuery = function (queryParams) {
        // Remove null, undefined, or empty string values
        var cleanedParams = {};
        Object.keys(queryParams).forEach(function (key) {
            var value = queryParams[key];
            if (value !== null && value !== undefined && value !== '') {
                cleanedParams[key] = value;
            }
        });

        // Only navigate if we have valid parameters
        if (Object.keys(cleanedParams).length > 0) {
            AdvancedFiltersService.goToRaceList($state, cleanedParams);
        }
    };

    $scope.goToResultsWithLocationQuery = function (members, countries, states) {
        // Only navigate if we have at least a racername and either country or state
        if (members && (countries || states)) {
            var queryParams = { members: members };
            if (countries) queryParams.countries = countries;
            if (states) queryParams.states = states;
            $scope.goToResultsWithQuery(queryParams);
        }
    };

    initialLoad();

    // Switch between bio and statistics views (for programmatic use)
    $scope.setActiveMemberView = function (view) {
        $scope.activeMemberView = view;
    };

}]);


angular.module('mcrrcApp.members').controller('MemberModalInstanceController', ['$scope', '$uibModalInstance', '$filter', 'member', function ($scope, $uibModalInstance, $filter, member) {

    // make sure dates are always UTC
    // $scope.$watch('formData.dateofbirth ', function(date) {
    //   $scope.formData.dateofbirth = $filter('date')($scope.formData.dateofbirth, 'yyyy-MM-dd', 'UTC');
    // });

    // $scope.$watch('formData.addMembershipDates', function(date) {
    //   if ($scope.formData.membershipDates){
    //     for (i=0;i<$scope.formData.membershipDates.length;i++) {
    //         $scope.formData.membershipDates[i].start = $filter('date')($scope.formData.membershipDates[i].start, 'yyyy-MM-dd', 'UTC');
    //         $scope.formData.membershipDates[i].end = $filter('date')($scope.formData.membershipDates[i].end, 'yyyy-MM-dd', 'UTC');
    //     }
    //   }
    // });



    $scope.editmode = false;
    if (member) {
        $scope.formData = member;
        $scope.formData.dateofbirth = new Date(member.dateofbirth);
        $scope.editmode = true;
        for (i = 0; i < $scope.formData.membershipDates.length; i++) {
            if ($scope.formData.membershipDates[i].start !== undefined) {
                $scope.formData.membershipDates[i].start = new Date($scope.formData.membershipDates[i].start);
            }
            if ($scope.formData.membershipDates[i].end !== undefined) {
                $scope.formData.membershipDates[i].end = new Date($scope.formData.membershipDates[i].end);
            }
        }

    } else {
        $scope.formData = {};
        $scope.formData.memberStatus = 'current';
        $scope.formData.dateofbirth = new Date($filter('date')(new Date().setHours(0, 0, 0, 0), 'yyyy-MM-dd', 'UTC'));
        $scope.formData.membershipDates = [];
        $scope.formData.membershipDates.push({
            start: new Date($filter('date')(new Date().setHours(0, 0, 0, 0), "yyyy-MM-dd", 'UTC')),
            end: undefined
        });
        $scope.editmode = false;
    }


    $scope.addMembershipDates = function () {
        if (!$scope.formData.membershipDates) {
            $scope.formData.membershipDates = [];
        }
        $scope.formData.membershipDates.push({ start: new Date($filter('date')(new Date().setHours(0, 0, 0, 0), "yyyy-MM-dd", 'UTC')), end: new Date($filter('date')(new Date().setHours(0, 0, 0, 0), "yyyy-MM-dd", 'UTC')) });
    };



    $scope.addMember = function () {
        $uibModalInstance.close($scope.formData);
    };

    $scope.editMember = function () {
        $uibModalInstance.close($scope.formData);
    };

    $scope.cancel = function () {
        $uibModalInstance.dismiss('cancel');
    };

    // =====================================
    // DATE PICKER CONFIG ==================
    // =====================================
    $scope.open = function ($event) {
        $event.preventDefault();
        $event.stopPropagation();

        $scope.opened = true;
    };

    $scope.openedMembershipStartDatePickers = [];
    $scope.openStartDatePicker = function ($event, index) {
        $event.preventDefault();
        $event.stopPropagation();

        for (i = 0; i < $scope.openedMembershipStartDatePickers.length; i++) {
            $scope.openedMembershipStartDatePickers[i] = false;
        }
        $scope.openedMembershipStartDatePickers[index] = true;
    };

    $scope.openedMembershipEndDatePickers = [];
    $scope.openEndDatePicker = function ($event, index) {
        $event.preventDefault();
        $event.stopPropagation();

        for (i = 0; i < $scope.openedMembershipEndDatePickers.length; i++) {
            $scope.openedMembershipEndDatePickers[i] = false;
        }
        $scope.openedMembershipEndDatePickers[index] = true;
    };

    $scope.newAlternateName = '';

    $scope.addAlternateName = function () {
        if ($scope.newAlternateName && $scope.newAlternateName.trim()) {
            if (!$scope.formData.alternateFullNames) {
                $scope.formData.alternateFullNames = [];
            }
            $scope.formData.alternateFullNames.push($scope.newAlternateName.trim());
            $scope.newAlternateName = '';
        }
    };

    $scope.removeAlternateName = function (index) {
        $scope.formData.alternateFullNames.splice(index, 1);
    };

    // Initialize alternateFullNames array if it doesn't exist
    if (!$scope.formData.alternateFullNames) {
        $scope.formData.alternateFullNames = [];
    }

    // =====================================
    // ACHIEVEMENTS =========================
    // =====================================
    var DEFAULT_ICONS = {
        'ROY': { img: '/images/roy.svg' },
        'MUTROY': { img: '/images/mutroy.svg' }
    };

    var DEFAULT_TEXT = {
        'ROY': 'Runner of the Year',
        'MUTROY': 'Mountain/Ultra/Trail Runner of the Year'
    };

    // Initialize achievements array and valueJson for editing
    if (!$scope.formData.achievements) {
        $scope.formData.achievements = [];
    }
    $scope.formData.achievements.forEach(function (ach) {
        ach.valueJson = ach.value ? JSON.stringify(ach.value) : '';
    });

    $scope.addAchievement = function () {
        $scope.formData.achievements.push({ name: '', text: '', value: null, valueJson: '' });
    };

    $scope.removeAchievement = function (index) {
        $scope.formData.achievements.splice(index, 1);
    };

    $scope.setAchievementPreset = function (index, presetName) {
        var ach = $scope.formData.achievements[index];
        ach.name = presetName;
        ach.text = DEFAULT_TEXT[presetName];
        ach.value = DEFAULT_ICONS[presetName];
        ach.valueJson = JSON.stringify(DEFAULT_ICONS[presetName]);
    };

    // Before closing modal, parse valueJson back to value
    var originalEditMember = $scope.editMember;
    $scope.editMember = function () {
        parseAchievementValues();
        originalEditMember();
    };

    var originalAddMember = $scope.addMember;
    $scope.addMember = function () {
        parseAchievementValues();
        originalAddMember();
    };

    function parseAchievementValues() {
        if ($scope.formData.achievements) {
            $scope.formData.achievements.forEach(function (ach) {
                if (ach.valueJson && ach.valueJson.trim()) {
                    try {
                        ach.value = JSON.parse(ach.valueJson);
                    } catch (e) {
                        ach.value = ach.valueJson;
                    }
                } else {
                    ach.value = null;
                }
                delete ach.valueJson;
            });
            // Remove empty achievements (no name and no text)
            $scope.formData.achievements = $scope.formData.achievements.filter(function (ach) {
                return ach.name || ach.text;
            });
        }
    }

}]);

angular.module('mcrrcApp.members').controller('BioEditModalInstanceController', ['$scope', '$uibModalInstance', 'member', function ($scope, $uibModalInstance, member) {

    $scope.simpleOptions = {
        forced_root_block: false,
        plugins: 'link image',
        toolbar: 'bold italic underline | link image',
        menubar: false,
        statusbar: false,
        height: 80,
        branding: false,
        base_url: '/libs/tinymce',
        suffix: '.min',
        content_style: 'body { margin: 0.5em; }'
    };

    $scope.mediumOptions = {
        forced_root_block: false,
        plugins: 'link image',
        toolbar: 'bold italic underline | link image',
        menubar: false,
        statusbar: false,
        height: 120,
        branding: false,
        base_url: '/libs/tinymce',
        suffix: '.min',
        content_style: 'body { margin: 0.5em; }'
    };

    $scope.tallOptions = {
        forced_root_block: false,
        plugins: 'link image',
        toolbar: 'bold italic underline | link image',
        menubar: false,
        statusbar: false,
        height: 150,
        branding: false,
        base_url: '/libs/tinymce',
        suffix: '.min',
        content_style: 'body { margin: 0.5em; }'
    };

    $scope.runningLogsOptions = {
        forced_root_block: false,
        plugins: 'link image',
        toolbar: 'bold italic underline | link image | strava garmin',
        menubar: false,
        statusbar: false,
        height: 80,
        branding: false,
        base_url: '/libs/tinymce',
        suffix: '.min',
        content_style: 'body { margin: 0.5em; }'
    };

    var bioFields = [
        { key: 'occupation', label: 'Occupation', options: $scope.simpleOptions },
        { key: 'college', label: 'College/Grad School Attended', options: $scope.simpleOptions },
        { key: 'hometown', label: 'Hometown', options: $scope.simpleOptions },
        { key: 'favoriteRace', label: 'Favorite race', options: $scope.simpleOptions },
        { key: 'bestMoment', label: 'Best running moment', options: $scope.mediumOptions },
        { key: 'goals', label: 'Running goals', options: $scope.mediumOptions },
        { key: 'gear', label: 'Running gear I can\'t live without', options: $scope.simpleOptions },
        { key: 'funFact', label: 'Fun fact', options: $scope.mediumOptions },
        { key: 'prs', label: 'All Time PRs', options: $scope.tallOptions },
        { key: 'runningLogs', label: 'Running logs', options: $scope.runningLogsOptions }
    ];

    var sectionFields = [

    ];

    function parseBio(html) {
        var result = {};
        if (!html) return result;

        // Build all labels for matching
        var allFields = bioFields.concat(sectionFields);

        for (var i = 0; i < allFields.length; i++) {
            var field = allFields[i];
            var label = field.label;
            // Match <span class="bold">Label: </span> or <span class="bold">Label:</span>
            var pattern = '<span class="bold">' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ':?\\s*</span>';
            var regex = new RegExp(pattern, 'i');
            var match = html.match(regex);
            if (match) {
                var startIdx = html.indexOf(match[0]) + match[0].length;
                // Find the next <span class="bold"> or end of string
                var nextBold = html.indexOf('<span class="bold">', startIdx);
                var content = nextBold > -1 ? html.substring(startIdx, nextBold) : html.substring(startIdx);
                // Clean up: remove leading/trailing <br>, <div>, whitespace
                content = content.replace(/^(\s|<br\s*\/?>|<\/?div>|<\/?p>)+/gi, '');
                content = content.replace(/(\s|<br\s*\/?>|<\/?div>|<\/?p>)+$/gi, '');
                result[field.key] = content;
            }
        }
        return result;
    }

    function assembleBio() {
        var parts = [];

        // Regular fields: <span class="bold">Label: </span>Value<br>
        for (var i = 0; i < bioFields.length; i++) {
            var field = bioFields[i];
            var value = ($scope.formData[field.key] || '').trim();
            if (value) {
                if (field.key === 'runningLogs' || field.key === 'prs') {
                    parts.push('<br><span class="bold">' + field.label + ': </span><br>');
                    parts.push(value + '<br>');
                } else {
                    parts.push('<span class="bold">' + field.label + ': </span>' + value + '<br>');
                }
            }
        }

        // // All Time PRs section
        // var prs = ($scope.formData.prs || '').trim();
        // if (prs) {
        //     parts.push('<br><span class="bold">All Time PRs:</span><br>');
        //     parts.push(prs + '<br>');
        // }

        // // Running logs section
        // var logs = ($scope.formData.runningLogs || '').trim();
        // if (logs) {
        //     parts.push('<br><span class="bold">Running logs:</span><br>');
        //     parts.push(logs);
        // }
        return parts.join('\n');
    }

    // Parse existing bio into fields
    var parsed = parseBio(member.bio || '');
    $scope.formData = {};
    var allFieldDefs = bioFields.concat(sectionFields);
    for (var i = 0; i < allFieldDefs.length; i++) {
        $scope.formData[allFieldDefs[i].key] = parsed[allFieldDefs[i].key] || '';
    }

    $scope.bioFields = bioFields;



    $scope.saveBio = function () {
        $uibModalInstance.close(assembleBio());
    };

    $scope.cancel = function () {
        $uibModalInstance.dismiss('cancel');
    };
}]);

angular.module('mcrrcApp.members').controller('PhotoEditModalInstanceController', ['$scope', '$q', '$uibModalInstance', 'member', 'MembersService', function ($scope, $q, $uibModalInstance, member, MembersService) {
    // A photo is sent as it is, so the server's resize (to 1000 px) works
    // from the original and the photo is compressed once. Only one over the
    // server's limits (10 MB, 100 megapixels) is shrunk here first, to
    // RESIZE_TO px at high quality: still three times what the server keeps.
    var RESIZE_TO = 3000;
    var RESIZE_ABOVE_BYTES = 9.5 * 1024 * 1024;
    var RESIZE_ABOVE_PIXELS = 100 * 1000 * 1000;
    var MAX_BYTES = 10 * 1024 * 1024;
    var ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

    $scope.memberName = member.firstname + ' ' + member.lastname;
    $scope.currentUrl = member.pictureLink || null;
    $scope.previewUrl = null;
    // 'photo' (choose / upload / remove), then 'thumb' (the round crop)
    $scope.step = 'photo';
    $scope.justUploaded = false;
    $scope.draft = { crop: null };
    // What changed, for the page: { pictureLink, profileThumbCrop }
    var result = { pictureLink: member.pictureLink || '', profileThumbCrop: member.profileThumbCrop };

    function hasCrop(c) {
        return !!(c && isFinite(c.size));
    }
    $scope.upload = null;
    $scope.busy = false;
    $scope.error = null;

    function sizeText(bytes) {
        return bytes >= 1024 * 1024 ? (bytes / 1024 / 1024).toFixed(1) + ' MB' : Math.round(bytes / 1024) + ' KB';
    }

    function setPreview(blob) {
        if ($scope.previewUrl) URL.revokeObjectURL($scope.previewUrl);
        $scope.previewUrl = blob ? URL.createObjectURL(blob) : null;
    }

    // The file, decoded upright (EXIF orientation applied) and drawn at most
    // RESIZE_ABOVE_SIDE px, as a high quality JPEG; the file itself when it is
    // already small enough
    function shrinkIfNeeded(file) {
        if (!window.createImageBitmap) return $q.when(file);
        return $q.when(createImageBitmap(file, { imageOrientation: 'from-image' })).then(function (bitmap) {
            var longSide = Math.max(bitmap.width, bitmap.height);
            if (file.size <= RESIZE_ABOVE_BYTES && bitmap.width * bitmap.height <= RESIZE_ABOVE_PIXELS) {
                bitmap.close && bitmap.close();
                return file;
            }
            var scale = Math.min(1, RESIZE_TO / longSide);
            var canvas = document.createElement('canvas');
            canvas.width = Math.round(bitmap.width * scale);
            canvas.height = Math.round(bitmap.height * scale);
            var ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
            bitmap.close && bitmap.close();
            return $q(function (resolve) {
                canvas.toBlob(function (blob) { resolve(blob || file); }, 'image/jpeg', 0.95);
            });
        }, function () {
            // The browser could not decode it: let the server judge (and explain)
            return file;
        });
    }

    $scope.onFileChosen = function (file) {
        $scope.error = null;
        $scope.confirmRemove = false;
        var isHeic = /heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
        if (isHeic) {
            $scope.error = 'iPhone HEIC photos are not accepted. Export it as JPEG first (see the tips below).';
            return;
        }
        if (ACCEPTED.indexOf(file.type) === -1) {
            $scope.error = 'Only JPEG, PNG or WebP photos are accepted.';
            return;
        }
        $scope.busy = true;
        shrinkIfNeeded(file).then(function (blob) {
            if (blob.size > MAX_BYTES) {
                $scope.error = 'This photo is over 10 MB. Try a smaller one.';
                return;
            }
            $scope.upload = blob;
            $scope.chosen = { name: file.name, sizeText: sizeText(blob.size) + (blob !== file ? ' after resizing' : '') };
            setPreview(blob);
        }).finally(function () {
            $scope.busy = false;
        });
    };

    function failed(res) {
        $scope.busy = false;
        $scope.error = (res && res.data && res.data.error) ||
            (res && res.status === 413 ? 'The file is too large.' : 'The photo could not be saved. Try again.');
    }

    $scope.savePhoto = function () {
        if (!$scope.upload) return;
        $scope.busy = true;
        $scope.error = null;
        MembersService.uploadMemberPhoto(member._id, $scope.upload).then(function (res) {
            // Saved: the photo is changed whatever happens in step 2
            setPreview(null);
            result = { pictureLink: res.pictureLink, profileThumbCrop: undefined };
            $scope.currentUrl = res.pictureLink;
            $scope.upload = null;
            $scope.justUploaded = true;
            $scope.busy = false;
            // The server made the thumbnail already: start from its square
            openThumbnailStep(res.thumbCrop);
        }, failed);
    };

    // ---- Step 2: the thumbnail ----

    // Step 2 starts on the square the current thumbnail is cut from (null:
    // the cropper's own default), so "unchanged" means keep it as it is
    var startCrop = null;

    function openThumbnailStep(crop) {
        startCrop = hasCrop(crop) ? { left: crop.left, top: crop.top, size: crop.size } : null;
        $scope.draft = { crop: startCrop ? angular.copy(startCrop) : null };
        $scope.thumbSrc = result.pictureLink;
        $scope.error = null;
        $scope.step = 'thumb';
    }

    // From step 1 without uploading: ask where the current thumbnail is
    $scope.goToThumbnail = function () {
        $scope.busy = true;
        $scope.error = null;
        MembersService.getThumbnailCrop(member._id).then(function (res) {
            $scope.busy = false;
            openThumbnailStep(res.crop);
        }, function () {
            $scope.busy = false;
            openThumbnailStep(null);
        });
    };

    function near(a, b) {
        return Math.abs(Number(a) - Number(b)) < 0.002;
    }

    $scope.thumbChanged = function () {
        var c = $scope.draft.crop;
        if (!c) return false;
        if (!startCrop) return true;
        return !(near(c.left, startCrop.left) && near(c.top, startCrop.top) && near(c.size, startCrop.size));
    };

    $scope.backToPhoto = function () {
        $scope.error = null;
        $scope.step = 'photo';
    };

    function sendCrop(crop) {
        $scope.busy = true;
        $scope.error = null;
        MembersService.setThumbnailCrop(member._id, crop).then(function (res) {
            result.profileThumbCrop = res.crop || undefined;
            $uibModalInstance.close(result);
        }, function (res) {
            $scope.busy = false;
            $scope.error = (res && res.data && res.data.error) || 'The thumbnail could not be saved.';
        });
    }

    // Unchanged: the thumbnail stays as it is (automatic, or the crop
    // already chosen), nothing to send
    $scope.saveThumbnail = function () {
        if (!$scope.thumbChanged()) return $uibModalInstance.close(result);
        var c = $scope.draft.crop;
        sendCrop({ left: Number(c.left), top: Number(c.top), size: Number(c.size) });
    };

    $scope.removePhoto = function () {
        $scope.busy = true;
        $scope.error = null;
        MembersService.removeMemberPhoto(member._id).then(function () {
            $uibModalInstance.close({ pictureLink: '', profileThumbCrop: undefined });
        }, failed);
    };

    // After an upload the photo is already saved: closing reports it
    $scope.cancel = function () {
        setPreview(null);
        if ($scope.justUploaded) $uibModalInstance.close(result);
        else $uibModalInstance.dismiss('cancel');
    };
}]);
