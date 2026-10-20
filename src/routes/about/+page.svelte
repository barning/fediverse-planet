<script lang="ts">
	import { preferences } from '#lib/dataset.js';
</script>

<svelte:head><title>About · {preferences.title}</title></svelte:head>
<section class="intro">
	<span class="eyebrow">LESS NOISE, MORE CONNECTION</span>
	<h1>A small window into a wider world.</h1>
	<p>A personal, curated Fediverse Community Planet.</p>
</section>
<div class="prose">
	<h2>How it works</h2>
	<p>
		Public RSS and Atom feeds identify new posts. Mastodon APIs verify public visibility and provide
		favourites, boosts and replies. GitHub Actions collects and generates this static site every 30
		minutes. Runs may be delayed; the collection timestamp tells you how fresh the data is.
	</p>
	<h2>Reading the rankings</h2>
	<p>
		Latest is chronological. Popular divides weighted engagement ({preferences.ranking
			.favouriteWeight}
		× favourites + {preferences.ranking.boostWeight} × boosts + {preferences.ranking.replyWeight}
		× replies) by (age in hours + {preferences.ranking.ageOffsetHours}) to the power of
		{preferences.ranking.popularDecay}. Trending measures positive engagement growth per hour across
		the last {preferences.ranking.trendingWindowHours} hours, with age decay. No history means no trend
		claim. Ranked views limit any account to {preferences.ranking.diversityMaxPerSource}
		posts in the first {preferences.ranking.diversityFrontSize} where alternatives exist.
	</p>
	<p>
		For You combines Popular at {preferences.ranking.forYouPopularityWeight}×, curator account
		weights and a {preferences.ranking.interestBonus}-point topic-interest bonus. These settings are
		the same for every visitor. Counts reflect what one server knows, not exhaustive global totals.
		Missing information stays unavailable.
	</p>
	<h2>Authors stay in control</h2>
	<p>
		Only verified public, discoverable Mastodon posts are published. Private, unlisted and unknown
		visibility is excluded. Content warnings remain collapsed; remote images load only when opened.
		Original discussions stay on their home servers. Disabling a source or hiding a URL removes it
		on the next build.
	</p>
	<h2>Privacy and removal</h2>
	<p>
		No login, tracking or visitor profiling. Opening an original post or loading an image contacts
		its remote server. Polling cannot guarantee immediate detection of edits or deletions; recent
		posts are reverified each run and expired verification is removed.
	</p>
	{#if preferences.contact}<p>Request exclusion or removal: {preferences.contact}</p>{:else}<p
			class="notice"
		>
			The curator has not configured a removal contact yet. Set contact in config/preferences.json
			before public launch.
		</p>{/if}
	<h2>Open and inexpensive</h2>
	<p>
		Hosted on GitHub Pages. Reviewed JSON files configure accounts and interests. Versioned JSON on
		a dedicated data branch preserves observations between runs. No database or continuously running
		server.
	</p>
</div>
