// GET    /api/skills/:id      - fetch one skill
// PATCH  /api/skills/:id      - update metadata / preview images (JSON)
// DELETE /api/skills/:id      - remove skill + storage files
import { supabase, BUCKET, json, err } from './_lib.js';

export default async (event) => {
  try {
    const id = (event.path || '').split('/').filter(Boolean).pop();
    if (!id) return err('missing id', 400);

    if (event.httpMethod === 'GET') {
      const { data, error } = await supabase.from('skills').select('*').eq('id', id).single();
      if (error) return err('not found', 404);
      return json(data);
    }

    if (event.httpMethod === 'DELETE') {
      const { data: row, error: getErr } = await supabase.from('skills').select('*').eq('id', id).single();
      if (getErr) return err('not found', 404);
      await supabase.storage.from(BUCKET).remove([row.zip_path, ...(row.preview_images || [])]);
      const { error } = await supabase.from('skills').delete().eq('id', id);
      if (error) return err(error.message, 500);
      return json({ ok: true });
    }

    if (event.httpMethod === 'PATCH') {
      let body;
      try {
        body = JSON.parse(event.body || '{}');
      } catch {
        return err('invalid JSON body');
      }
      const { data: row, error: getErr } = await supabase.from('skills').select('*').eq('id', id).single();
      if (getErr) return err('not found', 404);

      const updates = {};
      if (body.name !== undefined) updates.name = String(body.name).trim() || row.name;
      if (body.description !== undefined) updates.description = String(body.description).trim();
      if (body.tags !== undefined) updates.tags = Array.isArray(body.tags) ? body.tags : [];

      // Preview images: new array replaces old ones; remove stale files from storage.
      if (Array.isArray(body.preview_images)) {
        const newPaths = body.preview_images.filter(Boolean);
        const oldPaths = (row.preview_images || []).filter((p) => !newPaths.includes(p));
        if (oldPaths.length > 0) await supabase.storage.from(BUCKET).remove(oldPaths);
        updates.preview_images = newPaths;
      }

      if (Object.keys(updates).length === 0) return err('nothing to update', 400);
      updates.updated_at = new Date().toISOString();

      const { data, error } = await supabase.from('skills').update(updates).eq('id', id).select().single();
      if (error) return err(error.message, 500);
      return json(data);
    }

    return err('method not allowed', 405);
  } catch (e) {
    console.error('skill error:', e);
    return err(e.message || 'internal error', 500);
  }
}
