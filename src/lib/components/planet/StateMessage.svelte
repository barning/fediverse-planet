<script lang="ts">
	let {
		title,
		message,
		error = false
	}: { title: string; message: string; error?: boolean } = $props();
</script>

<div class:error class="state-message" role={error ? 'alert' : 'status'}>
	<h2>{title}</h2>
	<p>{message}</p>
</div>
