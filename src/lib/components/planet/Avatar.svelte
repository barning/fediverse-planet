<script lang="ts">
	let {
		author,
		avatarUrl,
		profileUrl
	}: { author: string; avatarUrl?: string; profileUrl?: string } = $props();
	let failed = $state(false);
</script>

{#snippet picture()}
	{#if avatarUrl && !failed}<img
			src={avatarUrl}
			alt=""
			loading="lazy"
			decoding="async"
			referrerpolicy="no-referrer"
			onerror={() => (failed = true)}
		/>{:else}<span aria-hidden="true">{author.slice(0, 1).toUpperCase()}</span>{/if}
{/snippet}

{#if profileUrl}<a
		class="avatar"
		href={profileUrl}
		target="_blank"
		rel="nofollow noopener noreferrer"
		aria-label={`${author}'s profile`}>{@render picture()}</a
	>{:else}<span class="avatar">{@render picture()}</span>{/if}
