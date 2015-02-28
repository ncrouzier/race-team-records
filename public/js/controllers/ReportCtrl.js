angular.module('mcrrcApp.results').controller('ReportController', ['$scope', '$analytics', '$filter', 'AuthService', 'ResultsService', function($scope, $analytics, $filter, AuthService, ResultsService) {

    $scope.authService = AuthService;
    $scope.$watch('authService.isLoggedIn()', function(user) {
        $scope.user = user;
    });

    $scope.datefrom = new Date().setDate((new Date()).getDate() - 30);
    $scope.dateto = new Date();





    $scope.getResults = function() {
        ResultsService.getResults({
            "filters": {
                "datefrom": $scope.datefrom,
                "dateto": $scope.dateto,
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
                    $scope.report += result.racename + " " + $filter('date')(result.racedate, "MM/dd/yyyy") + "\n";
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

    $scope.open = function($event, opened) {
        $event.preventDefault();
        $event.stopPropagation();

        $scope[opened] = true;
    };

}]);
