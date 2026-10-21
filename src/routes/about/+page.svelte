<script lang="ts">
	import { preferences } from '#lib/dataset.js';
</script>

<svelte:head><title>About · {preferences.title}</title></svelte:head>
<section class="intro">
	<span class="eyebrow">ABOUT THIS PLANET</span>
	<h1>A quieter way to follow the Fediverse.</h1>
	<p>One curated feed, built from public posts by people worth following.</p>
</section>
<div class="prose">
	<h2>What you are reading</h2>
	<p>
		This is a personal selection of public Fediverse accounts. Latest puts their posts in time
		order. Popular highlights posts that are receiving thoughtful attention. Reposts and referenced
		posts keep the original author, text, images, and link visible.
	</p>
	<h2>How Popular works</h2>
	<p>
		Favourites count once, boosts count {preferences.ranking.boostWeight} times, and replies count
		{preferences.ranking.replyWeight} times. Newer posts receive a modest advantage, and no account can
		occupy more than {preferences.ranking.diversityMaxPerSource} places near the top when other voices
		are available.
	</p>
	<p>
		Engagement counts are estimates from each account's server. Large accounts still have an
		advantage because they reach more people. A future ranking update will soften that effect while
		keeping real, sustained engagement meaningful.
	</p>
	<h2>Where the posts come from</h2>
	<p>
		RSS and Atom feeds find new posts. Mastodon APIs then confirm that a post is public and provide
		its engagement, author, images, and conversation context. The site refreshes about every 30
		minutes, although GitHub may occasionally delay a run. The timestamp at the bottom shows the
		latest completed collection.
	</p>
	<h2>Respecting authors and readers</h2>
	<p>
		Private and unlisted posts never appear here. Content warnings stay closed until you open them.
		Each post links back to its home server, where the conversation belongs. Recently collected
		posts are checked again for edits and deletions.
	</p>
	<p>
		There is no login, advertising, analytics, or visitor profiling. Avatars and post images come
		from their public media servers, so those servers receive a request when an image becomes
		visible.
	</p>
	{#if preferences.contact}<p>
			To request exclusion or removal, contact {preferences.contact}.
		</p>{:else}<p class="notice">A removal contact has not been configured yet.</p>{/if}
	<h2>Built to stay small</h2>
	<p>
		The project is open source and hosted on GitHub Pages. A scheduled workflow collects posts,
		builds the static site, and saves its history as versioned JSON. It needs no database, paid
		service, or always-on server.
	</p>
</div>
