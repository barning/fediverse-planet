# Personal Fediverse Planet — Codex Implementation Brief

**Status:** Initial product specification · **Date:** 2026-10-20  
**Working name:** My Planet (temporary; do not spend time on naming)  
**Reference:** https://planetfoss.net/ — use as *conceptual inspiration*, not a visual clone.

## 0. Instructions for Codex

You are implementing an actual product, not just an interface mockup. Read this entire document before coding.

**Operating rules**

1. Inspect the repository first. If it already contains relevant application code, preserve and extend it; do not blindly recreate the project.
2. Implement **one milestone at a time**, in the order below. Start with Milestone 1 only. Do not silently implement later milestones.
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
- **Cheap to self-host.** One Node process plus one scheduled worker and SQLite is a sufficient starting target.

### Non-goals for MVP

- No social interactions (posting, liking, following, boosting or replying through this site).
- No OAuth with Mastodon, automatic import of a personal following graph, or visitor accounts.
- No content scraping from authenticated feeds or behind instance restrictions.
- No AI summaries, embeddings, LLM ranking or topic clustering.
- No ActivityPub inbox/outbox implementation or followable aggregator account.
- No cross-platform parity promise; support Mastodon well before adding other services.
- No trending across the *entire* Fediverse; only posts from chosen sources.
- No mobile app or complex real-time streaming infrastructure.

## 3. Technical stack (decided)

- **Frontend:** SvelteKit, Svelte 5, TypeScript.
- **Components:** shadcn-svelte, Tailwind CSS (current supported setup), `@lucide/svelte`.
- **Persistence:** SQLite with Drizzle ORM + migrations; local database file, configurable by environment.
- **Collector:** a Node/TypeScript scheduled worker, callable from CLI and scheduled by cron or a simple timer; do not require Redis.
- **Parsing:** reputable maintained RSS/Atom parser; use feed discovery from the public profile page if possible.
- **Testing:** Vitest for logic/ingestion, Playwright for critical UI paths.
- **Hosting target:** a Dockerized SvelteKit Node adapter app + scheduled worker on a small Linux VPS, behind HTTPS and backups.
- **Package manager:** pnpm.

Use the official SvelteKit/shadcn-svelte setup sequence if starting fresh:

```bash
pnpm dlx sv create my-planet --add tailwindcss
cd my-planet
pnpm dlx shadcn-svelte@latest init
```

Follow the official docs rather than hardcoding obsolete aliases or CSS conventions:
- https://www.shadcn-svelte.com/docs/installation/sveltekit
- https://www.shadcn-svelte.com/docs/cli
- https://docs.joinmastodon.org/user/network/ (syndication feeds)
- https://docs.joinmastodon.org/methods/accounts/ (account statuses)
- https://docs.joinmastodon.org/entities/Status/ (public engagement fields)
- https://docs.joinmastodon.org/user/posting/ (public vs quiet-public visibility)

## 4. User journeys

1. **Read:** Open homepage → choose Latest / Popular / Trending / For You → select time window (24h / 7d / 30d where applicable) → see curated posts → open original post.
2. **Discover:** View `/sources` → see who is included, their server and topics → select a source to see its posts.
3. **Curate:** Protected `/admin` → add an account by canonical handle (`@person@example.social`) or profile URL → discover/verify feed → preview before approval → set name, categories, importance and inclusion rules → fetch now.
4. **Tune:** Update preferred topics, account priorities, default ordering, excluded hashtags, languages and boost/reply handling.
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

Protected routes:

- `/admin` — sources, settings, fetch status, errors. Do not expose credentials or external API secrets to the browser.

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

Use migrations and types. Include timestamps and stable keys, and indexes for common feed lookups.

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
- Missing metrics are NULL, never implicitly zero. Keep snapshots for trend computation.

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

This is an initial heuristic, not a final recommendation model. Default windows: 24 hours, 7 days, 30 days. Rank posts *published within the selected window*, with deterministic tie breaks. Limit repeated appearances by the same account in the first screenful. Do not rank unavailable metrics as if they were verified zeros; optionally put non-enriched posts into a separately marked group or gracefully fall back to Latest.

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
- Authentication: a **single protected admin area**, no public signup. Use a well-vetted session/auth approach or reverse-proxy protection with HTTPS for initial deployment; fail closed in production if it is not configured.
- Secure secrets in environment variables; no `.env` committed to git.
- Feed fetching must log failures without crashing the website. Show source health in admin.
- Add reasonable retention/cleanup and SQLite backup procedures before VPS deployment.
- No analytics tracker required. If analytics are added later, use privacy-respecting, opt-in/low-data collection.

## 10. Implementation milestones and acceptance criteria

### Milestone 1 — Foundation + believable UI (FIRST TASK)

Scope:
- Inspect repo; initialize SvelteKit/Svelte 5/TypeScript/Tailwind/shadcn-svelte if needed.
- Set up clean modular layout and base routes for homepage, Latest, Popular, Trending, Sources, About.
- Create a responsive, editorial app shell; light/dark mode; accessible typography/spacing.
- Build reusable `PostCard`, `EngagementSummary`, `ContentWarning`, feed controls and empty/error states.
- Add clearly labelled **local fixture content only**, including long posts, media, CWs, missing counts and avatar failures.
- Set up Vitest/Playwright basics, lint/type-check scripts and README.
- Document the intended Drizzle schema and backend service boundaries; do not yet implement live ingestion.

