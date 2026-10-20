# My Planet

A personal, curated Fediverse Community Planet built with SvelteKit 3, Svelte 5, TypeScript, Tailwind CSS 4 and a locally owned shadcn-svelte Button. GitHub Pages serves fully prerendered HTML; one GitHub Actions workflow collects RSS/Atom, verifies public Mastodon statuses, records engagement, ranks, builds and deploys every 30 minutes. No database, login, paid service or continuously running production server.

## Run locally

Requires Node **24** and **pnpm 11.25.0** (`packageManager` pins it).

```sh
pnpm install --frozen-lockfile
pnpm collect
pnpm dev
```

`pnpm collect` needs DNS and HTTPS access to configured home servers. It never falls back to fake posts. `data/state.json` starts empty; `/preview/` is an explicitly labelled fictional development preview and is not linked from production navigation. All public feeds use collected data only.

```sh
pnpm check                 # configuration validation + Svelte/TypeScript
pnpm lint                  # Prettier + ESLint
pnpm test:unit             # ranking/collection/safety tests + real Git persistence test
pnpm build                 # generates sanitized JSON, ranks and fully prerenders build/
pnpm exec playwright install --with-deps chromium
pnpm test:e2e              # tests existing build/ on a plain static server
```

Where Chromium is already installed, run `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium pnpm test:e2e`. Tests don't depend on live Fediverse servers. Production collection never uses test responses.

## Publish on GitHub Pages

1. Commit these files and push to **main** in your repository.
2. In **Settings → Pages → Build and deployment**, choose **GitHub Actions**.
3. Enable Actions and allow the workflow's `GITHUB_TOKEN` to write repository contents. Repository rules must permit `github-actions[bot]` to create/update **planet-data**; do not require human PRs for this state branch. Keep main protected as appropriate. The build job requests `contents: write`; the separate deployment job requests `pages: write` and `id-token: write`. PR validation has read-only permissions.
4. Check the **github-pages** environment's deployment protection rules permit main. Set a removal/contact route in `config/preferences.json` before public launch.
5. Run **Actions → Collect, build and deploy Planet → Run workflow**. The workflow must collect real eligible posts, pass checks, commit state, upload its tested build and finish the Pages deployment. Its deployment environment shows the actual public URL.

No PAT or Mastodon token is required for servers permitting public APIs. Authentication-required or unsupported servers are reported as failures; access restrictions are never bypassed. Initial source URLs use the home servers behind your supplied norden.social profile views:

- `https://mastodon.social/@_elena`
- `https://social.tchncs.de/@kaffeeringe`
- `https://mastodon.social/@hagen`

The workflow gets `BASE_PATH` and `SITE_URL` from official `actions/configure-pages` outputs. Project Pages work under `/fediverse-planet`; username Pages and custom domains use an empty base path. For a custom domain, configure the domain, DNS records and HTTPS in Pages settings, then rebuild. No hardcoded domain or CNAME file is required for this Actions deployment.

To test a repository subpath locally:

```sh
BASE_PATH=/fediverse-planet SITE_URL=https://barning.github.io/fediverse-planet pnpm build
BASE_PATH=/fediverse-planet pnpm test:e2e
```

For a custom-domain build, use `BASE_PATH='' SITE_URL=https://your-domain.example pnpm build`. `SITE_URL` is the full public site URL including any repository subpath; it supplies absolute RSS self/site links. Without it, local RSS uses `https://example.invalid` and must not be published as-is. Build artifacts do not require Node at runtime.

## Accounts and preferences

Edit `config/sources.json` through a reviewed commit:

```json
[
	{
		"id": "elena",
		"profileUrl": "https://mastodon.social/@_elena",
		"topics": ["community", "opensource"],
		"enabled": true
	}
]
```

Use a stable, unique lowercase ID and the **home-server** `/@username` profile URL, rather than a remote viewer's `/@user@other-server` URL. The collector uses Mastodon's account lookup API and profile RSS convention. An optional `feedUrl` can override the convention, but must be HTTPS on the same host. Cross-host redirects, credentialed requests and feeds of unverifiable visibility are rejected. Handles and generic RSS-only platforms are not auto-discovered in this version.

