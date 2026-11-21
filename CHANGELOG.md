# CHANGELOG

## 2026-11-21 — feedback pass

- 全屏菜单按官网思路重做：印章按钮嵌在右上角，左站名 + BANGUMI / X / GitHub，右英文大标题 + 日文小注；去掉中文小字、编号和 TOP。
- 删除 FAVORITES 的解说词、每张角色卡的介绍、RECORDS 各模块的说明小字。
- 页脚原本的宣言改成随机台词打字机；删掉重复的 BACK TO TOP，只保留浮动箭头。
- 收藏链接从白屏的 `bgm.tv/user/m1n/collections` 改为可用的 `bgm.tv/user/m1n`；首屏主按钮改为打开 Bangumi 主页。
- 口味地图的「我的评分」移到图表上方，不再和 10 分刻度重叠。
- DATA SNAPSHOT 增加说明：它是最后一次抓取时间，收藏更新后需要重跑脚本；部署后每周 Actions 会自动刷新。

## 2026-11-21 — overnight rebuild

### 站点
- 按动画官网的视觉语法重做整页：纸白点阵、朱红贴纸标题、深红硬投影、环形印章菜单、全屏红底菜单、贴纸卡片、荧光纸屑。
- 新增 HERO / PROFILE / FEATURED / FAVORITES / WATCHING / WISHLIST / RECORDS / TOP RATED / ARCHIVE / WORDS。
- 新增作品详情弹窗：我的评分、状态、进度、标签、短评、Bangumi 链接、`#work-<id>` 深链和复制链接。
- 收藏墙支持全量 1,327 部搜索（标题 / 年份 / 标签）、类型筛选、显示更多；年份柱和口味标签可以直接带着条件跳过去。
- WISHLIST 支持横向书架和“随机抽一部”，抽到直接打开详情。
- 制作公司 Top 8（按条目标签统计，面板里标注了可能漏计）。
- 评分分布、状态环、年份分布、口味散点图、和大众评分分歧。
- 响应式到 390 / 768 / 1024 / 1440，Chromium / WebKit / Firefox 都验过。

### 工程
- 数据改为 `data.json` 快照，`scripts/fetch_bgm.py` 可重抓；每周一有 GitHub Actions 自动刷新。
- `content.js` 集中个人文案；`README.md` 写清怎么换角色、换文案、刷新数据、部署。
- 本地字体 subset（Inter / Mochiy Pop / Noto Display），主页面不再请求 Google Fonts。
- 首屏封面与统计数字静态预渲染；小尺寸封面改用 200px 源图，减少图片传输。
- 页脚加“打印 / PDF”，配套 A4 打印样式（隐藏菜单/搜索/收藏墙，处理分页和懒加载封面）。
- `site.webmanifest` + 主屏图标、`404.html`、`.nojekyll`、`robots.txt`。
- `scripts/check_site.py` + `.github/workflows/check.yml` 做数据/HTML/资源自检。
- iOS 滚动锁、Safari 焦点环、跨引擎字体和详情封面加载都单独修过。

### 已知边界
- 首屏 LCP 仍受 893 KB 的 `data.json` 影响；要明显改善需要把首屏数据和全量搜索数据拆开。
- 404 页仍用 Google Fonts CDN；主页面已经不用。
- 没有 Service Worker / 离线缓存；封面与数据需要联网。
- 没有 deploy，也没有绑定域名。
- 个人简介、音乐/圣地/社交链接等仍是可替换的默认值；X / GitHub 目前是平台首页占位。