Acceptance:
- `pnpm dev`, type-check and build work; tests can run locally.
- All primary routes render, mobile and desktop responsive.
- No component imports from React shadcn or outdated Svelte packages.
- Frontend clearly says fixtures are demo content until live data is connected.
- UI has meaningful keyboard/focus/a11y support and clean loading/empty states.
- Show what was implemented, changed files, verification, and proposed Milestone 2 plan.

### Milestone 2 — Database + ingestion + Latest

Scope:
- SQLite + Drizzle schema/migrations.
- Single Planet seed and a few **curator-supplied** source entries; do not invent real-world curated accounts.
- RSS/Atom parser, discovery, polling, rate limits, idempotent upserts, input hardening and provenance.
- Mastodon public-post eligibility validation; conservative handling when visibility can't be established.
- Public Latest route wired to real stored posts, plus functional `/feed.xml` and `/sources`.
- Simple protected source management and refresh trigger; may use structured configuration temporarily if auth UI would exceed scope.

Acceptance:
- After configuring a supported public Mastodon account and running one documented collection command, actual eligible posts appear.
- Re-fetch doesn't duplicate posts; only eligible publicly discoverable items are published.
- `/feed.xml` validates as a usable RSS feed with stable GUIDs and links.
- Controlled tests use a fixture HTTP server and cover ETag/304, 429, invalid feed, duplicates, SSRF rejection, unsafe HTML and unavailable sources.

### Milestone 3 — API metrics + Popular + Trending

Scope:
- Mastodon account/status adapter for verified engagement counts.
- Snapshot jobs for recent items, observability and missing-data handling.
- Implement documented ranking functions and configurable windows.
- Wire Popular / Trending lists to real database queries.
- Show last refreshed time and ranking explanation.

Acceptance:
- Popular and Trending respond differently on known snapshot fixtures.
- No fabricated metrics; no silent '0' substitution for missing data.
- Trend cold start works; ranking logic covered by unit tests.
- Rate limits and per-instance errors don't bring down the feed.

### Milestone 4 — Personalization + curator controls

Scope:
- Source priorities, topics, excluded languages/tags, boosts/replies rules, For You ranking.
- Source directory/details and account-management UI improvements.
- Single-admin settings and helpful ranking transparency.
- Optional per-topic RSS feeds.

Acceptance:
- Changing priorities/exclusions affects For You but not chronological Latest.
- Administrator can add/disable sources, fetch again, hide a post and understand ingestion failures.
- No visitor login or multi-tenancy.

### Milestone 5 — Production hardening and deployment

Scope:
- Dockerfile / compose, example environment config, scheduled collector, HTTPS reverse-proxy example.
- Health endpoint, error logs, retention, backups, deploy/runbook, uptime and source health visibility.
- Accessibility and responsive QA, content-security review, proper feed metadata and sitemap/SEO basics.

Acceptance:
- Clean deploy to a single VPS, protected admin, scheduled refresh, restart persistence and verified restore instructions.
- No secret material leaked into client bundle, logs or repository.
- README documents known visibility, synchronization and engagement limitations.

## 11. Suggested file/module organization

Use idiomatic SvelteKit conventions; adapt to existing repository structure.

```text
src/
  routes/
    +layout.svelte
    +page.svelte
    latest/+page.svelte
    popular/+page.svelte
    trending/+page.svelte
    sources/+page.svelte
    sources/[slug]/+page.svelte
    topics/[slug]/+page.svelte
    about/+page.svelte
    admin/+page.svelte
    feed.xml/+server.ts
  lib/
    components/
      ui/                       # shadcn-svelte managed
      planet/                   # app-specific components
    server/
      db/                       # Drizzle schema, migrations
      ingestion/                # discovery, parsers, fetch, adapters
      ranking/                  # popularity, trending, personalization
      feeds/                    # outbound RSS
      auth/                     # single-admin only
    types/
    fixtures/
  scripts/
    collect.ts
    seed.ts
```

## 12. Definition of success

Success is **not** the number of pages or features. The personal Planet is successful when:

1. The curator can add several real public Fediverse accounts without manually coding each integration.
2. Latest reliably gives a calm reading view of their recent posts.
3. Popular helps uncover worthwhile posts; Trending identifies momentum rather than rewarding old posts.
4. Small accounts can be surfaced, not just dominant ones.
5. RSS readers can subscribe to the aggregated output.
6. It works consistently on mobile and desktop, respects authors' boundaries and can be run inexpensively.
7. The curator genuinely wants to use it as a daily starting page.

## 13. Copy/paste kickoff prompt for Codex

> Read `FEDIVERSE_PLANET_CODEX_BRIEF.md` in its entirety. We are building a personal, RSS-first Fediverse Community Planet with SvelteKit, shadcn-svelte, SQLite and Drizzle. **Execute Milestone 1 only.** Inspect the existing repo, provide a short implementation plan, and then build a polished, accessible, content-first app shell with the required feed modes and reusable post UI using explicitly labelled local fixtures. Follow current official Svelte 5 and shadcn-svelte documentation. Add type checks, tests and clear setup instructions. Do not yet implement network ingestion or authentication, and do not add multiuser features. Finish by showing changed files, checks run, any limitations, and a proposed Milestone 2 plan. Do not treat mock data as actual posts.