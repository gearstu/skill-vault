// API helpers for Skill Vault

const API = '/api';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const BUCKET = import.meta.env.VITE_SKILL_BUCKET || 'skillvault';

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

export const listSkills = (q = '', tag = '') =>
  req(`${API}/skills?q=${encodeURIComponent(q)}&tag=${encodeURIComponent(tag)}`);

export const getSkill = (id) => req(`${API}/skills/${id}`);

export const uploadSkill = (formData) =>
  req(`${API}/skills`, { method: 'POST', body: formData });

export const patchSkill = (id, formData) =>
  req(`${API}/skills/${id}`, { method: 'PATCH', body: formData });

export const deleteSkill = (id) =>
  req(`${API}/skills/${id}`, { method: 'DELETE' });

export const fileUrl = (id, path) =>
  `${API}/skills/${id}/file?path=${encodeURIComponent(path)}`;

export const storageUrl = (path) =>
  `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;

export const downloadUrl = (path) => storageUrl(path);
