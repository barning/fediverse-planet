<script lang="ts">
	import type { Post } from '#lib/model.js';
	import Avatar from './Avatar.svelte';
	import PostMedia from './PostMedia.svelte';
	import ContentWarning from './ContentWarning.svelte';
	import EngagementSummary from './EngagementSummary.svelte';
	import EmbeddedPost from './EmbeddedPost.svelte';
	import PostContent from './PostContent.svelte';
	let {
		post,
		reason,
		score,
		demo = false
	}: { post: Post; reason: string; score: number | null; demo?: boolean } = $props();
	let originalUrl = $derived(post.boost && post.embedded ? post.embedded.url : post.url);
</script>

<article class="post-card">
	<header class="post-header">
		<Avatar author={post.author} avatarUrl={post.avatarUrl} profileUrl={post.profileUrl} />
		<div class="post-author">
			{#if post.profileUrl}<a
					href={post.profileUrl}
					target="_blank"
					rel="nofollow noopener noreferrer"><strong>{post.author}</strong></a
				>{:else}<strong>{post.author}</strong>{/if}<span class="handle">{post.handle}</span>
		</div>
		<time datetime={post.publishedAt}
			>{new Date(post.publishedAt).toLocaleDateString('en-GB', {
				day: 'numeric',
				month: 'short',
				timeZone: 'UTC'
			})}</time
		>
	</header>
	{#if post.text || post.html || post.media.length}<ContentWarning warning={post.warning}
			><PostContent text={post.text} html={post.html} />
			{#if post.media.length}<div class:single={post.media.length === 1} class="post-media-grid">
					{#each post.media as media (media.url)}<PostMedia
							url={media.url}
							alt={media.alt}
						/>{/each}
				</div>{/if}</ContentWarning
		>{/if}
	{#if post.embedded}<EmbeddedPost post={post.embedded} />{/if}
	{#if post.tags.length && !post.boost}<div class="tags">
			{#each post.tags as tag (tag)}<span>#{tag}</span>{/each}
		</div>{/if}
	{#if !post.boost}<EngagementSummary {post} />{/if}
	<div class="post-bottom">
		<small>{score === null ? 'Not enough engagement history for this ranking' : reason}</small
		>{#if !demo}<a href={originalUrl} target="_blank" rel="nofollow noopener noreferrer"
				>Open original ↗</a
			>{:else}<span class="small-label">DEMO POST</span>{/if}
	</div>
</article>
