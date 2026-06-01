import assert from 'node:assert/strict';
import test from 'node:test';

import { buildExportContentDisposition } from './content-disposition';

test('builds an ASCII fallback and RFC 5987 filename for Chinese resume names', () => {
  const header = buildExportContentDisposition('张伟的简历-20260407080910', 'pdf');

  assert.equal(
    header,
    "attachment; filename=\"resume-20260407080910.pdf\"; filename*=UTF-8''%E5%BC%A0%E4%BC%9F%E7%9A%84%E7%AE%80%E5%8E%86-20260407080910.pdf",
  );
});

test('preserves spaces in the ASCII fallback and percent-encodes them in filename*', () => {
  const header = buildExportContentDisposition('My Resume Draft-20260407080910', 'docx');

  assert.equal(
    header,
    "attachment; filename=\"My Resume Draft-20260407080910.docx\"; filename*=UTF-8''My%20Resume%20Draft-20260407080910.docx",
  );
});

test('keeps special characters out of filename while encoding them in filename*', () => {
  const header = buildExportContentDisposition('R&D "Lead" (v2)*-20260407080910', '.txt');

  assert.equal(
    header,
    "attachment; filename=\"R D Lead v2 -20260407080910.txt\"; filename*=UTF-8''R%26D%20%22Lead%22%20%28v2%29%2A-20260407080910.txt",
  );
});
