# Getting past Cloudflare when scraping results

`/api/extract-table` fetches a results page server-side. Sites behind Cloudflare
often answer a server-side request with **403 Forbidden** no matter what headers
are sent — `mcrrc.org` does this today. No User-Agent or `Sec-Fetch-*` fiddling
gets around it; the block is at the edge, before the origin sees the request.

`fetchPageHtml()` in `app/routes.js` tries, in order:

1. **Direct**, with a secret bypass header if one is configured for that host.
2. **Through the proxy** (`PARKRUN_PROXY_URL`), which requests from a different
   address. Note the deployed proxy only allows parkrun domains, so this does
   not currently help for `mcrrc.org` — its allowlist would need updating.
3. **Through [r.jina.ai](https://r.jina.ai/)**, a public reader service that
   fetches the page from its own servers (`fetchViaJina()`). Tried twice. See
   Option E below.

If all fail the endpoint returns **502** with a message naming what was tried,
rather than a bare 500.

parkrun pages (the parkrun check, and a parkrun address in the extractor) go
through `app/parkrunFetch.js` instead: the proxy first, then **direct** when the
proxy refuses or cannot be reached (an unreachable proxy is skipped for five
minutes). Direct usually works from a home connection, not from the droplet.
r.jina.ai is not tried: parkrun answers it with a "Human Verification" page.

## Option A — WAF custom rule + secret header (recommended)

Needs access to the **mcrrc.org** Cloudflare dashboard.

1. **Generate a token.** Any long random string:

   ```
   openssl rand -hex 32
   ```

2. **Create the rule.** Cloudflare dashboard → the `mcrrc.org` zone →
   **Security → WAF → Custom rules → Create rule**:

   - **Field** `Custom header`, **Name** `X-MCRRC-Scraper`, **Operator**
     `equals`, **Value** the token from step 1.
   - **Action** `Skip`, and tick the components to skip — at minimum
     **Bot Fight Mode / Super Bot Fight Mode**, plus **All remaining custom
     rules** and **Managed rules** if those are what is blocking.
   - Deploy, and put it **above** any rule that would otherwise challenge or
     block the request. Rules evaluate top to bottom.

3. **Configure this app.** On the droplet, in `/opt/mcrrc/.env` (see
   `deploy/env.example`, then `docker compose up -d` to pick it up); locally, in
   `.env`:

   ```
   SCRAPE_BYPASS_HOSTS=mcrrc.org
   SCRAPE_BYPASS_HEADER=X-MCRRC-Scraper
   SCRAPE_BYPASS_TOKEN=<the token from step 1>
   ```

`SCRAPE_BYPASS_HOSTS` is **required** for the token to be sent at all. The
extractor fetches whatever URL an admin types, so the secret is only ever sent to
hosts named here — never to RunSignUp, Athlinks, or anywhere else. A bare domain
also covers its subdomains (`mcrrc.org` matches `www.mcrrc.org`), and lookalikes
such as `evil-mcrrc.org` or `mcrrc.org.attacker.com` do not match. If the site
redirects off an allowlisted host, the header is stripped before the next hop, so
an open redirect cannot leak the token.

## Option B — Cloudflare Access service token

If a host is put behind Cloudflare Zero Trust, issue a service token
(**Zero Trust → Access → Service auth**) and add it to the Access policy, then:

```
SCRAPE_BYPASS_HOSTS=mcrrc.org
CF_ACCESS_CLIENT_ID=<client id>
CF_ACCESS_CLIENT_SECRET=<client secret>
```

Same host scoping applies. Only worth it if the results pages are already behind
Access — putting public pages behind it would break them for everyone else.

Both options can be set at once; whichever headers are configured get sent.

## Option C — IP allowlist

Cloudflare → **Security → WAF → Tools → IP Access Rules**, allow the app
server's egress IP.

On the DigitalOcean droplet (see `doc/DEPLOY.md`) this is a good option: the
droplet has one stable public IP, so a single allow rule covers it and there is
no shared secret to manage. It needs redoing if the droplet is ever rebuilt with
a new IP, and it does not survive a move to a platform with dynamic egress
addresses — on Heroku, dyno IPs are dynamic and shared, so allowlisting one
would effectively allowlist other tenants too. Option A is the more portable of
the two; this one is less setup today.

## Option D — paste the HTML (available now, no Cloudflare change)

The browser can load a page even when the server cannot, so the admin pastes
what it rendered.

In the race edit modal, under **Retrieve results from a link**, click
**Paste the page source instead**, then:

1. Open the results page in a browser.
2. View source (<kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>U</kbd>) and copy all of it.
3. Paste into the box and press **Read pasted source**.

Leave the URL in the link box: it is what picks the per-site column guesses
(`Sex/Tot` → gender rank, and so on) and what gets saved as each result's link.

`POST /api/extract-table` accepts `{ htmlSource }` in place of `{ url }` and runs
the same table parsing, so this works for any site whose results are in an HTML
table, parkrun's included (its event, number and date are read from the page).

## Option E — r.jina.ai (on by default, no setup)

The last fallback. `GET https://r.jina.ai/<url>` with `Accept: application/json`,
`X-Return-Format: html` and `X-No-Cache: true` returns the page's HTML in
`data.html`, with the origin's status in `data.httpStatus`.

- **Hit or miss.** Tested 2026-11-04: it got the real `mcrrc.org` results page
  for some races and Cloudflare's "Just a moment..." challenge for others, and
  the same URL could go either way minutes apart. parkrun answers it with
  "Human Verification". A challenge page can come back as HTTP 200, so
  `isBotChallenge()` checks the page title before accepting it.
- **What is sent:** only the URL, to a third party. Never the bypass headers.
- **Limits:** about 20 requests a minute without a key. Set `JINA_API_KEY` for
  more (sent as `Authorization: Bearer …`).
- **Turn it off** with `SCRAPE_JINA=off`.

When it misses, Option D (paste the source) still works.

## mika:timing sites (Boston, Chicago, Berlin, London marathons)

Not fetched by the server: the sites block nothing, but Boston's robots.txt
disallows every automated client. The "Results → clipboard" bookmark does it
in the admin's browser instead (`mika()` in `public/bookmarklets/results.js`,
read by `app/mika.js`): it searches each team member's last name (the
extractor page writes the team into the bookmark), keeps finishers whose name
could be a member's, and counts the overall, gender and age-group totals
their places are out of. Codes and columns are read from each site
(`getSearchFields`, the list headings), never assumed: Boston's 45-49 is code
9, Chicago's 45; Chicago lists no age-group place, Berlin no gender place.
