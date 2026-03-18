angular.module('mcrrcApp.admin').factory('ActivityLogService', ['Restangular', function(Restangular) {

    var factory = {};

    factory.getLogs = function(params) {
        return Restangular.one('activitylogs').get(params).then(function(response) {
            return response.plain();
        }, function(res) {
            console.log('Error fetching activity logs: ' + res.status);
        });
    };

    factory.getActionTypes = function() {
        return Restangular.all('activitylogs').customGET('actions').then(function(actions) {
            return actions;
        }, function(res) {
            console.log('Error fetching action types: ' + res.status);
        });
    };

    return factory;
}]);
