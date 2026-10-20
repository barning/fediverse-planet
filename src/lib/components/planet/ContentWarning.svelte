<script lang="ts">
	import type { Snippet } from 'svelte';
	let { warning, children }: { warning: string; children: Snippet } = $props();
</script>

{#if warning}<details class="content-warning">
		<summary>Content warning: {warning}</summary>{@render children()}
	</details>{:else}{@render children()}{/if}
