# Personal Fediverse Planet — Codex Implementation Brief

**Status:** GitHub Pages architecture · first complete pipeline · **Date:** 2026-10-20<br />
**Working name:** My Planet (temporary; do not spend time on naming)  
**Reference:** https://planetfoss.net/ — use as _conceptual inspiration_, not a visual clone.

## 0. Instructions for Codex

You are implementing an actual product, not just an interface mockup. Read this entire document before coding.

**Operating rules**

1. Inspect the repository first. If it already contains relevant application code, preserve and extend it; do not blindly recreate the project.
2. Implement **one milestone at a time**, in the order below. The original task starts with Milestone 1; the subsequent user request explicitly expands scope to the complete collection/build/deployment pipeline. Implement that scope and keep remaining limitations explicit.
3. Before each milestone, provide a concise execution plan identifying files/modules, risks and verification steps. Do not ask for decisions already specified here.
4. Use current, compatible versions of the selected libraries and their official documentation. Do not assume older Svelte 4 / Tailwind 3 patterns.
5. Make small, reviewable commits or clearly separated changes. Run lint, type-check and relevant tests after each milestone.
6. Create/update a `README.md` with local setup, commands, configuration, architecture and known limitations. Document deliberate trade-offs.
7. When external access is unavailable, use labelled fixtures to validate UI and ingestion; **never present fixtures as live posts** or claim live integration succeeded.
8. Flag any blockers or security/privacy problems explicitly. Prioritize a working end-to-end vertical slice over speculative infrastructure.
9. Avoid unnecessary packages, cloud services, AI, queues, microservices or multiuser authentication.

## 1. Product vision

Build a **personal Fediverse Community Planet**: a public, editorial, content-first website showing posts from a hand-picked set of Mastodon/Fediverse accounts. Think of a personal newspaper for a particular corner of the Fediverse, not a social network, Mastodon client, or generic SaaS dashboard.

It is **highly personalized to one curator at first**. Anyone can visit and read the curator's selection, but only the curator can change sources and preferences. Later, the underlying data model should permit more than one separately configured Planet, without implementing multi-tenancy now.

The product needs:

- **Latest** — chronological posts from curated accounts.
- **Popular** — engaging posts with freshness decay and bias controls.
- **Trending** — posts whose public engagement is increasing unusually quickly.
- **For You** — curator-defined account/topic preferences, not opaque AI personalization.
- **RSS/Atom input** — primarily ingest from public profile feeds; do not operate a Mastodon server.
- **RSS output** — subscribe to the entire Planet; optionally to topics and popular posts later.
- **Source directory** — explain whose voices the reader is seeing.
- **Links to originals** — posts and discussions remain on their original servers.

**Primary user:** the curator, who wants a calmer, useful overview of chosen people, projects and communities, without missing disproportionately interesting conversations.  
**Secondary user:** visitors with overlapping interests.  
**Future user:** another person able to create their own Planet (not part of MVP).

## 2. Principles and non-goals

### Principles

- **RSS-first, API-enriched.** Feeds detect new posts. Mastodon APIs can enrich status metadata and engagement. Keep adapters separate from ingestion and rendering.
- **Human curation before algorithms.** Only approved accounts appear.
- **Explain the ranking.** Display why a post is popular/trending where sensible; expose sorting method and time filters.
- **Small accounts count.** Introduce relative-popularity ranking once sufficient history exists; don't just reward large existing audiences.
- **Real content from the outset.** The design should work with real posts, long text, missing avatars, content warnings, media, and errors.
- **Respect authors and instance communities.** Don't recreate private/protected discussions or bypass discoverability intent.
- **Editorial rather than dashboard aesthetics.** Strong typography, thoughtful post/media layouts, good light/dark modes, responsive and accessible controls.
- **Cheap to self-host.** GitHub Pages serves a fully prerendered site; GitHub Actions performs collection and builds. No database, continuously running server, or paid external service is required.

