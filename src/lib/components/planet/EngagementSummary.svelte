<script lang="ts">
	import { Heart, Repeat2, MessageCircle } from '@lucide/svelte';
	import type { Post } from '#lib/model.js';
	let { post }: { post: Post } = $props();
</script>

<div class="engagement">
	{#if post.metrics}<span
			><Heart size={14} />{post.metrics.favourites} <span class="sr-only">favourites</span></span
		><span><Repeat2 size={14} />{post.metrics.boosts} <span class="sr-only">boosts</span></span
		><span
			><MessageCircle size={14} />{post.metrics.replies} <span class="sr-only">replies</span></span
		><span class="metric-origin">Observed on {post.instance}</span>{:else}<span
			>Engagement unavailable</span
		>{/if}
</div>
