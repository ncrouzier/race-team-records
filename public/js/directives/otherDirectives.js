var app = angular.module('mcrrcApp');


app.directive('selectOnClick', function ($window) {
  return {
    link: function (scope, element) {
      element.on('click', function () {
        var selection = $window.getSelection();
        var range = document.createRange();
        range.selectNodeContents(element[0]);
        selection.removeAllRanges();
        selection.addRange(range);
      });
    }
  };
});

app.directive('imageonload', function () {
  return {
    restrict: 'A',
    link: function (scope, element, attrs) {
      element.bind('load', function () {
        //call the function that was passed
        scope.$apply(attrs.imageonload);
      });
    }
  };
});

// US and world race maps (Datamaps). By default they show the whole team's
// races per state / country (the locations API). With map-counts — an array
// of [code, count] — they show those instead (one member's races), redrawn
// whenever it changes; map-runner is then that member's username, so a click
// opens their races there rather than everyone's.
function raceMapDirective(kind) {
  return ['$timeout', '$window', 'UtilsService', '$state', function ($timeout, $window, UtilsService, $state) {
    return {
      restrict: 'EA',
      scope: {
        mapCounts: '<?',
        mapRunner: '<?'
      },
      link: function (scope, element) {
        var map = null;

        function draw(results) {
          element.empty();
          map = null;
          var dataset = {};
          var values = results.map(function (obj) { return obj[1]; });
          var minValue = Math.min.apply(null, values);
          var maxValue = Math.max.apply(null, values);
          // A log scale needs two different ends: one count (or one place)
          // just gets the low end's colour
          var paletteScale = minValue < maxValue
            ? d3.scale.log().domain([minValue, maxValue]).range(['#007196', 'red'])
            : function () { return '#007196'; };

          results.forEach(function (item) {
            dataset[item[0]] = { count: item[1], fillColor: paletteScale(item[1]) };
          });

          map = new Datamap({
            element: element[0],
            scope: kind === 'state' ? 'usa' : 'world',
            projection: kind === 'state' ? 'albersUsa' : 'mercator',
            responsive: true,
            fills: { defaultFill: '#afafaf' },
            data: dataset,
            geographyConfig: {
              highlightBorderWidth: 2,
              highlightFillColor: function (geo) {
                return geo.fillColor || '#afafaf';
              },
              highlightBorderColor: 'red',
              popupTemplate: function (geo, data) {
                var count = data ? data.count : 0;
                return '<div class="hoverinfo"><strong>' + count + (count === 1 ? ' race' : ' races') +
                  ' ran in ' + geo.properties.name + '</strong></div>';
              }
            },
            done: function (datamap) {
              datamap.svg.call(d3.behavior.zoom().on('zoom', function () {
                datamap.svg.selectAll('g').attr('transform', 'translate(' + d3.event.translate + ')scale(' + d3.event.scale + ')');
              }));
              datamap.svg.selectAll('.datamaps-subunit').each(function (d) {
                if (dataset[d.id] && dataset[d.id].count > 0) {
                  d3.select(this).style('cursor', 'pointer');
                  d3.select(this).on('click', function (ele) {
                    var params = kind === 'state' ? { state: ele.id } : { country: ele.id };
                    if (scope.mapRunner) params.runner = scope.mapRunner;
                    $state.go('/results', params, { inherit: false });
                  });
                }
              });
            }
          });
        }

        function render() {
          if (scope.mapCounts) {
            $timeout(function () { draw(scope.mapCounts); }, 10);
          } else {
            UtilsService.getLocationInfo({ type: kind }).then(function (results) {
              // a member picked while the team's counts were loading wins
              if (!scope.mapCounts) $timeout(function () { draw(results); }, 10);
            });
          }
        }

        scope.$watch('mapCounts', render);

        function onResize() {
          if (map) map.resize();
        }
        angular.element($window).on('resize', onResize);
        scope.$on('$destroy', function () {
          angular.element($window).off('resize', onResize);
        });
      }
    };
  }];
}

app.directive('usaMap', raceMapDirective('state'));
app.directive('worldMap', raceMapDirective('country'));

// Race Achievements Directive
// tap-tooltip: for a tooltip on something inside a clickable row (an icon in a
// results list). On a touch screen the tap opens the tooltip (with
// tooltip-trigger="$root.tapTooltipTrigger") and goes no further, so it does
// not also open the row's race or result; a tap anywhere else in the row
// still does. With a mouse, clicks pass through as before.
// tap-tooltip="rank" names what was tapped, for analytics (tooltip_open).
angular.module('mcrrcApp').directive('tapTooltip', ['$rootScope', '$document', 'Analytics', function ($rootScope, $document, Analytics) {
  return {
    restrict: 'A',
    link: function (scope, element, attrs) {
      if (!$rootScope.noHover) return;
      element.on('click', function (event) {
        event.stopPropagation();
        // Other open tooltips close on a tap outside them, which they hear
        // from the document; this tap no longer gets there, so tell it
        $document.triggerHandler({ type: 'click', target: event.target });
        Analytics.event('tooltip_open', { element: attrs.tapTooltip || 'icon' });
      });
    }
  };
}]);

