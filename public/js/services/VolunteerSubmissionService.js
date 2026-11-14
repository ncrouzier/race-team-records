// Volunteer submissions (app/volunteerSubmissionRoutes.js): members report
// volunteer jobs on /submit-volunteer; admins add them on /volunteer-submissions.
angular.module('mcrrcApp').factory('VolunteerSubmissionService', ['$http', function ($http) {

    var factory = {};

    function data(res) {
        return res.data;
    }

    // status: 'pending' or 'done'
    factory.list = function (status) {
        return $http.get('/api/volunteer-submissions', { params: { status: status } }).then(data);
    };

    factory.markAdded = function (id, jobId) {
        return $http.post('/api/volunteer-submissions/' + id + '/added', { jobId: jobId }).then(data);
    };

    factory.dismiss = function (id, reason) {
        return $http.post('/api/volunteer-submissions/' + id + '/dismiss', { reason: reason }).then(data);
    };

    // Already on the site: done, nothing to add
    factory.markAlready = function (id) {
        return $http.post('/api/volunteer-submissions/' + id + '/already').then(data);
    };

    factory.reopen = function (id) {
        return $http.post('/api/volunteer-submissions/' + id + '/reopen').then(data);
    };

    return factory;
}]);
