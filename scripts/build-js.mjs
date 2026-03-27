import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { globSync } from 'glob';
import { minify } from 'terser';

const mode = process.argv[2] || 'dev';

// Library files in exact order (matches old Gruntfile concat config)
const libFiles = [
    'public/libs/jquery/dist/jquery.js',
    'public/libs/angular/angular.js',
    'public/libs/angular-notify/dist/angular-notify.js',
    'public/libs/angular-loading-bar/build/loading-bar.js',
    'public/libs/angular-sanitize/angular-sanitize.js',
    'public/libs/angular-ui-router/release/angular-ui-router.js',
    'public/libs/angular-ui-select/dist/select.js',
    'public/libs/lodash/dist/lodash.js',
    'public/libs/restangular/dist/restangular.js',
    'public/libs/angular-utils-pagination/dirPagination.js',
    'public/libs/angular-dialog-service/dist/dialogs.min.js',
    'public/libs/angular-local-storage/dist/angular-local-storage.min.js',
    'public/libs/jspdf/dist/jspdf.min.js',
    'public/libs/async/dist/async.min.js',
    'public/libs/datamaps/dist/datamaps.all.hires.min.js',
    'public/libs/moment/min/moment.min.js',
    'public/libs/nouislider/dist/nouislider.js',
    'config/teamRequirements.js',
];

// App files via glob (same patterns as old Gruntfile)
const appFiles = globSync(['public/js/**/*.js', 'public/js/*.js']);

// Strip leading banner comments (matches Grunt stripBanners: true)
function stripBanners(content) {
    return content.replace(/^\s*\/\*[\s\S]*?\*\//, '');
}

const allFiles = [...libFiles, ...appFiles];
const output = allFiles
    .map(f => stripBanners(readFileSync(f, 'utf8')))
    .join('\n');

mkdirSync('public/dist/js', { recursive: true });

if (mode === 'prod') {
    console.log(`Concatenated ${allFiles.length} files, minifying...`);
    const result = await minify(output, { mangle: false });
    writeFileSync('public/dist/js/app.min.js', result.code);
    const savings = Math.round((1 - result.code.length / output.length) * 100);
    console.log(`Built public/dist/js/app.min.js (${Math.round(output.length / 1024)}KB → ${Math.round(result.code.length / 1024)}KB, ${savings}% smaller)`);
} else {
    writeFileSync('public/dist/js/app.js', output);
    console.log(`Built public/dist/js/app.js (${allFiles.length} files)`);
}
