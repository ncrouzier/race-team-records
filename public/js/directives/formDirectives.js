var app = angular.module('mcrrcApp');

app.directive('onlyDigitsForMinSec', function() {
    return {
        require: 'ngModel',
        restrict: 'A',
        link: function(scope, element, attr, ctrl) {
            //deal with ff allowing non numbers in number inputs...
            element.on('keydown', function(event) {
                const charCode = (event.which) ? event.which : event.keyCode;
                // const inputValue = element[0].value;
                // const selectionStart = element[0].selectionStart;
                   
                // Allow: backspace, delete, tab, escape, enter, home, end, left, right, up, down, Ctrl+A, Ctrl+C, Ctrl+R, Ctrl+X
                if ([46, 8, 9, 27, 13, 35, 36, 37, 39, 38, 40].indexOf(charCode) !== -1 ||
                  (charCode === 65 && (event.ctrlKey || event.metaKey)) ||
                  (charCode === 67 && (event.ctrlKey || event.metaKey)) ||
                  (charCode === 82 && (event.ctrlKey || event.metaKey)) ||
                  (charCode === 88 && (event.ctrlKey || event.metaKey))) {
                  return; // Allow
                }    
                // Prevent default for other key presses
                if (!((charCode >= 48 && charCode <= 57)  // Digits 0-9
                    // || (charCode === 190 && inputValue.indexOf('.') === -1 && !(selectionStart === 0 && text === '.')) || // Dot (.) - Allow only once and not at the beginning if empty
                    // (charCode === 189 && selectionStart === 0 && inputValue.indexOf('-') === -1)
                )) { // Minus (-) - Allow only at the beginning and only once
                  event.preventDefault();
                }                
              });
            function inputValue(val) {
                if (typeof val === 'number') {
                    val = val.toString();
                }
                if (val || val === "") {
                    if (val === "") { //accept nothing
                        return null;
                    }
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

app.directive('onlyDigitsForCentisec', function() {
    return {
        require: 'ngModel',
        restrict: 'A',
        link: function(scope, element, attr, ctrl) {
            //deal with ff allowing non numbers in number inputs...
            element.on('keydown', function(event) {
                const charCode = (event.which) ? event.which : event.keyCode;
                // const inputValue = element[0].value;
                // const selectionStart = element[0].selectionStart;
                   
                // Allow: backspace, delete, tab, escape, enter, home, end, left, right, up, down, Ctrl+A, Ctrl+C, Ctrl+R, Ctrl+X
                if ([46, 8, 9, 27, 13, 35, 36, 37, 39, 38, 40].indexOf(charCode) !== -1 ||
                  (charCode === 65 && (event.ctrlKey || event.metaKey)) ||
                  (charCode === 67 && (event.ctrlKey || event.metaKey)) ||
                  (charCode === 82 && (event.ctrlKey || event.metaKey)) ||
                  (charCode === 88 && (event.ctrlKey || event.metaKey))) {
                  return; // Allow
                }    
                // Prevent default for other key presses
                if (!((charCode >= 48 && charCode <= 57)  // Digits 0-9
                    // || (charCode === 190 && inputValue.indexOf('.') === -1 && !(selectionStart === 0 && text === '.')) || // Dot (.) - Allow only once and not at the beginning if empty
                    // (charCode === 189 && selectionStart === 0 && inputValue.indexOf('-') === -1)
                )) { // Minus (-) - Allow only at the beginning and only once
                  event.preventDefault();
                }                
              });
            function inputValue(val) {
                if (typeof val === 'number') {
                    val = val.toString();
                }
                if (val || val === "") {
                    if (val === "") { //accept nothing
                        return null;
                    }
                    var digits = val.replace(/[^0-9]/g, '');
                    if (digits < 0) digits = '0';
                    if (digits > 99) digits = '99';
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
        scope: {
            dirMin: '@?', 
            dirMax: '@?' 
          },
        link: function(scope, element, attr, ctrl) {
            //deal with ff allowing non numbers in number inputs...
            element.on('keydown', function(event) {
                const charCode = (event.which) ? event.which : event.keyCode;
                // const inputValue = element[0].value;
                // const selectionStart = element[0].selectionStart;
                   
                // Allow: backspace, delete, tab, escape, enter, home, end, left, right, up, down, Ctrl+A, Ctrl+C, Ctrl+R, Ctrl+X
                if ([46, 8, 9, 27, 13, 35, 36, 37, 39, 38, 40].indexOf(charCode) !== -1 ||
                  (charCode === 65 && (event.ctrlKey || event.metaKey)) ||
                  (charCode === 67 && (event.ctrlKey || event.metaKey)) ||
                  (charCode === 82 && (event.ctrlKey || event.metaKey)) ||
                  (charCode === 88 && (event.ctrlKey || event.metaKey))) {
                  return; // Allow
                }    
                // Prevent default for other key presses
                if (!((charCode >= 48 && charCode <= 57)  // Digits 0-9
                    // || (charCode === 190 && inputValue.indexOf('.') === -1 && !(selectionStart === 0 && text === '.')) || // Dot (.) - Allow only once and not at the beginning if empty
                    // (charCode === 189 && selectionStart === 0 && inputValue.indexOf('-') === -1)
                )) { // Minus (-) - Allow only at the beginning and only once
                  event.preventDefault();
                }                
              });
            function inputValue(val) {
                var min, max;
                if (typeof val === 'number') {
                    val = val.toString();            
                }
                if (val || val === "") {
                    if (val === "") {
                        return null;
                    }
                    var digits = val.replace(/[^0-9]/g, '');
                    digits = parseInt(digits, 10);
                    if (attr.dirMin) min = parseInt(attr.dirMin, 10);
                    if (attr.dirMax) max = parseInt(attr.dirMax, 10);             
                    if (min && digits < min) digits = min;
                    if (max && digits > max) digits = max;
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


app.directive('onlyDigitsAgeGradeTime', function() {
    return {
        require: 'ngModel',
        restrict: 'A',
        link: function(scope, element, attr, ctrl) {
            //deal with ff allowing non numbers in number inputs...
            element.on('keydown', function(event) {
                const charCode = (event.which) ? event.which : event.keyCode;
                // const inputValue = element[0].value;
                // const selectionStart = element[0].selectionStart;
                   
                // Allow: backspace, delete, tab, escape, enter, home, end, left, right, up, down, Ctrl+A, Ctrl+C, Ctrl+R, Ctrl+X
                if ([46, 8, 9, 27, 13, 35, 36, 37, 39, 38, 40].indexOf(charCode) !== -1 ||
                  (charCode === 65 && (event.ctrlKey || event.metaKey)) ||
                  (charCode === 67 && (event.ctrlKey || event.metaKey)) ||
                  (charCode === 82 && (event.ctrlKey || event.metaKey)) ||
                  (charCode === 88 && (event.ctrlKey || event.metaKey))) {
                  return; // Allow
                }    
                // Prevent default for other key presses
                if (!((charCode >= 48 && charCode <= 57)  // Digits 0-9
                    // || (charCode === 190 && inputValue.indexOf('.') === -1 && !(selectionStart === 0 && text === '.')) || // Dot (.) - Allow only once and not at the beginning if empty
                    // (charCode === 189 && selectionStart === 0 && inputValue.indexOf('-') === -1)
                )) { // Minus (-) - Allow only at the beginning and only once
                  event.preventDefault();
                }                
              });
            function inputValue(val) {
                if (typeof val === 'number') {
                    val = val.toString();
                }
                if (val || val === "") {
                    if (val === "") {
                        return 0;
                    }
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

// app.directive('onlyDecimals', function() {
//     return {
//         require: 'ngModel',
//         restrict: 'A',
//         link: function(scope, element, attr, ctrl) {
//             function inputValue(val) {
//                 if (typeof val === 'number') {
//                     val = val.toString();
//                 }
//                 if (val) {
//                     var digits = val.replace(/[^0-9.]/g, '');
//                     if (digits !== val) {
//                         ctrl.$setViewValue(digits);
//                         ctrl.$render();
//                     }
//                     return parseInt(digits, 10);
//                 }
//                 return undefined;
//             }
//             ctrl.$parsers.push(inputValue);
//         }
//     };
// });




//fix for datePicker format bug
app.directive('datepickerPopup', function() {
    return {
        restrict: 'EAC',
        require: 'ngModel',
        link: function(scope, element, attr, controller) {
            //remove the default formatter from the input directive to prevent conflict
            controller.$formatters.shift();
        }
    };
});

app.directive('autoFocus', function($timeout) {
    return {
        restrict: 'AC',
        link: function(_scope, _element) {
            $timeout(function() {
                _element[0].focus();
            }, 100);
        }
    };
});


//probably not used?
app.directive('datetimepickerNeutralTimezone', function() {
    return {
      restrict: 'A',
      priority: 1,
      require: 'ngModel',
      link: function (scope, element, attrs, ctrl) {
        ctrl.$formatters.push(function (value) {
            console.log("formatters",value);
          var date = new Date(Date.parse(value));
          date = new Date(date.getTime() + (60000 * date.getTimezoneOffset()));
          console.log(date.getTimezoneOffset(),date);
          return date;
        });

        ctrl.$parsers.push(function (value) {
            console.log("parsers",value);
          var date = new Date(value.getTime() + (60000 * value.getTimezoneOffset()));
          console.log(date.getTimezoneOffset(),date);
          return date;
        });
      }
    };
  });

