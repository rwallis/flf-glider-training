import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveDeployUiState, formatAppVersionText, readPackageVersion } from './src/buildMeta.js';

test('readPackageVersion returns semver string', () => {
  const v = readPackageVersion();
  assert.match(v, /^\d+\.\d+\.\d+/);
});

test('formatAppVersionText includes version and commit', () => {
  assert.equal(
    formatAppVersionText({ version: '0.1.1', git_commit: 'abc1234', environment: 'production' }),
    'v0.1.1 · abc1234 · production'
  );
});

test('deriveDeployUiState recommends refresh when deployment id changes', () => {
  const ui = deriveDeployUiState({
    pageLoadDeploymentId: 'dep-old',
    instanceDeploymentId: 'dep-new'
  });
  assert.equal(ui.refresh_recommended, true);
  assert.equal(ui.tone, 'ready');
});

test('deriveDeployUiState is live when ids match', () => {
  const ui = deriveDeployUiState({
    pageLoadDeploymentId: 'dep-1',
    instanceDeploymentId: 'dep-1'
  });
  assert.equal(ui.refresh_recommended, false);
  assert.equal(ui.label, 'Live');
});
