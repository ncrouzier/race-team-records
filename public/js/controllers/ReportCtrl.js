angular.module('mcrrcApp.results').controller('ReportController', ['$scope', '$analytics', '$filter', 'AuthService', 'ResultsService', function($scope, $analytics, $filter, AuthService, ResultsService) {

    $scope.authService = AuthService;
    $scope.$watch('authService.isLoggedIn()', function(user) {
        $scope.user = user;
    });

    $scope.datefrom = new Date().setDate((new Date()).getDate() - 30);
    $scope.dateto = new Date();



    $scope.getReports =function(){
        $scope.getResults();
        $scope.getReportAsHTML();
    };

    $scope.getResults = function() {
        ResultsService.getResults({
            "filters": {
                "datefrom": $filter('date')($scope.datefrom, "yyyy-MM-dd", 'UTC'),
                "dateto": $filter('date')($scope.dateto, "yyyy-MM-dd", 'UTC')
            },
            "sort": '-racedate racename time'
        }).then(function(results) {
            $scope.report = "";
            var lastEvent = "";
            var lastDate = "";
            results.forEach(function(result) {
                var members = '';
                result.members.forEach(function(m) {
                    members += m.firstname + ' ' + m.lastname + ' & ';
                });
                members = members.slice(0,-3);
                if (result.racename !== lastEvent || result.racedate !== lastDate) {
                    if ($scope.report !== '') {
                        $scope.report += '\n';
                    }
                    $scope.report += result.racename + " -- " + $filter('date')(result.racedate, "yyyy-MM-dd", 'UTC') + "\n";
                    $scope.report += members + " " + $filter('secondsToTimeString')(result.time);
                    if (result.ranking){
                        $scope.report += " ("+$filter('rankTooltipOneLine')(result.ranking) +")";
                    }
                    $scope.report += "\n";
                } else {
                    $scope.report += members + " " + $filter('secondsToTimeString')(result.time);
                    if (result.ranking){
                        $scope.report += " ("+$filter('rankTooltipOneLine')(result.ranking) +")";
                    }
                    $scope.report += "\n";
                }

                lastEvent = result.racename;
                lastDate = result.racedate;
            });
        });
    };

    $scope.getReportAsHTML = function() {
        ResultsService.getResults({
            "filters": {
                "datefrom": $filter('date')($scope.datefrom, "yyyy-MM-dd", 'UTC'),
                "dateto": $filter('date')($scope.dateto, "yyyy-MM-dd", 'UTC')
            },
            "sort": '-racedate racename time'
        }).then(function(results) {
            $scope.reportHTLM = '<table style="width:400px;border:1px;border-collapse: collapse;color:#646464;">';
    
            var lastEvent = "";
            var lastDate = "";
            results.forEach(function(result) {
                var members = '';
                result.members.forEach(function(m) {
                    members += m.firstname + ' ' + m.lastname + ' & ';
                });
                members = members.slice(0,-3);
                if (result.racename !== lastEvent || result.racedate !== lastDate) {
                    if ($scope.reportHTLM !== '<table style="width:400px;border:1px;border-collapse: collapse;color:#646464;">') {
                        $scope.reportHTLM += '<tr style="height: 30px;"></tr>';
                    }
                    // $scope.report += result.racename + " -- " + $filter('date')(result.racedate, "yyyy-MM-dd", 'UTC') + "\n";
                    
                    $scope.reportHTLM += '<thead><tr style="color: #FA4D19; font-size: 18px;border-bottom-width: 1px;border-bottom-style: dashed;"><th colspan="5">'+result.racename+' - ' + $filter('date')(result.racedate, "yyyy-MM-dd", 'UTC')+'</th></tr><tr style="color: #19c6fa; font-weight:bold"><th style="border-bottom: 1px solid #E6E6E6;font-size: 16px;" rowspan="2">Racer</th><th style="font-size: 14px;" colspan="3">Finish Place</th><th style="border-bottom: 1px solid #E6E6E6;font-size: 16px;" rowspan="2">Time</th></tr><tr style="border-bottom: 1px solid #E6E6E6;" ><th style="font-weight:normal;font-size:12px;">Age</th><th style="font-weight:normal;font-size:12px;">Gender</th><th style="font-weight:normal;font-size:12px;">Overall</th></tr></thead>';


                    $scope.reportHTLM += '<tr><td style="font-weight:bold;">'+members+'</td>'+$filter('rankTooltipTd')(result.ranking)+'<td style="text-align: center;"><span style="cursor:pointer;" title="pace: '+$filter('resultToPace')(result)+'">'+$filter('secondsToTimeString')(result.time)+'</span></td></tr>';
                    // $scope.report += members + " " + $filter('secondsToTimeString')(result.time);
                    // if (result.ranking){
                    //     $scope.report += " ("+$filter('rankTooltipOneLine')(result.ranking) +")";
                    // }
                    // $scope.report += "\n";
                } else {
                   
                    $scope.reportHTLM += '<tr><td style="font-weight:bold;">'+members+'</td>'+$filter('rankTooltipTd')(result.ranking)+'<td style="text-align: center;"><span style="cursor:pointer;" title="pace: '+$filter('resultToPace')(result)+'">'+$filter('secondsToTimeString')(result.time)+'</span></td></tr>';
                    // $scope.report += members + " " + $filter('secondsToTimeString')(result.time);
                    // if (result.ranking){
                    //     $scope.report += " ("+$filter('rankTooltipOneLine')(result.ranking) +")";
                    // }
                    // $scope.report += "\n";
                }

                lastEvent = result.racename;
                lastDate = result.racedate;
            });
console.log($scope.reportHTLM);
        $scope.reportHTLM += '</table><span style="font-size:12px;">See all results from the MCRRC racing team at <a href="http://raceteam.mcrrc.org" target="_blank">raceteam.mcrrc.org</a></span>';
        });
    };

    

    $scope.open = function($event, opened) {
        $event.preventDefault();
        $event.stopPropagation();

        $scope[opened] = true;
    };

}]);
