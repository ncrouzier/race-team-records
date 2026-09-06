angular.module('mcrrcApp.admin').controller('TeamApplicationsController', ['$scope', '$http', '$uibModal', 'dialogs', 'AuthService', function ($scope, $http, $uibModal, dialogs, AuthService) {

    $scope.authService = AuthService;
    $scope.$watch('authService.isLoggedIn()', function (user) {
        $scope.user = user;
        $scope.isAdmin = !!(user && user.role === 'admin');
        $scope.canReview = !!(user && (user.role === 'admin' || user.role === 'captain'));
    });

    $scope.applications = [];
    $scope.statusCounts = { pending: 0, approved: 0, rejected: 0 };
    $scope.minAgeGrade = 70;
    $scope.raceCommitment = 8;
    $scope.statusFilter = 'pending';
    $scope.loading = true;
    $scope.error = null;
    $scope.expanded = {};
    $scope.busy = {};

    $scope.statusTabs = [
        { key: 'pending', label: 'Pending', icon: 'fa-hourglass-half' },
        { key: 'approved', label: 'Approved', icon: 'fa-check-circle' },
        { key: 'rejected', label: 'Rejected', icon: 'fa-times-circle' },
        { key: 'all', label: 'All', icon: 'fa-list' }
    ];

    function loadApplications() {
        $scope.loading = true;
        $scope.error = null;
        var params = { _: Date.now() };
        if ($scope.statusFilter !== 'all') params.status = $scope.statusFilter;
        $http.get('/api/team-applications', { params: params }).then(function (res) {
            $scope.applications = res.data.applications;
            $scope.statusCounts = res.data.statusCounts;
            $scope.minAgeGrade = res.data.minAgeGrade;
            $scope.raceCommitment = res.data.raceCommitment;
        }, function () {
            $scope.error = 'Failed to load applications.';
        }).finally(function () {
            $scope.loading = false;
        });
    }

    loadApplications();

    $scope.setFilter = function (key) {
        $scope.statusFilter = key;
        $scope.expanded = {};
        loadApplications();
    };

    $scope.toggleExpand = function (application) {
        $scope.expanded[application._id] = !$scope.expanded[application._id];
    };

    $scope.approve = function (application) {
        var modalInstance = $uibModal.open({
            templateUrl: 'views/modals/applicationApproveModal.html',
            controller: 'ApplicationApproveModalController',
            size: 'lg',
            resolve: {
                application: function () { return application; }
            }
        });
        modalInstance.result.then(function () {
            loadApplications();
        }, function () { });
    };

    // Hand-ticked follow-up steps after approval — plain on/off records, no side effects.
    // Keys match the server's APPLICATION_FLAGS.
    $scope.flags = [
        { key: 'team-notified', field: 'teamNotified', label: 'Team notified', tip: 'this member has been announced in a team email' },
        { key: 'groups-io', field: 'addedToGroupsIo', label: 'Groups.io', tip: 'this member has been added to the Groups.io list' }
    ];

    $scope.toggleFlag = function (application, flag) {
        var next = !application[flag.field];
        $scope.busy[application._id] = true;
        $http.put('/api/team-applications/' + application._id + '/flags/' + flag.key, { value: next }).then(function (res) {
            // Copy back every flag field so timestamps and usernames stay in sync
            $scope.flags.forEach(function (f) {
                application[f.field] = res.data.application[f.field];
            });
            application.teamNotifiedAt = res.data.application.teamNotifiedAt;
            application.teamNotifiedByUsername = res.data.application.teamNotifiedByUsername;
            application.addedToGroupsIoAt = res.data.application.addedToGroupsIoAt;
            application.addedToGroupsIoByUsername = res.data.application.addedToGroupsIoByUsername;
        }, function (res) {
            dialogs.error('Update failed', (res.data && res.data.error) || 'Failed to update the application.');
        }).finally(function () {
            $scope.busy[application._id] = false;
        });
    };

    // Sends the approval or rejection letter — always a deliberate, separate step
    // from the decision itself.
    $scope.sendEmail = function (application, type) {
        var modalInstance = $uibModal.open({
            templateUrl: 'views/modals/applicationEmailModal.html',
            controller: 'ApplicationEmailModalController',
            size: 'lg',
            resolve: {
                application: function () { return application; },
                type: function () { return type; }
            }
        });
        modalInstance.result.then(function (updated) {
            application.approvalEmail = updated.approvalEmail;
            application.rejectionEmail = updated.rejectionEmail;
        }, function () { });
    };

    $scope.decisionEmail = function (application) {
        return application.status === 'rejected' ? application.rejectionEmail : application.approvalEmail;
    };

    $scope.emailSent = function (application) {
        var email = $scope.decisionEmail(application);
        return !!(email && email.sentAt);
    };

    $scope.reject = function (application) {
        var modalInstance = $uibModal.open({
            templateUrl: 'views/modals/applicationRejectModal.html',
            controller: 'ApplicationRejectModalController',
            size: 'lg',
            resolve: {
                application: function () { return application; },
                minAgeGrade: function () { return $scope.minAgeGrade; }
            }
        });
        modalInstance.result.then(function () {
            loadApplications();
        }, function () { });
    };

    $scope.reopen = function (application) {
        var dlg = dialogs.confirm('Move back to pending',
            'Move ' + $scope.fullname(application) + '\'s application back to pending?' +
            (application.member ? ' Any member record already created from it is left in place.' : ''));
        dlg.result.then(function () {
            $scope.busy[application._id] = true;
            $http.post('/api/team-applications/' + application._id + '/reopen', {}).then(function () {
                loadApplications();
            }, function (res) {
                dialogs.error('Could not reopen', (res.data && res.data.error) || 'Failed to reopen application.');
            }).finally(function () {
                $scope.busy[application._id] = false;
            });
        });
    };

    $scope.remove = function (application) {
        var name = $scope.fullname(application);
        var dlg = dialogs.confirm('Delete application',
            'Delete the application from ' + name + '? This cannot be undone.' +
            (application.member ? ' The member record already created from it is left in place.' : ''));
        dlg.result.then(function () {
            $http.delete('/api/team-applications/' + application._id).then(function () {
                $scope.applications = $scope.applications.filter(function (a) { return a._id !== application._id; });
                loadApplications();
            }, function (res) {
                dialogs.error('Delete failed', (res.data && res.data.error) || 'Failed to delete application.');
            });
        });
    };

    // --- display helpers ---

    $scope.fullname = function (application) {
        return application.firstname + ' ' + application.lastname;
    };

    $scope.ageOf = function (application) {
        if (!application.dateofbirth) return null;
        var dob = new Date(application.dateofbirth);
        var now = new Date();
        var age = now.getUTCFullYear() - dob.getUTCFullYear();
        var monthDiff = now.getUTCMonth() - dob.getUTCMonth();
        if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < dob.getUTCDate())) age--;
        return age;
    };

    $scope.centisToString = function (cs) {
        if (!cs) return '—';
        var totalSec = Math.floor(cs / 100);
        var h = Math.floor(totalSec / 3600);
        var m = Math.floor((totalSec % 3600) / 60);
        var s = totalSec % 60;
        function pad(n) { return String(n).padStart(2, '0'); }
        if (h > 0) return h + ':' + pad(m) + ':' + pad(s);
        return m + ':' + pad(s);
    };

}]);

