angular.module('mcrrcApp.results').controller('ReportController', ['$scope', '$stateParams', '$analytics', '$filter', 'AuthService', 'ResultsService', function($scope, $stateParams, $analytics, $filter, AuthService, ResultsService) {



    $scope.authService = AuthService;
    $scope.$watch('authService.isLoggedIn()', function(user) {
        $scope.user = user;
    });

    $scope.datefrom = new Date().setDate((new Date()).getDate() - 30);
    $scope.dateto = new Date();
    $scope.showhtml = false;


    $scope.getReports = function() {
        $scope.getResults();
        $scope.getReportAsHTML();
    };

    $scope.getResults = function() {

        ResultsService.getRacesInfos({
            "filters": {
                "dateFrom": new Date($filter('date')($scope.datefrom, "yyyy-MM-dd", 'UTC')).getTime(),
                "dateTo": new Date($filter('date')($scope.dateto, "yyyy-MM-dd", 'UTC')).getTime()
            },
            "sort": '-race.racedate -race.order race.racename'
        }).then(function(raceInfosList) {
            $scope.report = "";
            raceInfosList.forEach(function(raceinfo) {
                $scope.report += raceinfo.race.racename + " -- " + $filter('date')(raceinfo.race.racedate, "yyyy-MM-dd", 'UTC') + "\n";
                raceinfo.results.forEach(function(result) {
                    var members = '';
                    result.members.forEach(function(m) {
                        members += m.firstname + ' ' + m.lastname + ' & ';
                    });
                    members = members.slice(0, -3);
                    $scope.report += members + " " + $filter('secondsToTimeString')(result.time);
                    if (result.ranking && $filter('rankTooltipOneLine')(result.ranking) !== "") {
                        $scope.report += " (" + $filter('rankTooltipOneLine')(result.ranking) + ")";
                    }
                    $scope.report += "\n";
                });
                $scope.report += "\n";
            });

        });

    };

    $scope.getReportAsHTML = function() {


        ResultsService.getRacesInfos({
            "filters": {
                "dateFrom": new Date($filter('date')($scope.datefrom, "yyyy-MM-dd", 'UTC')).getTime(),
                "dateTo": new Date($filter('date')($scope.dateto, "yyyy-MM-dd", 'UTC')).getTime()
            },
            "sort": '-race.racedate -race.order race.racename'
        }).then(function(raceInfosList) {
            $scope.reportHTLM = '<table style="width:400px;border:1px;border-collapse: collapse;color:#646464;">';
            raceInfosList.forEach(function(raceinfo) {
                $scope.reportHTLM += '<thead><tr style="color: #FA4D19; font-size: 18px;border-bottom-width: 1px;border-bottom-style: dashed;"><th style="text-align:center;" colspan="5">' + raceinfo.race.racename + ' - ' + $filter('date')(raceinfo.race.racedate, "yyyy-MM-dd", 'UTC') + '</th></tr><tr style="color: #19c6fa; font-weight:bold"><th style="text-align:center;border-bottom: 1px solid #E6E6E6;font-size: 16px;" rowspan="2">Racer</th><th style="text-align:center;font-size: 14px;" colspan="3">Finish Place</th><th style="text-align:center;border-bottom: 1px solid #E6E6E6;font-size: 16px;" rowspan="2">Time</th></tr><tr style="border-bottom: 1px solid #E6E6E6;" ><th style="text-align:center;font-weight:normal;font-size:12px;">Age</th><th style="text-align:center;font-weight:normal;font-size:12px;">Gender</th><th style="text-align:center;font-weight:normal;font-size:12px;">Overall</th></tr></thead>';
                raceinfo.results.forEach(function(result) {
                    var members = '';
                    result.members.forEach(function(m) {
                        members += m.firstname + ' ' + m.lastname + ' & ';
                    });
                    members = members.slice(0, -3);
                    $scope.reportHTLM += '<tr><td style="font-weight:bold;">' + members + '</td>' + $filter('rankTooltipTd')(result.ranking) + '<td style="text-align: center;"><span style="cursor:pointer;" title="pace: ' + $filter('resultToPace')(result,raceinfo.race) + '">' + $filter('secondsToTimeString')(result.time) + '</span></td></tr>';
                });
            });
            $scope.reportHTLM += '</table><span style="color:#646464;font-size:12px;">See all results from the MCRRC racing team at <a href="http://raceteam.mcrrc.org" target="_blank">raceteam.mcrrc.org</a></span>';

        });

        // ResultsService.getResults({
        //     "filters": {
        //         "datefrom": $filter('date')($scope.datefrom, "yyyy-MM-dd", 'UTC'),
        //         "dateto": $filter('date')($scope.dateto, "yyyy-MM-dd", 'UTC')
        //     },
        //     "sort": '-race.racedate race.racename time'
        // }).then(function(results) {
        //     $scope.reportHTLM = '<table style="width:400px;border:1px;border-collapse: collapse;color:#646464;">';

        //     var lastEvent = "";
        //     var lastDate = "";
        //     results.forEach(function(result) {
        //         var members = '';
        //         result.members.forEach(function(m) {
        //             members += m.firstname + ' ' + m.lastname + ' & ';
        //         });
        //         members = members.slice(0, -3);
        //         if (result.race.racename !== lastEvent || result.race.racedate !== lastDate) {
        //             if ($scope.reportHTLM !== '<table style="width:400px;border:1px;border-collapse: collapse;color:#646464;">') {
        //                 $scope.reportHTLM += '<tr style="height: 30px;"></tr>';
        //             }
        //             $scope.reportHTLM += '<thead><tr style="color: #FA4D19; font-size: 18px;border-bottom-width: 1px;border-bottom-style: dashed;"><th style="text-align:center;" colspan="5">' + result.race.racename + ' - ' + $filter('date')(result.race.racedate, "yyyy-MM-dd", 'UTC') + '</th></tr><tr style="color: #19c6fa; font-weight:bold"><th style="text-align:center;border-bottom: 1px solid #E6E6E6;font-size: 16px;" rowspan="2">Racer</th><th style="text-align:center;font-size: 14px;" colspan="3">Finish Place</th><th style="text-align:center;border-bottom: 1px solid #E6E6E6;font-size: 16px;" rowspan="2">Time</th></tr><tr style="border-bottom: 1px solid #E6E6E6;" ><th style="text-align:center;font-weight:normal;font-size:12px;">Age</th><th style="text-align:center;font-weight:normal;font-size:12px;">Gender</th><th style="text-align:center;font-weight:normal;font-size:12px;">Overall</th></tr></thead>';
        //             $scope.reportHTLM += '<tr><td style="font-weight:bold;">' + members + '</td>' + $filter('rankTooltipTd')(result.ranking) + '<td style="text-align: center;"><span style="cursor:pointer;" title="pace: ' + $filter('resultToPace')(result) + '">' + $filter('secondsToTimeString')(result.time) + '</span></td></tr>';
        //         } else {

        //             $scope.reportHTLM += '<tr><td style="font-weight:bold;">' + members + '</td>' + $filter('rankTooltipTd')(result.ranking) + '<td style="text-align: center;"><span style="cursor:pointer;" title="pace: ' + $filter('resultToPace')(result) + '">' + $filter('secondsToTimeString')(result.time) + '</span></td></tr>';
        //         }

        //         lastEvent = result.race.racename;
        //         lastDate = result.race.racedate;
        //     });
        //     $scope.reportHTLM += '</table><span style="color:#646464;font-size:12px;">See all results from the MCRRC racing team at <a href="http://raceteam.mcrrc.org" target="_blank">raceteam.mcrrc.org</a></span>';
        // });
    };



    $scope.open = function($event, opened) {
        $event.preventDefault();
        $event.stopPropagation();

        $scope[opened] = true;
    };

}]);

