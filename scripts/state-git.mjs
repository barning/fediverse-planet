// Restore/commit only versioned public state, without changing the application checkout.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
/** @param {...string} args */
const git = (...args) =>
	execFileSync('git', args, {
		encoding: 'utf8',
		maxBuffer: 64 * 1024 * 1024,
		stdio: ['ignore', 'pipe', 'pipe']
	}).trim();
const parentFile = git('rev-parse', '--git-path', 'planet-data-parent');
if (process.argv[2] === 'restore') {
	let remote;
	try {
		remote = git('ls-remote', '--exit-code', '--heads', 'origin', 'refs/heads/planet-data');
	} catch (e) {
		if (!(e instanceof Error) || !('status' in e) || e.status !== 2) throw e;
		remote = '';
	}
	if (remote) {
		git('fetch', '--depth=1', '--no-tags', 'origin', 'refs/heads/planet-data');
		const parent = git('rev-parse', 'FETCH_HEAD');
		const state = git('show', `${parent}:state.json`);
		const parsed = JSON.parse(state);
		if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.posts))
			throw new Error('Unrecognized persisted state; explicit migration required');
		writeFileSync('data/state.json', state + '\n');
		writeFileSync(parentFile, parent);
	} else {
		if (existsSync(parentFile)) rmSync(parentFile);
		console.log('First collection: planet-data branch does not exist.');
	}
} else if (process.argv[2] === 'commit') {
	const parent = existsSync(parentFile) ? readFileSync(parentFile, 'utf8').trim() : null;
	const indexFile = git('rev-parse', '--git-path', 'planet-data-index');
	const previousIndex = process.env.GIT_INDEX_FILE;
	try {
		process.env.GIT_INDEX_FILE = indexFile;
		git('read-tree', '--empty');
		const blob = git('hash-object', '-w', 'data/state.json');
		git('update-index', '--add', '--cacheinfo', `100644,${blob},state.json`);
		const tree = git('write-tree');
		const generation = JSON.parse(readFileSync('data/state.json', 'utf8')).generationId;
		const commit = git(
			'-c',
			'user.name=github-actions[bot]',
			'-c',
			'user.email=41898282+github-actions[bot]@users.noreply.github.com',
			'commit-tree',
			tree,
			...(parent ? ['-p', parent] : []),
			'-m',
			`Planet generation ${generation}`
		);
		git('push', 'origin', `${commit}:refs/heads/planet-data`);
		console.log(`Persisted ${generation}`);
	} finally {
		if (previousIndex === undefined) delete process.env.GIT_INDEX_FILE;
		else process.env.GIT_INDEX_FILE = previousIndex;
		if (existsSync(indexFile)) rmSync(indexFile);
	}
} else throw new Error('Expected restore or commit');