### Non-goals for MVP

- No social interactions (posting, liking, following, boosting or replying through this site).
- No OAuth with Mastodon, automatic import of a personal following graph, or visitor accounts.
- No content scraping from authenticated feeds or behind instance restrictions.
- No AI summaries, embeddings, LLM ranking or topic clustering.
- No ActivityPub inbox/outbox implementation or followable aggregator account.
- No cross-platform parity promise; support Mastodon well before adding other services.
- No trending across the _entire_ Fediverse; only posts from chosen sources.
- No mobile app or complex real-time streaming infrastructure.

## 3. Technical stack and static architecture (decided)

- **Frontend:** SvelteKit, Svelte 5, TypeScript, Tailwind CSS, shadcn-svelte.
- **Hosting:** GitHub Pages, using `adapter-static`, root `prerender = true`, SSR enabled and `trailingSlash = 'always'`. No SPA fallback or runtime API is required. Keep the configuration compatible with the installed SvelteKit release.
- **Collection:** Node/TypeScript CLI in GitHub Actions, RSS/Atom detection followed by Mastodon public-status verification and API engagement enrichment. Browsers never collect feeds or receive credentials.
- **Persistence:** schema-versioned JSON, not SQLite/PostgreSQL. Curated sources and personal ranking preferences live in reviewed JSON files under `config/`; no public admin or write API.
- **Outputs:** prerendered HTML pages, versioned public JSON datasets, and RSS XML. All pages read one validated dataset at build time; scores use the same recorded `asOf` timestamp.
- **Tooling:** pnpm lockfile, Vitest, Playwright, lint and Svelte/TypeScript checking.

### Collection, state and deployment contract (Milestones 2–5)

Use one orchestrating workflow on scheduled runs (every 30 minutes at minutes 7 and 37), manual dispatch, and pushes to main. Serialize state-writing runs with a shared concurrency group and `cancel-in-progress: false`. Scheduled Actions can be delayed or disabled in inactive repositories; document manual recovery and display data freshness.

1. Check out main and restore the last committed state from a dedicated `planet-data` branch. A missing branch is a documented first-run empty state; an unreadable or invalid existing state is a hard failure, never silently reset.
2. Validate configuration and schema, collect feeds with conditional requests, verify public discoverability, enrich recent posts and append engagement snapshots. Use per-host concurrency limits, bounded response sizes/timeouts, structured logs, retries with jitter, and `Retry-After` compliance. Redact credentials and remote content from error logs. Retain last-known-good data for individual source failures and mark its freshness; total failure must not replace a good publication with empty data.
3. Normalize and deduplicate by canonical URI/URL. Use `schemaVersion`, `generationId`, `asOf`, sources/health, normalized posts and snapshots. Keep null metrics distinct from zero. Compute deterministic Latest, Popular, Trending and curator-configured For You rankings. Preserve the scoring rules in section 8.
4. Prune deterministically: retain posts for 90 days (maximum 10,000, oldest first), hourly snapshots for 7 days, daily aggregates through day 90, run summaries for 30 days, and reviewed source/URL exclusions until the curator explicitly removes them. Preserve first/last samples per aggregate interval and timestamps; never invent trend history. Bound per-post samples. Log pruning counts. Remove opted-out content immediately from public outputs; removed API statuses cannot be republished without renewed public API verification.
5. Build and test against that candidate generation before atomically committing state JSON plus a manifest to `planet-data`. Push without force; a conflicting writer fails safely. This branch is the authoritative durable store, not Actions caches or expiring artifacts. Restrict its contents to public metadata, avoid secrets, and periodically compact old Git history after a recoverable backup (JSON pruning alone does not bound Git history).
6. Upload the exact tested build using official `actions/configure-pages`, `actions/upload-pages-artifact`, then `actions/deploy-pages` in a job with `needs: build`, the `github-pages` environment, `pages: write` and `id-token: write`. Pass data within the run through artifacts/job dependencies. Never rely on a `GITHUB_TOKEN` data-branch commit triggering a second workflow. A deployment failure can retry against the committed generation; log generation IDs for recovery. Pull requests validate fixtures without writing state or deploying.

