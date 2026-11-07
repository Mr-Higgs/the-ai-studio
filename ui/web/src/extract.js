// Browser-side text extraction for uploads: only the text reaches the server, never the file.
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_CHARS, uploadKind } from './uploads.js';

const fail = message => Object.assign(new Error(message), { user: true });

async function pdfText(file) {
  const [pdfjs, { default: workerSrc }] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]);
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false });
  const doc = await task.promise;
  try {
    const pages = [];
    let total = 0;
    for (let n = 1; n <= doc.numPages && total <= MAX_UPLOAD_CHARS; n++) {
      const { items } = await (await doc.getPage(n)).getTextContent();
      const text = items.map(i => (i.str || '') + (i.hasEOL ? '\n' : ' ')).join('').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
      if (text) { pages.push(`## Page ${n}\n${text}`); total += text.length; }
    }
    if (!pages.length) throw fail(`${file.name} has no selectable text — it may be a scan. Copy the text into the chat instead.`);
    return pages.join('\n\n');
  } finally { task.destroy(); }
}

async function excelText(file) {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array', dense: true, cellFormula: false, cellHTML: false });
  const sheets = [];
  let total = 0;
  for (const name of wb.SheetNames) {
    if (total > MAX_UPLOAD_CHARS) break;
    const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name], { blankrows: false }).trim();
    if (csv) { sheets.push(`## Sheet: ${name}\n${csv}`); total += csv.length; }
  }
  if (!sheets.length) throw fail(`${file.name} looks empty.`);
  return sheets.join('\n\n');
}

export async function extractUpload(file) {
  const kind = uploadKind(file.name);
  if (!kind) throw fail(`${file.name}: upload a PDF, Markdown, text, CSV or Excel file.`);
  if (file.size > MAX_UPLOAD_BYTES) throw fail(`${file.name} is over ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`);
  let text;
  try {
    text = kind === 'pdf' ? await pdfText(file) : kind === 'excel' ? await excelText(file) : (await file.text()).trim();
  } catch (e) {
    if (e.user) throw e;
    throw fail(`Couldn’t read ${file.name}${e.name === 'PasswordException' ? ' — it’s password-protected' : ''}.`);
  }
  if (!text) throw fail(`${file.name} looks empty.`);
  return { name: file.name, size: file.size, text: text.slice(0, MAX_UPLOAD_CHARS), truncated: text.length > MAX_UPLOAD_CHARS };
}
