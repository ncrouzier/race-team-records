// Correction requests (app/correctionRoutes.js): members suggest fixes to
// their own results; admins review them on /corrections.
angular.module('mcrrcApp').factory('CorrectionService', ['$http', '$uibModal', function ($http, $uibModal) {

    var factory = {};

    function data(res) {
        return res.data;
    }

    // { role, request, values, runners, isMultisport } for the logged-in user
    factory.forResult = function (resultId) {
        return $http.get('/api/results/' + resultId + '/correction').then(data);
    };

    factory.send = function (resultId, values, note) {
        return $http.post('/api/results/' + resultId + '/correction', { values: values, note: note }).then(data);
    };

    factory.withdraw = function (id) {
        return $http.delete('/api/corrections/' + id).then(data);
    };

    // status: 'open' or 'done'
    factory.list = function (status) {
        return $http.get('/api/corrections', { params: { status: status } }).then(data);
    };

    factory.markSaved = function (id, kind, keepOpen) {
        return $http.post('/api/corrections/' + id + '/saved', { kind: kind, keepOpen: !!keepOpen }).then(data);
    };

    factory.dismiss = function (id, reason) {
        return $http.post('/api/corrections/' + id + '/dismiss', { reason: reason }).then(data);
    };

    // The member's form. status: what forResult answered. Resolves 'sent' or
    // 'withdrawn'; rejects when closed without either.
    factory.openRequestModal = function (status) {
        return $uibModal.open({
            templateUrl: 'views/modals/correctionRequestModal.html',
            controller: 'CorrectionRequestModalController',
            size: 'lg',
            backdrop: 'static',
            resolve: {
                status: function () { return status; }
            }
        }).result;
    };

    return factory;
}]);