Use configure-pages outputs for the full public origin and repository base path. All internal links/assets use SvelteKit base-path helpers; RSS links are absolute. Test both `/repository` and empty base paths. For a custom domain configure DNS and HTTPS in Pages settings; use its origin and empty base path. No hard-coded repository name, CNAME requirement for Actions deployments, server secrets, or client-side environment credentials.

### Documentation consulted

- https://svelte.dev/docs/kit/adapter-static (official source: `sveltejs/kit`, `documentation/docs/25-build-and-deploy/50-adapter-static.md`)
- https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow (official source reusable: `data/reusables/actions/actions-do-not-trigger-workflows.md`)
- https://www.shadcn-svelte.com/docs/installation/sveltekit
- https://docs.joinmastodon.org/entities/Status/

During implementation, official SvelteKit and GitHub documentation was consulted via their GitHub source because documentation-site HTTP access returned 403. Verify package compatibility against the installed toolchain.

## 4. User journeys

1. **Read:** Open homepage → choose Latest / Popular / Trending / For You → select time window (24h / 7d / 30d where applicable) → see curated posts → open original post.
2. **Discover:** View `/sources` → see who is included, their server and topics → select a source to see its posts.
3. **Curate:** Edit reviewed `config/sources.json` → add an account by canonical handle (`@person@example.social`) or profile URL → discover/verify feed → preview before approval → set name, categories, importance and inclusion rules → run collection through workflow dispatch.
4. **Tune:** Edit `config/preferences.json` to update preferred topics, account priorities, default ordering, excluded hashtags, languages and boost/reply handling.
5. **Subscribe:** Subscribe to `/feed.xml` in any RSS reader and receive chronological posts with stable GUIDs and links to originals.
6. **Remove:** Curator can disable an account or remove a post; an author can request exclusion via a documented contact route.

## 5. Information architecture and interface

Public routes:

- `/` — personal front page; default For You only after preferences exist, otherwise Popular or Latest. Clearly show active mode.
- `/latest` — chronological, paginated feed.
- `/popular?window=24h|7d|30d` — ranked feed.
- `/trending?window=24h|7d` — ranked by change in engagement.
- `/sources` — curated account directory with status/description.
- `/sources/[slug]` — individual source page.
- `/topics/[slug]` — filtered feed, when topics are configured.
- `/about` — what this Planet is, curation and ranking explanation, how to opt out.
- `/feed.xml` — valid aggregated RSS 2.0 feed; stable canonical URLs and IDs.

Curator operations use repository configuration and Actions logs. No protected web routes or browser credentials. Add `/for-you` for curator preferences. Static time filters operate on precomputed datasets/client state, never request-time server queries.

Component guidance:

- shadcn-svelte: Tabs or navigation, Button, Badge, Avatar, Card where useful, Select, Dropdown Menu, Dialog, Sheet, Input, Switch, Skeleton, Tooltip, Separator, Alert.
- Custom content components: `PostCard`, `PostMedia`, `ContentWarning`, `EngagementSummary`, `FeedToolbar`, `SourceListItem`, `EmptyState`, `RankExplanation`.
- Preserve semantic HTML, correct heading levels, keyboard navigation, accessible labels, reduced motion and WCAG AA color contrast.
- Responsive mobile layout, comfortable reading width, lightweight desktop multi-column presentation where appropriate.
- Use CSS variables/design tokens; keep visual identity distinct from default shadcn styling.
- Do not invent titles for Mastodon posts: most posts have no title. Show author + actual excerpt/content and metadata.
- Show missing data honestly (e.g. `Engagement unavailable`), not fake zero values.
- Provide loading, empty, error and content-warning states.

