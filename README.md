# KOKO / ACGN Archive

个人 ACGN 档案馆 — 以动画官网的视觉语法（纸白点阵、朱红标题、印章菜单、贴纸卡片、荧光纸屑）重做的 Bangumi 兴趣展示页。没有视频，没有后端，也没有构建步骤。

数据来自 [Bangumi 番组计划](https://bgm.tv) 的公开 API，页面读取的是仓库里的 `data.json` 快照；换账号、换本命、换文案都不需要改 JS。

![桌面预览](assets/preview.jpg)

## 本地预览

```bash
cd bgm-showcase
python3 -m http.server 8000
# 打开 http://localhost:8000
```

不要直接双击 `index.html`：浏览器会拦截 `fetch('data.json')`。

## 页面里有什么

| 区块 | 内容 | 数据来源 |
|---|---|---|
| HERO | 站名、总收藏 / 评分 / 均分、封面拼贴、本命头像 | `profile` + `collections` + `featured` |
| PROFILE | 头像、签名、简介、口味标签、四个“此刻”卡片 | `profile`、`collections`、`characters` |
| FEATURED | 最近沉迷：《学生会也有洞！》专属大卡 | `featured` + 对应收藏 |
| FAVORITES | 5 位最爱角色：生日、身高、血型、私货短句 | `characters` + `content.js` |
| WATCHING | 最近在看的进度、话数、更新时间 | `collections?type=3` |
| WISHLIST | 472 部想看里的最近 8 部，横向书架 + 随机抽一部 | `collections?type=1` |
| RECORDS | 总览数字、评分分布、收藏状态、年份分布、口味关键词、口味散点图 + 评分分歧 | 全量收藏计算 |
| TOP RATED | 动画 / 书籍 / 游戏各自的前 5 名 | 我的评分排序 |
| ARCHIVE | 48 张精选封面 + 全量 1,327 部实时搜索，可分批“显示更多”；点封面打开作品详情 | 评分最高 + 最近更新 |
| WORDS | 从短评里抽的三句话 | `collections.comment` |

## 更新数据

```bash
python3 scripts/fetch_bgm.py
```

脚本会重新抓取公开收藏、5 位角色和 featured 条目，覆盖 `data.json`。全程只读，不需要 token；请求之间有间隔，遇到 429/5xx 会退避重试。

- 换 Bangumi 用户名：`BGM_USERNAME=yourname python3 scripts/fetch_bgm.py`
- 换最爱角色：同时改 `scripts/fetch_bgm.py` 里的 `CHARACTER_IDS` 和 `content.js` 里的 `favoriteOrder`
- 换 featured 作品：改 `scripts/fetch_bgm.py` 里的 `FEATURED_SUBJECT`，再改 `index.html` 里 `#feature-link` 的默认链接即可

`data.json` 是提交进仓库的快照，所以页面不依赖实时 API。仓库里带了一条 GitHub Actions 定时任务（`.github/workflows/refresh-data.yml`），每周一自动跑脚本，数据有变化才提交；不需要的话删掉这个文件即可。

## 改“我”的部分

所有个人文案集中在 `content.js`，不需要翻 HTML：

```js
window.SITE_CONTENT = {
  tagline: '首屏一句话',
  intro: '关于我的简介',
  quote: '首屏小纸条 / 签名',
  favoriteOrder: [3575, 24760, 19041, 14823, 53770],
  characterNotes: { 3575: '角色卡上的一句私货' },
  links: [{ label: 'BANGUMI', href: 'https://bgm.tv/user/m1n' }],
};
```

文件底部留了 TODO：最近循环的歌、喜欢的监督/公司/声优、圣地巡礼、三句想说的话、其他社交主页。想加板块时，先补数据，再加一个 `<section>` 和对应的 render 函数即可。

## 设计说明

- **配色**：纸白 `#fbf8f1`、朱红 `#c7000a / #7d0000`、墨黑 `#1c1a17`，青色/粉色/黄色只做点缀。
- **字体**：Inter（英文标题）、Noto Sans SC（中文）、Mochiy Pop One（日文小标签），来自 Google Fonts；被墙或离线时会回退到系统字体。
- **菜单**：右上角印章按钮，环形 MENU 文字 + 三横；打开后全屏红底白点，菜单项逐条弹入，支持 Esc、焦点循环和滚动锁。
- **卡片**：白底、粗描边、硬阴影、轻微旋转和胶带；数据区保持白卡，先保证可读，再谈风格。
- **动效**：滚动 reveal、跑马灯、柱状图生长、封面悬停；全部尊重 `prefers-reduced-motion`。
- **响应式**：1440 / 1024 / 768 / 390 四档验证；平板的 5 张角色卡会重排成居中的 3+2。
- **搜索**：收藏墙支持标题（中/日）、年份、标签的即时过滤；搜索时自动回到 ALL，避免被当前类型筛选挡住。RECORDS 里的年份柱和口味标签也可直接点击，带着条件跳到收藏墙；搜索结果超过 48 条时可以继续展开。
- **详情弹窗**：点收藏墙/搜索结果里的封面，会在页内打开作品详情（我的评分、状态、进度、标签、短评），`Ctrl/⌘` 点击仍直接去 Bangumi；WISHLIST 的“随机抽一部”也会用同一个弹窗。

参考的是动画官网的**语法**（版式、字重、红白关系、印章菜单、纸屑），没有使用官网的 logo、插画或视频素材。

## 质量检查

```bash
python3 scripts/check_site.py
```

会检查 `data.json` 的字段/数量/重复项、HTML 的重复 id、锚点目标、本地资源、图片 alt、viewport 等；CI 里还有一条 `.github/workflows/check.yml` 跑同样的检查和语法检查。

## 部署到 GitHub Pages

```bash
git add .
git commit -m "feat: anime-official-site style ACGN archive"
git branch -M main
git remote add origin https://github.com/<你的用户名>/bgm-showcase.git
git push -u origin main
```

仓库 **Settings → Pages → Source** 选 `main` / `(root)`，几十秒后访问：

```text
https://<你的用户名>.github.io/bgm-showcase/
```

`data.json`、`content.js`、`scripts/` 都会一起发布；没有构建步骤。仓库里带了 `.nojekyll`、`robots.txt` 和一个同风格的 `404.html`，GitHub Pages 找不到路径时会回到这张“迷路的档案”。

## 技术说明

- 纯静态：`index.html` + `style.css` + `app.js` + `content.js` + `data.json`
- 零依赖、零构建；`scripts/fetch_bgm.py` 只用 Python 标准库
- 图片直接引用 `lain.bgm.tv` 的公开封面，`loading="lazy"`；加载失败会自动替换成占位图
- `data.json` 约 890 KB（未压缩）；页面首屏只加载 hero / profile 所需图片
- 兼容现代浏览器；不支持 `IntersectionObserver` 时会直接显示全部内容

## 版权

本页是个人兴趣展示，非官方站点。作品封面、角色画像的版权归各自原作者及版权方所有；数据与图片来自 Bangumi。页面代码可自由修改自用。
