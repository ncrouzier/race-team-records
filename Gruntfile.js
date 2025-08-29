module.exports = function(grunt) {

    grunt.initConfig({

        // JS TASKS ================================================================
        // check all js files for errors
        jshint: {
            options: {
                smarttabs: true,
                 esversion: 9,
                 sub:true
            },
            all: [
                'public/js/**/*.js',
                '!public/js/libs/*.js',
                '!public/js/custom-libs/angular-bootstrap/ui-bootstrap-tpls.js',
                '!public/js/custom-libs/dexie/dexie.js']
        },

        // take all the js files and minify them into app.min.js
        // terser: {
        //     options: {
        //         mangle: false                
        //     },
        //     build: {
        //         files: {
        //                 'public/dist/js/app.min.js': [
        //                 'public/libs/jquery/dist/jquery.js',
        //                 'public/libs/angular/angular.js',
        //                 'public/libs/angular-notify/dist/angular-notify.js',
        //                 // 'public/js/custom-libs/angular-bootstrap/ui-bootstrap-tpls.js',
        //                 'public/libs/angular-loading-bar/build/loading-bar.js',
        //                 'public/libs/angular-sanitize/angular-sanitize.js',
        //                 'public/libs/angular-ui-router/release/angular-ui-router.js',
        //                 'public/libs/angular-ui-select/dist/select.js',
        //                 'public/libs/lodash/dist/lodash.js',
        //                 'public/libs/restangular/dist/restangular.js',
        //                 'public/libs/angular-utils-pagination/dirPagination.js',
        //                 'public/libs/angular-dialog-service/dist/dialogs.min.js',
        //                 'public/libs/angular-local-storage/dist/angular-local-storage.min.js',
        //                 'public/libs/angulartics/dist/angulartics.min.js',
        //                 'public/libs/angulartics-google-analytics/dist/angulartics-google-analytics.min.js',
        //                 'public/libs/jspdf/dist/jspdf.min.js',
        //                 'public/libs/async/dist/async.min.js',
        //                 'public/libs/datamaps/dist/datamaps.all.hires.min.js',
        //                 'public/libs/moment/min/moment.min.js',
        //                 'public/js/**/*.js',
        //                 'public/js/*.js'
        //             ]
        //         }
        //     }
        // },

        concat: {
            options: {
                stripBanners: true
            },
           
            dist: {
                src: ['public/libs/jquery/dist/jquery.js',
                'public/libs/angular/angular.js',
                'public/libs/angular-notify/dist/angular-notify.js',
                // 'public/js/custom-libs/angular-bootstrap/ui-bootstrap-tpls.js',
                'public/libs/angular-loading-bar/build/loading-bar.js',
                'public/libs/angular-sanitize/angular-sanitize.js',
                'public/libs/angular-ui-router/release/angular-ui-router.js',
                'public/libs/angular-ui-select/dist/select.js',
                'public/libs/lodash/dist/lodash.js',
                'public/libs/restangular/dist/restangular.js',
                'public/libs/angular-utils-pagination/dirPagination.js',
                'public/libs/angular-dialog-service/dist/dialogs.min.js',
                'public/libs/angular-local-storage/dist/angular-local-storage.min.js',
                'public/libs/angulartics/dist/angulartics.min.js',
                'public/libs/angulartics-google-analytics/dist/angulartics-google-analytics.min.js',
                'public/libs/jspdf/dist/jspdf.min.js',
                'public/libs/async/dist/async.min.js',
                'public/libs/datamaps/dist/datamaps.all.hires.min.js',
                'public/libs/moment/min/moment.min.js',
                'public/libs/nouislider/distribute/nouislider.min.js',
                'public/js/**/*.js',
                'public/js/*.js'],
                dest: 'public/dist/js/app.min.js'
            },
            dev: {
                src: ['public/libs/jquery/dist/jquery.js',
                'public/libs/angular/angular.js',
                'public/libs/angular-notify/dist/angular-notify.js',
                // 'public/js/custom-libs/angular-bootstrap/ui-bootstrap-tpls.js',
                'public/libs/angular-loading-bar/build/loading-bar.js',
                'public/libs/angular-sanitize/angular-sanitize.js',
                'public/libs/angular-ui-router/release/angular-ui-router.js',
                'public/libs/angular-ui-select/dist/select.js',
                'public/libs/lodash/dist/lodash.js',
                'public/libs/restangular/dist/restangular.js',
                'public/libs/angular-utils-pagination/dirPagination.js',
                'public/libs/angular-dialog-service/dist/dialogs.min.js',
                'public/libs/angular-local-storage/dist/angular-local-storage.min.js',
                'public/libs/angulartics/dist/angulartics.min.js',
                'public/libs/angulartics-google-analytics/dist/angulartics-google-analytics.min.js',
                'public/libs/jspdf/dist/jspdf.min.js',
                'public/libs/async/dist/async.min.js',
                'public/libs/datamaps/dist/datamaps.all.hires.min.js',
                'public/libs/moment/min/moment.min.js',
                'public/libs/nouislider/distribute/nouislider.min.js',
                'public/js/**/*.js',
                'public/js/*.js'],
                dest: 'public/dist/js/app.js'
            }
        },


        // CSS TASKS ===============================================================
        // process the less file to style.css
        less: {
            build: {
                files: {
                    'public/dist/css/style.css': 'public/less/**/*.less'
                }
            }
        },

        // take the processed style.css file and minify
        cssmin: {
            build: {
                options: {
                    rebase: false,
                    keepSpecialComments: 0
                },
                files: {
                        'public/dist/css/style.min.css': [
                            'public/libs/fontawesome/css/font-awesome.css',
                            'public/libs/nanogallery/dist/css/nanogallery.min.css',
                            'public/libs/nanogallery/dist/css/themes/light/nanogallery_light.woff.min.css',
                            'public/css/libs/select2.css',
                            'public/css/libs/select2-override.css',
                            'public/css/libs/bootstrap.css',
                            'public/libs/angular-loading-bar/build/loading-bar.css',
                            'public/libs/angular-ui-select/dist/select.css',
                            'public/libs/angular-dialog-service/dist/dialogs.min.css',
                            'public/libs/angular-notify/dist/angular-notify.css',
                            'public/libs/nouislider/distribute/nouislider.min.css',
                            'public/dist/css/style.css'
                        ]
                }
            }
        },

        copy: {
            fonts: {
                options: {
                    flatten: true
                },
                files: {
                    'public/dist/fonts/fontawesome-webfont.eot': 'public/libs/fontawesome/fonts/fontawesome-webfont.eot',
                    'public/dist/fonts/fontawesome-webfont.ttf': 'public/libs/fontawesome/fonts/fontawesome-webfont.ttf',
                    'public/dist/fonts/fontawesome-webfont.woff': 'public/libs/fontawesome/fonts/fontawesome-webfont.woff',
                    'public/dist/fonts/fontawesome-webfont.woff2': 'public/libs/fontawesome/fonts/fontawesome-webfont.woff2',
                    'public/dist/font/nano_icon_font3.eot': 'public/libs/nanogallery/dist/css/themes/light/font/nano_icon_font3.eot',
                    'public/dist/font/nano_icon_font3.svg': 'public/libs/nanogallery/dist/css/themes/light/font/nano_icon_font3.svg',
                    'public/dist/font/nano_icon_font3.ttf': 'public/libs/nanogallery/dist/css/themes/light/font/nano_icon_font3.ttf',
                    'public/dist/font/nano_icon_font3.woff': 'public/libs/nanogallery/dist/css/themes/light/font/nano_icon_font3.woff',
                    'public/dist/fonts/glyphicons-halflings-regular.eot': 'public/libs/bootstrap/dist/fonts/glyphicons-halflings-regular.eot',
                    'public/dist/fonts/glyphicons-halflings-regular.ttf': 'public/libs/bootstrap/dist/fonts/glyphicons-halflings-regular.ttf',
                    'public/dist/fonts/glyphicons-halflings-regular.woff': 'public/libs/bootstrap/dist/fonts/glyphicons-halflings-regular.woff',
                    'public/dist/fonts/glyphicons-halflings-regular.woff2': 'public/libs/bootstrap/dist/fonts/glyphicons-halflings-regular.woff2'
                }
            },
            templates: {
                options: {
                    flatten: true
                },
                files: {
                    'public/views/templates/dirPagination.tpl.html': 'public/libs/angular-utils-pagination/dirPagination.tpl.html'
                }
            }
        },

        // COOL TASKS ==============================================================
        // watch css and js files and process the above tasks
        watch: {
            css: {
                files: ['public/less/**/*.less', 'public/css/**/*.css'],
                tasks: ['less', 'cssmin']
            },
            js: {
                files: ['public/js/**/*.js', 'public/js/*.js'],
                tasks: ['jshint', 'concat']
            }
        },

        // watch our node server for changes
        nodemon: {
            dev: {
                script: 'server.js'
            },
            prod: {
                script: 'server.js',
                options: {
                    env: {
                        NODE_ENV: 'production'
                    }
                }
            }
        },

        // run watch and nodemon at the same time
        concurrent: {
            options: {
                logConcurrentOutput: true
            },
            dev: {
                tasks: ['nodemon:dev', 'watch']
            },
            prod: {
                tasks: ['nodemon:prod', 'watch']
            }
        }



    });

    grunt.loadNpmTasks('grunt-contrib-jshint');
    // grunt.loadNpmTasks('grunt-terser');
    grunt.loadNpmTasks('grunt-contrib-less');
    grunt.loadNpmTasks('grunt-contrib-cssmin');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-nodemon');
    grunt.loadNpmTasks('grunt-concurrent');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-concat');

    grunt.registerTask('default', ['less', 'cssmin', 'jshint', 'concat', 'copy', 'concurrent:dev']);
    grunt.registerTask('build', ['less', 'cssmin', 'jshint', 'concat', 'copy']);
    // Add a dev task for non-minified JS
    grunt.registerTask('dev', ['less', 'cssmin', 'jshint', 'concat:dev', 'copy', 'concurrent:dev']);
    grunt.registerTask('prod', ['less', 'cssmin', 'jshint', 'concat', 'copy', 'concurrent:prod']);

    // In your HTML, use:
    // <script src="/dist/js/app.js"></script> <!-- for development -->
    // <script src="/dist/js/app.min.js"></script> <!-- for production -->

};
