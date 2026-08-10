// POST /api/skills  - create a skill (JSON body: file already in Storage, server parses zip)
// GET  /api/skills  - list skills (?q= search, ?tag= filter)
// Netlify Functions v2 signature: (req: Request, context) => Response
import AdmZip from 'adm-zip';
import { supabase, BUCKET, json, err, buildTree, isSafeEntry, downloadZip } from './_lib.js';

export default async (req) => {
  try {
    const method = (req.method || 'GET').toUpperCase();
    if (method === 'GET') return await list(req);
    if (method === 'POST') return await create(req);
    return err('method not allowed', 405);
  } catch (e) {
    console.error('skills error:', e);
    return err(e.message || 'internal error', 500);
  }
};

async function list(req) {
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') || '').trim();
  const tag = (url.searchParams.get('tag') || '').trim();
  let query = supabase.from('skills').select('*').order('created_at', { ascending: false });
  if (tag) query = query.contains('tags', [tag]);
  const { data, error } = await query;
  if (error) return err(error.message, 500);
  let rows = data || [];
  if (q) {
    const lq = q.toLowerCase();
    rows = rows.filter(
      (r) =>
        r.name.toLowerCase().includes(lq) ||
        (r.description || '').toLowerCase().includes(lq) ||
        (r.tags || []).some((t) => t.toLowerCase().includes(lq)),
    );
  }
  return json(rows);
}

async function create(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return err('invalid JSON body');
  }
  const { id, name, description, tags, zip_path, preview_images } = body || {};
  if (!name || !String(name).trim()) return err('name is required');
  if (!zip_path) return err('zip_path is required');

  // Server downloads the zip from Storage and builds the file tree.
  const buf = await downloadZip(zip_path);
  if (!buf) return err('zip not found in storage', 404);

  let zip;
  try {
    zip = new AdmZip(buf);
  } catch {
    return err('invalid zip archive');
  }
  const entries = zip.getEntries();
  if (!entries.every((e) => isSafeEntry(e.entryName))) return err('zip contains unsafe paths');

  const row = {
    id: id || undefined,
    name: String(name).trim(),
    description: String(description || '').trim(),
    tags: Array.isArray(tags) ? tags : [],
    preview_images: Array.isArray(preview_images) ? preview_images : [],
    zip_path,
    file_tree: buildTree(entries),
  };

  const { data, error: insErr } = await supabase.from('skills').insert(row).select().single();
  if (insErr) return err('db insert failed: ' + insErr.message, 500);
  return json(data, 201);
}
