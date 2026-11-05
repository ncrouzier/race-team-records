// The banner editor's stage: the whole photo, dimmed outside the banner's
// window, with the real title badge and fade over the window. Drag the photo
// to move it, scroll or the slider to zoom, arrow keys to nudge (Shift: more).
// Ported from the offline editor (scripts/banner-editor.html).
//
//   <banner-stage draft="draft" crop="crop" preview-mode="mode" show-title="true"></banner-stage>
//
// `draft` is the server's description of the photo (app/bannerRoutes.js,
// describeDraft): width, height, limits, layout, photoUrl. `crop` is
// { x, y, width } in the photo's pixels: what the banner shows. The limits
// are the server's (clampCrop), so what is framed here is what is saved.
angular.module('mcrrcApp').directive('bannerStage', ['$window', function ($window) {
    var PAD = 0.18; // dimmed context around the window, as a share of its width

    return {
        restrict: 'E',
        scope: {
            draft: '<',
            crop: '=',
            previewMode: '<',
            showTitle: '<'
        },
        templateUrl: 'views/directives/bannerStage.html',
        link: function (scope, element) {
            var root = element[0];
            var stage = root.querySelector('.bstage');
            var photo = root.querySelector('.bstage-photo');
            var win = root.querySelector('.bstage-window');
            var mask = root.querySelector('.bstage-mask');
            var fade = root.querySelector('.bstage-fade');
            var past = root.querySelector('.bstage-past');
            var wideLine = root.querySelector('.bstage-wide-line');
            var winW = 0, winH = 0, pad = 0;
            scope.zoom = { value: 0, label: '' };

            function out() { return scope.draft.layout; }

            function clamp(c) {
                var d = scope.draft, L = d.limits, O = out();
                var width = Math.min(L.maxWidth, Math.max(L.minWidth, c.width));
                var x = Math.min(Math.max(0, d.width - L.reachShare * width), Math.max(0, c.x));
                var y = Math.min(Math.max(0, d.height - width * O.height / O.width), Math.max(0, c.y));
                return { x: x, y: y, width: width };
            }

            function setCrop(c) {
                var next = clamp(c);
                scope.crop.x = next.x;
                scope.crop.y = next.y;
                scope.crop.width = next.width;
                draw();
            }

            function layout() {
                if (!scope.draft || !scope.crop) return;
                var O = out();
                var avail = Math.min(1100, root.clientWidth || 900);
                winW = Math.round(avail / (1 + 2 * PAD));
                // The image's full height at this width: the window shows all
                // of it (narrow screen) or the top part (wide screen)
                var imageH = Math.round(winW * O.height / O.width);
                winH = scope.previewMode === 'wide' ? Math.round(imageH * O.wideVisible) : imageH;
                fade.style.height = imageH + 'px';
                pad = Math.round(winW * PAD);
                stage.style.width = (winW + 2 * pad) + 'px';
                stage.style.height = (winH + 2 * pad) + 'px';
                [win, mask].forEach(function (el) {
                    el.style.left = pad + 'px';
                    el.style.top = pad + 'px';
                    el.style.width = winW + 'px';
                    el.style.height = winH + 'px';
                });
                wideLine.style.top = Math.round(winH * O.wideVisible) + 'px';
                wideLine.style.display = scope.previewMode === 'wide' ? 'none' : '';
                draw();
            }

            function draw() {
                var d = scope.draft, c = scope.crop;
                if (!d || !c || !winW) return;
                var s = winW / c.width; // screen px per photo px
                photo.style.width = (d.width * s) + 'px';
                photo.style.height = (d.height * s) + 'px';
                photo.style.left = (pad - c.x * s) + 'px';
                photo.style.top = (pad - c.y * s) + 'px';
                // The banner is white where the photo ends (past the fade)
                past.style.width = Math.max(0, winW - (d.width - c.x) * s) + 'px';
                var L = d.limits;
                var t = (L.maxWidth - c.width) / Math.max(1, L.maxWidth - L.minWidth);
                scope.zoom.value = Math.round(Math.sqrt(Math.max(0, t)) * 1000);
                scope.zoom.label = '×' + (L.maxWidth / c.width).toFixed(2);
            }

            // Zoom keeping the photo point under (wx, wy) — window px — in place
            function zoomTo(width, wx, wy) {
                var c = scope.crop, L = scope.draft.limits;
                var s = winW / c.width;
                var sx = c.x + wx / s, sy = c.y + wy / s;
                width = Math.min(L.maxWidth, Math.max(L.minWidth, width));
                var s2 = winW / width;
                setCrop({ x: sx - wx / s2, y: sy - wy / s2, width: width });
            }

            scope.onZoomSlider = function () {
                var L = scope.draft.limits;
                var t = Math.pow(scope.zoom.value / 1000, 2);
                zoomTo(L.maxWidth - t * (L.maxWidth - L.minWidth), winW / 2, winH / 2);
            };

            var drag = null;
            stage.addEventListener('pointerdown', function (e) {
                if (!scope.draft) return;
                drag = { x: e.clientX, y: e.clientY, crop: angular.copy(scope.crop) };
                stage.classList.add('is-dragging');
                try { stage.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
            });
            stage.addEventListener('pointermove', function (e) {
                if (!drag) return;
                var s = winW / scope.crop.width;
                scope.$applyAsync(function () {
                    setCrop({ x: drag.crop.x - (e.clientX - drag.x) / s, y: drag.crop.y - (e.clientY - drag.y) / s, width: scope.crop.width });
                });
            });
            ['pointerup', 'pointercancel'].forEach(function (type) {
                stage.addEventListener(type, function () { drag = null; stage.classList.remove('is-dragging'); });
            });
            stage.addEventListener('wheel', function (e) {
                if (!scope.draft) return;
                e.preventDefault();
                var rect = win.getBoundingClientRect();
                var factor = Math.exp(e.deltaY * 0.0015);
                scope.$applyAsync(function () {
                    zoomTo(scope.crop.width * factor, e.clientX - rect.left, e.clientY - rect.top);
                });
            }, { passive: false });

            function onKey(e) {
                if (!scope.draft || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
                var step = (e.shiftKey ? 40 : 8) * scope.crop.width / winW;
                var moves = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
                if (!moves[e.key]) return;
                e.preventDefault();
                scope.$applyAsync(function () {
                    setCrop({ x: scope.crop.x + moves[e.key][0], y: scope.crop.y + moves[e.key][1], width: scope.crop.width });
                });
            }
            $window.document.addEventListener('keydown', onKey);
            $window.addEventListener('resize', layout);
            scope.$on('$destroy', function () {
                $window.document.removeEventListener('keydown', onKey);
                $window.removeEventListener('resize', layout);
            });

            photo.addEventListener('load', layout);
            scope.$watchGroup(['draft', 'previewMode'], function () {
                // After the modal has its size
                setTimeout(function () { scope.$applyAsync(layout); }, 0);
            });
            // A crop set from outside (Reset to automatic)
            scope.$watch('crop', function () { draw(); }, true);
        }
    };
}]);

// Drop a photo on the element, or paste one anywhere while it is on screen:
// calls back with the file. drop-over is set while a file is dragged over.
//
//   <div banner-photo-drop="onFile(file)" drop-over="dropOver"></div>
angular.module('mcrrcApp').directive('bannerPhotoDrop', ['$window', function ($window) {
    return {
        restrict: 'A',
        scope: { onDrop: '&bannerPhotoDrop', dropOver: '=?' },
        link: function (scope, element) {
            var el = element[0];
            var depth = 0;
            function hasFiles(e) {
                return e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') !== -1;
            }
            function give(file) {
                scope.$applyAsync(function () { scope.onDrop({ file: file }); });
            }
            el.addEventListener('dragenter', function (e) {
                if (!hasFiles(e)) return;
                depth++;
                scope.$applyAsync(function () { scope.dropOver = true; });
            });
            el.addEventListener('dragleave', function (e) {
                if (!hasFiles(e)) return;
                if (--depth <= 0) { depth = 0; scope.$applyAsync(function () { scope.dropOver = false; }); }
            });
            el.addEventListener('dragover', function (e) { if (hasFiles(e)) e.preventDefault(); });
            el.addEventListener('drop', function (e) {
                if (!hasFiles(e)) return;
                e.preventDefault();
                depth = 0;
                scope.$applyAsync(function () { scope.dropOver = false; });
                if (e.dataTransfer.files[0]) give(e.dataTransfer.files[0]);
            });
            // A copied picture or a screenshot: it has no name
            function onPaste(e) {
                var items = (e.clipboardData && e.clipboardData.items) || [];
                for (var i = 0; i < items.length; i++) {
                    if (items[i].kind === 'file' && /^image\//.test(items[i].type)) {
                        var file = items[i].getAsFile();
                        if (!file) continue;
                        e.preventDefault();
                        give(file.name && file.name !== 'image.png' ? file : new File([file], 'pasted-photo.' + (file.type.split('/')[1] || 'png'), { type: file.type }));
                        return;
                    }
                }
            }
            $window.document.addEventListener('paste', onPaste);
            scope.$on('$destroy', function () { $window.document.removeEventListener('paste', onPaste); });
        }
    };
}]);
