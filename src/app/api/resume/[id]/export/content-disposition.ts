const RFC_5987_ESCAPE_PATTERN = /['()*]/g;
const CONTROL_CHARS_PATTERN = /[\u0000-\u001f\u007f]/g;
const ASCII_FILENAME_UNSAFE_PATTERN = /[^A-Za-z0-9._ -]/g;

function encodeRFC5987Value(value: string) {
  return encodeURIComponent(value).replace(
    RFC_5987_ESCAPE_PATTERN,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function quoteHeaderValue(value: string) {
  return value.replace(/["\\]/g, '\\$&');
}

export function buildExportContentDisposition(filename: string, extension: string) {
  const normalizedExtension = extension.startsWith('.') ? extension : `.${extension}`;
  const unicodeFilename = `${filename.replace(CONTROL_CHARS_PATTERN, ' ').trim() || 'resume'}${normalizedExtension}`;
  const sanitizedAsciiBase =
    filename
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(CONTROL_CHARS_PATTERN, ' ')
      .replace(ASCII_FILENAME_UNSAFE_PATTERN, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/[ ._-]+$/g, '');
  const sanitizedAsciiSuffix = sanitizedAsciiBase.replace(/^[ ._-]+/, '');
  const asciiBase =
    sanitizedAsciiBase && /^[A-Za-z0-9]/.test(sanitizedAsciiBase)
      ? sanitizedAsciiBase
      : sanitizedAsciiSuffix
        ? `resume-${sanitizedAsciiSuffix}`
        : 'resume';
  const asciiFilename = `${asciiBase}${normalizedExtension}`;

  return `attachment; filename="${quoteHeaderValue(asciiFilename)}"; filename*=UTF-8''${encodeRFC5987Value(unicodeFilename)}`;
}