// On a touch screen (no hover), a tooltip on something that is not itself a
// link or button opens on tap, like tooltip-trigger="$root.tapTooltipTrigger"
// (the "?" beside a figure, a badge). Tooltips with their own trigger, and
// those on or inside anything tappable (a tap there keeps doing what it does;
// see tap-tooltip for icons in clickable rows), are left as they are.
function tapByDefault() {
  var noHover = window.matchMedia && window.matchMedia('(hover: none)').matches;
  return {
    restrict: 'A',
    priority: 1,
    compile: function (element, attrs) {
      if (!noHover || attrs.tooltipTrigger) return;
      if (element[0].closest && element[0].closest('a, button, label, input, select, textarea, [ng-click], [ui-sref], [href]')) return;
      attrs.tooltipTrigger = "'outsideClick'";
    }
  };
}
angular.module('mcrrcApp').directive('uibTooltip', tapByDefault);
angular.module('mcrrcApp').directive('uibTooltipHtml', tapByDefault);

// A row of tabs (class="nav-tabs") swipes sideways on a phone (mcrrc.less).
// There it opens with the current tab in view, and shows a ‹ / › at each end
// that has more tabs past it (tap: scroll a screenful); the row's classes
// nav-tabs-more-left / -right say which. The arrows are always added and
// only shown on a phone, so the row follows a window resized either way.
//
// The Stats pages' row, in their shared frame (views/stats/shell.html), does
// more on a phone: its underline glides to the tab being opened, and the page
// under it (the frame's ui-view) follows a sideways swipe, the next or
// previous tab behind it: a copy of that page as last seen (statsCopies),
// or a placeholder until it has been opened once.
var SWIPE_IGNORE = 'input, textarea, select, canvas, svg, .leaflet-container, .noUi-target, .nav-tabs, .modal';

// The Stats pages as last seen, by state name: taken as each is left, so a
// swipe back shows it as it was. Charts (canvases) become images; ids go.
var statsCopies = {
  pages: {},

  take: function (name, pageEl) {
    if (!name || !pageEl) return;
    var clone = pageEl.cloneNode(true);
    var canvases = pageEl.querySelectorAll('canvas');
    var cloneCanvases = clone.querySelectorAll('canvas');
    Array.prototype.forEach.call(canvases, function (canvas, i) {
      try {
        var img = document.createElement('img');
        var box = canvas.getBoundingClientRect();
        img.src = canvas.toDataURL();
        img.style.width = box.width + 'px';
        img.style.height = box.height + 'px';
        cloneCanvases[i].parentNode.replaceChild(img, cloneCanvases[i]);
      } catch (e) { /* a tainted canvas: left out */ }
    });
    clone.removeAttribute('id');
    Array.prototype.forEach.call(clone.querySelectorAll('[id]'), function (el) { el.removeAttribute('id'); });
    this.pages[name] = clone;
  }
};