angular.module('mcrrcApp.admin').controller('ApplicationApproveModalController', ['$scope', '$http', '$uibModalInstance', 'application', function ($scope, $http, $uibModalInstance, application) {

    $scope.application = application;
    $scope.matches = [];
    // Wrapped in an object on purpose: the radios live inside ng-if/ng-repeat child
    // scopes, and binding a bare primitive would be shadowed rather than written back.
    $scope.selection = { choice: null };   // an existing member _id, or 'new'
    $scope.saving = false;
    $scope.loading = true;
    $scope.error = null;

    // Look for an existing member with the same name before approving — a returning
    // runner should keep their old record rather than get a duplicate one.
    $http.get('/api/team-applications/' + application._id + '/member-matches').then(function (res) {
        $scope.matches = res.data.matches || [];
        // Default to the safer option: only link when the captain says so.
        $scope.selection.choice = $scope.matches.length ? null : 'new';
    }, function () {
        $scope.matches = [];
        $scope.selection.choice = 'new';
    }).finally(function () {
        $scope.loading = false;
    });

    // Flag a date-of-birth mismatch — the strongest hint that it's a different person
    $scope.sameDob = function (member) {
        if (!member.dateofbirth || !application.dateofbirth) return true;
        return new Date(member.dateofbirth).toISOString().split('T')[0] ===
            new Date(application.dateofbirth).toISOString().split('T')[0];
    };

    $scope.confirm = function () {
        $scope.error = null;
        if (!$scope.selection.choice) {
            $scope.error = 'Please choose whether this is a returning member or a new one.';
            return;
        }
        $scope.saving = true;
        var payload = $scope.selection.choice === 'new' ? {} : { existingMemberId: $scope.selection.choice };
        $http.post('/api/team-applications/' + application._id + '/approve', payload).then(function (res) {
            $uibModalInstance.close(res.data);
        }, function (res) {
            $scope.error = (res.data && res.data.error) || 'Failed to approve application.';
        }).finally(function () {
            $scope.saving = false;
        });
    };

    $scope.cancel = function () {
        $uibModalInstance.dismiss('cancel');
    };

}]);

