import React, { useEffect, useMemo, useState } from 'react';
import { marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js';
import 'highlight.js/styles/github.css';
import FileTree from './FileTree.jsx';
import { downloadUrl, fileUrl, patchSkill } from '../api.js';

marked.use(
  markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : '';
      return language ? hljs.highlight(code, { language }).value : hljs.highlightAuto(code).value;
    },
  }),
);

// extension -> highlight.js language name
const LANG_MAP = {
  py: 'python', js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
  mjs: 'javascript', cjs: 'javascript', sh: 'bash', bash: 'bash', zsh: 'bash',
  rb: 'ruby', go: 'go', rs: 'rust', c: 'c', h: 'c', cpp: 'cpp', java: 'java',
  kt: 'kotlin', swift: 'swift', php: 'php', sql: 'sql', html: 'xml', xml: 'xml',
  css: 'css', scss: 'scss', json: 'json', yaml: 'yaml', yml: 'yaml', toml: 'ini',
  ini: 'ini', dockerfile: 'dockerfile', lua: 'lua', r: 'r', perl: 'perl',
};

const langFromPath = (path) => {
  const ext = (path.match(/\.([a-zA-Z0-9]+)$/) || [])[1]?.toLowerCase() || '';
  return LANG_MAP[ext] || null;
};

export default function DetailView({ skill, onClose, onDeleted, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [selectedPath, setSelectedPath] = useState('');
  const [fileMeta, setFileMeta] = useState(null); // {content, isImage, mime}
  const [loadingFile, setLoadingFile] = useState(false);

  const [name, setName] = useState(skill.name);
  const [description, setDescription] = useState(skill.description || '');
  const [tags, setTags] = useState((skill.tags || []).join(', '));
  const [newPreviews, setNewPreviews] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const openFile = async (path) => {
    setSelectedPath(path);
    setLoadingFile(true);
    setFileMeta(null);
    try {
      const res = await fetch(fileUrl(skill.id, path));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const mime = res.headers.get('content-type') || '';
      const buf = await res.arrayBuffer();
      const bytes = new Uint8Array(buf);
      const isImage = mime.startsWith('image/');
      if (isImage) {
        setFileMeta({ isImage, mime, content: URL.createObjectURL(new Blob([buf], { type: mime })) });
      } else {
        // decode utf-8, fall back to gbk if replacement chars appear (some skill files are GBK)
        let text = new TextDecoder('utf-8').decode(bytes);
        if (text.includes('\uFFFD')) {
          try {
            const gbk = new TextDecoder('gbk').decode(bytes);
            if (!gbk.includes('\uFFFD')) text = gbk;
          } catch { /* keep utf-8 */ }
        }
        setFileMeta({ isImage: false, mime, content: text });
      }
    } catch (e) {
      setFileMeta({ isImage: false, content: '读取失败：' + e.message, mime: 'text/plain' });
    } finally {
      setLoadingFile(false);
    }
  };

  // open SKILL.md by default
  useEffect(() => {
    const walk = (nodes, depth = 0) => {
      for (const n of nodes) {
        if (n.type === 'file' && /^(SKILL\.md|README\.md)$/i.test(n.name)) return n.path;
        if (n.children) {
          const r = walk(n.children, depth + 1);
          if (r) return r;
        }
      }
      return null;
    };
    const first = walk(skill.file_tree || []);
    if (first) openFile(first);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skill.id]);

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const updated = await patchSkill(skill.id, {
        name: name.trim() || skill.name,
        description: description.trim(),
        tags,
        previews: newPreviews,
      });
      onChanged(updated);
      setEditing(false);
      setNewPreviews([]);
    } catch (e) {
      setError('保存失败：' + e.message);
    } finally {
      setBusy(false);
    }
  };

  const zipHref = downloadUrl(skill.zip_path);

  const renderContent = () => {
    if (!fileMeta) return null;
    if (fileMeta.isImage) {
      return <img src={fileMeta.content} alt={selectedPath} className="file-img" />;
    }
    const isMd = fileMeta.mime === 'text/markdown' || /\.(md|markdown)$/i.test(selectedPath || '');
    if (isMd) {
      return (
        <div
          className="md-body"
          dangerouslySetInnerHTML={{ __html: marked.parse(fileMeta.content) }}
        />
      );
    }
    const lang = langFromPath(selectedPath || '');
    const html = lang
      ? hljs.highlight(fileMeta.content, { language: lang }).value
      : hljs.highlightAuto(fileMeta.content).value;
    return (
      <pre className="code-block">
        <code
          className={`hljs${lang ? ` language-${lang}` : ''}`}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </pre>
    );
  };

  return (
    <div className="detail-mask">
      <div className="detail">
        <div className="detail-head">
          <button className="btn" onClick={onClose}>← 返回</button>
          <div className="detail-title">
            <h2>{skill.name}</h2>
            <div className="tags">
              {(skill.tags || []).map((t) => (
                <span key={t} className="tag">#{t}</span>
              ))}
            </div>
          </div>
          <div className="detail-actions">
            <a className="btn" href={zipHref} download>⬇ 下载 zip</a>
            <button className="btn" onClick={() => setEditing(!editing)}>
              {editing ? '取消编辑' : '✏ 编辑'}
            </button>
            <button className="btn danger" onClick={() => onDeleted(skill.id)}>🗑 删除</button>
          </div>
        </div>

        <div className="preview-row">
          {(skill.preview_images || []).map((p) => (
            <img key={p} src={downloadUrl(p)} alt="preview" className="preview-img" />
          ))}
          {(!skill.preview_images || skill.preview_images.length === 0) && (
            <div className="cover-placeholder large">🧩</div>
          )}
        </div>

        {editing ? (
          <div className="edit-panel">
            <label>
              名称
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label>
              描述
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </label>
            <label>
              标签（逗号分隔）
              <input value={tags} onChange={(e) => setTags(e.target.value)} />
            </label>
            <label>
              替换预览图（多选）
              <input type="file" accept="image/*" multiple onChange={(e) => setNewPreviews([...e.target.files])} />
            </label>
            {newPreviews.length > 0 && (
              <div className="preview-thumbs">
                {newPreviews.map((p, i) => (
                  <img key={i} src={URL.createObjectURL(p)} alt={p.name} />
                ))}
              </div>
            )}
            {error && <div className="error">{error}</div>}
            <button className="btn primary" onClick={save} disabled={busy}>
              {busy ? '保存中…' : '保存'}
            </button>
          </div>
        ) : (
          skill.description && <p className="detail-desc">{skill.description}</p>
        )}

        <div className="detail-body">
          <div className="tree-col">
            <h4>文件目录</h4>
            <FileTree tree={skill.file_tree || []} selectedPath={selectedPath} onSelect={openFile} />
          </div>
          <div className="file-col">
            <h4 className="file-title">{selectedPath || '选择一个文件查看'}</h4>
            {loadingFile && <div className="muted">读取中…</div>}
            {fileMeta && !loadingFile && renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
}
