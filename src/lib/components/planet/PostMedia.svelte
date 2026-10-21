<script lang="ts">
	import { asset } from '$app/paths';
	let { url, alt }: { url: string; alt: string } = $props();
	let source = $derived(url === '/demo-garden.svg' ? asset('demo-garden.svg') : url);
</script>

<figure class="post-media">
	<img
		src={source}
		alt={alt || 'Attached image; no description was provided.'}
		loading="lazy"
		decoding="async"
		referrerpolicy="no-referrer"
	/>
</figure>
