<script lang="ts">
	import { resolve } from '$app/paths';
	import { state as dataset, posts, preferences, sources } from '#lib/dataset.js';
	import { rank } from '#lib/ranking.js';
	import type { Mode, Post } from '#lib/model.js';
	import PostCard from './PostCard.svelte';
	import StateMessage from './StateMessage.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	let { mode = 'latest', demoPosts }: { mode?: Mode; demoPosts?: Post[] } = $props();
	let days = $state(7),
		count = $state(20);
	let results = $derived(
		rank(
			demoPosts ?? posts,
			dataset.snapshots,
			preferences,
			mode,
			Date.parse(dataset.asOf ?? (demoPosts ? '2026-10-20T12:00:00Z' : '1970-01-01T00:00:00Z')),
			days,
			Object.fromEntries(sources.map((s) => [s.id, s.topics]))
		)
	);
	let titles = {
		latest: 'The latest, at your pace.',
		popular: 'Conversations worth a look.',
		trending: 'Gathering momentum.',
		'for-you': 'A little closer to your interests.'
	};
</script>

<svelte:head
	><title
		>{mode === 'for-you' ? 'For You' : mode.charAt(0).toUpperCase() + mode.slice(1)} · {preferences.title}</title
	></svelte:head
>
<section class="intro">
	<span class="eyebrow">YOUR CORNER OF THE FEDIVERSE</span>
	<h1>{titles[mode]}</h1>
	<p>{preferences.description}</p>
</section>
{#if demoPosts}<div class="notice">
		Development preview — every post below is a fictional local fixture. No live integration is
		claimed.
	</div>{/if}
<div class="reading-layout">
	<section aria-label="Posts">
		<div class="feed-toolbar">
			<h2>
				{mode === 'for-you' ? 'For You' : mode.charAt(0).toUpperCase() + mode.slice(1)}
				<span>{results.length} posts</span>
			</h2>
			{#if mode !== 'latest'}<label
					>Published within <select bind:value={days} onchange={() => (count = 20)}
						><option value={1}>24 hours</option><option value={7}>7 days</option
						>{#if mode !== 'trending'}<option value={30}>30 days</option>{/if}</select
					></label
				>{/if}
		</div>
		{#if mode === 'popular'}<p class="feed-note">
				{preferences.ranking.favouriteWeight} × favourites +
				{preferences.ranking.boostWeight} × boosts + {preferences.ranking.replyWeight} × replies, with
				freshness decay. Counts are instance estimates.
			</p>{:else if mode === 'trending'}<p class="feed-note">
				Growth over the last {preferences.ranking.trendingWindowHours} hours. Observations must be at
				least {preferences.ranking.trendingMinIntervalMinutes} minutes apart.
			</p>{:else if mode === 'for-you'}<p class="feed-note">
				Popularity, account priority and a {preferences.ranking.interestBonus}-point interest bonus.
				No visitor tracking or personal profiling.
			</p>{/if}
		{#if !results.length}<StateMessage
				title="A quiet corner, for now."
				message={sources.length
					? 'No eligible posts in this view yet. Check source health, collection logs or choose a wider window.'
					: 'The curator has not added accounts yet. Add public Mastodon profile URLs to config/sources.json and run collection.'}
			/>{:else}{#each results.slice(0, count) as item (item.post.id)}<PostCard
					{...item}
					demo={!!demoPosts}
				/>{/each}{#if count < results.length}<Button variant="outline" onclick={() => (count += 20)}
					>Show 20 more posts</Button
				>{/if}{/if}
	</section>
	<aside>
		<div class="aside-card">
			<span class="eyebrow">A PERSONAL PLANET</span>
			<h2>People, not an algorithm.</h2>
			<p>
				A hand-picked collection of voices. Read here, join the conversation on their home server.
			</p>
			<a href={resolve('/sources')}>Meet the sources ↗</a>
		</div>
		<div class="aside-card">
			<h3>Take it with you.</h3>
			<p>Follow this Planet in your favourite feed reader.</p>
			<Button variant="outline" href={resolve('/feed.xml')}>Subscribe via RSS</Button>
		</div>
		<div class="aside-note">
			{dataset.asOf
				? `Last collection: ${new Date(dataset.asOf).toUTCString()}. Updates are scheduled every 30 minutes; GitHub may delay runs.`
				: 'No collection has run yet.'}
		</div>
	</aside>
</div>
