import React from 'react';
import { storageUrl } from '../api.js';

export default function SkillCard({ skill, onClick }) {
  const cover = (skill.preview_images && skill.preview_images[0]) || null;
  const date = new Date(skill.created_at).toLocaleDateString('zh-CN');
  return (
    <div className="card" onClick={onClick}>
      <div className="card-cover">
        {cover ? (
          <img src={storageUrl(cover)} alt={skill.name} loading="lazy" />
        ) : (
          <div className="cover-placeholder">🧩</div>
        )}
      </div>
      <div className="card-body">
        <h3>{skill.name}</h3>
        <p className="desc">{skill.description || '（无描述）'}</p>
        <div className="tags">
          {(skill.tags || []).slice(0, 4).map((t) => (
            <span key={t} className="tag">#{t}</span>
          ))}
        </div>
        <div className="meta">
          <span className="muted">{date}</span>
          <span className="link">查看 ›</span>
        </div>
      </div>
    </div>
  );
}
