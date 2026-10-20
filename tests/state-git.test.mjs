import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
const script = path.resolve('scripts/state-git.mjs');
test('state branch bootstraps, restores history and rejects a conflicting writer without changing main', () => {
	const dir = mkdtempSync(path.join(tmpdir(), 'planet-git-'));
	const remote = path.join(dir, 'remote.git'),
		first = path.join(dir, 'first'),
		second = path.join(dir, 'second');
	const run = (cwd, cmd, args) =>
		execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
	const git = (cwd, ...args) => run(cwd, 'git', args);
	try {
		git(dir, 'init', '--bare', remote);
		git(dir, 'clone', remote, first);
		mkdirSync(path.join(first, 'data'));
		writeFileSync(
			path.join(first, 'data/state.json'),
			JSON.stringify({ schemaVersion: 1, generationId: 'initial', posts: [], snapshots: [] })
		);
		git(first, 'add', 'data');
		git(
			first,
			'-c',
			'user.name=Test',
			'-c',
			'user.email=test@example.invalid',
			'commit',
			'-m',
			'Initial'
		);
		git(first, 'push', 'origin', 'HEAD:main');
		const head = git(first, 'rev-parse', 'HEAD');
		run(first, 'node', [script, 'restore']);
		run(first, 'node', [script, 'commit']);
		git(dir, 'clone', '--branch', 'main', remote, second);
		run(second, 'node', [script, 'restore']);
		const state = JSON.parse(readFileSync(path.join(second, 'data/state.json'), 'utf8'));
		assert.equal(state.generationId, 'initial');
		run(first, 'node', [script, 'restore']);
		state.generationId = 'next';
		writeFileSync(path.join(first, 'data/state.json'), JSON.stringify(state));
		run(first, 'node', [script, 'commit']);
		assert.throws(() => run(second, 'node', [script, 'commit']));
		run(second, 'node', [script, 'restore']);
		assert.equal(
			JSON.parse(readFileSync(path.join(second, 'data/state.json'), 'utf8')).generationId,
			'next'
		);
		assert.equal(git(first, 'rev-parse', 'HEAD'), head);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});
