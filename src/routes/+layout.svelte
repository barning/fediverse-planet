<script lang="ts">
	import './layout.css';
	import { asset, resolve } from '$app/paths';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { Moon, Sun, Rss, Orbit } from '@lucide/svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { preferences, state as dataset } from '#lib/dataset.js';
	let { children } = $props();
	let dark = $state(false);
	let themeReady = $state(false);
	onMount(() => {
		try {
			dark =
				localStorage.getItem('theme') === 'dark' ||
				(!localStorage.getItem('theme') && matchMedia('(prefers-color-scheme: dark)').matches);
		} catch {
			dark = matchMedia('(prefers-color-scheme: dark)').matches;
		}
		document.documentElement.classList.toggle('dark', dark);
		requestAnimationFrame(() => (themeReady = true));
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
		['/popular', 'Popular'],
		['/latest', 'Latest']
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
	/><link rel="manifest" href={resolve('/manifest.webmanifest')} /><link
		rel="apple-touch-icon"
		sizes="180x180"
		href={asset('icons/apple-touch-icon.png')}
	/><link rel="icon" type="image/png" sizes="32x32" href={asset('icons/favicon-32.png')} /><meta
		name="theme-color"
		content="#f8f7f2"
		media="(prefers-color-scheme: light)"
	/><meta name="theme-color" content="#151d18" media="(prefers-color-scheme: dark)" /><meta
		name="mobile-web-app-capable"
		content="yes"
	/><meta name="apple-mobile-web-app-capable" content="yes" /><meta
		name="apple-mobile-web-app-status-bar-style"
		content="default"
	/><meta name="apple-mobile-web-app-title" content={preferences.title} /></svelte:head
>
<a class="skip" href="#main">Skip to content</a>
<header class="site-header">
	<a class="brand" href={resolve('/')}
		><Orbit size={24} strokeWidth={2.5} aria-hidden="true" />{preferences.title}</a
	>
	<div class="header-actions">
		<a class="utility-link" href={resolve('/sources')}>Sources</a>
		<a class="utility-link header-about" href={resolve('/about')}>About</a>
		<a class="rss-link" href={resolve('/feed.xml')}
			><Rss size={16} strokeWidth={1.5} aria-hidden="true" /> Subscribe</a
		><Button
			variant="ghost"
			size="icon"
			aria-label={dark ? 'Use light theme' : 'Use dark theme'}
			onclick={toggle}
			><span class="theme-icon-stack" class:ready={themeReady} aria-hidden="true">
				<span class="theme-icon" class:active={dark}><Sun size={18} strokeWidth={1.75} /></span>
				<span class="theme-icon" class:active={!dark}><Moon size={18} strokeWidth={1.75} /></span>
			</span></Button
		>
	</div>
</header>
<div class="nav-wrap">
	<nav aria-label="Feed views">
		{#each feedLinks as [slug, label] (slug)}<a
				aria-current={currentPath.endsWith(slug) ||
				(slug === '/popular' && currentPath === homePath)
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
