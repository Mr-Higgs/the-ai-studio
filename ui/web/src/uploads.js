// Owner-uploaded reference files. Shared by the browser (extract.js) and the API (POST /api/uploads).
export const UPLOAD_KINDS = { pdf: 'PDF', markdown: 'Markdown', text: 'Text', csv: 'CSV', excel: 'Excel' };
const EXT = { pdf: 'pdf', md: 'markdown', markdown: 'markdown', txt: 'text', csv: 'csv', xlsx: 'excel', xls: 'excel' };
export const UPLOAD_ACCEPT = Object.keys(EXT).map(e => `.${e}`).join(',');
export const MAX_UPLOADS = 10;
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const MAX_UPLOAD_CHARS = 40000;
export const UPLOAD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const uploadKind = name => EXT[String(name || '').toLowerCase().match(/\.([a-z]+)$/)?.[1]] || null;

// eslint-disable-next-line no-control-regex
const cleanName = name => String(name || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 200);

export function cleanUpload(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { error: 'bad upload' };
  const name = cleanName(data.name);
  const kind = uploadKind(name);
  if (!name || !kind) return { error: 'Upload a PDF, Markdown, text, CSV or Excel file.' };
  if (typeof data.text !== 'string' || !data.text.trim()) return { error: `${name} has no text Devin can read.` };
  const size = Number.isInteger(data.size) && data.size >= 0 ? data.size : 0;
  if (size > MAX_UPLOAD_BYTES) return { error: `${name} is over ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.` };
  const truncated = data.truncated === true || data.text.length > MAX_UPLOAD_CHARS;
  return { item: { name, kind, size, text: data.text.slice(0, MAX_UPLOAD_CHARS), truncated } };
}
