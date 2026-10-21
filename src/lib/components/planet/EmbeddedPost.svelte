<script lang="ts">
	import { ExternalLink, Quote, Repeat2 } from '@lucide/svelte';
	import type { EmbeddedPost } from '#lib/model.js';
	import Avatar from './Avatar.svelte';
	import ContentWarning from './ContentWarning.svelte';
	import EngagementSummary from './EngagementSummary.svelte';
	import PostContent from './PostContent.svelte';
	import PostMedia from './PostMedia.svelte';
	let { post }: { post: EmbeddedPost } = $props();
</script>

<div class="embed-label">
	{#if post.type === 'boost'}<Repeat2 size={14} /> Reposted{:else}<Quote size={14} /> Quoted post{/if}
</div>
<article class="embedded-post">
	<header class="embedded-header">
		<Avatar author={post.author} avatarUrl={post.avatarUrl} profileUrl={post.profileUrl} />
		<div class="post-author">
			<a href={post.profileUrl} target="_blank" rel="nofollow noopener noreferrer"
				><strong>{post.author}</strong></a
			><span class="handle">{post.handle}</span>
		</div>
		<time datetime={post.publishedAt}
			>{new Date(post.publishedAt).toLocaleDateString('en-GB', {
				day: 'numeric',
				month: 'short',
				timeZone: 'UTC'
			})}</time
		>
	</header>
	<ContentWarning warning={post.warning}
		><PostContent text={post.text} html={post.html} />
		{#each post.media as media (media.url)}<PostMedia
				url={media.url}
				alt={media.alt}
			/>{/each}</ContentWarning
	>
	{#if post.tags.length}<div class="tags embedded-tags">
			{#each post.tags as tag (tag)}<span>#{tag}</span>{/each}
		</div>{/if}
	<EngagementSummary {post} />
	<a class="embedded-original" href={post.url} target="_blank" rel="nofollow noopener noreferrer"
		>Open original <ExternalLink size={12} aria-hidden="true" /></a
	>
</article>
