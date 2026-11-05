// The square an admin drags over a member's photo to choose their thumbnail
// (PUT /api/members/:id/thumbnail-crop). `crop` is { left, top, size } as
// fractions of the upright photo: left and top of its width and height, size
// of its shorter side, the same units app/profileThumbnails.js crops with.
//
//   <thumb-cropper src="{{member.pictureLink}}" crop="crop"></thumb-cropper>
angular.module('mcrrcApp').directive('thumbCropper', ['$window', function ($window) {
    var MIN_SIZE = 0.1;

    return {
        restrict: 'E',
        scope: {
            src: '@',
            crop: '='
        },
        templateUrl: 'views/directives/thumbCropper.html',
        link: function (scope, element) {
            var img = null;
            var nat = { w: 0, h: 0 };
            scope.state = 'loading';
            scope.MIN_SIZE = MIN_SIZE;

            function view() {
                return { w: img.clientWidth, h: img.clientHeight };
            }

            // Keeps the square whole and inside the photo
            function clamp() {
                var v = view();
                var c = scope.crop;
                var short = Math.min(v.w, v.h);
                c.size = Math.max(MIN_SIZE, Math.min(1, Number(c.size) || MIN_SIZE));
                var side = c.size * short;
                c.left = Math.max(0, Math.min(1 - side / v.w, Number(c.left) || 0));
                c.top = Math.max(0, Math.min(1 - side / v.h, Number(c.top) || 0));
            }

            function render() {
                if (scope.state !== 'ready') return;
                var v = view();
                var side = scope.crop.size * Math.min(v.w, v.h);
                var x = scope.crop.left * v.w;
                var y = scope.crop.top * v.h;
                scope.box = { left: x + 'px', top: y + 'px', width: side + 'px', height: side + 'px' };
                // The photo outside the square, dimmed: four panels around it
                scope.shade = {
                    top: { left: 0, top: 0, width: '100%', height: y + 'px' },
                    bottom: { left: 0, top: (y + side) + 'px', width: '100%', bottom: 0 },
                    left: { left: 0, top: y + 'px', width: x + 'px', height: side + 'px' },
                    right: { left: (x + side) + 'px', top: y + 'px', right: 0, height: side + 'px' }
                };
            }

            // The round preview at a given size: the photo as a background,
            // scaled and shifted so the square fills the circle
            scope.preview = function (px) {
                if (scope.state !== 'ready') return {};
                var scale = px / (scope.crop.size * Math.min(nat.w, nat.h));
                return {
                    width: px + 'px',
                    height: px + 'px',
                    backgroundImage: 'url("' + String(scope.src).replace(/"/g, '%22') + '")',
                    backgroundSize: (nat.w * scale) + 'px ' + (nat.h * scale) + 'px',
                    backgroundPosition: (-scope.crop.left * nat.w * scale) + 'px ' + (-scope.crop.top * nat.h * scale) + 'px'
                };
            };

            scope.onSize = function () {
                clamp();
                render();
            };

            // $applyAsync: a cached photo is already loaded when the template
            // appears, so this can run during a digest as well as after one
            function onLoad() {
                scope.$applyAsync(function () {
                    nat = { w: img.naturalWidth, h: img.naturalHeight };
                    scope.state = 'ready';
                    if (!scope.crop || !isFinite(scope.crop.size)) {
                        // No crop yet: a large square, centred, near the top,
                        // where the face usually is in a portrait
                        var short = Math.min(nat.w, nat.h);
                        var size = 0.8;
                        scope.crop = {
                            left: (1 - size * short / nat.w) / 2,
                            top: nat.h > nat.w ? 0.08 : (1 - size * short / nat.h) / 2,
                            size: size
                        };
                    }
                    clamp();
                    render();
                });
            }

            function onError() {
                scope.$applyAsync(function () { scope.state = 'error'; });
            }

            // Dragging: the square moves, its corner handle resizes it
            var drag = null;

            function pointerDown(event) {
                if (scope.state !== 'ready') return;
                var box = event.target.closest('.tcrop-box');
                if (!box) return;
                event.preventDefault();
                drag = {
                    mode: event.target.classList.contains('tcrop-handle') ? 'resize' : 'move',
                    x: event.clientX,
                    y: event.clientY,
                    left: scope.crop.left,
                    top: scope.crop.top,
                    size: scope.crop.size
                };
                try {
                    box.setPointerCapture(event.pointerId);
                } catch (e) {
                    // an unknown pointer (a synthetic event): the drag still works
                }
            }

            function pointerMove(event) {
                if (!drag) return;
                var v = view();
                var dx = event.clientX - drag.x;
                var dy = event.clientY - drag.y;
                scope.$apply(function () {
                    if (drag.mode === 'move') {
                        scope.crop.left = drag.left + dx / v.w;
                        scope.crop.top = drag.top + dy / v.h;
                    } else {
                        scope.crop.size = drag.size + Math.max(dx, dy) / Math.min(v.w, v.h);
                    }
                    clamp();
                    render();
                });
            }

            function pointerUp() {
                drag = null;
            }

            function onResize() {
                scope.$apply(render);
            }

            // The image is inside the template, which is loaded asynchronously
            scope.$watch(function () { return element[0].querySelector('.tcrop-img'); }, function (found) {
                if (!found || found === img) return;
                img = found;
                img.addEventListener('load', onLoad);
                img.addEventListener('error', onError);
                if (img.complete && img.naturalWidth) onLoad();
            });

            var stage = element[0];
            stage.addEventListener('pointerdown', pointerDown);
            stage.addEventListener('pointermove', pointerMove);
            stage.addEventListener('pointerup', pointerUp);
            stage.addEventListener('pointercancel', pointerUp);
            $window.addEventListener('resize', onResize);

            scope.$on('$destroy', function () {
                stage.removeEventListener('pointerdown', pointerDown);
                stage.removeEventListener('pointermove', pointerMove);
                stage.removeEventListener('pointerup', pointerUp);
                stage.removeEventListener('pointercancel', pointerUp);
                $window.removeEventListener('resize', onResize);
                if (img) {
                    img.removeEventListener('load', onLoad);
                    img.removeEventListener('error', onError);
                }
            });
        }
    };
}]);
