<script lang="ts">
	import type { Post } from '#lib/model.js';
	import PostMedia from './PostMedia.svelte';
	import ContentWarning from './ContentWarning.svelte';
	import EngagementSummary from './EngagementSummary.svelte';
	let {
		post,
		reason,
		score,
		demo = false
	}: { post: Post; reason: string; score: number | null; demo?: boolean } = $props();
</script>

<article class="post-card">
	<header>
		<span class="avatar" aria-hidden="true">{post.author.slice(0, 1).toUpperCase()}</span>
		<div><strong>{post.author}</strong><span class="handle">{post.handle}</span></div>
		<time datetime={post.publishedAt}
			>{new Date(post.publishedAt).toLocaleDateString('en-GB', {
				day: 'numeric',
				month: 'short',
				timeZone: 'UTC'
			})}</time
		>
	</header>
	<ContentWarning warning={post.warning}
		><div class="post-text">{post.text}</div>
		{#each post.media as media (media.url)}<PostMedia
				url={media.url}
				alt={media.alt}
			/>{/each}</ContentWarning
	>
	<div class="tags">
		{#each post.tags as tag (tag)}<span>#{tag}</span>{/each}
	</div>
	<EngagementSummary {post} />
	<div class="post-bottom">
		<small>{score === null ? 'Not enough engagement history for this ranking' : reason}</small
		>{#if !demo}<a href={post.url} target="_blank" rel="nofollow noopener noreferrer"
				>Open original ↗</a
			>{:else}<span class="small-label">DEMO POST</span>{/if}
	</div>
</article>
