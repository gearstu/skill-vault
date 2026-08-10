import React, { useState } from 'react';

export default function FileTree({ tree, selectedPath, onSelect }) {
  return (
    <div className="filetree">
      {tree.map((node) => (
        <TreeNode key={node.path} node={node} depth={0} selectedPath={selectedPath} onSelect={onSelect} />
      ))}
    </div>
  );
}

function TreeNode({ node, depth, selectedPath, onSelect }) {
  const [open, setOpen] = useState(depth === 0);
  const isDir = node.type === 'dir';
  const selected = selectedPath === node.path;

  return (
    <div>
      <div
        className={'tree-node' + (isDir ? ' dir' : '') + (selected ? ' selected' : '')}
        style={{ paddingLeft: 8 + depth * 14 }}
        onClick={() => (isDir ? setOpen(!open) : onSelect(node.path))}
        title={node.path}
      >
        <span className="tree-icon">{isDir ? (open ? '📂' : '📁') : '📄'}</span>
        <span className="tree-name">{node.name}</span>
      </div>
      {isDir && open && node.children?.map((c) => (
        <TreeNode key={c.path} node={c} depth={depth + 1} selectedPath={selectedPath} onSelect={onSelect} />
      ))}
    </div>
  );
}