## 6. Core data model (suggestion, adjust deliberately)

Use schema-versioned JSON and TypeScript types. The entities below describe logical records, not database tables; keep stable keys and timestamps, validate all restored state and provide explicit schema migration functions before changing formats.

**`planets`**

- `id`, `slug`, `title`, `description`, `settings_json`, `created_at`.
- Seed a single initial Planet; no multiuser UI.

**`sources`**

- `id`, `planet_id`, `handle`, `profile_url`, `feed_url`, `platform`, `display_name`, `avatar_url`, `is_approved`, `is_enabled`, `priority_weight`, `default_language`, `last_fetched_at`, `last_success_at`, `last_error`, `etag`, `last_modified`, `created_at`.
- Unique canonical profile URL per Planet. `priority_weight` configurable but bounded.

**`posts`**

- `id`, `canonical_uri` (unique when available), `canonical_url` (fallback unique identity), `author_source_id` (nullable for boosted original), `published_at`, `first_seen_at`, `last_seen_at`, `content_html_sanitized`, `content_text`, `content_warning`, `language`, `visibility`, `is_reply`, `is_boost`, `original_post_id` (nullable), `media_json`, `tags_json`, `deleted_at`, `last_verified_at`.
- Never treat a remote platform-local numerical ID as globally unique.
- If feed items reference boosted original posts, deduplicate on the canonical original post identifier. Preserve enough relation metadata to explain which curated account boosted it.

**`planet_posts`**

- `planet_id`, `post_id`, `discovery_source_id`, `discovered_at`, `is_hidden`.
- This allows a post to be part of multiple future planets, but implement one Planet now.

**`engagement_snapshots`**

- `id`, `post_id`, `observed_at`, `favourites_count`, `boosts_count`, `replies_count`, `source_instance`, `is_complete` / `confidence`.
- Missing metrics are null, never implicitly zero. Keep snapshots for trend computation.

**`topics`** and **`source_topics`** (or simple tags initially)

- Curator-defined themes rather than ML classification.

**`ingestion_runs`** (optional but useful)

- `source_id`, `started_at`, `finished_at`, `status`, `items_seen`, `items_added`, `error_message`.

## 7. Source ingestion and API enrichment

### RSS/Atom flow

1. Curator enters a profile URL or Fediverse handle.
2. Normalize/canonicalize the handle; discover a public feed via linked metadata where possible. Use documented platform conventions only as fallbacks, not universal assumptions.
3. Fetch feed with clear User-Agent/contact details, sensible timeout, conditional `ETag` and `Last-Modified`, and per-host rate limits/backoff. Respect HTTP 429/Retry-After.
4. Parse author, timestamps, canonical URL/URI, content, media and categories. Normalize into platform-agnostic records.
5. Deduplicate, sanitize all untrusted HTML, validate media URLs and store independently of view code.
6. Verify discoverability/visibility before publishing where supported (especially Mastodon); **exclude followers-only, direct, unlisted/quiet-public and ambiguously non-discoverable posts by default**. Never treat mere fetchability as consent to redistribute.
7. Run idempotently. A repeated run must not create duplicates or regress metadata.
8. Allow source disable, retry, and removal. Attempt to detect deleted/edited posts via periodically rechecking recent entries where API support exists; document imperfect guarantees of RSS polling.

**Mastodon adapter:** RSS for detection; Mastodon API for account identity, public status verification and engagement. Mastodon status IDs are local to the server; obtain an actual status ID from the appropriate server, rather than assuming one can be constructed from an RSS URL. Some instances require authentication or disable endpoints; respect this, report enrichment unavailable and keep the feed stable.

**Other Fediverse apps:** Add separate adapters only after verifying their actual feed structure and visibility semantics. RSS-only sources that cannot be confidently vetted must not be automatically syndicated on the public Planet.

