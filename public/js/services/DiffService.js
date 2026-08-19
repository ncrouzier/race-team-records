angular.module('mcrrcApp.admin').factory('DiffService', function () {
    var factory = {};

    // Strips HTML tags down to visible text, collapsing whitespace. Kept
    // around for anywhere a plain-text diff is preferable to a formatted one
    // (e.g. the comments field on a comp race form entry).
    factory.stripHtml = function (html) {
        if (!html) return '';
        var div = document.createElement('div');
        div.innerHTML = html;
        return (div.textContent || div.innerText || '').replace(/\s+/g, ' ').trim();
    };

    // Splits on whitespace while keeping the whitespace as its own token, so
    // the diff can preserve original spacing in the equal/added/removed runs.
    function tokenizeWords(text) {
        return (text || '').match(/\S+|\s+/g) || [];
    }

    // Splits HTML into tags (as atomic, indivisible tokens) and words/
    // whitespace in between, so a diff over this stream can move whole tags
    // around without ever splitting one in half.
    function tokenizeHtml(html) {
        return (html || '').match(/<[^>]+>|\s+|[^\s<]+/g) || [];
    }

    // Longest Common Subsequence over two token arrays. Returns an array of
    // {type: 'equal'|'add'|'remove', tokens: [...]} , consecutive tokens of
    // the same type grouped into one segment.
    function diffTokens(a, b) {
        var n = a.length, m = b.length;

        // Guard against pathological input — fall back to a single
        // remove/add pair rather than building a huge DP table.
        if (n * m > 250000) {
            var out = [];
            if (n) out.push({ type: 'remove', tokens: a });
            if (m) out.push({ type: 'add', tokens: b });
            return out;
        }

        var dp = new Array(n + 1);
        var i, j;
        for (i = 0; i <= n; i++) dp[i] = new Array(m + 1).fill(0);
        for (i = n - 1; i >= 0; i--) {
            for (j = m - 1; j >= 0; j--) {
                dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
            }
        }

        var segments = [];
        function push(type, token) {
            var last = segments[segments.length - 1];
            if (last && last.type === type) { last.tokens.push(token); }
            else { segments.push({ type: type, tokens: [token] }); }
        }

        i = 0; j = 0;
        while (i < n && j < m) {
            if (a[i] === b[j]) { push('equal', a[i]); i++; j++; }
            else if (dp[i + 1][j] >= dp[i][j + 1]) { push('remove', a[i]); i++; }
            else { push('add', b[j]); j++; }
        }
        while (i < n) { push('remove', a[i]); i++; }
        while (j < m) { push('add', b[j]); j++; }

        return segments;
    }

    // Plain-text word diff. Returns [{type, text}], for use in a
    // {{ }}-interpolated (non-HTML) view.
    factory.wordDiff = function (oldText, newText) {
        return diffTokens(tokenizeWords(oldText), tokenizeWords(newText)).map(function (seg) {
            return { type: seg.type, text: seg.tokens.join('') };
        });
    };

    // Rich-text diff that keeps the original HTML formatting (bold, links,
    // paragraphs, etc.) intact. Tags are diffed as atomic tokens so they're
    // never split, and unchanged tags simply pass through around whichever
    // text moved. Returns a single HTML string — added text wrapped in
    // .diff-add, removed text in .diff-remove — meant to be rendered with
    // the `unsafe` filter (it's the same trust level as the bio HTML it's
    // built from, which is already rendered elsewhere via ng-bind-html).
    factory.htmlDiff = function (oldHtml, newHtml) {
        return diffTokens(tokenizeHtml(oldHtml), tokenizeHtml(newHtml)).map(function (seg) {
            var html = seg.tokens.join('');
            if (seg.type === 'equal') return html;
            return '<span class="' + (seg.type === 'add' ? 'diff-add' : 'diff-remove') + '">' + html + '</span>';
        }).join('');
    };

    return factory;
});
