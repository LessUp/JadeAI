import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveBrowserLaunchPlan, resolveLocalChromeExecutable } from './generate-pdf';

test('resolveLocalChromeExecutable returns the first available local browser', () => {
  const executablePath = resolveLocalChromeExecutable((candidate) => candidate === '/usr/bin/chromium');

  assert.equal(executablePath, '/usr/bin/chromium');
});

test('resolveLocalChromeExecutable returns null when no local browser exists', () => {
  const executablePath = resolveLocalChromeExecutable(() => false);

  assert.equal(executablePath, null);
});

test('resolveBrowserLaunchPlan uses a valid CHROME_PATH', () => {
  assert.deepEqual(
    resolveBrowserLaunchPlan(
      { CHROME_PATH: '/custom/chromium' },
      (candidate) => candidate === '/custom/chromium',
    ),
    {
      kind: 'local',
      executablePath: '/custom/chromium',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    },
  );
});

test('resolveBrowserLaunchPlan rejects an invalid CHROME_PATH', () => {
  assert.throws(
    () => resolveBrowserLaunchPlan({ CHROME_PATH: '/missing/chromium' }, () => false),
    /CHROME_PATH points to a missing or inaccessible executable/,
  );
});

test('resolveBrowserLaunchPlan requires explicit permission for runtime Chromium download', () => {
  assert.throws(
    () => resolveBrowserLaunchPlan({}, () => false),
    /ALLOW_CHROMIUM_DOWNLOAD=true/,
  );

  assert.deepEqual(
    resolveBrowserLaunchPlan({ ALLOW_CHROMIUM_DOWNLOAD: 'true' }, () => false),
    { kind: 'download' },
  );
});
