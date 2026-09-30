# Bangumi ACGN Showcase

个人 ACGN 展示页 — 数据实时来自 Bangumi 公开 API，无需后端、无需 token。

## 预览

```bash
# 在项目目录下启动一个静态服务器
python3 -m http.server 8000
# 然后浏览器打开 http://localhost:8000
```

## 页面内容

| 区块 | 数据来源 |
|---|---|
| 顶部资料（头像 / 昵称 / 签名） | `GET /v0/users/{username}` |
| 最爱角色竖幅（5 张立绘） | `GET /v0/characters/{id}` |
| 收藏统计圆环 + 数字 | `GET /v0/users/{username}/collections?subject_type=N` |
| 完整收藏入口 | 跳转 `bgm.tv/user/{username}` |

## 怎么改内容

### 换最爱角色

编辑 `app.js` 顶部的 `CONFIG.characters`：

```js
characters: [
  { id: 3575,  zh: '御坂美琴' },
  // ...
],
```

`id` 的获取方式：打开 `bgm.tv` 搜索角色 → 进入角色页 → 地址栏 `bgm.tv/character/**3575**` 里的数字就是 id。
`zh` 是显示用的中文名，留空则显示 Bangumi 上的原名。

### 改用户名 / 收藏分类

同样在 `app.js` 的 `CONFIG` 里：

```js
username: 'm1n',        // bgm.tv/user/xxxx 的 xxxx
subjects: [             // 想展示哪些分类
  { type: 2, zh: '动画', color: '#a78bfa' },
  { type: 1, zh: '书籍', color: '#f472b6' },
  { type: 4, zh: '游戏', color: '#38bdf8' },
],
```

分类编码：`1`=书籍 `2`=动画 `3`=音乐 `4`=游戏 `6`=三次元。

## 部署到 GitHub Pages

```bash
git init
git add .
git commit -m "init: bangumi showcase"
git branch -M main
git remote add origin https://github.com/<你的用户名>/bgm-showcase.git
git push -u origin main
```

然后在 GitHub 仓库 → **Settings → Pages** → Source 选 `main` 分支 `/ (root)` → 保存。

几十秒后访问：`https://<你的用户名>.github.io/bgm-showcase/`

## 技术说明

- 纯静态：`index.html` + `style.css` + `app.js`，零依赖、零构建
- 数据：Bangumi 官方 API（`api.bgm.tv`），CORS 全开放，浏览器直连
- 缓存：无（每次打开拉最新数据，共 9 个请求）
- 响应式：桌面 5 列 → 平板 3 列 → 手机 2 列

## 注意

- 页面展示的是**公开收藏统计**，需要 Bangumi 账号的收藏为公开状态
- 若 API 返回失败，对应区块会留空/显示占位，不会白屏