`config/preferences.json` configures the title, description, removal contact, `interests` (case-insensitive hashtags or source topics), bounded `accountWeights` (0–5 by source ID), ranking controls, `excludedTags`, `languages` (empty means all), `includeReplies`, and `hiddenUrls` (canonical original URLs). For You uses those preferences for all visitors, with no tracking. Latest remains chronological. Boost **counts** are supported; syndicating boosted original posts is deliberately excluded, regardless of `includeBoosts`, pending original-author provenance support.

The `ranking` object makes the editorial scoring explicit and reviewable:

```json
"ranking": {
	"favouriteWeight": 1,
	"boostWeight": 3,
	"replyWeight": 2,
	"ageOffsetHours": 2,
	"popularDecay": 1.2,
	"trendingWindowHours": 6,
	"trendingDecay": 0.5,
	"trendingMinIntervalMinutes": 30,
	"trendingMaxObservationAgeHours": 2,
	"forYouPopularityWeight": 1,
	"defaultAccountWeight": 1,
	"interestBonus": 3,
	"diversityMaxPerSource": 2,
	"diversityFrontSize": 12
}
```

Engagement weights accept 0–20; decay exponents 0–5; `ageOffsetHours` 0–72 (exclusive of zero); the trending window 1–48 hours; its minimum interval 5–1440 minutes; maximum observation age 0–48 hours (exclusive of zero); For You popularity 0–10; default account weight 0–5; interest bonus 0–20; and diversity values 1–20 posts within a front section of 1–100 posts. Invalid configuration fails validation before collection or deployment. Setting an engagement weight to zero ignores that signal. Setting `forYouPopularityWeight` to zero makes For You depend only on account and interest preferences.

Disable an account with `enabled: false`; hide/remove a post with `hiddenUrls`. Both affect the next build, even if old state still contains the item. Keep exclusions in configuration permanently unless you intend to allow reimport. Source health and latest successful fetch are visible on `/sources/`.

## Collection and ranking

- RSS/Atom detects new URLs; only matching statuses returned by the account's home Mastodon API can enter the dataset. Mastodon local numeric IDs are stored alongside globally canonical URI identities, never used as globally unique IDs.
- Only `visibility: public` posts from the expected account are eligible. Discovery opt-outs, unlisted/private/direct/unknown statuses and boosts are excluded. Existing posts are reverified; API 404/410 removes them. Public output excludes records not verified within 24 hours of the last collection timestamp.
- API counts are nullable; missing data is never presented as zero. By default, Popular uses `(favourites + 3×boosts + 2×replies) / (ageHours + 2)^1.2`. Trending uses nonnegative weighted engagement growth/hour over a configurable interval with age decay and a minimum observation interval. For You combines configurable popularity influence, account weights and interests. All coefficients, timing thresholds and diversity caps come from the validated `ranking` object. Ties are deterministic.
- New detection is bounded to the latest **40** account statuses per run; older stored statuses rotate through **60** additional verifications per account. This is a reader, not an archival backfill crawler. Busy accounts may have posts beyond this boundary missed. Disabled source and hidden-URL filters also run during publication.
- Fetches are sequential with at least 1.1 seconds between requests to a host, 20-second timeouts, a 2 MB decoded response limit, one transient retry with jitter, TLS verification, and no redirects. HTTP 429/503 `Retry-After` is respected in-process and persisted across runs. Source failures produce structured, redacted logs and retain existing content; total failure saves health/backoff but fails the workflow and skips deployment.
- Outbound URLs stay on the curator-approved host. DNS results must all be public; the connection is pinned to a validated IP while retaining hostname/SNI and certificate checking. Private, loopback, link-local and mapped-private IPv6 addresses are blocked, along with unsafe ports and URL credentials. This intentionally uses direct HTTPS on GitHub runners; environments requiring an outbound HTTP proxy may need a supported trusted network route rather than weakening these protections.
- Untrusted HTML is converted to plain text before publication; no raw remote HTML is rendered. Content warnings are collapsed, RSS warning bodies are withheld, images load only after explicit expansion and carry descriptions/referrer protection. No avatars or tracking pixels are fetched automatically.

