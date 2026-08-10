// GET    /api/skills/:id      - fetch one skill
// PATCH  /api/skills/:id      - update metadata (+ optional preview images, multipart)
// DELETE /api/skills/:id      - remove skill + storage files
import { supabase, BUCKET, json, err, parseMultipart } from './_lib.js';

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
      const { fields, files } = await parseMultipart(event);
      const updates = {};
      if (fields.name !== undefined) updates.name = fields.name.trim() || undefined;
      if (fields.description !== undefined) updates.description = fields.description.trim();
      if (fields.tags !== undefined) {
        updates.tags = fields.tags.split(/[,，]/).map((t) => t.trim()).filter(Boolean);
      }
      const previews = files.preview || [];
      if (previews.length > 0) {
        const { data: row, error: getErr } = await supabase.from('skills').select('*').eq('id', id).single();
        if (getErr) return err('not found', 404);
        const old = row.preview_images || [];
        const paths = [];
        for (let i = 0; i < previews.length; i++) {
          const p = previews[i];
          const ext = (p.filename.match(/\.(png|jpe?g|gif|webp|svg)$/i) || [])[1] || 'png';
          const path = `skills/${id}/preview_${Date.now()}_${i}.${ext}`;
          const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, p.buffer, {
            contentType: p.mimeType || 'image/png',
            upsert: true,
          });
          if (upErr) return err('preview upload failed: ' + upErr.message, 500);
          paths.push(path);
        }
        await supabase.storage.from(BUCKET).remove(old.filter(Boolean));
        updates.preview_images = paths;
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
