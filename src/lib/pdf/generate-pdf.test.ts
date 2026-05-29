import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveLocalChromeExecutable } from './generate-pdf';

test('resolveLocalChromeExecutable returns the first available local browser', () => {
  const executablePath = resolveLocalChromeExecutable((candidate) => candidate === '/usr/bin/chromium');

  assert.equal(executablePath, '/usr/bin/chromium');
});

test('resolveLocalChromeExecutable returns null when no local browser exists', () => {
  const executablePath = resolveLocalChromeExecutable(() => false);

  assert.equal(executablePath, null);
});
