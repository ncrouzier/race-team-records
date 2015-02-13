angular.module('mcrrcApp.results').controller('PdfGeneratorController', ['$scope', '$analytics', '$filter', 'AuthService', 'ResultsService', function($scope, $analytics, $filter, AuthService, ResultsService) {

    $scope.authService = AuthService;
    $scope.$watch('authService.isLoggedIn()', function(user) {
        $scope.user = user;
    });



    $scope.generatePdf = function() {

        ResultsService.getResultsForPdf().then(function(pdfreport) {

            var doc = new jsPDF('p');
            doc.setFont("courier");

            doc.setFontSize(30);
            doc.text(35, 25, "MCRRC Race Team Records");
            doc.setFontSize(8);
            doc.text(10, 290, "Document generated on "+ $filter('date')(new Date(), "MM/dd/yyyy"));
            doc.addPage();

            doc.setFontSize(11);
            doc.setFontType("bold");
            doc.setTextColor(26, 90, 133);
            doc.text(8, 7, "Open Male:" );
            doc.setTextColor(0, 0, 0);
            doc.setFontType("normal");
            var h = 12;
            pdfreport.openMaleRecords.recordsList.forEach(function(divRecords) {
                var results = divRecords.records;
                if (results.length === 0) return;
                var rt = divRecords.racetype;
                h++;
                doc.setFontSize(8);
                doc.setFontType("bold");
                doc.text(8, h, rt.name + ' (' + rt.surface + ')');
                doc.setFontType("normal");
                doc.setFontSize(5);
                var place = 1;
                h += 3;
                results.forEach(function(result) {
                    var members = '';
                    result.member.forEach(function(m) {
                        members += m.firstname + ' ' + m.lastname + ' & ';
                    });
                    members = members.slice(0, -3);
                    doc.text(10, h, place + '. ' + $filter('secondsToTimeString')(result.time) + ' - ' + members + '; ' + result.racename + ' ' + $filter('date')(result.racedate, "MM/dd/yyyy"));
                    place++;
                    h = h + 2;
                });

            });
            doc.addPage();

			doc.setFontSize(11);
            doc.setFontType("bold");
            doc.setTextColor(26, 90, 133);
            doc.text(8, 7, "Master Male:" );
            doc.setTextColor(0, 0, 0);
            doc.setFontType("normal");
            h = 12;
            pdfreport.masterMaleRecords.recordsList.forEach(function(divRecords) {
                var results = divRecords.records;
                if (results.length === 0) return;
                var rt = divRecords.racetype;
                h++;
                doc.setFontSize(8);
                doc.setFontType("bold");
                doc.text(8, h, rt.name + ' (' + rt.surface + ')');
                doc.setFontType("normal");
                doc.setFontSize(5);
                var place = 1;
                h += 3;
                results.forEach(function(result) {
                    var members = '';
                    result.member.forEach(function(m) {
                        members += m.firstname + ' ' + m.lastname + ' & ';
                    });
                    members = members.slice(0, -3);
                    doc.text(10, h, place + '. ' + $filter('secondsToTimeString')(result.time) + ' - ' + members + '; ' + result.racename + ' ' + $filter('date')(result.racedate, "MM/dd/yyyy"));
                    place++;
                    h = h + 2;
                });
            });
            doc.addPage();

            doc.setFontSize(11);
            doc.setFontType("bold");
            doc.setTextColor(26, 90, 133);
            doc.text(8, 7, "Open Female:" );
            doc.setTextColor(0, 0, 0);
            doc.setFontType("normal");
            h = 12;
            pdfreport.openFemaleRecords.recordsList.forEach(function(divRecords) {
                var results = divRecords.records;
                if (results.length === 0) return;
                var rt = divRecords.racetype;
                h++;
                doc.setFontSize(8);
                doc.setFontType("bold");
                doc.text(8, h, rt.name + ' (' + rt.surface + ')');
                doc.setFontType("normal");
                doc.setFontSize(5);
                var place = 1;
                h += 3;
                results.forEach(function(result) {
                    var members = '';
                    result.member.forEach(function(m) {
                        members += m.firstname + ' ' + m.lastname + ' & ';
                    });
                    members = members.slice(0, -3);
                    doc.text(10, h, place + '. ' + $filter('secondsToTimeString')(result.time) + ' - ' + members + '; ' + result.racename + ' ' + $filter('date')(result.racedate, "MM/dd/yyyy"));
                    place++;
                    h = h + 2;
                });
            });
            doc.addPage();

            doc.setFontSize(11);
            doc.setFontType("bold");
            doc.setTextColor(26, 90, 133);
            doc.text(8, 7, "Master Female:" );
            doc.setTextColor(0, 0, 0);
            doc.setFontType("normal");
            h = 12;
            pdfreport.masterFemaleRecords.recordsList.forEach(function(divRecords) {
                var results = divRecords.records;
                if (results.length === 0) return;
                var rt = divRecords.racetype;
                h++;
                doc.setFontSize(8);
                doc.setFontType("bold");
                doc.text(8, h, rt.name + ' (' + rt.surface + ')');
                doc.setFontType("normal");
                doc.setFontSize(5);
                var place = 1;
                h += 3;
                results.forEach(function(result) {
                    var members = '';
                    result.member.forEach(function(m) {
                        members += m.firstname + ' ' + m.lastname + ' & ';
                    });
                    members = members.slice(0, -3);
                    doc.text(10, h, place + '. ' + $filter('secondsToTimeString')(result.time) + ' - ' + members + '; ' + result.racename + ' ' + $filter('date')(result.racedate, "MM/dd/yyyy"));
                    place++;
                    h = h + 2;
                });
            });

            doc.save('mcrrcRecords.pdf');
        });




        // doc.setFontSize(40);
        // doc.text(35, 25, "Paranyan loves jsPDF");
        // doc.addImage(imgData, 'JPEG', 15, 40, 180, 160);

    };



}]);
