# Skill Vault · 部署指南（Netlify + Supabase）

个人 AI Skill 收藏站：上传 SKILL 压缩包、预览图、目录树浏览、在线看文档、打标签、随时下载、卡片增删改。

## 技术栈

- 前端：Vite + React（纯静态，部署 Netlify）
- 后端：Netlify Functions（上传解压 zip、文件读取）
- 数据：Supabase Postgres（skills 表）+ Supabase Storage（zip / 预览图）

## 项目结构

```
skill-vault/
├── index.html
├── netlify.toml            # Netlify 构建 + /api 重写
├── package.json
├── supabase/schema.sql     # 数据库 + Storage 初始化（部署前必须执行）
├── netlify/functions/      # 后端接口
│   ├── _lib.js             # 公共工具（supabase client / multipart 解析 / 目录树）
│   ├── skills.js           # POST 上传 / GET 列表
│   ├── skill.js            # GET 单个 / PATCH 编辑 / DELETE 删除
│   └── skill-file.js       # GET 从 zip 中读取单个文件内容
└── src/                    # 前端
    ├── App.jsx             # 列表 + 搜索 + 标签筛选
    ├── api.js              # API 封装
    └── components/         # SkillCard / UploadModal / DetailView / FileTree
```

## 部署步骤

### 1. Supabase（数据 + 存储）

1. 打开 https://supabase.com → New Project（选离你近的 region，设数据库密码）
2. 项目建好后，左侧 **SQL Editor** → New query → 粘贴 `supabase/schema.sql` 全部内容 → **Run**
   - 会自动创建 `skills` 表、`skillvault` 公开 storage bucket、RLS 策略
3. 记录两个值（**Settings → API**）：
   - `Project URL`（形如 `https://xxxx.supabase.co`）
   - `service_role` key（**Secret，只放服务端**，切勿暴露到前端）

### 2. Netlify（站点 + 后端接口）

方式 A（推荐）：推到 GitHub → Netlify 新建站点导入仓库
```
Build command:  npm run build
Publish directory:  dist
Functions directory:  netlify/functions   （netlify.toml 已配置）
```

方式 B（Netlify CLI）：
```bash
npm install -g netlify-cli
cd skill-vault
netlify login
netlify deploy --prod --build
```

### 3. 环境变量（Netlify → Site settings → Environment variables）

| 变量 | 值 | 谁用 |
|---|---|---|
| `SUPABASE_URL` | Supabase Project URL | Functions |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key | Functions |
| `SKILL_BUCKET` | `skillvault`（默认，可省略） | Functions |
| `VITE_SUPABASE_URL` | Supabase Project URL（**需以 VITE_ 开头**，构建时注入前端） | 前端显示预览图 |

> `VITE_*` 变量会在构建时打进前端代码，因此必须手动在 Netlify 配置（不要提交进仓库）。

### 4. 验证

部署完成后打开站点：
- 上传一个测试 skill（zip + 名称）
- 点进详情：应看到目录树，点击 SKILL.md 能预览内容
- 下载按钮应能拿到原始 zip

## 使用说明

- **上传**：右上「＋ 上传 Skill」→ 名称（必填）、描述、标签（逗号分隔）、zip（必填）、预览图（可多张）
- **浏览**：卡片网格；顶部搜索框按名称/描述/标签模糊搜；标签栏点击筛选
- **详情**：点卡片 → 左侧目录树（文件夹可展开）→ 点文件在右侧预览（文本/图片）
- **编辑**：详情页「编辑」→ 改名称/描述/标签、可替换预览图 → 保存
- **下载**：详情页「⬇ 下载 zip」→ 直接拿原始压缩包，新设备随时取用
- **删除**：详情页「🗑 删除」→ 连带删除 storage 中的 zip 和预览图

## 安全说明（重要）

- 当前 schema 的 RLS 是**全公开**（个人收藏库，无登录）。任何人知道站点 URL 都能增删改。
- 想加登录保护：Supabase 开启 **Auth（Email/Google）**，然后：
  1. schema 的 policy 改为 `auth.uid() is not null`
  2. 前端加登录（`@supabase/supabase-js` 的 `signInWithPassword`），`SUPABASE_SERVICE_ROLE_KEY` 换 `anon` key + JWT
- `service_role` key 是管理员密钥，**只在 Netlify Functions 环境变量里用**，任何情况不要放进前端代码或提交仓库。

## 限制与说明

- zip 上传上限：约 **100MB**（Functions 的 busboy limits 配置）
- 在线看文件是"按需解压"：每次查看单个文件会下载整个 zip 再取内容（skill 包一般 <20MB，秒级）
- 文本文件按扩展名 + 内容探测判断；二进制文件（非图片）会以 `application/octet-stream` 返回，浏览器可能直接下载
- 图片预览支持 png/jpg/gif/webp/svg；svg 走文本（可查看源码）

## 本地开发

```bash
cd skill-vault
npm install
# 本地起 Supabase（可选）：supabase start
# 本地调试 Functions 需要环境变量：
#   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 指向你的云端项目
netlify dev        # 需要 netlify-cli，会自动跑 Functions + 前端
```
