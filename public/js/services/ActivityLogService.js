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

    factory.deleteLog = function(id) {
        return Restangular.one('activitylogs', id).remove().then(function() {
            return true;
        }, function(res) {
            console.log('Error deleting activity log: ' + res.status);
        });
    };

    return factory;
}]);
