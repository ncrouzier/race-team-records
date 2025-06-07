angular.module('mcrrcApp.tools').controller('ResultExtractorController', [
    '$scope', '$http', '$analytics', 'AuthService', 'ResultsService', 'MembersService', 'NotificationService', 'UtilsService',
    function ($scope, $http, $analytics, AuthService, ResultsService, MembersService, NotificationService, UtilsService) {

        $scope.authService = AuthService;
        $scope.$watch('authService.isLoggedIn()', function (user) {
            $scope.user = user;
        });

        // Initialize scope variables
        $scope.formData = {};
        $scope.tableData = null;
        $scope.tableHeaders = null;
        $scope.columnMapping = {};
        $scope.processedResults = [];
        $scope.currentTeamMembers = [];
        $scope.isLoading = false;
        $scope.formData.raceDate  = new Date(Date.UTC(new Date().getFullYear(),new Date().getMonth(),new Date().getDate(),0,0,0,0)); // Set today's date
        $scope.url = '';   
        $scope.raceType = null;        
        $scope.formData.location = {
            country: 'USA',
            state: 'MD'
        };
        $scope.formData.isRecordEligible = true;
        $scope.distanceName = '';
        $scope.meters = '';
        $scope.miles = '';
        $scope.states = UtilsService.states;
        $scope.countries = UtilsService.countries;
        $scope.resultlink = '';

        // Watch for any form input changes and reprocess results
        $scope.$watch('formData', function() {
            if ($scope.tableData && $scope.canProcess().canProcess) {
                $scope.processResults();
            }else{
                $scope.processedResults = [];
            }
        }, true);

        $scope.$watch('columnMapping', function(newMapping, oldMapping) {
            // Check if any mapping changed
            for (var header in newMapping) {
                if (newMapping[header] !== oldMapping[header]) {
                    // If a new mapping was selected
                    if (newMapping[header]) {
                        // Find any other headers that were mapped to the same field
                        for (var otherHeader in newMapping) {
                            if (otherHeader !== header && newMapping[otherHeader] === newMapping[header]) {
                                // Unmap the previous column
                                newMapping[otherHeader] = '';
                                NotificationService.showNotifiction(false, 'Field "' + newMapping[header] + '" was unmapped from previous column');
                            }
                        }
                    }
                }
            }

            if ($scope.tableData && $scope.canProcess().canProcess) {
                $scope.processResults();
            }else{
                $scope.processedResults = [];
            }
        }, true);

        // Define mappable fields
        $scope.mappableFields = [
            { value: 'place', label: 'Overall Ranking' },
            { value: 'genderRank', label: 'Gender Ranking' },
            { value: 'ageRank', label: 'Age Ranking' },
            { value: 'name', label: 'Full Name' },
            { value: 'firstname', label: 'First Name' },
            { value: 'lastname', label: 'Last Name' },
            { value: 'time', label: 'Time' } ,
            { value: 'gender', label: 'Gender/Sex' },
            { value: 'ageGroup', label: 'Age/Division Group' }           
        ];

        // Get available options for a specific header
        $scope.getAvailableOptions = function(header) {
            var currentMapping = $scope.columnMapping[header];
            return $scope.mappableFields.filter(function(field) {
                // If this is the current mapping, always include it
                if (field.value === currentMapping) {
                    return true;
                }
                // Check if this field is mapped to any other header
                for (var otherHeader in $scope.columnMapping) {
                    if (otherHeader !== header && $scope.columnMapping[otherHeader] === field.value) {
                        return false;
                    }
                }
                // // Special handling for name fields
                // if (field.value === 'name' && (hasFirstName || hasLastName)) {
                //     return false; // Can't map name if firstname or lastname is already mapped
                // }
                // if ((field.value === 'firstname' || field.value === 'lastname') && hasName) {
                //     return false; // Can't map firstname or lastname if name is already mapped
                // }
                return true;
            });
        };

       

        // Fetch current team members
        MembersService.getMembers({
            "filters[memberStatus]": "current",
            "sort": "firstname lastname"
        }).then(function(members) {
            $scope.currentTeamMembers = members;
        });

        $scope.$watch('formData.location.country', function(country) {
            if(country !== 'USA'){
                $scope.formData.location.state = null;
            }
        });

        $scope.loadTable = function() {
            $scope.isLoading = true;
            $http.post('/api/extract-table', { url: $scope.url })
                .then(function(response) {
                    if (response.data.success) {
                        $scope.formData.raceType = null;
                        $scope.hiddenColumns = [];
                        $scope.tableHeaders = response.data.headers;
                        $scope.tableData = response.data.data;
                        $scope.pageTitle = response.data.pageTitle;
                        
                        // Set race date if available
                        if (response.data.raceDate) {
                            $scope.formData.raceDate = new Date(response.data.raceDate);
                        }

                        // Set race type to road 5K for Parkrun
                        if ($scope.url.includes('parkrun.')) {
                            $scope.racetypesList.forEach(function(racetype) {
                                if (racetype.name === '5k' && racetype.surface === 'road') {
                                    $scope.raceType = racetype;
                                    $scope.formData.raceType = racetype;
                                }
                            });
                        }
                        
                        // Filter out the first row if it appears to be headers
                        $scope.tableData = response.data.data.filter(function(row, index) {
                            if (index === 0) {
                                // Check if the first row looks like headers
                                var isHeaderRow = true;
                                for (var header in row) {
                                    // If any value is not a string or contains numbers, it's probably not a header row
                                    if (typeof row[header] !== 'string' || /\d/.test(row[header])) {
                                        isHeaderRow = false;
                                        break;
                                    }
                                }
                                return !isHeaderRow;
                            }
                            return true;
                        });

                        $scope.columnMapping = {}; // Reset column mapping

                        // Site-specific column mapping
                        if ($scope.url.includes('runsignup.com')) {
                            // RunSignUp specific column mapping
                            $scope.tableHeaders.forEach(function(header) {
                                var headerLower = header.toLowerCase();
                                if (headerLower.includes('name')) {
                                    $scope.columnMapping[header] = 'name';
                                } else if (headerLower.includes('chip time') || headerLower.includes('finish')) {
                                    $scope.columnMapping[header] = 'time';
                                } else if (headerLower === 'place'|| headerLower.includes('overall')) {
                                    $scope.columnMapping[header] = 'place';
                                } else if (headerLower.includes('gender place') || headerLower.includes('gender rank')) {
                                    $scope.columnMapping[header] = 'genderRank';
                                } else if (headerLower.includes('gender') || headerLower.includes('sex')) {
                                    $scope.columnMapping[header] = 'gender';
                                } else if (headerLower.includes('age place') || headerLower.includes('age rank')) {
                                    $scope.columnMapping[header] = 'ageRank';
                                }
                            });
                        } else if ($scope.url.includes('parkrun.')) {
                            // Parkrun specific column mapping
                            $scope.tableHeaders.forEach(function(header) {
                                var headerLower = header.toLowerCase();
                                if (headerLower.includes('name') || headerLower.includes('runner') || headerLower.includes('parkrunner')) {
                                    $scope.columnMapping[header] = 'name';
                                } else if (headerLower.includes('time') || headerLower.includes('finish')) {
                                    $scope.columnMapping[header] = 'time';
                                } else if (headerLower.includes('position') || headerLower.includes('place')) {
                                    $scope.columnMapping[header] = 'place';
                                } else if (headerLower === 'gender') {
                                    $scope.columnMapping[header] = 'gender';
                                } else if (headerLower === 'gender rank') {
                                    $scope.columnMapping[header] = 'genderRank';
                                } else if (headerLower.includes('age position') || headerLower.includes('age place')) {
                                    $scope.columnMapping[header] = 'ageRank';
                                }
                            });
                        } else if ($scope.url.includes('mcrrc.org')) {
                            // Default MCRRC mapping
                            $scope.tableHeaders.forEach(function(header) {
                                var headerLower = header.toLowerCase();
                                if (headerLower === 'name') {
                                    $scope.columnMapping[header] = 'name';
                                } else if (headerLower === 'net time') {
                                    $scope.columnMapping[header] = 'time';
                                } else if (headerLower.includes('place') || headerLower.includes('overall')) {
                                    $scope.columnMapping[header] = 'place';
                                } else if (headerLower.includes('gender') || headerLower.includes('sex')) {
                                    $scope.columnMapping[header] = 'gender';
                                } else if (headerLower.includes('gen/tot') || headerLower.includes('gender place') || headerLower.includes('gender rank')) {
                                    $scope.columnMapping[header] = 'genderRank';
                                } else if (headerLower.includes('div/tot') || headerLower.includes('age place') || headerLower.includes('age rank')) {
                                    $scope.columnMapping[header] = 'ageRank';
                                } 
                            });
                        } else if ($scope.url.includes('athlinks.com')) {
                            // Athlinks specific column mapping
                            $scope.tableHeaders.forEach(function(header) {
                                var headerLower = header.toLowerCase();
                                if (headerLower === 'name') {
                                    $scope.columnMapping[header] = 'name';
                                } else if (headerLower === 'time') {
                                    $scope.columnMapping[header] = 'time';
                                } else if (headerLower === 'place') {
                                    $scope.columnMapping[header] = 'place';
                                } else if (headerLower === 'gender') {
                                    $scope.columnMapping[header] = 'gender';
                                } else if (headerLower === 'gender place') {
                                    $scope.columnMapping[header] = 'genderRank';                                
                                } else if (headerLower === 'division place' ) {
                                    $scope.columnMapping[header] = 'ageRank';
                                }
                            });
                        }
                        
                        // Try to extract race name from the page title or content
                        if (response.data.pageTitle) {
                            // Remove common suffixes and clean up the title
                            var title = response.data.pageTitle
                                .replace(/results?/i, '')
                                .replace(/race/i, '')
                                .replace(/202[0-9]/g, '') // Remove years
                                .trim();
                            
                            if (title) {
                                $scope.formData.raceName = title;
                            }
                        }
                        // Set the result link to the URL being processed
                        $scope.formData.resultlink = $scope.url;
                    } else {
                        NotificationService.showNotifiction(false,'Failed to load table data: ' + response.data.error);
                    }
                    $scope.isLoading = false;
                })
                .catch(function(response) {
                    NotificationService.showNotifiction(false,response.data.error);
                    $scope.tableData = null;
                    $scope.processedResults = null;
                    $scope.isLoading = false;
                });
        };

        $scope.hasRequiredFields = function() {
            // Check if we have either a name column or both firstname and lastname columns
            var hasName = false;
            var hasFirstName = false;
            var hasLastName = false;
            var hasTime = false;
            
            for (var header in $scope.columnMapping) {
                if ($scope.columnMapping[header] === 'name') {
                    hasName = true;
                }
                if ($scope.columnMapping[header] === 'firstname') {
                    hasFirstName = true;
                }
                if ($scope.columnMapping[header] === 'lastname') {
                    hasLastName = true;
                }
                if ($scope.columnMapping[header] === 'time') {
                    hasTime = true;
                }
            }
            
            // We need either name or both firstname and lastname
            var hasValidNameMapping = hasName || (hasFirstName && hasLastName);
            return hasValidNameMapping && hasTime;
        };

        $scope.getRaceTypeClass = function(s) {
            if (s !== undefined) {
                return s.replace(/ /g, '') + '-col';
            }
        };

        ResultsService.getRaceTypes({
            sort: 'meters'
        }).then(function(racetypes) {
            $scope.racetypesList = racetypes;
            racetypes.forEach(function(r) {
                if (r.name === 'Multisport'){//this needs to be added to racetypes
                    $scope.multisportRacetype = r;
                }
            });
        });

        $scope.onRaceTypeSelect = function(selected) {
            $scope.raceType = selected;
            if (selected.isVariable && selected.surface !== 'multiple') {
                $scope.meters = selected.meters;
                $scope.miles = selected.miles;
            } else {
                $scope.meters = '';
                $scope.miles = '';
            }
        };

        $scope.onMetersChange = function() {
            if ($scope.formData.meters && !isNaN($scope.formData.meters)) {
                $scope.formData.miles = ($scope.formData.meters * 0.000621371).toFixed(2);
                // Update the race type's attributes if it's variable
                if ($scope.formData.raceType && $scope.formData.raceType.isVariable) {
                    $scope.formData.raceType.meters = parseInt($scope.formData.meters);
                    $scope.formData.raceType.miles = parseFloat($scope.formData.miles);
                }
            }
        };

        $scope.onMilesChange = function() {
            if ($scope.formData.miles && !isNaN($scope.formData.miles)) {
                $scope.formData.meters = Math.round($scope.formData.miles * 1609.34);
                // Update the race type's attributes if it's variable
                if ($scope.formData.raceType && $scope.formData.raceType.isVariable) {
                    $scope.formData.raceType.meters = parseInt($scope.formData.meters);
                    $scope.formData.raceType.miles = parseFloat($scope.formData.miles);
                }
            }
        };

        $scope.canProcess = function() {
            const missingRequirements = [];
            
            if (!$scope.hasRequiredFields()) {
                missingRequirements.push('Name and Time fields are required');
            }
            
            if (!$scope.formData.raceType) {
                missingRequirements.push('Please select a race type');
            }

            if (!$scope.formData.raceName) {
                missingRequirements.push('Please select a race Name');
            }

            if (!$scope.formData.raceDate) {
                missingRequirements.push('Please select a race Date');
            }
            
            if (!$scope.formData.location.country) {
                missingRequirements.push('Please select a country');
            }
            
            if ($scope.formData.location.country === 'USA' && !$scope.formData.location.state) {
                missingRequirements.push('Please select a state for USA');
            }
            
            return { 
                canProcess: missingRequirements.length === 0,
                message: missingRequirements.length > 0 ? missingRequirements.join('<br>') : ''
            };
        };

        $scope.processResults = function() {
            const processStatus = $scope.canProcess();
            if (!processStatus.canProcess) {                
                return;
            }

            $scope.processedResults = $scope.tableData
                .map(function(row) {
                    var result = {
                        selected: true, // Default to selected
                        member: {
                                                   },
                        time: 0,
                        timeExp: {
                            hours: 0,
                            minutes: 0,
                            seconds: 0,
                            centiseconds: 0
                        },
                        race: {
                            racename: $scope.formData.raceName,
                            racedate: $scope.formData.raceDate ? new Date($scope.formData.raceDate).getTime() : null,
                            racetype: $scope.formData.raceType,
                            location: $scope.formData.location,
                            distanceName: $scope.formData.distanceName                        
                        },
                        ranking: {                                                    
                        },
                        resultlink: $scope.formData.resultlink,
                        isRecordEligible: $scope.formData.isRecordEligible || false
                    };

                    // Find the column header that was mapped to 'name'
                    var nameColumn = Object.keys($scope.columnMapping).find(key => $scope.columnMapping[key] === 'name');
                    var firstNameColumn = Object.keys($scope.columnMapping).find(key => $scope.columnMapping[key] === 'firstname');
                    var lastNameColumn = Object.keys($scope.columnMapping).find(key => $scope.columnMapping[key] === 'lastname');

                    if (nameColumn && row[nameColumn]) {
                        var nameParts = row[nameColumn].trim().split(/\s+/);
                        if (nameParts.length >= 2) {
                            result.member.firstname = nameParts[0];
                            result.member.lastname = nameParts.slice(1).join(' ');
                        } else {
                            return null;
                        }
                    } else if (firstNameColumn && lastNameColumn && row[firstNameColumn] && row[lastNameColumn]) {
                        result.member.firstname = row[firstNameColumn].trim();
                        result.member.lastname = row[lastNameColumn].trim();
                    } else {
                        return null;
                    }

                    // Find the column header that was mapped to 'time'
                    var timeColumn = Object.keys($scope.columnMapping).find(key => $scope.columnMapping[key] === 'time');
                    if (timeColumn && row[timeColumn]) {
                        var timeStr = row[timeColumn].toString().trim();
                        // For Parkrun results, extract only the finish time (before any PB info)
                        if ($scope.url.includes('parkrun.')) {
                            timeStr = timeStr.split('PB')[0].trim();
                        }
                        result.time = $scope.cleanTime(timeStr);
                        // Initialize timeExp from the cleaned time
                        var totalSeconds = result.time / 100; // Convert from centiseconds to seconds
                        result.timeExp.hours = Math.floor(totalSeconds / 3600);
                        result.timeExp.minutes = Math.floor((totalSeconds % 3600) / 60);
                        result.timeExp.seconds = Math.floor(totalSeconds % 60);
                        result.timeExp.centiseconds = Math.floor((result.time % 100));
                    } else {
                        return null;
                    }

                    // Parse gender ranking
                    var genderRankColumn = Object.keys($scope.columnMapping).find(key => $scope.columnMapping[key] === 'genderRank');
                    var genderColumn = Object.keys($scope.columnMapping).find(key => $scope.columnMapping[key] === 'gender' );
                    
                    if (genderRankColumn && row[genderRankColumn]) {
                        var genderRankStr = row[genderRankColumn].toString().trim();
                        // Check if the format is "rank/total"
                        if (genderRankStr.includes('/')) {
                            var genderParts = genderRankStr.split('/');
                            genderRankValue = parseInt(genderParts[0]);
                            var genderTotalValue = parseInt(genderParts[1]);
                            if (!isNaN(genderRankValue)) {
                                result.ranking.genderrank = genderRankValue;
                            }
                            if (!isNaN(genderTotalValue)) {
                                result.ranking.gendertotal = genderTotalValue;
                            }
                        } else {
                            // Handle single number format
                            genderRankValue = parseInt(genderRankStr);
                            if (!isNaN(genderRankValue)) {
                                result.ranking.genderrank = genderRankValue;
                                // Try to find total gender participants by looking for the highest rank
                                if (genderColumn && row[genderColumn]) {
                                    // If we have gender/sex info but no ranking, calculate it
                                    var currentGender = row[genderColumn].toString().trim();
                                    // Count total participants in the same age group
                                    result.ranking.gendertotal = $scope.tableData.filter(r => {
                                        var otherGender = r[genderColumn].toString().trim();
                                        return otherGender === currentGender;
                                    }).length;
                                }
                            }
                        }
                    } else if (genderColumn && row[genderColumn]) {
                        // If we only have gender info, calculate rank based on position within gender group
                        var currentGender2 = row[genderColumn].toString().trim();
                        
                        // Count total participants of the same gender
                        var genderTotal = $scope.tableData.filter(r => {
                            var otherGender = r[genderColumn].toString().trim();
                            return otherGender === currentGender2;
                        }).length;
                        
                        // Calculate gender rank based on position in the filtered array
                        var genderRank = $scope.tableData
                            .filter(r => r[genderColumn].toString().trim() === currentGender2)
                            .findIndex(r => r === row) + 1;
                        
                        if (genderRank > 0) {
                            result.ranking.genderrank = genderRank;
                            result.ranking.gendertotal = genderTotal;
                        }
                    }

                    // Parse age ranking
                    var ageRankColumn = Object.keys($scope.columnMapping).find(key => $scope.columnMapping[key] === 'ageRank');
                    var ageGroupColumn = Object.keys($scope.columnMapping).find(key => $scope.columnMapping[key] === 'ageGroup');
                    if (ageRankColumn && row[ageRankColumn]) {
                        var ageRankStr = row[ageRankColumn].toString().trim();
                        // Check if the format is "rank/total"
                        if (ageRankStr.includes('/')) {
                            var ageParts = ageRankStr.split('/');
                            ageRankValue = parseInt(ageParts[0]);
                            var ageTotalValue = parseInt(ageParts[1]);
                            if (!isNaN(ageRankValue)) {
                                result.ranking.agerank = ageRankValue;
                            }
                            if (!isNaN(ageTotalValue)) {
                                result.ranking.agetotal = ageTotalValue;
                            }
                        } else {
                            // Handle single number format
                            ageRankValue = parseInt(ageRankStr);
                            if (!isNaN(ageRankValue)) {
                                result.ranking.agerank = ageRankValue;
                                // If we have age group information, use it to calculate total
                                if (ageGroupColumn && row[ageGroupColumn]) {
                                    var currentAgeGroup = row[ageGroupColumn].toString().trim();
                                    // Count total participants in the same age group
                                    result.ranking.agetotal = $scope.tableData.filter(r => {
                                        var otherAgeGroup = r[ageGroupColumn].toString().trim();
                                        return otherAgeGroup === currentAgeGroup;
                                    }).length;
                                } 
                            }
                        }
                    } else if (ageGroupColumn && row[ageGroupColumn]) {
                        // If we only have age group info, calculate rank based on position within age group
                        var currentAgeGroup2 = row[ageGroupColumn].toString().trim();
                        
                        // Count total participants in the same age group
                        var ageGroupTotal = $scope.tableData.filter(r => {
                            var otherAgeGroup = r[ageGroupColumn].toString().trim();
                            return otherAgeGroup === currentAgeGroup2;
                        }).length;
                        
                        // Calculate age group rank based on position in the filtered array
                        var ageGroupRank = $scope.tableData
                            .filter(r => r[ageGroupColumn].toString().trim() === currentAgeGroup2)
                            .findIndex(r => r === row) + 1;
                        
                        if (ageGroupRank > 0) {
                            result.ranking.agerank = ageGroupRank;
                            result.ranking.agetotal = ageGroupTotal;
                        }
                    }

                    // Parse general ranking (place)
                     // Find the column header that was mapped to 'place' to get total participants
                    var placeColumn = Object.keys($scope.columnMapping).find(key => $scope.columnMapping[key] === 'place');
                    if (placeColumn && row[placeColumn]) {
                        var place = parseInt(row[placeColumn]);
                        if (!isNaN(place)) {
                            result.ranking.overallrank = place;
                        }
                    }
                    
                    var totalParticipants = 0;
                    if (placeColumn) {
                        // Find the highest place number to get total participants
                        totalParticipants = Math.max(...$scope.tableData.map(row => {
                            var place = parseInt(row[placeColumn]);
                            return isNaN(place) ? 0 : place;
                        }));
                        result.ranking.overalltotal = totalParticipants;
                    }

                    // After the existing gender ranking parsing code, add:
                    

                    

                    return result;
                })
                .filter(function(result) {
                    if (!result) return false;

                    // More flexible name matching using full names
                    var isMatch = $scope.currentTeamMembers.some(function(member) {
                        // Normalize names for comparison
                        var normalizeName = function(name) {
                            return name.toLowerCase()
                                .replace(/[^a-z0-9]/g, '')
                                .replace(/\s+/g, '');
                        };

                        var resultFullName = normalizeName(result.member.firstname + ' ' + result.member.lastname);
                        var memberFullName = normalizeName(member.firstname + ' ' + member.lastname);
                        
                        // Check against alternate names if they exist
                        var alternateNamesMatch = false;
                        if (member.alternateFullNames && member.alternateFullNames.length > 0) {
                            alternateNamesMatch = member.alternateFullNames.some(function(altName) {
                                var normalizedAltName = normalizeName(altName);
                                return resultFullName === normalizedAltName || 
                                       resultFullName.includes(normalizedAltName) || 
                                       normalizedAltName.includes(resultFullName);
                            });
                        }

                        if (resultFullName === memberFullName || 
                            resultFullName.includes(memberFullName) || 
                            memberFullName.includes(resultFullName) ||
                            alternateNamesMatch) {
                            // Update the member data with the complete member information
                            result.members = [member];
                            return true;
                        }
                        return false;
                    });

                    return isMatch;
                });

            // Remove the temporary member object since we now have the proper members array
            $scope.processedResults.forEach(function(result) {
                delete result.member;
            });

        };

        $scope.selectAll = function() {
            $scope.processedResults.forEach(function(result) {
                result.selected = true;
            });
        };

        $scope.deselectAll = function() {
            $scope.processedResults.forEach(function(result) {
                result.selected = false;
            });
        };

        $scope.hasSelectedResults = function() {
            return $scope.processedResults.some(function(result) {
                return result.selected;
            });
        };

        $scope.saveResults = function() {
            if (!$scope.processedResults.length) {
                NotificationService.showNotifiction(false,'No results to save');
                return;
            }

            var resultsToSave = $scope.processedResults.filter(function(result) {
                return result.selected;
            });

            if (!resultsToSave.length) {
                NotificationService.showNotifiction(false,'Please select at least one result to save');
                return;
            }

            // Process each result before saving
            resultsToSave = resultsToSave.map(function(result) {
                // Update time from timeExp components
                if (result.timeExp) {
                    result.time = (result.timeExp.hours * 3600 + 
                                 result.timeExp.minutes * 60 + 
                                 result.timeExp.seconds) * 100 + 
                                 result.timeExp.centiseconds;
                }

                // Ensure all ranking numbers are integers
                if (result.ranking) {
                    result.ranking.overallrank = parseInt(result.ranking.overallrank) || undefined;
                    result.ranking.overalltotal = parseInt(result.ranking.overalltotal) || undefined;
                    result.ranking.genderrank = parseInt(result.ranking.genderrank) || undefined;
                    result.ranking.gendertotal = parseInt(result.ranking.gendertotal) || undefined;
                    result.ranking.agerank = parseInt(result.ranking.agerank) || undefined;
                    result.ranking.agetotal = parseInt(result.ranking.agetotal) || undefined;                    
                }

                // Clean up the result object
                var res = JSON.parse(JSON.stringify(result));
                delete res.timeExp;
                delete res.selected;
                delete res.member;

                return res;
            });

            $scope.isLoading = true;
            ResultsService.saveResults(resultsToSave)
                .then(function(savedResults) {
                    $analytics.eventTrack('Result Extractor', { 
                        category: 'Tools',
                        label: 'Results Saved',
                        value: savedResults.length
                    });
                    $scope.processedResults = []; // Clear processed results after successful save
                    $scope.isLoading = false;
                })
                .catch(function(error) {
                    console.error('Error saving results:', error);
                    $scope.isLoading = false;
                });
        };

        $scope.cleanTime = function(timeStr) {
            if (!timeStr) return 0;
            // Remove any non-numeric characters except for colons and periods
            timeStr = timeStr.replace(/[^0-9:.]/g, '');
            
            // Handle different time formats
            if (timeStr.includes(':')) {
                var parts = timeStr.split(':');
                if (parts.length === 2) {
                    // MM:SS format
                    return (parseInt(parts[0]) * 60 + parseFloat(parts[1]))*100;
                } else if (parts.length === 3) {
                    // HH:MM:SS format
                    return (parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2]))*100;
                }
            }
            // If it's just a number, assume it's seconds
            return parseFloat(timeStr)*100;
        };

        $scope.updateTime = function(result) {
            // Ensure all time components are numbers
            result.timeExp.hours = parseInt(result.timeExp.hours) || 0;
            result.timeExp.minutes = parseInt(result.timeExp.minutes) || 0;
            result.timeExp.seconds = parseInt(result.timeExp.seconds) || 0;
            result.timeExp.centiseconds = parseInt(result.timeExp.centiseconds) || 0;

            // Calculate total time in centiseconds
            result.time = (result.timeExp.hours * 3600 + 
                          result.timeExp.minutes * 60 + 
                          result.timeExp.seconds) * 100 + 
                          result.timeExp.centiseconds;
        };

        $scope.debugResult = function(result) {
            console.log('Debug Result:', result);
        };

        $scope.hideColumn = function(header) {
            $scope.hiddenColumns[header] = true;
        };

        $scope.isColumnHidden = function(header) {
            return $scope.hiddenColumns[header] || false;
        };

           // =====================================
    // DATE PICKER CONFIG ==================
    // =====================================

    $scope.dateOptions = {
        formatDay: 'dd',
        formatMonth: 'MM',
        formatYear: 'yy',

        startingDay: 1
    };

    $scope.open = function($event) {
        $event.preventDefault();
        $event.stopPropagation();

        $scope.formData.opened = true;
    };
    }
]); 