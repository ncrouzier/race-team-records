export default [
    {
        files: ['public/js/**/*.js'],
        ignores: [
            'public/js/libs/**',
            'public/js/custom-libs/**'
        ],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'script',
            globals: {
                // Browser
                window: 'readonly',
                document: 'readonly',
                console: 'readonly',
                localStorage: 'readonly',
                navigator: 'readonly',
                location: 'readonly',
                setTimeout: 'readonly',
                setInterval: 'readonly',
                clearTimeout: 'readonly',
                clearInterval: 'readonly',
                alert: 'readonly',
                btoa: 'readonly',
                atob: 'readonly',
                Blob: 'readonly',
                URL: 'readonly',
                Image: 'readonly',
                FileReader: 'readonly',
                FormData: 'readonly',
                // Libraries
                angular: 'readonly',
                $: 'readonly',
                jQuery: 'readonly',
                _: 'readonly',
                moment: 'readonly',
                L: 'readonly',
                Chart: 'readonly',
                Datamap: 'readonly',
                d3: 'readonly',
                topojson: 'readonly',
                noUiSlider: 'readonly',
                tinymce: 'readonly',
                gtag: 'readonly',
                // App globals (defined in app.js / filters.js)
                app: 'writable',
                membersModule: 'writable',
                resultsModule: 'writable',
                toolsModule: 'writable',
                adminModule: 'writable',
                authenticationModule: 'writable',
                secondsToTimeString: 'readonly',
                resultToPace: 'readonly',
                calculateAgeAtDate: 'readonly',
                ordinal_suffix_of: 'readonly',
                inline_ordinal_suffix_of: 'readonly',
                isJson: 'readonly',
                racenameToDistance: 'readonly',
            }
        },
        rules: {
            'no-unused-vars': 'off',
            'no-undef': 'warn',
        }
    }
];