angular.module('mcrrcApp').directive('navTabs', ['$timeout', '$window', '$transitions', function ($timeout, $window, $transitions) {
  var phone = $window.matchMedia ? $window.matchMedia('(max-width: 767px)') : null;
  function isPhone() { return !!(phone && phone.matches); }

  // Something under the finger that scrolls sideways itself (a wide table)
  function scrollsSideways(el, stop) {
    for (; el && el !== stop; el = el.parentElement) {
      var overflow = $window.getComputedStyle(el).overflowX;
      if ((overflow === 'auto' || overflow === 'scroll') && el.scrollWidth > el.clientWidth + 2) return true;
    }
    return false;
  }

  return {
    restrict: 'C',
    link: function (scope, element) {
      var row = element[0];

      // ---- The arrows ----
      function arrow(side, label, icon) {
        var li = angular.element('<li class="nav-tabs-arrow nav-tabs-arrow-' + side + '" role="presentation">' +
          '<button type="button" aria-label="' + label + '"><i class="fa ' + icon + '"></i></button></li>');
        li.find('button').on('click', function () {
          var step = row.clientWidth * 0.7 * (side === 'left' ? -1 : 1);
          if (row.scrollBy) row.scrollBy({ left: step, behavior: 'smooth' });
          else row.scrollLeft += step;
        });
        return li;
      }
      element.prepend(arrow('left', 'Previous tabs', 'fa-chevron-left'));
      element.append(arrow('right', 'More tabs', 'fa-chevron-right'));

      function update() {
        var max = row.scrollWidth - row.clientWidth;
        element.toggleClass('nav-tabs-more-left', isPhone() && row.scrollLeft > 4);
        element.toggleClass('nav-tabs-more-right', isPhone() && row.scrollLeft < max - 4);
      }

      // The row scrolled to centre this tab
      function scrollTo(li, smooth) {
        if (!isPhone() || !li || row.scrollWidth <= row.clientWidth) return;
        var left = Math.max(0, Math.min(li.offsetLeft - (row.clientWidth - li.offsetWidth) / 2, row.scrollWidth - row.clientWidth));
        if (smooth && row.scrollTo) row.scrollTo({ left: left, behavior: 'smooth' });
        else row.scrollLeft = left;
      }

      function onBreakpoint() { scrollTo(row.querySelector('li.active'), false); placeBar(row.querySelector('li.active'), false); update(); }
      element.on('scroll', update);
      angular.element($window).on('resize', update);
      if (phone && phone.addEventListener) phone.addEventListener('change', onBreakpoint);
      $timeout(function () { scrollTo(row.querySelector('li.active'), false); update(); }, 100, false);

      var shell = element.parent();
      var inShell = shell.hasClass('stats-shell');
      var slot = inShell ? row.nextElementSibling : null; // around the pages' ui-view: stays

      // ---- The gliding underline (the Stats row, on a phone) ----
      var bar = null;
      function placeBar(li, animate, fromLi, progress) {
        if (!inShell) return;
        if (!isPhone() || !li) {
          element.removeClass('nav-tabs-glide');
          if (bar) { bar.remove(); bar = null; }
          return;
        }
        if (!bar) {
          bar = angular.element('<span class="nav-tabs-indicator" aria-hidden="true"></span>');
          element.append(bar);
        }
        element.addClass('nav-tabs-glide');
        var from = fromLi || li;
        var p = progress === undefined ? 1 : progress;
        bar[0].style.transition = animate ? 'left 0.25s ease-out, width 0.25s ease-out' : 'none';
        bar[0].style.left = (from.offsetLeft + (li.offsetLeft - from.offsetLeft) * p) + 'px';
        bar[0].style.width = (from.offsetWidth + (li.offsetWidth - from.offsetWidth) * p) + 'px';
      }

      function tabFor(stateName) {
        var a = row.querySelector('a[ui-sref="' + stateName + '"]');
        return a && a.parentNode;
      }

      if (inShell) {
        $timeout(function () { placeBar(row.querySelector('li.active'), false); }, 100, false);

        // Leaving a page: keep a copy of it; opening one: the underline
        // glides there at once, before the page has loaded
        var offStart = $transitions.onStart({}, function (trans) {
          var from = trans.from().name;
          var leaving = slot && slot.querySelector('[ui-view] > .jumbotron');
          if (leaving && tabFor(from)) statsCopies.take(from, leaving);
          var target = tabFor(trans.to().name);
          if (target) {
            placeBar(target, true);
            scrollTo(target, true);
          }
        });
        var offSuccess = $transitions.onSuccess({}, function () {
          $timeout(function () { placeBar(row.querySelector('li.active'), false); update(); }, 0, false);
        });
      }

      // ---- Swipe between the Stats pages ----
      var drag = null;
      var cover = null; // the panel left over the page while its tab opens

      function links() {
        return Array.prototype.slice.call(row.querySelectorAll('li:not(.nav-tabs-arrow) > a'));
      }

      // The tab past this one, that way (-1: previous, 1: next)
      function neighbour(direction) {
        var all = links();
        var current = all.indexOf(row.querySelector('li.active > a'));
        return current === -1 ? null : all[current + direction] || null;
      }

      function setX(el, x, animate) {
        el.style.transition = animate ? 'transform 0.22s ease-out' : 'none';
        el.style.transform = x ? 'translateX(' + x + 'px)' : '';
      }

      // The destination behind the page: its copy, or a placeholder (its
      // icon and name over empty cards) until it has been opened once
      function makePanel(link) {
        var copy = statsCopies.pages[link.getAttribute('ui-sref')];
        var panel = angular.element('<div class="stats-swipe-panel" aria-hidden="true"></div>');
        if (copy) {
          panel.addClass('stats-swipe-panel-copy');
          panel[0].appendChild(copy.cloneNode(true));
        } else {
          panel.html('<div class="stats-swipe-placeholder"><div class="stats-swipe-placeholder-name"></div>' +
            '<div class="stats-swipe-placeholder-card"></div><div class="stats-swipe-placeholder-card"></div>' +
            '<div class="stats-swipe-placeholder-card"></div></div>');
          panel[0].querySelector('.stats-swipe-placeholder-name').innerHTML = link.innerHTML;
          panel.css('min-height', slot.offsetHeight + 'px');
        }
        panel.css('top', slot.offsetTop + 'px');
        shell.append(panel);
        return panel;
      }

      function onTouchStart(e) {
        drag = null;
        if (!isPhone() || e.touches.length !== 1 || cover) return;
        var target = e.target;
        if (target.closest && target.closest(SWIPE_IGNORE)) return;
        if (scrollsSideways(target, slot)) return;
        drag = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now(), mode: null, dx: 0 };
      }

      function onTouchMove(e) {
        if (!drag || drag.mode === 'scroll') return;
        var dx = e.touches[0].clientX - drag.x;
        var dy = e.touches[0].clientY - drag.y;
        if (!drag.mode) {
          if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
          if (Math.abs(dy) > Math.abs(dx)) { drag.mode = 'scroll'; return; }
          drag.mode = 'swipe';
        }
        e.preventDefault();
        var direction = dx < 0 ? 1 : -1;
        if (drag.direction !== direction) {
          drag.direction = direction;
          drag.link = neighbour(direction);
          if (drag.panel) { drag.panel.remove(); drag.panel = null; }
          if (drag.link) drag.panel = makePanel(drag.link);
        }
        var width = slot.offsetWidth;
        // No tab that way: the page only gives a little
        drag.dx = drag.link ? dx : dx * 0.25;
        setX(slot, drag.dx);
        if (drag.panel) setX(drag.panel[0], drag.dx + direction * width);
        placeBar(drag.link ? drag.link.parentNode : row.querySelector('li.active'), false,
          row.querySelector('li.active'), drag.link ? Math.min(1, Math.abs(drag.dx) / width) : 0);
      }

      function onTouchEnd() {
        if (!drag || drag.mode !== 'swipe') { drag = null; return; }
        var d = drag;
        drag = null;
        var width = slot.offsetWidth;
        var fast = Date.now() - d.t < 300 && Math.abs(d.dx) > 40;
        if (d.link && (Math.abs(d.dx) > width * 0.3 || fast)) {
          // Committed: the destination slides in, its tab opens under it
          setX(slot, -d.direction * width, true);
          setX(d.panel[0], 0, true);
          placeBar(d.link.parentNode, true);
          cover = d.panel;
          $timeout(function () { d.link.click(); }, 220, false);
          $timeout(uncover, 4000, false); // in case the new page never comes
        } else {
          setX(slot, 0, true);
          placeBar(row.querySelector('li.active'), true);
          if (d.panel) {
            setX(d.panel[0], d.direction * width, true);
            $timeout(function () { d.panel.remove(); }, 250, false);
          }
        }
      }

      // The new page is in: back in place under the panel, which goes once
      // the page has loaded (no spinner showing), at most 1.5s later
      function uncover() {
        if (!cover) return;
        var panel = cover;
        cover = null;
        panel.addClass('stats-swipe-panel-out');
        $timeout(function () { panel.remove(); }, 160, false);
      }

      function busy() {
        return Array.prototype.some.call(slot.querySelectorAll('.fa-spin'), function (el) {
          return el.offsetParent !== null;
        });
      }

      if (inShell && slot) {
        slot.addEventListener('touchstart', onTouchStart);
        slot.addEventListener('touchmove', onTouchMove, { passive: false });
        slot.addEventListener('touchend', onTouchEnd);
        slot.addEventListener('touchcancel', onTouchEnd);
        var offArrive = $transitions.onSuccess({}, function () {
          if (!cover) return;
          setX(slot, 0);
          var waited = 0;
          (function check() {
            if (!cover) return;
            if (busy() && waited < 1500) { waited += 100; $timeout(check, 100, false); return; }
            $timeout(uncover, 60, false);
          })();
        });
      }

      scope.$on('$destroy', function () {
        angular.element($window).off('resize', update);
        if (phone && phone.removeEventListener) phone.removeEventListener('change', onBreakpoint);
        if (inShell) {
          offStart();
          offSuccess();
        }
        if (inShell && slot) {
          offArrive();
          slot.removeEventListener('touchstart', onTouchStart);
          slot.removeEventListener('touchmove', onTouchMove);
          slot.removeEventListener('touchend', onTouchEnd);
          slot.removeEventListener('touchcancel', onTouchEnd);
          if (cover) cover.remove();
        }
      });
    }
  };
}]);

