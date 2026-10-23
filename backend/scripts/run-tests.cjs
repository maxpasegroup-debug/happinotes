#!/usr/bin/env node

/**
 * Run the complete built-in Node test suite.
 *
 * The Windows Node test runner currently fails before executing any tests when
 * it tries to spawn one worker per test file (spawn EPERM). Node's supported
 * no-isolation mode keeps all files in one process and preserves the complete
 * test set. Other platforms retain the default file isolation.
 */
const { spawnSync } = require('node:child_process');
const { readdirSync } = require('node:fs');
const { join } = require('node:path');

const testDir = join(__dirname, '..', 'test');
const testFiles = readdirSync(testDir)
  .filter((name) => name.endsWith('.test.cjs'))
  .sort()
  .map((name) => join('test', name));

const canDisableIsolation = process.allowedNodeEnvironmentFlags?.has('--test-isolation=none');
const useSingleProcessMode = process.platform === 'win32' && canDisableIsolation;
const args = ['--test'];

if (useSingleProcessMode) {
  args.push('--test-isolation=none');
}

args.push(...testFiles);
const result = spawnSync(process.execPath, args, { stdio: 'inherit' });

if (result.error) {
  console.error(`Unable to start Node test runner: ${result.error.message}`);
  process.exit(1);
}

if (typeof result.status === 'number') {
  process.exit(result.status);
}

process.exit(1);
