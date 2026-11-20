import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { globSync } from 'glob';
import { minify } from 'terser';

const mode = process.argv[2] || 'dev';

// The library's own minified build for prod, its readable one for dev (clearer
// errors: AngularJS's minified build only links to its error pages). Ours is
// minified without mangling, which leaves an unminified library several times
// the size of its official .min.js.
const pick = base => base + (mode === 'prod' ? '.min.js' : '.js');

// Library files in exact order (matches old Gruntfile concat config)
const libFiles = [
    pick('public/libs/jquery/dist/jquery'),
    pick('public/libs/angular/angular'),
    pick('public/libs/angular-notify/dist/angular-notify'),
    pick('public/libs/angular-loading-bar/build/loading-bar'),
    pick('public/libs/angular-sanitize/angular-sanitize'),
    pick('public/libs/angular-ui-router/release/angular-ui-router'),
    pick('public/libs/angular-ui-select/dist/select'),
    pick('public/libs/lodash/dist/lodash'),
    pick('public/libs/restangular/dist/restangular'),
    'public/libs/angular-utils-pagination/dirPagination.js',
    'public/libs/angular-dialog-service/dist/dialogs.min.js',
    'public/libs/angular-local-storage/dist/angular-local-storage.min.js',
    'public/libs/datamaps/dist/datamaps.all.hires.min.js',
    'public/libs/moment/min/moment.min.js',
    pick('public/libs/nouislider/dist/nouislider'),
    'config/teamRequirements.js',
    'config/locations.js',
    // Shared with the server: pure stats the pages also run on cached data
    'app/raceSeriesStats.js',
    'app/memberRaceCounts.js',
    'app/resultStanding.js', 'app/correctionRequests.js', 'app/resultSubmissions.js',
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
