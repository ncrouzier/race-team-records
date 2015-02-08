var app = angular.module('mcrrcApp');

app.directive('onlyDigitsForMinSec', function() {
    return {
        require: 'ngModel',
        restrict: 'A',
        link: function(scope, element, attr, ctrl) {
            function inputValue(val) {
                if (val) {
                    var digits = val.replace(/[^0-9]/g, '');
                    if (digits < 0) digits = '0';
                    if (digits > 59) digits = '59';
                    if (digits !== val) {
                        ctrl.$setViewValue(digits);
                        ctrl.$render();
                    }
                    return parseInt(digits, 10);
                }
                return undefined;
            }
            ctrl.$parsers.push(inputValue);
        }
    };
});

app.directive('onlyDigits', function() {
    return {
        require: 'ngModel',
        restrict: 'A',
        link: function(scope, element, attr, ctrl) {
            function inputValue(val) {
                if (val) {
                    var digits = val.replace(/[^0-9]/g, '');
                    if (digits !== val) {
                        ctrl.$setViewValue(digits);
                        ctrl.$render();
                    }
                    return parseInt(digits, 10);
                }
                return undefined;
            }
            ctrl.$parsers.push(inputValue);
        }
    };
});




app.directive("memberselector", function() {
    return {
        restrict: "E",
        transclude: true,
        scope: {
            datamembers: "=",
            members: "=",
            index: "@"
        },
        templateUrl: "views/templates/memberDropdown.html",
        link: function(scope, element) {
            scope.deleteMemberSelector = function(datamembers, index) {
                datamembers.splice(index, 1);
            };
        }
    };
});

//fix for datePicker format bug
app.directive('datepickerPopup', function (){
  return {
    restrict: 'EAC',
    require: 'ngModel',
    link: function(scope, element, attr, controller) {
      //remove the default formatter from the input directive to prevent conflict
      controller.$formatters.shift();
    }
  };
});

