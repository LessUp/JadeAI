export interface LocalVersionHistoryFailureCopy {
  title: string;
  description: string;
}

export interface AutoSaveFailureCopy {
  title: string;
  description: string;
}

export function getLocalVersionHistoryFailureCopy(locale?: string): LocalVersionHistoryFailureCopy {
  if (locale?.toLowerCase().startsWith('zh')) {
    return {
      title: '本地版本历史保存失败',
      description: '简历已继续保存，但当前浏览器的本地历史版本可能不可用。请检查浏览器存储权限或可用空间。',
    };
  }

  return {
    title: 'Local version history was not saved',
    description: 'Your resume save can continue, but local browser history may be unavailable. Check browser storage permissions or available space.',
  };
}

export function getAutoSaveFailureCopy(locale?: string): AutoSaveFailureCopy {
  if (locale?.toLowerCase().startsWith('zh')) {
    return {
      title: '自动保存失败',
      description: '当前改动尚未保存到服务器，请检查网络或稍后手动保存。',
    };
  }

  return {
    title: 'Auto-save failed',
    description: 'Recent changes were not saved to the server. Check your network or save manually.',
  };
}
