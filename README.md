# My Planet

A personal Fediverse reader for a hand-picked set of accounts.

My Planet collects public Mastodon posts every 30 minutes, enriches them with engagement data, and publishes a fast static site with **Latest** and **Popular** feeds. It runs entirely on GitHub Actions and GitHub Pages—no database, login, paid service, or always-on server required.

## Features

- RSS/Atom collection with Mastodon API enrichment
- Configurable sources, interests, and account weights
- Popularity ranking based on favourites, boosts, replies, and age
- Embedded boosts, quotes, images, and profile pictures
- Public RSS feed and JSON dataset
- Responsive light and dark themes
- Installable PWA with offline access to the last deployed feed
- Versioned collection state on the `planet-data` branch

Built with SvelteKit, TypeScript, Tailwind CSS, and shadcn-svelte.

## Run locally

Requires Node **24** and **pnpm 11.25.0**.

```sh
pnpm install --frozen-lockfile
pnpm collect
pnpm dev
```

Collection uses real public posts from the configured servers. The fictional `/preview/` route is available only as a clearly labelled design preview.

## Choose your sources

Add home-server profile URLs to [`config/sources.json`](config/sources.json):

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

Each source needs a unique lowercase `id`. Use the account's home-server URL, such as `https://mastodon.social/@name`, rather than a remote profile viewer URL.

Edit [`config/preferences.json`](config/preferences.json) to change the site title, description, removal contact, interests, account weights, language filters, exclusions, and ranking weights. Configuration is validated before collection or deployment.

## Deploy to GitHub Pages

1. Push the project to your repository's `main` branch.
2. In **Settings → Pages**, set the source to **GitHub Actions**.
3. In **Settings → Actions → General**, give workflows read and write permission.
4. Allow `github-actions[bot]` to create and update the `planet-data` branch if repository rules restrict writes.
5. Set your removal contact in `config/preferences.json`.
6. Run **Collect, build and deploy Planet** from the Actions tab.

The same workflow collects posts, restores and saves state, tests the site, and deploys the exact tested artifact. It runs at minute 7 and 37 of every hour.

Repository subpaths and custom domains are detected through the official GitHub Pages Actions configuration. No hardcoded domain is required.

## Install on a phone

Open the deployed HTTPS site, then:

- **iPhone/iPad:** Safari → Share → **Add to Home Screen**
- **Android:** Chrome menu → **Install app**

The installed app keeps the most recently deployed interface and feed available offline. Remote post media still needs a connection.

## Useful commands

```sh
pnpm collect        # fetch and enrich configured accounts
pnpm check          # validate data and run TypeScript/Svelte checks
pnpm lint           # run Prettier and ESLint checks
pnpm test:unit      # test collection, ranking, and persistence
pnpm build          # generate the static site, JSON, and RSS
pnpm test:e2e       # test the built site in Chromium
```

Test the GitHub Pages repository path locally with:

```sh
BASE_PATH=/fediverse-planet SITE_URL=https://barning.github.io/fediverse-planet pnpm build
BASE_PATH=/fediverse-planet pnpm test:e2e
```

## Project notes

- Only verified public posts are published.
- Failed source fetches retain the previous successful content and appear in source health data.
- Posts are retained for 90 days; engagement snapshots and ranking history are pruned automatically.
- The workflow persists public state as versioned JSON on `planet-data` without relying on one workflow to trigger another.
- Mastodon servers that require authentication are not supported in the current version.

See [`FEDIVERSE_PLANET_CODEX_BRIEF.md`](FEDIVERSE_PLANET_CODEX_BRIEF.md) for the architecture, ranking model, retention policy, failure handling, and implementation milestones.

The local Button component is adapted from the MIT-licensed shadcn-svelte registry; see [`licenses/shadcn-svelte.md`](licenses/shadcn-svelte.md).
