<script lang="ts">
	import { asset } from '$app/paths';
	let { url, alt }: { url: string; alt: string } = $props();
	let open = $state(false);
</script>

<details class="media-consent" bind:open>
	<summary>Load image: {alt || 'No description supplied'}</summary>{#if open}<img
			src={url === '/demo-garden.svg' ? asset('demo-garden.svg') : url}
			{alt}
			loading="lazy"
			referrerpolicy="no-referrer"
		/>{/if}
</details>
