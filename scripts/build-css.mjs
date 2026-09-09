import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'fs';
import { execSync } from 'child_process';
import CleanCSS from 'clean-css';

mkdirSync('public/dist/css', { recursive: true });

// Step 1: Compile LESS to style.css
// bootswatch.less imports "public/libs/bootstrap/less/bootstrap.less" relative to project root
const bootswatch = execSync('npx lessc --include-path=. public/less/bootstrap/bootswatch.less', { encoding: 'utf8' });
const mcrrc = execSync('npx lessc public/less/mcrrc.less', { encoding: 'utf8' });
writeFileSync('public/dist/css/style.css', bootswatch + '\n' + mcrrc);
console.log('LESS compiled to public/dist/css/style.css');

// Step 2: Concatenate lib CSS + compiled style.css and minify
const cssFiles = [
    'public/libs/fontawesome/css/font-awesome.css',
    'public/css/libs/select2.css',
    'public/css/libs/select2-override.css',
    'public/libs/angular-loading-bar/build/loading-bar.css',
    'public/libs/angular-ui-select/dist/select.css',
    'public/libs/angular-dialog-service/dist/dialogs.min.css',
    'public/libs/angular-notify/dist/angular-notify.css',
    'public/libs/nouislider/dist/nouislider.min.css',
    'public/dist/css/style.css',
];

const combined = cssFiles
    .filter(f => {
        if (!existsSync(f)) {
            console.warn(`  Warning: CSS file not found, skipping: ${f}`);
            return false;
        }
        return true;
    })
    .map(f => readFileSync(f, 'utf8'))
    .join('\n');

const minified = new CleanCSS({ rebase: false }).minify(combined);
if (minified.errors.length > 0) {
    console.error('CSS minification errors:', minified.errors);
    process.exit(1);
}
writeFileSync('public/dist/css/style.min.css', minified.styles);
console.log(`CSS minified to public/dist/css/style.min.css (${Math.round(combined.length / 1024)}KB → ${Math.round(minified.styles.length / 1024)}KB)`);

// Step 3: Copy the hand-written stylesheets for the standalone public pages.
// These are not part of the SPA bundle — applyForm.ejs and compRaceForm.ejs
// load them directly — but they still have to be copied rather than merely
// committed: .dockerignore excludes public/dist from the build context, so
// anything living only in that directory is absent at runtime and every
// request for it falls through to the SPA catch-all, which answers with
// text/html and makes the browser refuse the stylesheet.
const standaloneCss = ['apply-form.css', 'comprace-form.css'];
standaloneCss.forEach(name => {
    copyFileSync(`public/css/${name}`, `public/dist/css/${name}`);
});
console.log(`Copied ${standaloneCss.length} standalone stylesheets to public/dist/css/`);
