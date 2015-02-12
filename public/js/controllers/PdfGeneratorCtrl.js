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
            doc.text(35, 200, "Document generated on "+ $filter('date')(new Date(), "MM/dd/yyyy"));
            doc.addPage();


            var h = 9;
            pdfreport.openMaleRecords.recordsList.forEach(function(divRecords) {
                h++;
                var rt = divRecords.racetype;
                var results = divRecords.records;
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
            h = 15;
            pdfreport.masterMaleRecords.recordsList.forEach(function(divRecords) {
                h++;
                var rt = divRecords.racetype;
                var results = divRecords.records;
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
            h = 15;
            pdfreport.openFemaleRecords.recordsList.forEach(function(divRecords) {
                h++;
                var rt = divRecords.racetype;
                var results = divRecords.records;
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
            h = 15;
            pdfreport.masterFemaleRecords.recordsList.forEach(function(divRecords) {
                h++;
                var rt = divRecords.racetype;
                var results = divRecords.records;
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
