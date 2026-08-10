// API helpers for Skill Vault
// Large files (zip, previews) go DIRECTLY to Supabase Storage from the browser
// (Netlify Functions reject big request bodies with HTTP 413).
// Functions only receive small JSON and do server-side zip parsing.

import { createClient } from '@supabase/supabase-js';

const API = '/api';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const BUCKET = import.meta.env.VITE_SKILL_BUCKET || 'skillvault';

export const sb =
  SUPABASE_URL && ANON_KEY ? createClient(SUPABASE_URL, ANON_KEY) : null;

async function req(url, options = {}) {
  const res = await fetch(url, options);
  const ct = res.headers.get('content-type') || '';
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      msg = body.error || msg;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  return ct.includes('application/json') ? res.json() : res;
}

async function uploadToStorage(path, file, contentType) {
  if (!sb) throw new Error('Supabase 未配置：请设置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY');
  const { error } = await sb.storage.from(BUCKET).upload(path, file, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(`上传 ${file.name} 到存储失败：${error.message}`);
}

// Upload a skill: zip + previews go straight to Storage, then JSON to Functions.
export async function uploadSkill({ name, description, tags, zip, previews }) {
  const id = crypto.randomUUID();
  const base = `skills/${id}`;
  const zipPath = `${base}/skill.zip`;

  await uploadToStorage(zipPath, zip, 'application/zip');

  const previewPaths = [];
  for (let i = 0; i < (previews || []).length; i++) {
    const p = previews[i];
    const ext = (p.name.match(/\.(png|jpe?g|gif|webp|svg)$/i) || [])[1] || 'png';
    const path = `${base}/preview_${i}.${ext}`;
    await uploadToStorage(path, p, p.type || 'image/png');
    previewPaths.push(path);
  }

  return req(`${API}/skills`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id,
      name,
      description,
      tags,
      zip_path: zipPath,
      preview_images: previewPaths,
    }),
  });
}

export async function patchSkill(id, { name, description, tags, previews = [] }) {
  // New preview images (if any) go straight to Storage first.
  const previewPaths = [];
  for (let i = 0; i < previews.length; i++) {
    const p = previews[i];
    const ext = (p.name.match(/\.(png|jpe?g|gif|webp|svg)$/i) || [])[1] || 'png';
    const path = `skills/${id}/preview_${Date.now()}_${i}.${ext}`;
    await uploadToStorage(path, p, p.type || 'image/png');
    previewPaths.push(path);
  }
  return req(`${API}/skills/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description, tags, preview_images: previewPaths }),
  });
}

export const listSkills = (q = '', tag = '') =>
  req(`${API}/skills?q=${encodeURIComponent(q)}&tag=${encodeURIComponent(tag)}`);

export const getSkill = (id) => req(`${API}/skills/${id}`);

export const deleteSkill = (id) =>
  req(`${API}/skills/${id}`, { method: 'DELETE' });

export const fileUrl = (id, path) =>
  `${API}/skills/${id}/file?path=${encodeURIComponent(path)}`;

export const storageUrl = (path) =>
  `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;

export const downloadUrl = (path) => storageUrl(path);