**Network security:** protect outbound fetches from SSRF (reject localhost, loopback, link-local and private address ranges even through redirects and DNS rebinding), set response size limits, follow a small redirect budget, enforce HTTPS for remote endpoints unless explicitly justified, and never fetch credentialed content.

## 8. Popularity and trending logic

Do **not** create fake likes or fabricate global counts. On Mastodon, get real `favourites_count`, `reblogs_count`, and `replies_count` from supported status API responses. Counts can differ across instances and may be incomplete, so show their origin and treat values as estimates rather than exhaustive global metrics.

### MVP Popular score (configurable weights)

For posts with usable engagement metadata:

```
engagement = favourites + 3 * boosts + 2 * replies
age_hours = max(0, now - published_at in hours)
popular_score = engagement / pow(age_hours + 2, 1.2)
```

This is an initial heuristic, not a final recommendation model. Default windows: 24 hours, 7 days, 30 days. Rank posts _published within the selected window_, with deterministic tie breaks. Limit repeated appearances by the same account in the first screenful. Do not rank unavailable metrics as if they were verified zeros; optionally put non-enriched posts into a separately marked group or gracefully fall back to Latest.

### MVP Trending score

Collect snapshots regularly for recent posts. Use **positive engagement delta** over an interval (e.g. last 6 hours), with recency decay. A post without enough snapshot history must not claim to be 'trending'; show a suitable cold-start state.

### Relative popularity (next iteration)

Once enough history is collected per source, calculate a robust per-author baseline. Compare each post's engagement to its author's normal engagement at a comparable age. Apply shrinkage toward the global baseline for accounts with few observations; add caps to avoid manipulation and review unexpected outliers. This prevents established accounts from always dominating.

### For You (initially simple and transparent)

Use curator-configured source priorities, preferred topics, excluded tags/languages, and optional popularity. No user profiling, opaque AI or engagement-optimizing infinite scroll. Show an explanation such as 'From a priority source' or 'Matches Open Source'.

### Testing

Unit test recency decay, ties, missing data, negative deltas caused by corrections, cold start, relative-baseline smoothing, repeated boosts, outliers and diversity caps.

## 9. Moderation, privacy and operational constraints

- Respect post visibility, quiet-public intent, content warnings, author opt-outs, takedown requests and instance access restrictions. Only display posts that can be reasonably treated as intended for public discovery.
- Render content warnings collapsed by default and convey relevant media descriptions.
- Sanitize all user-authored HTML; allow safe links only and add `rel="nofollow noopener noreferrer"` as appropriate.
- Avoid proxying/storing original media unless needed; prefer linking/remote display with safeguards and acknowledge privacy implications of third-party media requests.
- Document contact address and removal process before launching publicly.
- Curator authorization uses repository permissions, reviewed configuration changes and protected Actions environments; no web admin or visitor authentication.
- Secure secrets in environment variables; no `.env` committed to git.
- Feed fetching must log failures without crashing the website. Publish sanitized source health and last-success timestamps.
- Apply the JSON retention policy above; back up the state branch and test recovery before production collection.
- No analytics tracker required. If analytics are added later, use privacy-respecting, opt-in/low-data collection.

## 10. Implementation milestones and acceptance criteria

### Milestone 1 — Static foundation and fixture UI

Scope: initialize the current compatible SvelteKit/Svelte 5/TypeScript/Tailwind/shadcn-svelte stack; use adapter-static and full prerendering. Build responsive editorial homepage, Latest, Popular, Trending, For You, Sources and About; reusable post, engagement, content-warning, feed controls and empty/error states; light/dark mode; explicitly labelled local fixtures with long text, media, warnings, unavailable counts and missing avatars. Add JSON curator configuration, fixture JSON/RSS outputs, official Pages deployment workflow, README, lint/type checks and Vitest/Playwright basics. Document future collection boundaries without implementing live ingestion or production ranking.