angular.module('mcrrcApp').directive('raceAchievements', ['UtilsService', function (UtilsService) {
  return {
    restrict: 'E',
    scope: {
      race: '='
    },
    template: '<span>' +
      '<span ng-repeat="ach in achievements" ng-if="ach.emoji" uib-tooltip="{{ach.tooltip}}" tooltip-placement="top" tooltip-trigger="$root.tapTooltipTrigger" tap-tooltip="race_achievement" tooltip-popup-delay="100" tooltip-append-to-body="true">{{ach.emoji}}</span>' +
      '<img ng-repeat="ach in achievements" ng-if="ach.flag" ng-src="{{ach.flag}}" alt="Location flag" class="achievement-flag" uib-tooltip="{{ach.tooltip}}" tooltip-placement="top" tooltip-trigger="$root.tapTooltipTrigger" tap-tooltip="race_achievement" tooltip-popup-delay="100" tooltip-append-to-body="true" onerror="this.style.display=\'none\'">' +
      '<i ng-repeat="ach in achievements" ng-if="ach.icon" ng-class="ach.icon" uib-tooltip="{{ach.tooltip}}" tooltip-placement="top" tooltip-trigger="$root.tapTooltipTrigger" tap-tooltip="race_achievement" tooltip-popup-delay="100" tooltip-append-to-body="true"></i>' +
      '</span>',
    controller: function ($scope) {
      $scope.achievements = [];
      $scope.$watch('race', function (newRace) {
        if (newRace && newRace.results) {
          $scope.achievements = $scope.getAchievements(newRace);
        }
      }, true);

      $scope.getAchievements = function (race) {
        if (!race.results || race.results.length === 0) {
          return [];
        }
        var achievements = [];
        // Trophy for overall or gender win
        var overallWins = race.results.filter(function (result) {
          return result.ranking && (result.ranking.overallrank === 1 || result.ranking.genderrank === 1);
        });
        if (overallWins.length > 0) {
          achievements.push({ type: 'trophy', emoji: '🏆', tooltip: 'Race winner!' });
        }
        // Silver for 2nd place
        var secondPlace = race.results.filter(function (result) {
          return result.ranking && (result.ranking.overallrank === 2 || result.ranking.genderrank === 2);
        });
        if (secondPlace.length > 0) {
          achievements.push({ type: 'second', emoji: '🥈', tooltip: '2nd Place' });
        }
        // Bronze for 3rd place
        var thirdPlace = race.results.filter(function (result) {
          return result.ranking && (result.ranking.overallrank === 3 || result.ranking.genderrank === 3);
        });
        if (thirdPlace.length > 0) {
          achievements.push({ type: 'third', emoji: '🥉', tooltip: '3rd Place' });
        }
        // Personal bests
        var personalBests = race.results.filter(function (result) {
          return Array.isArray(result.achievements) && result.achievements.some(function (a) {
            return a.name && a.name.toLowerCase() === 'pb';
          });
        });
        if (personalBests.length > 0) {
          achievements.push({ type: 'pb', emoji: '🧨', tooltip: 'Personal Best on the team' });
        }
        var teamRecordCount = race.results.reduce(function (count, result) {
          if (!Array.isArray(result.achievements)) return count;
          return count + result.achievements.filter(function (a) {
            return a.name && a.name.toLowerCase() === 'teamrecord';
          }).length;
        }, 0);
        if (teamRecordCount > 0) {
          achievements.push({
            type: 'teamRecords',
            emoji: '🔥',
            tooltip: teamRecordCount === 1 ? 'New team record!' : teamRecordCount + ' new team records!'
          });
        }
        // National class (agegrade >= 90)
        var excellentAgeGrades = race.results.filter(function (result) {
          return result.agegrade && result.agegrade >= 90;
        });
        if (excellentAgeGrades.length > 0) {
          achievements.push({ type: 'nationalClass', icon: 'ageworld fa fa-star', tooltip: 'World Class age grade performance' });
        }

        // New location achievement
        if (race.achievements && race.achievements.some(function (a) {
          return a.name && a.name.toLowerCase() === 'newlocation';
        })) {
          var locationAchievement = race.achievements.find(function (a) {
            return a.name && a.name.toLowerCase() === 'newlocation';
          });

          if (locationAchievement && locationAchievement.value) {
            var locationName = 'this location';
            var flag = '';
            var tooltip = '';

            // Use state flag if available, otherwise country emoji
            if (locationAchievement.value.state) {
              var stateName = UtilsService.getStateNameFromCode(locationAchievement.value.state);
              locationName = stateName;
              flag = UtilsService.getStateFlag(locationAchievement.value.state);
              tooltip = 'First team race in ' + locationName + '!';

              if (flag) {
                achievements.push({
                  type: 'newLocation',
                  flag: flag,
                  tooltip: tooltip
                });
              } else {
                achievements.push({
                  type: 'newLocation',
                  emoji: '🗺️',
                  tooltip: tooltip
                });
              }
            } else if (locationAchievement.value.country) {
              var countryName = UtilsService.getCountryNameFromCode(locationAchievement.value.country);
              locationName = countryName;
              var countryEmoji = UtilsService.getCountryFlag(locationAchievement.value.country);
              tooltip = 'First team race in ' + locationName + '!';

              achievements.push({
                type: 'newLocation',
                emoji: countryEmoji,
                tooltip: tooltip
              });
            } else {
              // Fallback to locationName if provided, otherwise generic message
              if (locationAchievement.value.locationName) {
                locationName = locationAchievement.value.locationName;
              }
              tooltip = 'First team race in ' + locationName + '!';

              achievements.push({
                type: 'newLocation',
                emoji: '🗺️',
                tooltip: tooltip
              });
            }
          } else {
            achievements.push({
              type: 'newLocation',
              emoji: '🗺️',
              tooltip: 'First team race in this location!'
            });
          }
        }
        return achievements;
      };
    }
  };
}]);

