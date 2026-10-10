angular.module('mcrrcApp.admin').controller('AgeGradingTablesController', [
    '$scope', 'AuthService', 'AgeGradingService', 'NotificationService',
    function ($scope, AuthService, AgeGradingService, NotificationService) {

        $scope.authService = AuthService;
        $scope.$watch('authService.isLoggedIn()', function (user) {
            $scope.user = user;
        });

        $scope.loading = true;
        $scope.refreshing = false;
        $scope.meta = null;
        $scope.table = null;
        $scope.showSeconds = false;

        // Set through a function, not `ng-click="showSeconds = true"`: the
        // controls sit inside an ng-if, which creates a child scope, and a
        // bare assignment would write to that child and shadow the value the
        // rest of the page reads.
        $scope.setShowSeconds = function (value) {
            $scope.showSeconds = value;
        };

        $scope.selection = {
            sex: null,
            type: null,
            version: null
        };

        // The standards are stored in seconds, sometimes fractional on the
        // track (a 60m standard is 6.93s), so the sub-minute case keeps its
        // decimals instead of rounding away the only meaningful digits.
        $scope.formatSeconds = function (value) {
            if (value === null || value === undefined) return '';
            // Round to hundredths before splitting, so a value that rounds up
            // across a boundary (59.999) becomes 1:00 rather than "60".
            var total = Math.round(value * 100) / 100;
            if (total < 60) {
                return total.toString();
            }
            var hours = Math.floor(total / 3600);
            var minutes = Math.floor((total % 3600) / 60);
            var seconds = total % 60;
            var whole = Math.floor(seconds);
            var hundredths = Math.round((seconds - whole) * 100);
            var secStr = (whole < 10 ? '0' : '') + whole;
            if (hundredths > 0) {
                secStr += '.' + (hundredths < 10 ? '0' : '') + hundredths;
            }
            if (hours > 0) {
                return hours + ':' + (minutes < 10 ? '0' : '') + minutes + ':' + secStr;
            }
            return minutes + ':' + secStr;
        };

        $scope.cellValue = function (row, distance) {
            var value = row.values[distance];
            if (value === null || value === undefined) return '';
            return $scope.showSeconds ? value : $scope.formatSeconds(value);
        };

        // Versions and sexes are offered per surface: the track tables use a
        // different version series (2005/2023) than the road ones.
        $scope.versionsFor = function (type) {
            if (!$scope.meta) return [];
            var seen = {};
            var versions = [];
            $scope.meta.tables.forEach(function (t) {
                if (t.type === type && !seen[t.version]) {
                    seen[t.version] = true;
                    versions.push(t.version);
                }
            });
            return versions;
        };

        $scope.types = function () {
            if (!$scope.meta) return [];
            var seen = {};
            var types = [];
            $scope.meta.tables.forEach(function (t) {
                if (!seen[t.type]) {
                    seen[t.type] = true;
                    types.push(t.type);
                }
            });
            return types;
        };

        function tableInfo(sex, type, version) {
            if (!$scope.meta) return null;
            var found = null;
            $scope.meta.tables.forEach(function (t) {
                if (t.sex === sex && t.type === type && t.version === version) found = t;
            });
            return found;
        }

        $scope.selectType = function (type) {
            if ($scope.selection.type === type) return;
            $scope.selection.type = type;
            var versions = $scope.versionsFor(type);
            if (versions.indexOf($scope.selection.version) === -1) {
                $scope.selection.version = versions[0];
            }
            $scope.loadTable();
        };

        $scope.selectSex = function (sex) {
            if ($scope.selection.sex === sex) return;
            $scope.selection.sex = sex;
            $scope.loadTable();
        };

        $scope.selectVersion = function (version) {
            if ($scope.selection.version === version) return;
            $scope.selection.version = version;
            $scope.loadTable();
        };

        $scope.currentInfo = function () {
            return tableInfo($scope.selection.sex, $scope.selection.type, $scope.selection.version);
        };

        $scope.loadTable = function () {
            if (!$scope.selection.sex || !$scope.selection.type || !$scope.selection.version) return;
            $scope.loading = true;
            AgeGradingService.getTable({
                sex: $scope.selection.sex,
                type: $scope.selection.type,
                version: $scope.selection.version
            }).then(function (table) {
                $scope.table = table || null;
                $scope.loading = false;
            });
        };

        $scope.refreshCache = function () {
            $scope.refreshing = true;
            AgeGradingService.refreshCache().then(function () {
                $scope.refreshing = false;
                NotificationService.showNotifiction(true, 'Age grading cache refreshed.');
            }, function () {
                $scope.refreshing = false;
                NotificationService.showNotifiction(false, 'Could not refresh the age grading cache.');
            });
        };

        $scope.exportCsv = function () {
            if (!$scope.table) return;
            var escapeCell = function (value) {
                var str = (value === null || value === undefined) ? '' : String(value);
                return /[",\n]/.test(str) ? '"' + str.replace(/"/g, '""') + '"' : str;
            };
            var lines = [['age'].concat($scope.table.distances).map(escapeCell).join(',')];
            $scope.table.rows.forEach(function (row) {
                var cells = [row.age];
                $scope.table.distances.forEach(function (d) {
                    cells.push($scope.cellValue(row, d));
                });
                lines.push(cells.map(escapeCell).join(','));
            });

            var blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
            var link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'agegrading-' + $scope.table.type + '-' + $scope.table.sex + '-' + $scope.table.version + '.csv';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
        };

        AgeGradingService.getMeta().then(function (meta) {
            $scope.meta = meta || null;
            if (!$scope.meta || !$scope.meta.tables.length) {
                $scope.loading = false;
                return;
            }
            // Default to the newest road table, which is the one nearly every
            // current result is graded against.
            var preferred = null;
            $scope.meta.tables.forEach(function (t) {
                if (t.type === 'road' && t.sex === 'male' && (!preferred || t.version > preferred.version)) {
                    preferred = t;
                }
            });
            preferred = preferred || $scope.meta.tables[0];
            $scope.selection.sex = preferred.sex;
            $scope.selection.type = preferred.type;
            $scope.selection.version = preferred.version;
            $scope.loadTable();
        });
    }
]);
