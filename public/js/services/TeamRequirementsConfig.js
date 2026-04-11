angular.module('mcrrcApp').constant('TEAM_REQUIREMENTS', teamRequirements);

angular.module('mcrrcApp').factory('TeamRequirementsConfig', ['TEAM_REQUIREMENTS', function (TEAM_REQUIREMENTS) {
    return {
        getForYear: TEAM_REQUIREMENTS.getForYear,
        defaults: TEAM_REQUIREMENTS.defaults
    };
}]);
