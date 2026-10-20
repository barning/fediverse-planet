<script lang="ts">
	import { sources, state } from '#lib/dataset.js';
	import StateMessage from '#lib/components/planet/StateMessage.svelte';
</script>

<svelte:head><title>Sources · My Planet</title></svelte:head>
<section class="intro">
	<span class="eyebrow">THE VOICES BEHIND THE PLANET</span>
	<h1>Deliberately curated.</h1>
	<p>Only explicitly approved accounts are collected. Follow the links to their home servers.</p>
</section>
{#if !sources.length}<StateMessage
		title="Your reading circle starts here."
		message="Add your first account to config/sources.json. The README explains profile URLs, topics and preferences."
	/>{/if}
<div class="source-grid">
	{#each sources as source (source.id)}{@const health = state.sources.find(
			(s) => s.id === source.id
		)}
		<article class="aside-card">
			<h2><a href={source.profileUrl} rel="noopener noreferrer">{source.id} ↗</a></h2>
			<p>{source.topics.join(' · ')}</p>
			<p>{source.enabled ? 'Enabled' : 'Disabled'}</p>
			<p>Last success: {health?.lastSuccess ?? 'Never'}</p>
			{#if health?.error}<p class="notice">{health.error}</p>{/if}
		</article>{/each}
</div>
