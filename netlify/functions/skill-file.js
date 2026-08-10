// GET /api/skills/:id/file?path=relative/path/in/zip
// Streams a single file's content out of the stored zip archive.
import AdmZip from 'adm-zip';
import { supabase, BUCKET, err } from './_lib.js';

const TEXT_EXT = /\.(md|markdown|txt|json|yaml|yml|toml|ini|py|js|jsx|ts|tsx|sh|bash|zsh|rb|go|rs|c|h|cpp|hpp|java|kt|swift|php|sql|html|css|scss|xml|svg|env|gitignore|lock|cfg|conf|properties|dockerfile)$/i;
const MIME = {
  '.md': 'text/markdown', '.markdown': 'text/markdown', '.txt': 'text/plain',
  '.json': 'application/json', '.yaml': 'text/yaml', '.yml': 'text/yaml',
  '.py': 'text/x-python', '.js': 'text/javascript', '.ts': 'text/typescript',
  '.sh': 'text/x-shellscript', '.html': 'text/html', '.css': 'text/css',
  '.xml': 'text/xml', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
};

export default async (event) => {
  try {
    const id = (event.path || '').split('/').filter(Boolean).pop();
    const url = new URL(event.url);
    const rel = url.searchParams.get('path');
    if (!id || !rel) return err('missing id or path', 400);

    const { data: row, error } = await supabase.from('skills').select('zip_path').eq('id', id).single();
    if (error || !row) return err('not found', 404);

    const { data: zipBuf, error: dlErr } = await supabase.storage.from(BUCKET).download(row.zip_path);
    if (dlErr || !zipBuf) return err('zip download failed', 500);

    const zip = new AdmZip(Buffer.from(await zipBuf.arrayBuffer()));
    const entry = zip.getEntry(rel);
    if (!entry || entry.isDirectory) return err('file not found in archive', 404);

    const content = entry.getData();
    const ext = (rel.match(/(\.[a-zA-Z0-9]+)$/) || [])[1]?.toLowerCase() || '';
    const isText = TEXT_EXT.test(ext) || isProbablyText(content);
    const mime = MIME[ext] || (isText ? 'text/plain' : 'application/octet-stream');

    return new Response(isText ? content : content, {
      status: 200,
      headers: {
        'Content-Type': mime,
        'Content-Length': content.length,
        'Cache-Control': 'private, max-age=60',
      },
    });
  } catch (e) {
    console.error('skill-file error:', e);
    return err(e.message || 'internal error', 500);
  }
};

function isProbablyText(buf) {
  const sample = buf.subarray(0, 8000);
  for (let i = 0; i < sample.length; i++) {
    if (sample[i] === 0) return false;
  }
  return true;
}
