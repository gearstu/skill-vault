// Shared helpers for Skill Vault Netlify Functions
import { createClient } from '@supabase/supabase-js';
import Busboy from 'busboy';

export const SUPABASE_URL = process.env.SUPABASE_URL;
export const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const BUCKET = process.env.SKILL_BUCKET || 'skillvault';

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function err(message, status = 400) {
  return json({ error: message }, status);
}

// Parse multipart/form-data body -> { fields: {}, files: { name: [{filename, buffer}] } }
export function parseMultipart(event) {
  return new Promise((resolve, reject) => {
    const contentType = event.headers['content-type'] || '';
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64')
      : Buffer.from(event.body || '');
    const bb = Busboy({ headers: { 'content-type': contentType }, limits: { fileSize: 100 * 1024 * 1024 } });
    const fields = {};
    const files = {};
    bb.on('field', (name, val) => {
      fields[name] = val;
    });
    bb.on('file', (name, stream, info) => {
      const chunks = [];
      stream.on('data', (d) => chunks.push(d));
      stream.on('end', () => {
        (files[name] ||= []).push({ filename: info.filename || 'file', mimeType: info.mimeType, buffer: Buffer.concat(chunks) });
      });
    });
    bb.on('error', reject);
    bb.on('finish', () => resolve({ fields, files }));
    bb.end(raw);
  });
}

// Build nested directory tree from adm-zip entries
export function buildTree(entries) {
  const root = [];
  const map = new Map();
  const ensureDir = (parts) => {
    let cur = root;
    let path = '';
    for (const p of parts) {
      path = path ? `${path}/${p}` : p;
      let node = map.get(path);
      if (!node) {
        node = { name: p, type: 'dir', path, children: [] };
        map.set(path, node);
        cur.push(node);
      }
      cur = node.children;
    }
    return cur;
  };
  for (const e of entries) {
    if (e.isDirectory) {
      ensureDir(e.entryName.split('/').filter(Boolean));
      continue;
    }
    const parts = e.entryName.split('/').filter(Boolean);
    const name = parts.pop();
    const parent = ensureDir(parts);
    parent.push({ name, type: 'file', path: e.entryName, size: e.header.size || 0 });
  }
  const sort = (nodes) => {
    nodes.sort((a, b) =>
      a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1,
    );
    for (const n of nodes) if (n.children) sort(n.children);
  };
  sort(root);
  return root;
}

// Reject zip entries that try to escape the archive root
export function isSafeEntry(entryName) {
  const parts = entryName.split('/');
  return !parts.some((p) => p === '..' || p.includes('\\'));
}

export function storageUrl(path) {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}
