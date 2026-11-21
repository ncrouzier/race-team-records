// The rich text editor (TinyMCE) on a textarea. TinyMCE is not in the page
// head: the first editor opened loads it (LazyLoad, ~130 KB). Meanwhile the
// textarea stays hidden, so its raw HTML does not flash; it comes back if
// TinyMCE cannot be loaded, so the text can still be edited.
app.directive('appTinymce', ['LazyLoad', function (LazyLoad) {
    return {
        require: 'ngModel',
        restrict: 'A',
        link: function (scope, element, attrs, ngModel) {
            var destroyed = false;
            var config = scope.$eval(attrs.appTinymce) || {};

            var defaultConfig = {
                forced_root_block: false,
                plugins: 'link image lists code',
                toolbar: 'bold italic underline strikethrough | bullist numlist | link image | code | undo redo',
                menubar: false,
                statusbar: false,
                height: 350,
                branding: false,
                base_url: '/libs/tinymce',
                suffix: '.min'
            };

            var configSetup = config.setup;
            delete config.setup;

            var options = angular.extend({}, defaultConfig, config, {
                target: element[0],
                setup: function (editor) {
                    // Register custom Strava button
                    editor.ui.registry.addButton('strava', {
                        tooltip: 'Insert Strava link',
                        icon: 'strava',
                        onAction: function () {
                            editor.windowManager.open({
                                title: 'Strava Profile Link',
                                body: {
                                    type: 'panel',
                                    items: [{ type: 'input', name: 'url', label: 'Strava profile URL' }]
                                },
                                buttons: [
                                    { type: 'cancel', text: 'Cancel' },
                                    { type: 'submit', text: 'Insert', primary: true }
                                ],
                                onSubmit: function (api) {
                                    var url = api.getData().url;
                                    if (url) {
                                        editor.insertContent('<a href="' + url + '" target="_blank"><img src="/images/strava.jpg" alt="Strava" style="height:14px; width:14px; vertical-align:middle;"> Strava</a>');
                                    }
                                    api.close();
                                }
                            });
                        }
                    });

                    // Register custom Garmin button
                    editor.ui.registry.addButton('garmin', {
                        tooltip: 'Insert Garmin link',
                        icon: 'garmin',
                        onAction: function () {
                            editor.windowManager.open({
                                title: 'Garmin Connect Profile Link',
                                body: {
                                    type: 'panel',
                                    items: [{ type: 'input', name: 'url', label: 'Garmin Connect profile URL' }]
                                },
                                buttons: [
                                    { type: 'cancel', text: 'Cancel' },
                                    { type: 'submit', text: 'Insert', primary: true }
                                ],
                                onSubmit: function (api) {
                                    var url = api.getData().url;
                                    if (url) {
                                        editor.insertContent('<a href="' + url + '" target="_blank"><img src="/images/garmin.png" alt="Garmin" style="height:14px; width:14px; vertical-align:middle;"> Garmin</a>');
                                    }
                                    api.close();
                                }
                            });
                        }
                    });

                    // Register custom icons using project images via SVG <image>
                    editor.ui.registry.addIcon('strava', '<svg width="24" height="24" viewBox="0 0 24 24"><image href="/images/strava_icon.jpeg" max-width="24" max-height="24"/></svg>');
                    editor.ui.registry.addIcon('garmin', '<svg width="24" height="24" viewBox="0 0 24 24"><image href="/images/garmin_icon.jpeg" max-width="24" max-height="24"/></svg>');

                    if (configSetup) {
                        configSetup(editor);
                    }

                    editor.on('init', function () {
                        editor.setContent(ngModel.$viewValue || '');
                    });

                    editor.on('change keyup', function () {
                        scope.$apply(function () {
                            ngModel.$setViewValue(editor.getContent());
                        });
                    });
                }
            });

            ngModel.$render = function () {
                var editor = window.tinymce && tinymce.get(element[0].id);
                if (editor) {
                    editor.setContent(ngModel.$viewValue || '');
                }
            };

            // The editor goes next to the textarea, which TinyMCE then hides
            // for good: it only has to show again when no editor comes up
            var textarea = element[0];
            textarea.style.visibility = 'hidden';
            function showTextarea(err) {
                if (err) console.error(err);
                textarea.style.visibility = '';
            }
            LazyLoad.lib('tinymce').then(function () {
                if (destroyed) return;
                return tinymce.init(options).then(function (editors) {
                    if (!editors || !editors.length) showTextarea(new Error('The editor did not start'));
                });
            }).catch(showTextarea);

            scope.$on('$destroy', function () {
                destroyed = true;
                var editor = window.tinymce && tinymce.get(element[0].id);
                if (editor) {
                    editor.remove();
                }
            });
        }
    };
}]);
