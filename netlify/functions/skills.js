// POST /api/skills  - upload a skill zip (+ preview images)
// GET  /api/skills  - list skills (?q= search, ?tag= filter)
import AdmZip from 'adm-zip';
import { supabase, BUCKET, json, err, parseMultipart, buildTree, isSafeEntry } from './_lib.js';
import { randomUUID } from 'node:crypto';

export default async (event) => {
  try {
    if (event.httpMethod === 'GET') {
      return await list(event);
    }
    if (event.httpMethod === 'POST') {
      return await create(event);
    }
    return err('method not allowed', 405);
  } catch (e) {
    console.error('skills error:', e);
    return err(e.message || 'internal error', 500);
  }
};

async function list(event) {
  const url = new URL(event.url);
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

async function create(event) {
  const { fields, files } = await parseMultipart(event);
  const name = (fields.name || '').trim();
  const description = (fields.description || '').trim();
  const tags = (fields.tags || '')
    .split(/[,，]/)
    .map((t) => t.trim())
    .filter(Boolean);

  if (!name) return err('name is required');
  const zips = files.zip || [];
  if (zips.length !== 1) return err('exactly one .zip file is required');
  const zipFile = zips[0];
  if (!/\.zip$/i.test(zipFile.filename)) return err('file must be a .zip archive');

  // validate + build tree
  let zip;
  try {
    zip = new AdmZip(zipFile.buffer);
  } catch {
    return err('invalid zip archive');
  }
  const entries = zip.getEntries().filter((e) => !e.entryName.endsWith('/') || e.isDirectory);
  if (!entries.every((e) => isSafeEntry(e.entryName))) return err('zip contains unsafe paths');

  const id = randomUUID();
  const base = `skills/${id}`;
  const zipPath = `${base}/${zipFile.filename.replace(/[^\w.\-]/g, '_')}`;

  // upload zip
  const { error: zipErr } = await supabase.storage.from(BUCKET).upload(zipPath, zipFile.buffer, {
    contentType: 'application/zip',
    upsert: true,
  });
  if (zipErr) return err('storage zip upload failed: ' + zipErr.message, 500);

  // upload preview images
  const previews = files.preview || [];
  const previewPaths = [];
  for (let i = 0; i < previews.length; i++) {
    const p = previews[i];
    const ext = (p.filename.match(/\.(png|jpe?g|gif|webp|svg)$/i) || [])[1] || 'png';
    const path = `${base}/preview_${i}.${ext}`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, p.buffer, {
      contentType: p.mimeType || 'image/png',
      upsert: true,
    });
    if (upErr) return err('preview upload failed: ' + upErr.message, 500);
    previewPaths.push(path);
  }

  const { data, error: insErr } = await supabase
    .from('skills')
    .insert({ id, name, description, tags, preview_images: previewPaths, zip_path: zipPath, file_tree: buildTree(entries) })
    .select()
    .single();
  if (insErr) return err('db insert failed: ' + insErr.message, 500);
  return json(data, 201);
}
