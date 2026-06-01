import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getAutoSaveFailureCopy,
  getLocalVersionHistoryFailureCopy,
} from './resume-version-history-status';

test('returns Chinese copy for Chinese browser locales', () => {
  assert.deepEqual(getLocalVersionHistoryFailureCopy('zh-CN'), {
    title: '本地版本历史保存失败',
    description: '简历已继续保存，但当前浏览器的本地历史版本可能不可用。请检查浏览器存储权限或可用空间。',
  });
});

test('returns English copy by default', () => {
  assert.deepEqual(getLocalVersionHistoryFailureCopy('en-US'), {
    title: 'Local version history was not saved',
    description: 'Your resume save can continue, but local browser history may be unavailable. Check browser storage permissions or available space.',
  });
});

test('returns Chinese copy for auto-save failures', () => {
  assert.deepEqual(getAutoSaveFailureCopy('zh-CN'), {
    title: '自动保存失败',
    description: '当前改动尚未保存到服务器，请检查网络或稍后手动保存。',
  });
});

test('returns English copy for auto-save failures by default', () => {
  assert.deepEqual(getAutoSaveFailureCopy('en-US'), {
    title: 'Auto-save failed',
    description: 'Recent changes were not saved to the server. Check your network or save manually.',
  });
});