angular.module('mcrrcApp.results').controller('TableReportController', ['$scope', '$stateParams', '$analytics', '$filter', 'AuthService', 'ResultsService', function($scope, $stateParams, $analytics, $filter, AuthService, ResultsService) {

    if ($stateParams.from && $stateParams.to) {
        ResultsService.getResults({
            "filters": {
                "datefrom": $filter('date')($stateParams.from, "yyyy-MM-dd", 'UTC'),
                "dateto": $filter('date')($stateParams.to, "yyyy-MM-dd", 'UTC')
            },
            "sort": '-race.racedate -race.order race.racename time'
        }).then(function(results) {
            $scope.reportHTLM = '<table style="width:400px;border:1px;border-collapse: collapse;color:#646464;">';

            var lastEvent = "";
            var lastDate = "";
            results.forEach(function(result) {
                var members = '';
                result.members.forEach(function(m) {
                    members += m.firstname + ' ' + m.lastname + ' & ';
                });
                members = members.slice(0, -3);
                if (result.race.racename !== lastEvent || result.race.racedate !== lastDate) {
                    if ($scope.reportHTLM !== '<table style="width:400px;border:1px;border-collapse: collapse;color:#646464;">') {
                        $scope.reportHTLM += '<tr style="height: 30px;"></tr>';
                    }
                    $scope.reportHTLM += '<thead><tr style="color: #FA4D19; font-size: 18px;border-bottom-width: 1px;border-bottom-style: dashed;"><th style="text-align:center;" colspan="5">' + result.race.racename + ' - ' + $filter('date')(result.race.racedate, "yyyy-MM-dd", 'UTC') + '</th></tr><tr style="color: #19c6fa; font-weight:bold"><th style="text-align:center;border-bottom: 1px solid #E6E6E6;font-size: 16px;" rowspan="2">Racer</th><th style="text-align:center;font-size: 14px;" colspan="3">Finish Place</th><th style="text-align:center;border-bottom: 1px solid #E6E6E6;font-size: 16px;" rowspan="2">Time</th></tr><tr style="border-bottom: 1px solid #E6E6E6;" ><th style="text-align:center;font-weight:normal;font-size:12px;">Age</th><th style="text-align:center;font-weight:normal;font-size:12px;">Gender</th><th style="text-align:center;font-weight:normal;font-size:12px;">Overall</th></tr></thead>';
                    $scope.reportHTLM += '<tr><td style="font-weight:bold;">' + members + '</td>' + $filter('rankTooltipTd')(result.ranking) + '<td style="text-align: center;"><span style="cursor:pointer;" title="pace: ' + $filter('resultToPace')(result) + '">' + $filter('secondsToTimeString')(result.time) + '</span></td></tr>';

                } else {

                    $scope.reportHTLM += '<tr><td style="font-weight:bold;">' + members + '</td>' + $filter('rankTooltipTd')(result.ranking) + '<td style="text-align: center;"><span style="cursor:pointer;" title="pace: ' + $filter('resultToPace')(result) + '">' + $filter('secondsToTimeString')(result.time) + '</span></td></tr>';

                }

                lastEvent = result.race.racename;
                lastDate = result.race.racedate;
            });
            $scope.reportHTLM += '</table><span style="color:#646464;font-size:12px;">See all results from the MCRRC racing team at <a href="http://raceteam.mcrrc.org" target="_blank">raceteam.mcrrc.org</a></span>';
        });
    }



}]);