angular.module('mcrrcApp.admin').controller('ApplicationRejectModalController', ['$scope', '$http', '$uibModalInstance', 'application', 'minAgeGrade', function ($scope, $http, $uibModalInstance, application, minAgeGrade) {

    $scope.application = application;
    $scope.minAgeGrade = minAgeGrade;
    // Object wrapper so the binding survives any child scope in the template
    $scope.form = { notes: '' };
    $scope.saving = false;
    $scope.error = null;

    $scope.confirm = function () {
        $scope.error = null;
        $scope.saving = true;
        $http.post('/api/team-applications/' + application._id + '/reject', { notes: $scope.form.notes }).then(function (res) {
            $uibModalInstance.close(res.data);
        }, function (res) {
            $scope.error = (res.data && res.data.error) || 'Failed to reject application.';
        }).finally(function () {
            $scope.saving = false;
        });
    };

    $scope.cancel = function () {
        $uibModalInstance.dismiss('cancel');
    };

}]);

angular.module('mcrrcApp.admin').controller('ApplicationEmailModalController', ['$scope', '$http', '$uibModalInstance', 'application', 'type', function ($scope, $http, $uibModalInstance, application, type) {

    $scope.application = application;
    $scope.type = type;
    // Object wrapper for the same reason as the approve dialog — the tabs live inside
    // an ng-if child scope.
    $scope.view = { tab: 'edit' };
    $scope.loading = true;
    $scope.sending = false;
    $scope.error = null;
    $scope.previouslySentAt = null;
    $scope.copy = null;   // { mode: 'Cc'|'Bcc', address } — set from the server config
    $scope.email = { subject: '', body: '' };

    $http.get('/api/team-applications/' + application._id + '/email-template', { params: { type: type } }).then(function (res) {
        $scope.email.subject = res.data.subject;
        $scope.email.body = res.data.body;
        $scope.previouslySentAt = res.data.previouslySentAt || null;
        $scope.copy = res.data.copy || null;
    }, function (res) {
        $scope.error = (res.data && res.data.error) || 'Could not load the email template.';
    }).finally(function () {
        $scope.loading = false;
    });

    $scope.send = function () {
        $scope.error = null;
        if (!$scope.email.subject.trim() || !$scope.email.body.trim()) {
            $scope.error = 'The email needs both a subject and a message.';
            return;
        }
        $scope.sending = true;
        $http.post('/api/team-applications/' + application._id + '/send-email', {
            type: type,
            subject: $scope.email.subject,
            body: $scope.email.body
        }).then(function (res) {
            $uibModalInstance.close(res.data.application);
        }, function (res) {
            $scope.error = (res.data && res.data.error) || 'Failed to send the email.';
        }).finally(function () {
            $scope.sending = false;
        });
    };

    $scope.cancel = function () {
        $uibModalInstance.dismiss('cancel');
    };

}]);
