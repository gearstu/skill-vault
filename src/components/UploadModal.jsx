import React, { useRef, useState } from 'react';
import { uploadSkill } from '../api.js';

export default function UploadModal({ onClose, onUploaded }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [zip, setZip] = useState(null);
  const [previews, setPreviews] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const zipRef = useRef(null);
  const prevRef = useRef(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return setError('请填写名称');
    if (!zip) return setError('请选择 .zip 压缩包');
    setBusy(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('name', name.trim());
      fd.append('description', description.trim());
      fd.append('tags', tags);
      fd.append('zip', zip, zip.name);
      for (const p of previews) fd.append('preview', p, p.name);
      await uploadSkill(fd);
      onUploaded();
    } catch (err) {
      setError('上传失败：' + err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>上传 Skill</h2>
        <form onSubmit={submit}>
          <label>
            名称 *
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：代码审查助手" />
          </label>
          <label>
            描述
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="这个 skill 是做什么的" />
          </label>
          <label>
            标签（逗号分隔）
            <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="例如：编程, 审查, claude" />
          </label>
          <label>
            Skill 压缩包（.zip）*
            <input type="file" accept=".zip" ref={zipRef} onChange={(e) => setZip(e.target.files[0])} />
            {zip && <span className="file-name">📦 {zip.name}（{(zip.size / 1024).toFixed(0)} KB）</span>}
          </label>
          <label>
            预览图（可多张：png/jpg/webp）
            <input
              type="file"
              accept="image/*"
              multiple
              ref={prevRef}
              onChange={(e) => setPreviews([...e.target.files])}
            />
            {previews.length > 0 && (
              <div className="preview-thumbs">
                {previews.map((p, i) => (
                  <img key={i} src={URL.createObjectURL(p)} alt={p.name} />
                ))}
              </div>
            )}
          </label>
          {error && <div className="error">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn" onClick={onClose} disabled={busy}>取消</button>
            <button type="submit" className="btn primary" disabled={busy}>
              {busy ? '上传中…' : '上传'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
