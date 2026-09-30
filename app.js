/* ============================================================
   Bangumi ACGN Showcase — v4
   三套亮色主题 · 角色卡渐变边框 · 数据实时来自 Bangumi API
   ============================================================ */
(() => {
  'use strict';

  const CONFIG = {
    username: 'm1n',
    api: 'https://api.bgm.tv/v0',

    // 最爱角色：id 即 bgm.tv/character/{id} 里的数字
    favorites: [
      { id: 3575 },
      { id: 24760 },
      { id: 19041 },
      { id: 14823 },
      { id: 53770 },
    ],

    // 分类：type 1=书籍 2=动画 3=音乐 4=游戏 6=三次元
    subjects: [
      { type: 2, zh: '动画',         accent: 'var(--c-anime)' },
      { type: 1, zh: '漫画 / 轻小说', accent: 'var(--c-book)' },
      { type: 4, zh: '游戏',         accent: 'var(--c-game)' },
    ],

    wallCount: 120,
    watchingLimit: 5,
    topPerGroup: 5,
    maxPages: 12,   // 每类型最多 1200 条（覆盖大户）
  };

  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const getJSON = (path) =>
    fetch(CONFIG.api + path).then((r) => {
      if (!r.ok) throw new Error(path + ' → HTTP ' + r.status);
      return r.json();
    });

  function countUp(el, target) {
    if (!el) return;
    const dur = 950;
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min((now - t0) / dur, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))).toLocaleString();
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  const cover = (s, size) => {
    const im = (s && s.images) || {};
    return im[size || 'common'] || im.medium || im.large || im.small || '';
  };

  /* ============================================================
     主题切换
     ============================================================ */
  function initTheme() {
    const btns = document.querySelectorAll('.theme-switch button');
    const saved = localStorage.getItem('bgm-theme') || 'gold';
    apply(saved);

    btns.forEach((btn) => {
      btn.addEventListener('click', () => {
        apply(btn.dataset.theme);
        try { localStorage.setItem('bgm-theme', btn.dataset.theme); } catch (e) {}
      });
    });

    function apply(t) {
      document.documentElement.setAttribute('data-theme', t);
      btns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.theme === t)));
    }
  }

  /* ============================================================
     背景：作品封面墙
     ============================================================ */
  async function loadCoverWall() {
    const wall = $('#cover-wall');
    if (!wall) return;
    try {
      const d = await getJSON('/users/' + CONFIG.username + '/collections?limit=100');
      const srcs = (d.data || [])
        .map((it) => {
          const im = (it.subject && it.subject.images) || {};
          return im.small || im.grid || im.common || '';
        })
        .filter(Boolean);

      if (!srcs.length) return;

      const pool = srcs.slice().sort(() => Math.random() - 0.5);
      const out = [];
      for (let i = 0; i < CONFIG.wallCount; i++) out.push(pool[i % pool.length]);

      wall.innerHTML = out.map((s) => '<img src="' + s + '" alt="" loading="eager">').join('');
    } catch (e) {
      console.warn('[wall]', e);
    }
  }

  /* ============================================================
     顶部资料
     ============================================================ */
  async function loadProfile() {
    try {
      const u = await getJSON('/users/' + CONFIG.username);
      const av = (u.avatar && (u.avatar.large || u.avatar.medium)) || '';
      if (av) $('#avatar').src = av;
      $('#nickname').textContent = u.nickname || CONFIG.username;
      $('#sign').textContent = u.sign || '';

      const url = 'https://bgm.tv/user/' + CONFIG.username;
      $('#pill-text').textContent = 'bgm.tv/user/' + CONFIG.username;
      $('#profile-link').href = url;
    } catch (e) {
      console.warn('[profile]', e);
      $('#nickname').textContent = CONFIG.username;
    }
  }

  /* ============================================================
     最爱角色（只显示日文名）
     ============================================================ */
  async function loadFavorites() {
    const box = $('#favorites');
    const res = await Promise.allSettled(
      CONFIG.favorites.map((c) => getJSON('/characters/' + c.id))
    );

    box.innerHTML = '';
    res.forEach((r, i) => {
      const cfg = CONFIG.favorites[i];
      const d = r.status === 'fulfilled' ? r.value : null;
      const img = d && d.images ? (d.images.large || d.images.medium || '') : '';
      const name = (d && d.name) || '';   // 只取日文原名

      const a = document.createElement('a');
      a.className = 'fav-card';
      a.href = 'https://bgm.tv/character/' + cfg.id;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.style.animationDelay = i * 80 + 'ms';
      a.innerHTML =
        (img ? '<img src="' + img + '" alt="' + esc(name) + '" loading="lazy">' : '') +
        '<span class="fav-corners" aria-hidden="true"></span>' +
        '<span class="fav-rank">#' + (i + 1) + '</span>' +
        '<span class="fav-name"><strong>' + esc(name) + '</strong></span>';
      box.appendChild(a);
    });
  }

  /* ============================================================
     最近在看
     ============================================================ */
  async function loadWatching() {
    const box = $('#watching');
    try {
      const d = await getJSON(
        '/users/' + CONFIG.username + '/collections?type=3&limit=' + CONFIG.watchingLimit
      );
      const items = d.data || [];
      if (!items.length) {
        box.innerHTML = '<p class="empty">暂无「在看」的条目</p>';
        return;
      }
      box.innerHTML = items.map((it) => {
        const s = it.subject || {};
        const img = cover(s, 'common');
        const ep = it.ep_status ? it.ep_status + ' 话' : '';
        return '' +
          '<a class="watch-item" href="https://bgm.tv/subject/' + s.id + '" target="_blank" rel="noopener noreferrer">' +
            (img ? '<img src="' + img + '" alt="" loading="lazy">' : '<span></span>') +
            '<span class="watch-meta">' +
              '<strong>' + esc(s.name_cn || s.name) + '</strong>' +
              '<span>' + esc((it.updated_at || '').slice(0, 10)) + '</span>' +
            '</span>' +
            '<span class="watch-ep">' + esc(ep) + '</span>' +
          '</a>';
      }).join('');
    } catch (e) {
      console.warn('[watching]', e);
      box.innerHTML = '<p class="empty">加载失败</p>';
    }
  }

  /* ============================================================
     看过分布
     ============================================================ */
  async function loadCompleted() {
    const legendEl = $('#legend');

    const counts = await Promise.all(
      CONFIG.subjects.map((s) =>
        getJSON('/users/' + CONFIG.username + '/collections?subject_type=' + s.type + '&type=2&limit=1')
          .then((d) => d.total || 0).catch(() => 0)
      )
    );

    const total = counts.reduce((a, b) => a + b, 0);

    let acc = 0;
    const stops = counts.map((n, i) => {
      const from = total ? (acc / total) * 360 : 0;
      acc += n;
      const to = total ? (acc / total) * 360 : 0;
      return CONFIG.subjects[i].accent + ' ' + from + 'deg ' + to + 'deg';
    });
    $('#donut').style.background =
      'conic-gradient(' + stops.join(',') + (total ? '' : 'var(--line) 0 360deg') + ')';

    countUp($('#donut-total'), total);

    legendEl.innerHTML = CONFIG.subjects.map((s, i) => {
      const pct = total ? Math.round((counts[i] / total) * 100) : 0;
      return '<li>' +
        '<span class="dot" style="background:' + s.accent + '"></span>' +
        '<span class="label">' + esc(s.zh) + '</span>' +
        '<span class="pct">' + pct + '%</span>' +
        '<span class="count" data-target="' + counts[i] + '">0</span>' +
      '</li>';
    }).join('');
    legendEl.querySelectorAll('.count').forEach((el) => countUp(el, +el.dataset.target));
  }

  /* ============================================================
     评分 Top 5
     ============================================================ */
  async function fetchTypeCollections(type) {
    const out = [];
    for (let page = 0; page < CONFIG.maxPages; page++) {
      const d = await getJSON(
        '/users/' + CONFIG.username + '/collections?subject_type=' + type +
        '&limit=100&offset=' + page * 100
      ).catch(() => null);
      if (!d || !d.data || !d.data.length) break;
      out.push.apply(out, d.data);
      if (d.data.length < 100) break;
    }
    return out;
  }

  async function loadTopRated() {
    const box = $('#top-rated');

    const groups = await Promise.all(
      CONFIG.subjects.map((s) =>
        fetchTypeCollections(s.type)
          .then((list) => ({ cfg: s, list }))
          .catch(() => ({ cfg: s, list: [] }))
      )
    );

    box.innerHTML = groups.map((g, gi) => {
      const rated = g.list
        .filter((it) => it.rate && it.rate > 0)
        .sort((a, b) => (b.rate - a.rate) || ((b.subject.score || 0) - (a.subject.score || 0)))
        .slice(0, CONFIG.topPerGroup);

      const rows = rated.length
        ? rated.map((it, i) => {
            const s = it.subject || {};
            const img = cover(s, 'common');
            const date = (s.date || '').slice(0, 4);
            return '<a class="top-item" href="https://bgm.tv/subject/' + s.id + '" target="_blank" rel="noopener noreferrer">' +
              '<span class="no">' + (i + 1) + '</span>' +
              (img ? '<img src="' + img + '" alt="" loading="lazy">' : '<span></span>') +
              '<span class="t"><strong>' + esc(s.name_cn || s.name) + '</strong>' +
              '<span>' + esc(date) + (s.score ? ' · 均分 ' + s.score : '') + '</span></span>' +
              '<span class="score">' + it.rate + '.0</span>' +
            '</a>';
          }).join('')
        : '<p class="empty">暂无评分数据</p>';

      return '<div class="top-group" style="--accent:' + g.cfg.accent + ';animation-delay:' + gi * 90 + 'ms">' +
        '<h3><span class="bar"></span>' + esc(g.cfg.zh) +
        '<span class="cnt">' + g.list.filter((x) => x.rate > 0).length + ' 部已评分</span></h3>' +
        '<div class="top-list">' + rows + '</div>' +
      '</div>';
    }).join('');
  }

  /* ---------------- 启动 ---------------- */
  initTheme();
  loadProfile();
  loadCoverWall();
  loadFavorites();
  loadWatching();
  loadCompleted();
  loadTopRated();
})();
