// Result submissions (app/resultSubmissionRoutes.js): runners report results
// on /submit-result; admins add them on /result-submissions.
angular.module('mcrrcApp').factory('ResultSubmissionService', ['$http', function ($http) {

    var factory = {};

    function data(res) {
        return res.data;
    }

    // status: 'pending' or 'done'
    factory.list = function (status) {
        return $http.get('/api/result-submissions', { params: { status: status } }).then(data);
    };

    factory.markAdded = function (id, resultId, addPhotoLink) {
        return $http.post('/api/result-submissions/' + id + '/added', { resultId: resultId, addPhotoLink: !!addPhotoLink }).then(data);
    };

    factory.dismiss = function (id, reason) {
        return $http.post('/api/result-submissions/' + id + '/dismiss', { reason: reason }).then(data);
    };

    // Already on the site: done, nothing to add
    factory.markAlready = function (id) {
        return $http.post('/api/result-submissions/' + id + '/already').then(data);
    };

    factory.reopen = function (id) {
        return $http.post('/api/result-submissions/' + id + '/reopen').then(data);
    };

    return factory;
}]);
