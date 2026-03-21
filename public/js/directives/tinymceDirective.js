app.directive('appTinymce', function () {
    return {
        require: 'ngModel',
        restrict: 'A',
        link: function (scope, element, attrs, ngModel) {
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
                var editor = tinymce.get(element[0].id);
                if (editor) {
                    editor.setContent(ngModel.$viewValue || '');
                }
            };

            tinymce.init(options);

            scope.$on('$destroy', function () {
                var editor = tinymce.get(element[0].id);
                if (editor) {
                    editor.remove();
                }
            });
        }
    };
});
