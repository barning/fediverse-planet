<script lang="ts">
	let { text, html }: { text: string; html: string } = $props();
	type Part = { text: string; url?: string };
	function linkify(value: string): Part[] {
		const parts: Part[] = [];
		let cursor = 0;
		for (const match of value.matchAll(/https:\/\/[^\s<>]+/g)) {
			const start = match.index;
			if (start > cursor) parts.push({ text: value.slice(cursor, start) });
			let url = match[0];
			const trailing = /[),.!?;:]+$/.exec(url)?.[0] ?? '';
			if (trailing) url = url.slice(0, -trailing.length);
			parts.push({ text: url, url });
			if (trailing) parts.push({ text: trailing });
			cursor = start + match[0].length;
		}
		if (cursor < value.length) parts.push({ text: value.slice(cursor) });
		return parts;
	}
</script>

{#if html}
	<!-- The collector sanitizes this to a small allowlist before it reaches the public dataset. -->
	<div class="post-text rich-text">{@html html}</div>
{:else}
	<div class="post-text">
		{#each linkify(text) as part, index (index)}{#if part.url}<a
					href={part.url}
					target="_blank"
					rel="nofollow noopener noreferrer">{part.text}</a
				>{:else}{part.text}{/if}{/each}
	</div>
{/if}
