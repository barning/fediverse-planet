<script lang="ts">
	import Feed from '#lib/components/planet/Feed.svelte';
	import { demoPosts } from '#lib/fixtures/posts.js';
</script>

<svelte:head><meta name="robots" content="noindex" /></svelte:head><Feed {demoPosts} />
