import assert from 'node:assert/strict';
import test from 'node:test';

import { dbInterviewMessagesToUIMessages, getInterviewRole } from './ui-message-adapter';

test('preserves original interview roles when adapting database messages', () => {
  const [interviewer, candidate, system] = dbInterviewMessagesToUIMessages([
    { id: 'm1', role: 'interviewer', content: 'Question', metadata: { marked: true } },
    { id: 'm2', role: 'candidate', content: 'Answer', metadata: { hinted: true } },
    { id: 'm3', role: 'system', content: 'Trigger', metadata: { skipped: true } },
  ]);

  assert.equal(interviewer.role, 'assistant');
  assert.equal(getInterviewRole(interviewer), 'interviewer');
  assert.deepEqual(interviewer.metadata?.interviewMetadata, { marked: true });

  assert.equal(candidate.role, 'user');
  assert.equal(getInterviewRole(candidate), 'candidate');
  assert.deepEqual(candidate.metadata?.interviewMetadata, { hinted: true });

  assert.equal(system.role, 'system');
  assert.equal(getInterviewRole(system), 'system');
  assert.deepEqual(system.metadata?.interviewMetadata, { skipped: true });
});