Acceptance: dev/check/lint/build/tests work; every primary route is generated as HTML and works with direct navigation under root and repository subpaths. RSS/JSON outputs are static and labelled demo. No server/database dependency, private admin, React imports, fabricated live integration or fixture scoring presented as real ranking. Keyboard navigation, visible focus, responsive layout and collapsed CWs are verified. CI builds and deploys the exact validated artifact. Actual publication requires repository Pages settings and a workflow run.

### Milestone 2 — Durable JSON collection and Latest

Implement versioned state schema/migrations, source configuration validation, RSS/Atom detection and Mastodon public-visibility verification, safe fetch/SSRF protection, sanitization, conditional requests, rate limits, idempotent normalization and removal. Integrate scheduled/manual collect → validate → build → state commit → deploy in one workflow. Use curator-supplied accounts only. Generate real Latest, Sources, public JSON and RSS. Test malformed state, bootstrap, duplicates, ETag/304, 429, SSRF/redirects, unsafe HTML, source failures and last-known-good recovery. Repeated runs preserve ranking history and never duplicate posts.

### Milestone 3 — Engagement and ranking history

Implement API enrichment, nullable snapshots, popularity and trending from section 8, configurable windows, deterministic ordering/diversity and cold-start states. Apply retention/aggregation limits. Verify missing counts, negative corrections, decay, ties, sample intervals, per-instance rate limits and pruning/recovery with controlled HTTP fixtures. Display origin, confidence and last refresh.

### Milestone 4 — Personal preferences and curation

Implement For You from JSON account/topic priorities, exclusions and reply/boost rules. Add source/detail/topic routes with enumerated prerender entries and optional topic RSS. Repository configuration handles enable/disable/hide/opt-out; no web admin. Test preferences independently of chronological ordering and validate config errors before publication.

### Milestone 5 — Production hardening

Exercise scheduled workflow, state-branch restoration and compaction backup, failure recovery and exact-generation deployment. Review access controls, log redaction, sanitization, retention, accessibility and mobile/desktop behavior. Validate custom-domain HTTPS and project-subpath deployment, canonical/RSS URLs, freshness and source-health reporting. Document schedule delays, deletion/polling guarantees and partial engagement limitations. No paid service, database or continuously running server required.

## 11. Suggested module organization

```text
config/                     # reviewed sources and personal preferences JSON
src/routes/                 # fully prerendered pages, RSS and JSON endpoints
src/lib/components/ui/      # shadcn-svelte components
src/lib/components/planet/  # post, feed and state components
src/lib/fixtures/           # explicitly labelled Milestone 1 data
src/lib/types/              # normalized public data types
scripts/collection/         # future fetch, adapters, validation, state, scoring
.github/workflows/          # Pages build/deploy; later collection orchestration
```

Collection runs only in Actions or a local CLI. Rendering consumes a validated, immutable dataset. No collection logic or credentials enter client bundles. JSON state on the data branch and public JSON outputs have separate schemas; raw responses and internal diagnostics are never copied into public outputs.

## 12. Definition of success

Success is **not** the number of pages or features. The personal Planet is successful when:

1. The curator can add several real public Fediverse accounts without manually coding each integration.
2. Latest reliably gives a calm reading view of their recent posts.
3. Popular helps uncover worthwhile posts; Trending identifies momentum rather than rewarding old posts.
4. Small accounts can be surfaced, not just dominant ones.
5. RSS readers can subscribe to the aggregated output.
6. It works consistently on mobile and desktop, respects authors' boundaries and can be run inexpensively.
7. The curator genuinely wants to use it as a daily starting page.

## 13. Kickoff prompt

Read this brief in full. The original Milestone 1 task established: a fully prerendered GitHub Pages site with the decided Svelte stack, labelled fixtures, all four feed modes, JSON/RSS outputs, accessible responsive UI, automated checks and the official Pages workflow. The latest user request expands scope to real RSS collection, API metrics, durable JSON snapshots/ranking history and a single scheduled build/deploy workflow. Implement those capabilities without a database or login; report external validation blockers precisely.
