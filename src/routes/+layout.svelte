<script lang="ts">
	import './layout.css';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { Moon, Sun, Rss, Orbit } from '@lucide/svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { preferences, state as dataset } from '#lib/dataset.js';
	let { children } = $props();
	let dark = $state(false);
	onMount(() => {
		try {
			dark =
				localStorage.getItem('theme') === 'dark' ||
				(!localStorage.getItem('theme') && matchMedia('(prefers-color-scheme: dark)').matches);
		} catch {
			dark = matchMedia('(prefers-color-scheme: dark)').matches;
		}
		document.documentElement.classList.toggle('dark', dark);
	});
	function toggle() {
		dark = !dark;
		document.documentElement.classList.toggle('dark', dark);
		try {
			localStorage.setItem('theme', dark ? 'dark' : 'light');
		} catch {
			/* Storage is optional. */
		}
	}
	const feedLinks = [
		['/latest', 'Latest'],
		['/popular', 'Popular']
	] as const;
	const homePath = resolve('/').replace(/\/$/, '');
	const currentPath = $derived(page.url.pathname.replace(/\/$/, ''));
</script>

<svelte:head
	><title>{preferences.title} · A curated Fediverse</title><meta
		name="description"
		content={preferences.description}
	/><link
		rel="alternate"
		type="application/rss+xml"
		title={preferences.title}
		href={resolve('/feed.xml')}
	/></svelte:head
>
<a class="skip" href="#main">Skip to content</a>
<header class="site-header">
	<a class="brand" href={resolve('/')}><Orbit size={24} />{preferences.title}</a>
	<div class="header-actions">
		<a class="utility-link" href={resolve('/sources')}>Sources</a>
		<a class="utility-link header-about" href={resolve('/about')}>About</a>
		<a class="rss-link" href={resolve('/feed.xml')}><Rss size={16} /> Subscribe</a><Button
			variant="ghost"
			size="icon"
			aria-label={dark ? 'Use light theme' : 'Use dark theme'}
			onclick={toggle}
			>{#if dark}<Sun size={18} />{:else}<Moon size={18} />{/if}</Button
		>
	</div>
</header>
<div class="nav-wrap">
	<nav aria-label="Feed views">
		{#each feedLinks as [slug, label] (slug)}<a
				aria-current={currentPath.endsWith(slug) || (slug === '/latest' && currentPath === homePath)
					? 'page'
					: undefined}
				href={resolve(slug)}>{label}</a
			>{/each}
	</nav>
</div>
<main id="main">{@render children()}</main>
<footer>
	<span>Small voices. A wider world.</span><span
		>{dataset.asOf
			? `Collected ${new Date(dataset.asOf).toUTCString()}`
			: 'Waiting for the first collection'} · <a href={resolve('/about')}>How this works</a></span
	>
</footer>