## State, retention and recovery

`data/state.json` is the bootstrap/local state. In Actions, the authoritative previous generation is restored from **planet-data:state.json**, a dedicated branch containing only versioned public collection state. `scripts/state-git.mjs` uses a separate temporary Git index, so the application checkout and main HEAD stay unchanged.

The production workflow serializes collection/build/deploy, builds and tests a candidate generation, persists it, then deploys the **same artifact** with official Pages actions. It does not depend on a `GITHUB_TOKEN` commit triggering another workflow. State push conflicts fail without force-pushing. PRs validate code and fixtures with read-only credentials and never collect or deploy.

Retention runs on successful collection:

- Posts: 90 days, maximum 10,000, newest retained first.
- Snapshots: first/last per hour for 7 days, first/last per day through day 90; snapshots for removed posts are pruned.
- Ranking history: top 20 IDs/scores per mode per run, retained for 30 days with a 5,760-record cap.
- Total state: a 60 MiB safety ceiling fails collection before replacing state; reduce retained capacity if reached.
- Run summaries: 30 days, maximum 1,500. Per-source errors and `Retry-After` timestamps persist.
- Hidden URLs and disabled accounts remain in reviewed configuration until the curator changes them.

`pnpm validate:data` creates ignored `data/public.json`, stripping internal cache headers, run logs, removed/stale posts and their snapshots/history. Builds read only this publication dataset. `/data.json` exposes normalized posts, health, the active ranking configuration and precomputed rankings for 1/7/30-day windows; `/feed.xml` exposes up to 100 latest eligible posts with stable GUIDs and original links. Ranking uses a shared recorded `asOf` timestamp, not different browser clocks.

JSON pruning does **not** shrink existing Git history. Back up `planet-data` periodically (for example, a Git bundle stored outside the checkout), verify restoration in a disposable clone, and compact its history during a paused schedule if needed. Do not force-push a compacted branch while collection is running. Git history can retain removed public content; removal from the website does not erase historical commits.

A failed fetch leaves the old publication available. A failed deployment after a successful state commit can rerun the workflow against that state. For recovery, disable scheduling temporarily, restore a verified state-branch commit from a backup, validate its schema, dispatch the workflow, and verify generation IDs in logs and `/data.json` before re-enabling scheduling. Invalid or unknown schema versions fail closed and require an explicit migration; a missing state branch is the only automatic bootstrap case.

## Verify automatic updates

The schedule is **minute 7 and 37 of every hour (UTC)**, on the default branch. GitHub may delay runs and can disable schedules in inactive public repositories. Scheduled/manual runs share the same production concurrency group.

After the first deployment, check Actions for successful **scheduled** runs about 30 minutes apart. Compare the `collection_complete` generation/timestamp, the `planet-data` commits and the public `/data.json` `generationId`/`asOf`. `/sources/` should show current last-success times and `/feed.xml` should contain eligible posts. Trending becomes meaningful only after at least two successful observations 30 minutes apart. A quiet account need not publish new posts for generation IDs and observations to advance.

## Current validation and limits

Local type checking, lint, unit/collector tests, Git branch persistence and static browser checks exercise the application without external credentials. During development in this cloud instance, live requests to mastodon.social/social.tchncs.de were denied by DNS/proxy policy. Therefore the committed bootstrap state remains empty: **a live collection and public Pages deployment have not been verified here**. The first GitHub Actions run is required to validate the supplied accounts' current availability and discoverability. Empty or excluded accounts are reported honestly.

There is no relative per-author popularity baseline yet, no generic Fediverse adapter, automatic feed discovery, boost redistribution, authenticated-instance support or topic RSS. Deletion checks are polling-based and bounded; if all future runs fail, the last deployed static site remains until a successful deployment or manual takedown. The README and `/about/` describe count and freshness limits rather than implying exhaustive global metrics.

Architecture and the revised milestone plan are in `FEDIVERSE_PLANET_CODEX_BRIEF.md`. The latest request expands implementation beyond its original Milestone 1 scope.

The Button source is adapted from the official shadcn-svelte registry (MIT); see `licenses/shadcn-svelte.md`. Registry access was blocked, so its official GitHub source was used.
