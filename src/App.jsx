import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { listSkills, deleteSkill, sb } from './api.js';
import SkillCard from './components/SkillCard.jsx';
import UploadModal from './components/UploadModal.jsx';
import DetailView from './components/DetailView.jsx';

export default function App() {
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await listSkills(query, tagFilter);
      setSkills(data);
      setLoadError('');
    } catch (e) {
      setLoadError(e.message);
    } finally {
      setLoading(false);
    }
  }, [query, tagFilter]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const allTags = useMemo(() => {
    const set = new Set();
    skills.forEach((s) => (s.tags || []).forEach((t) => set.add(t)));
    return [...set].sort();
  }, [skills]);

  const onUploaded = () => {
    setShowUpload(false);
    setToast('上传成功');
    load();
  };

  const onDeleted = async (id) => {
    if (!confirm('确定删除这个 skill 吗？zip 和预览图会一并删除。')) return;
    try {
      await deleteSkill(id);
      setSelected(null);
      setToast('已删除');
      load();
    } catch (e) {
      setToast('删除失败：' + e.message);
    }
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">🧩</span>
          <div>
            <h1>Skill Vault</h1>
            <p className="sub">我的 AI 技能收藏库</p>
          </div>
        </div>
        <div className="top-actions">
          <input
            className="search"
            placeholder="搜索名称 / 描述 / 标签…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="btn primary" onClick={() => setShowUpload(true)}>
            ＋ 上传 Skill
          </button>
        </div>
      </header>

      {allTags.length > 0 && (
        <div className="tagbar">
          <span className="muted">标签：</span>
          <button className={'chip' + (!tagFilter ? ' active' : '')} onClick={() => setTagFilter('')}>
            全部
          </button>
          {allTags.map((t) => (
            <button
              key={t}
              className={'chip' + (tagFilter === t ? ' active' : '')}
              onClick={() => setTagFilter(tagFilter === t ? '' : t)}
            >
              #{t}
            </button>
          ))}
        </div>
      )}

      {!sb && (
        <div className="banner warn">
          ⚠️ <b>Supabase 未配置</b>：请在 Netlify 环境变量中添加
          <code>VITE_SUPABASE_URL</code> 和 <code>VITE_SUPABASE_ANON_KEY</code>
          （值从 Supabase → Settings → API 复制），然后重新部署。
        </div>
      )}

      {loadError && (
        <div className="banner error">
          <b>加载失败：</b>{loadError}
          <div className="muted small">
            排查：① 确认 Netlify 构建日志成功且 Functions 已部署（Site → Functions 应看到
            skills / skill / skill-file）② 确认 <code>/api/*</code> 重写生效 ③ 检查浏览器
            Network 面板里 <code>/api/skills</code> 的响应。
          </div>
        </div>
      )}

      {loading ? (
        <div className="center muted">加载中…</div>
      ) : skills.length === 0 ? (
        <div className="center empty">
          <p>还没有收藏的 skill</p>
          <button className="btn primary" onClick={() => setShowUpload(true)}>
            ＋ 上传第一个
          </button>
        </div>
      ) : (
        <div className="grid">
          {skills.map((s) => (
            <SkillCard key={s.id} skill={s} onClick={() => setSelected(s)} />
          ))}
        </div>
      )}

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} onUploaded={onUploaded} />}

      {selected && (
        <DetailView
          skill={selected}
          onClose={() => setSelected(null)}
          onDeleted={onDeleted}
          onChanged={(updated) => setSelected(updated)}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