// D3 Interactive Pie Chart Directive
app.directive('d3PieChart', function () {
  return {
    restrict: 'E',
    scope: {
      data: '=',
      width: '@',
      height: '@',
      onSliceClick: '&'
    },
    template: '<div class="d3-pie-chart-container" style="display: flex; flex-direction: column; align-items: center; width: 100%;"><div class="d3-pie-svg"></div><div class="d3-pie-legend" style="min-width: 200px; max-width: 400px;"></div></div>',
    link: function (scope, element, attrs) {
      // Check if D3 is available
      if (typeof d3 === 'undefined') {
        console.error('D3 is not loaded');
        return;
      }

      var width = parseInt(scope.width) || 300;
      var height = parseInt(scope.height) || 300;
      var radius = Math.min(width, height) / 2;

      var svg, pie, arc, color;

      function initChart() {
        // Clear existing chart
        element.find('.d3-pie-svg').empty();
        element.find('.d3-pie-legend').empty();

        // Create SVG in left div
        var svgContainer = element.find('.d3-pie-svg')[0];
        if (!svgContainer) {
          console.error('SVG container not found');
          return;
        }

        // The viewBox matches the size (nothing changes on a desktop); on a
        // phone the CSS lets the chart shrink to the card's width
        svg = d3.select(svgContainer)
          .append('svg')
          .attr('width', width)
          .attr('height', height)
          .attr('viewBox', '0 0 ' + width + ' ' + height)
          .style('overflow', 'visible')
          .append('g')
          .attr('transform', 'translate(' + width / 2 + ',' + (height / 2) + ')');

        // Create pie layout
        pie = d3.layout.pie()
          .value(function (d) { return d.count; })
          .sort(null);

        // Create arc generator
        arc = d3.svg.arc()
          .innerRadius(0)
          .outerRadius(radius);

        // Create color scale with more colors to avoid repetition
        color = d3.scale.ordinal()
          .domain(scope.data.map(function (d, i) { return i; }))
          .range([
            '#007bff', '#28a745', '#ffc107', '#fd7e14', '#e83e8c', '#dc3545', '#6f42c1', '#6c757d',
            '#20c997', '#17a2b8', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3',
            '#54a0ff', '#5f27cd', '#00d2d3', '#ff9f43', '#10ac84', '#ee5a24', '#0abde3', '#48dbfb',
            '#2ecc71', '#9b59b6', '#f39c12', '#1abc9c', '#34495e', '#e67e22', '#3498db', '#8e44ad',
            '#16a085', '#c0392b', '#d35400', '#27ae60', '#2980b9', '#f1c40f', '#7f8c8d', '#95a5a6'
          ]);

        return svgContainer; // Return the container for use in updateChart
      }

      function updateChart() {
        if (!scope.data || !scope.data.length) {
          return;
        }

        var svgContainer = initChart();

        // Create tooltip
        var tooltip = d3.select('body').append('div')
          .attr('class', 'd3-tooltip')
          .style('position', 'absolute')
          .style('background', 'rgba(0, 0, 0, 0.8)')
          .style('color', 'white')
          .style('padding', '8px')
          .style('border-radius', '4px')
          .style('font-size', '12px')
          .style('pointer-events', 'none')
          .style('opacity', 0)
          .style('z-index', 1000);

        // Create pie slices
        var pieData = pie(scope.data);

        var slices = svg.selectAll('.slice')
          .data(pieData)
          .enter()
          .append('g')
          .attr('class', 'slice')
          .style('cursor', 'pointer');

        // Add paths for slices
        slices.append('path')
          .attr('d', arc)
          .attr('fill', function (d, i) { return color(i); })
          .attr('stroke', '#fff')
          .attr('stroke-width', 2)
          .style('transition', 'all 0.3s ease')
          .on('mouseover', function (d, i) {
            d3.select(this)
              .attr('transform', 'scale(1.10)') // less aggressive scale
              .style('opacity', 0.85);



            // Highlight corresponding legend item
            legendDiv.selectAll('.legend-item')
              .style('background-color', function (legendData, legendIndex) {
                return legendIndex === i ? 'rgba(0, 123, 255, 0.1)' : 'transparent';
              })
              .style('border-radius', function (legendData, legendIndex) {
                return legendIndex === i ? '4px' : '0px';
              })
              .style('padding', function (legendData, legendIndex) {
                return legendIndex === i ? '2px 4px' : '2px 0';
              });

            tooltip.transition()
              .duration(200)
              .style('opacity', 1);

            tooltip.html(
              '<strong>' + d.data.name + '</strong><br/>' +
              d.data.count + ' races (' + d.data.percentage + '%)'
            )
              .style('left', (d3.event.pageX + 10) + 'px')
              .style('top', (d3.event.pageY - 10) + 'px');
          })
          .on('mouseout', function (d, i) {
            d3.select(this)
              .attr('transform', 'scale(1)')
              .style('opacity', 1);

            // Restore all legend items
            legendDiv.selectAll('.legend-item')
              .style('background-color', 'transparent')
              .style('border-radius', '0px')
              .style('padding', '2px 0');

            tooltip.transition()
              .duration(500)
              .style('opacity', 0);
          })
          .on('click', function (d) {
            if (scope.onSliceClick) {
              scope.$apply(function () {
                scope.onSliceClick({ data: d.data });
              });
            }
          });

        // Add labels
        slices.append('text')
          .attr('transform', function (d) {
            var centroid = arc.centroid(d);
            return 'translate(' + centroid[0] + ',' + centroid[1] + ')';
          })
          .attr('text-anchor', 'middle')
          .attr('dy', '0.35em')
          .style('font-size', '12px')
          .style('font-weight', 'bold')
          .style('fill', 'white')
          .style('text-shadow', '1px 1px 2px rgba(0,0,0,0.8)')
          // .text(function(d) {
          //     return d.data.percentage >= 5 ? d.data.name + '%' : '';
          // })
          ;

        // Render legend as HTML in right div
        var legendContainer = element.find('.d3-pie-legend')[0];

        if (!legendContainer) {
          console.error('Legend container not found');
          return;
        }

        // Calculate required height for legend with wrapping
        var legendItemHeight = 20;
        var legendItemWidth = 120; // Approximate width per legend item
        var legendPadding = 30; // 15px top + 15px bottom
        var legendContainerWidth = 400; // Max width of legend container
        var itemsPerRow = Math.floor(legendContainerWidth / legendItemWidth);
        var numberOfRows = Math.ceil(scope.data.length / itemsPerRow);
        var requiredLegendHeight = (numberOfRows * legendItemHeight) + legendPadding;

        // Use the larger of chart height or legend height
        var finalHeight = Math.max(height, requiredLegendHeight);

        // Update SVG height to match
        var svgElement = d3.select(svgContainer).select('svg');
        svgElement.attr('height', finalHeight).attr('viewBox', '0 0 ' + width + ' ' + finalHeight);

        var legendDiv = d3.select(legendContainer)
          .style('display', 'flex')
          .style('flex-direction', 'row')
          .style('flex-wrap', 'wrap')
          .style('justify-content', 'left')
          .style('align-items', 'flex-start')
          .style('height', requiredLegendHeight + 'px')
          .style('overflow-y', 'visible')
          .style('margin-top', '8px')
          .style('padding', '15px')
          .style('background-color', '#f8f9fa')
          .style('border-radius', '6px')
          .style('border', '1px solid #dee2e6')
          .style('min-height', '120px')
          .style('min-width', '200px')
          .style('max-width', '500px');

        var legendItems = legendDiv.selectAll('.legend-item')
          .data(scope.data)
          .enter()
          .append('div')
          .attr('class', 'legend-item')
          .style('display', 'flex')
          .style('align-items', 'center')
          .style('margin', '4px 0')
          .style('cursor', 'pointer')
          .style('padding', '2px 0')
          .style('transition', 'all 0.2s ease')
          .on('mouseenter', function (d, i) {
            // Highlight corresponding pie slice with same behavior as slice hover
            svg.selectAll('.slice')
              .each(function (sliceData, sliceIndex) {
                if (sliceIndex === i) {
                  // Scale and opacity for hovered slice
                  d3.select(this).select('path')
                    .attr('transform', 'scale(1.10)')
                    .style('opacity', 0.85);
                }
                // else {
                //     // Fade other slices
                //     d3.select(this).select('path')
                //         .attr('transform', 'scale(1)')
                //         .style('opacity', 0.3);
                // }
              });

            // Highlight legend item
            d3.select(this)
              .style('background-color', 'rgba(0, 123, 255, 0.1)')
              .style('border-radius', '4px')
              .style('padding', '2px 4px');
          })
          .on('mouseleave', function (d, i) {
            // Restore all pie slices to normal state
            svg.selectAll('.slice path')
              .attr('transform', 'scale(1)')
              .style('opacity', 1);

            // Restore legend item
            d3.select(this)
              .style('background-color', 'transparent')
              .style('padding', '2px 0');
          })
          .on('click', function (d) {
            if (scope.onSliceClick) {
              scope.$apply(function () {
                scope.onSliceClick({ data: d });
              });
            }
          });

        legendItems.append('span')
          .style('display', 'inline-block')
          .style('width', '14px')
          .style('height', '14px')
          .style('margin-left', '5px')
          .style('background-color', function (d, i) { return color(i); })
          .style('border', '1px solid #fff')
          .style('border-radius', '2px');

        legendItems.append('span')
          .style('font-size', '12px')
          .style('color', 'black')
          .style('font-weight', '500')
          .text(function (d) {
            var displayName = d.name.length > 16 ? d.name.substring(0, 16) + '...' : d.name;
            return displayName + ' (' + d.count + ')';
          });


      }

      // Watch for data changes
      scope.$watch('data', function (newVal, oldVal) {
        if (newVal && newVal.length > 0) {
          updateChart();
        }
      }, true);

      // Cleanup on destroy
      scope.$on('$destroy', function () {
        d3.select('body').selectAll('.d3-tooltip').remove();
      });
    }
  };
});

// Turns the image's build timestamp into a tooltip on the footer version.
//
// BUILD_DATE is stamped into the image in UTC and rendered into index.ejs by
// the server, which has no idea what timezone the reader is in — so the
// conversion has to happen in the browser.
app.directive('buildStamp', function () {
  return {
    restrict: 'A',
    link: function (scope, element, attrs) {
      var built = new Date(attrs.buildStamp);
      if (isNaN(built.getTime())) {
        return;
      }
      element.attr('title', 'built: ' + built.toLocaleString());
    }
  };
});

// Renders achievements in the same feed language the home page uses for "The
// team's latest achievements" — a coloured badge per type beside the sentence
// the achievement already carries.
//
// `entries` is a flat list of achievements, each optionally carrying the
// member who earned it. Both the race page and the single result page build
// that list and hand it over, so the two stay identical to each other and to
// the home feed.
app.directive('achievementFeed', function () {
  // Same badges as the home feed, keyed by the lowercased achievement name
  var BADGES = {
    pb: { icon: '🧨', cls: 'feed-icon-pb', label: 'Personal Best' },
    agegrade: { icon: '🎖️', cls: 'feed-icon-agegrade', label: 'Age Grade' },
    teamrecord: { icon: '🔥', cls: 'feed-icon-teamrecord', label: 'Team Record' },
    birthday: { icon: '🎂', cls: 'feed-icon-birthday', label: 'Raced on their birthday' },
    newlocation: { icon: '📍', cls: 'feed-icon-newlocation', label: 'New location for the team' },
    racecount: { icon: '', cls: 'feed-icon-racecount raceCountBox', label: 'Race Count' }
  };
  var FALLBACK = { icon: '🌟', cls: 'feed-icon-multi', label: 'Achievement' };

  return {
    restrict: 'E',
    scope: {
      entries: '=',
      // Optional: renders a header, the way the home feed has one. Worth it
      // where the list is long enough to need naming, not on a result page
      // showing two badges.
      heading: '@'
    },
    template:
      '<div class="feed-card feed-card-compact achievement-feed" ng-if="rows.length">' +
      '  <div class="feed-card-header" ng-if="heading">' +
      '    <h4><i class="fa fa-trophy"></i> {{heading}} <small>({{rows.length}})</small></h4>' +
      '  </div>' +
      '  <ul class="feed-list">' +
      '    <li class="feed-item" ng-repeat="row in rows">' +
      '      <div class="feed-row">' +
      '        <span class="feed-icon hoverhand {{row.cls}}" uib-tooltip="{{row.label}}" ' +
      '              tooltip-append-to-body="true">{{row.icon}}</span>' +
      '        <div class="feed-body">' +
      '          <div class="feed-text">' +
      '            <b ng-if="row.member"><a ui-sref="/members/member({ member: row.member.username })">' +
      '              {{row.member.firstname}} {{row.member.lastname}}</a></b>' +
      '            {{row.text}}' +
      '          </div>' +
      '        </div>' +
      '      </div>' +
      '    </li>' +
      '  </ul>' +
      '</div>',
    controller: ['$scope', function ($scope) {
      $scope.rows = [];

      function build(entries) {
        // Some races carry the same race-level achievement many times over —
        // one has 465 copies of "First team race in MD!" — so the same
        // achievement for the same person is only ever shown once.
        var seen = {};
        var unique = (entries || []).filter(function (entry) {
          var key = [
            entry.name,
            entry.text,
            entry.member ? entry.member._id : ''
          ].join('|');
          if (seen[key]) return false;
          seen[key] = true;
          return true;
        });

        $scope.rows = unique.map(function (entry) {
          var key = (entry.name || '').toLowerCase();
          var badge = BADGES[key] || FALLBACK;
          // The race-count badge shows the number itself, the way the home
          // feed does, rather than a generic emoji.
          var icon = key === 'racecount' && entry.value ? entry.value.raceCount : badge.icon;
          // A 175th race fills the fixed-width badge edge to edge; the
          // narrower type buys back a margin either side.
          var crowded = key === 'racecount' && String(icon).length > 2;
          return {
            cls: badge.cls + (crowded ? ' feed-icon-racecount-long' : ''),
            label: badge.label,
            icon: icon,
            text: entry.text,
            // Only shown when the sentence does not already name someone —
            // team-record text says what was set, not who set it.
            member: key === 'teamrecord' ? entry.member : null
          };
        });
      }

      $scope.$watch('entries', build);
    }]
  };
});
