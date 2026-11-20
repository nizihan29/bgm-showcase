/* ============================================================
   KOKO / ACGN ARCHIVE
   Vanilla JS. Reads data.json (snapshot from scripts/fetch_bgm.py).
   ============================================================ */
(() => {
  'use strict';

  const CONTENT = window.SITE_CONTENT || {};
  const TYPES = {
    1: { en: 'MANGA', zh: '书籍', short: 'MANGA', color: '#16b8d6' },
    2: { en: 'ANIME', zh: '动画', short: 'ANIME', color: '#c7000a' },
    3: { en: 'MUSIC', zh: '音乐', short: 'MUSIC', color: '#ffd451' },
    4: { en: 'GAME', zh: '游戏', short: 'GAME', color: '#ffd451' },
    6: { en: 'REAL', zh: '三次元', short: 'REAL', color: '#b79cff' },
  };
  const STATUS = {
    1: { zh: '想看', color: '#1c1a17' },
    2: { zh: '看过', color: '#c7000a' },
    3: { zh: '在看', color: '#16b8d6' },
    4: { zh: '搁置', color: '#ffd451' },
    5: { zh: '抛弃', color: '#b79cff' },
  };
  const FAVORITE_ORDER = CONTENT.favoriteOrder || [3575, 24760, 19041, 14823, 53770];
  const TAG_STOP = new Set([
    'TV', '日本', '已完结', '连载中', '漫画改', '漫改', '轻小说改', '小说', '漫画',
    '原创', '剧场版', 'OVA', 'WEB', '动画', '欧美', '美国', '中国', '国产',
    '短片', 'CM', 'PV', '同人', '游戏改', '真人', '日剧', '电影',
    '单行本', '漫画系列', '轻小说分卷', '轻改', '小说改',
  ]);
  const PH = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600">' +
    '<rect width="400" height="600" fill="#e9dfcc"/>' +
    '<path d="M0 0h400v600H0z" fill="none" stroke="#1c1a17" stroke-width="6"/>' +
    '<circle cx="200" cy="270" r="54" fill="none" stroke="#c7000a" stroke-width="6"/>' +
    '<path d="M170 300l60-60M230 300l-60-60" stroke="#c7000a" stroke-width="6"/>' +
    '<text x="200" y="380" text-anchor="middle" font-family="Arial" font-size="20" letter-spacing="4" fill="#7c7365">NO IMAGE</text>' +
    '</svg>'
  );

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (value) => String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const fmtInt = (n) => Number(n || 0).toLocaleString('en-US');
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const bgmSubject = (id) => 'https://bgm.tv/subject/' + encodeURIComponent(id);
  const bgmCharacter = (id) => 'https://bgm.tv/character/' + encodeURIComponent(id);
  const titleOf = (s) => (s && (s.name_cn || s.name)) || '未知作品';

  const state = { data: null, stats: null, archiveItems: [], filter: 'all', total: 0 };

  /* ---------------- boot ---------------- */
  init();

  async function init() {
    bindChrome();
    initImageFallback();
    try {
      const res = await fetch('data.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error('data.json → HTTP ' + res.status);
      state.data = await res.json();
      state.stats = computeStats(state.data);
      renderAll();
    } catch (err) {
      console.error('[archive]', err);
      showDataError(err);
    }
    initReveal();
    initSpy();
  }

  /* ---------------- stats ---------------- */
  function computeStats(data) {
    const cols = (data.collections || []).slice();
    const byType = {};
    const byStatus = {};
    const dist = {};
    for (let i = 4; i <= 10; i++) dist[i] = 0;

    cols.forEach((c) => {
      byType[c.subject_type] = (byType[c.subject_type] || 0) + 1;
      byStatus[c.type] = (byStatus[c.type] || 0) + 1;
      if (c.rate >= 4) dist[c.rate] += 1;
    });

    const rated = cols.filter((c) => c.rate > 0);
    const avg = rated.length ? rated.reduce((sum, c) => sum + c.rate, 0) / rated.length : 0;

    const top = {};
    [2, 1, 4].forEach((type) => {
      top[type] = cols
        .filter((c) => c.subject_type === type && c.rate > 0)
        .sort((a, b) => (b.rate - a.rate) || ((b.subject.score || 0) - (a.subject.score || 0)))
        .slice(0, 5);
    });

    // year buckets: <=1999 + 2000..2026
    const buckets = [{ label: '≤1999', year: 1999, count: 0 }];
    for (let y = 2000; y <= 2026; y++) buckets.push({ label: String(y), year: y, count: 0 });
    cols.forEach((c) => {
      const y = parseInt((c.subject.date || '').slice(0, 4), 10);
      if (!y) return;
      if (y <= 1999) buckets[0].count += 1;
      else if (y <= 2026) buckets[y - 1999].count += 1;
    });

    // tags
    const tagMap = new Map();
    cols.forEach((c) => {
      (c.subject.tags || []).forEach((t) => {
        if (!t || TAG_STOP.has(t) || /^\d{4}(年|$)/.test(t)) return;
        tagMap.set(t, (tagMap.get(t) || 0) + 1);
      });
    });
    const tags = Array.from(tagMap, ([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 24);

    // score disagreements
    const diffs = rated
      .filter((c) => c.subject.score > 0)
      .map((c) => ({ c, diff: +(c.rate - c.subject.score).toFixed(1) }))
      .filter((x) => Math.abs(x.diff) >= 1.0)
      .sort((a, b) => b.diff - a.diff);
    const deviations = diffs.filter((x) => x.diff > 0).slice(0, 4)
      .concat(diffs.filter((x) => x.diff < 0).slice(-4).reverse());

    const watching = cols
      .filter((c) => c.type === 3)
      .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
      .slice(0, 5);

    const wish = cols
      .filter((c) => c.type === 1)
      .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)) || ((b.subject.score || 0) - (a.subject.score || 0)));

    const compared = rated.filter((c) => c.subject.score > 0);
    const avgDiff = compared.length
      ? compared.reduce((sum, c) => sum + (c.rate - c.subject.score), 0) / compared.length
      : 0;

    const comments = cols
      .filter((c) => c.comment && c.comment.length >= 6)
      .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
      .slice(0, 3);

    const completed = cols.filter((c) => c.type === 2).length;

    return {
      cols, byType, byStatus, dist, rated, avg, top, buckets, tags,
      deviations, watching, wish, avgDiff, comments, completed,
      total: cols.length,
      tagPeak: tags[0] ? tags[0].count : 1,
      maxDist: Math.max(1, ...Object.values(dist)),
      maxYear: Math.max(1, ...buckets.map((b) => b.count)),
    };
  }

  /* ---------------- render ---------------- */
  function renderAll() {
    const { data, stats } = state;
    renderChrome(data);
    renderHero(data, stats);
    renderProfile(data, stats);
    renderFeatured(data, stats);
    renderFavorites(data);
    renderWatching(stats);
    renderWishlist(data, stats);
    renderRecords(stats);
    renderTasteMap(stats);
    renderTop(stats);
    renderArchive(data, stats);
    renderWords(stats);
    renderTicker(stats);
    renderFooter(data, stats);
    animateBars();
    initHeroParallax();
  }

  function renderChrome(data) {
    const p = data.profile || {};
    const av = $('#avatar');
    if (av && p.avatar) av.src = p.avatar;
    if ($('#tagline')) $('#tagline').textContent = CONTENT.tagline || '';
    if ($('#kicker') && CONTENT.kicker) $('#kicker').textContent = CONTENT.kicker;
    if ($('#hero-quote')) $('#hero-quote').textContent = CONTENT.quote || p.sign || '';
    if ($('#hero-quote-from')) $('#hero-quote-from').textContent = CONTENT.quoteFrom || 'BANGUMI SIGNATURE';

    const social = $('.menu-social');
    if (social && CONTENT.links && CONTENT.links.length) {
      social.innerHTML = CONTENT.links.map((l) => (
        '<a href="' + esc(l.href) + '" target="_blank" rel="noopener noreferrer">' + esc(l.label) + ' ↗</a>'
      )).join('');
    }
  }

  function renderHero(data, stats) {
    const statsEl = $('#hero-stats');
    if (statsEl) {
      const vals = [fmtInt(stats.total), fmtInt(stats.rated.length), stats.avg.toFixed(2)];
      $$('dd', statsEl).forEach((dd, i) => { dd.textContent = vals[i]; });
    }

    const stack = $('#hero-stack');
    if (!stack) return;
    const featured = data.featured && data.featured.subject;
    const picks = [];
    if (featured) picks.push(featured);
    stats.top[2].forEach((c) => {
      if (picks.length < 5 && !picks.some((p) => p.id === c.subject.id)) picks.push(c.subject);
    });
    stats.cols.slice().sort((a, b) => b.rate - a.rate).forEach((c) => {
      if (picks.length < 5 && !picks.some((p) => p.id === c.subject.id)) picks.push(c.subject);
    });

    stack.innerHTML = picks.slice(0, 5).map((s, i) => (
      '<div class="stack-card">' +
        '<img src="' + esc((s.images && s.images.common) || '') + '" alt="" loading="' + (i < 2 ? 'eager' : 'lazy') + '" decoding="async" referrerpolicy="no-referrer">' +
        '<span class="stack-title">' + esc(titleOf(s)) + '</span>' +
      '</div>'
    )).join('');
  }

  function renderProfile(data, stats) {
    const p = data.profile || {};
    if ($('#profile-name')) $('#profile-name').textContent = p.nickname || p.username || '—';
    if ($('#profile-handle')) {
      $('#profile-handle').textContent = '@' + (p.username || 'm1n');
      $('#profile-handle').href = p.url || 'https://bgm.tv/user/m1n';
    }
    if ($('#profile-avatar') && p.avatar) $('#profile-avatar').src = p.avatar;
    if ($('#profile-intro')) $('#profile-intro').textContent = CONTENT.intro || p.sign || '';
    if ($('#profile-quote')) $('#profile-quote').textContent = CONTENT.quote || p.sign || '';

    const tagBox = $('#profile-tags');
    if (tagBox) {
      const tags = (CONTENT.profileTags && CONTENT.profileTags.length)
        ? CONTENT.profileTags.map((name) => ({ name, count: 0 }))
        : stats.tags.slice(0, 6);
      tagBox.innerHTML = tags.map((t) => (
        '<span class="tag">' + esc(t.name) + (t.count ? '<b>' + t.count + '</b>' : '') + '</span>'
      )).join('');
    }

    const facts = $('#fact-strip');
    if (facts) {
      const topRate = Object.entries(stats.dist).sort((a, b) => b[1] - a[1])[0];
      facts.innerHTML = [
        [fmtInt(stats.completed), '部看完'],
        [fmtInt(stats.rated.length), '部打过评分'],
        [stats.avg.toFixed(2), '平均分'],
        [topRate ? topRate[0] + ' 分' : '—', topRate ? '最常给出的分数' : ''],
      ].map(([b, s]) => '<div><b>' + esc(b) + '</b><span>' + esc(s) + '</span></div>').join('');
    }

    const now = $('#now-grid');
    if (!now) return;

    const featured = data.featured && data.featured.subject;
    const watching = stats.watching.find((w) => !featured || w.subject_id !== featured.id) || stats.watching[0];
    const recommend = stats.top[2][0];
    const honmei = (data.characters && data.characters[String(FAVORITE_ORDER[0])]) || null;
    const cards = [];

    if (featured) {
      const fCol = stats.cols.find((c) => c.subject_id === featured.id);
      cards.push({
        red: true,
        label: 'NOW OBSESSED',
        title: titleOf(featured),
        meta: fCol && fCol.ep_status ? '看到 EP.' + String(fCol.ep_status).padStart(2, '0') : seasonOf(featured.date) + ' 开播',
        img: imgSrc(featured),
        href: bgmSubject(featured.id),
        alt: titleOf(featured),
      });
    }
    if (honmei) {
      cards.push({
        label: 'HONMEI / 本命',
        title: charName(honmei),
        meta: [charInfo(honmei, '生日'), charInfo(honmei, '身高')].filter(Boolean).join(' / ') || '最喜欢的角色',
        img: charImg(honmei),
        href: bgmCharacter(honmei.id),
        alt: charName(honmei),
      });
    }
    if (watching) {
      cards.push({
        label: 'WATCHING / 在看',
        title: titleOf(watching.subject),
        meta: '更新 ' + fmtDateShort(watching.updated_at),
        img: imgSrc(watching.subject),
        href: bgmSubject(watching.subject.id),
        alt: titleOf(watching.subject),
      });
    }
    if (recommend) {
      cards.push({
        label: 'RECOMMEND / 想安利',
        title: titleOf(recommend.subject),
        meta: '我 ' + recommend.rate + ' / 均分 ' + (recommend.subject.score || '—'),
        img: imgSrc(recommend.subject),
        href: bgmSubject(recommend.subject.id),
        alt: titleOf(recommend.subject),
      });
    }

    now.innerHTML = cards.map((c) => (
      '<a class="now-card' + (c.red ? ' is-red' : '') + '" href="' + esc(c.href) + '" target="_blank" rel="noopener noreferrer">' +
        '<span class="now-arrow" aria-hidden="true">↗</span>' +
        '<img class="now-cover" src="' + esc(c.img) + '" alt="' + esc(c.alt) + '" loading="lazy" decoding="async" referrerpolicy="no-referrer">' +
        '<span class="now-text">' +
          '<span class="now-label">' + esc(c.label) + '</span>' +
          '<span class="now-title">' + esc(c.title) + '</span>' +
          '<span class="now-meta">' + esc(c.meta) + '</span>' +
        '</span>' +
      '</a>'
    )).join('');
  }

  function renderFeatured(data, stats) {
    const box = $('#feature');
    if (!box) return;
    const feat = data.featured && data.featured.subject;
    if (!feat) return;
    const col = stats.cols.find((c) => c.subject_id === feat.id);
    const base = (col && col.subject) || feat;
    const images = feat.images || {};

    setText('#feature-title', titleOf(feat));
    setText('#feature-jp', feat.name || '');
    setText('#feature-kicker', seasonOf(feat.date) + ' / ' + ((feat.platform || 'TV') + ' ' + (TYPES[feat.type] ? TYPES[feat.type].en : 'ANIME')).toUpperCase());
    setText('#feature-summary', featureSummary(data.featured.summary));
    if ($('#feature-cover')) {
      $('#feature-cover').src = images.large || images.common || PH;
      $('#feature-cover').alt = titleOf(feat) + ' 封面';
    }
    if ($('#feature-link')) $('#feature-link').href = bgmSubject(feat.id);

    const tags = (CONTENT.featuredTags && CONTENT.featuredTags.length)
      ? CONTENT.featuredTags.slice(0, 6)
      : (base.tags || feat.tags || []).filter((t) => !TAG_STOP.has(t) && !/^\d{4}(年|$)/.test(t)).slice(0, 6);
    if ($('#feature-tags')) {
      $('#feature-tags').innerHTML = tags.map((t) => '<li>' + esc(t) + '</li>').join('');
    }
    if ($('#feature-meta')) {
      const score = base.score ? Number(base.score).toFixed(1) : '—';
      const rank = base.rank ? '#' + base.rank : '—';
      const mine = col && col.rate ? col.rate + ' / 10' : '未评分';
      $('#feature-meta').innerHTML = [
        ['放送', (feat.date || '').replace(/-/g, '.') || '—'],
        ['我的评分', mine],
        ['BANGUMI', score + ' / ' + rank],
      ].map(([k, v]) => '<div><dt>' + esc(k) + '</dt><dd>' + esc(v) + '</dd></div>').join('');
    }
    if ($('#feature-ep')) {
      $('#feature-ep').textContent = col && col.ep_status
        ? '看到 EP.' + String(col.ep_status).padStart(2, '0') + (feat.eps ? ' / ' + feat.eps : '')
        : '';
    }
  }

  function renderFavorites(data) {
    const box = $('#char-grid');
    if (!box) return;
    const chars = data.characters || {};
    const tilts = ['-2.4deg', '1.6deg', '-1.2deg', '2.2deg', '-1.8deg'];
    const offsets = ['0px', '34px', '8px', '46px', '16px'];

    box.innerHTML = FAVORITE_ORDER.map((id, i) => {
      const c = chars[String(id)];
      if (!c) return '';
      const note = (CONTENT.characterNotes && CONTENT.characterNotes[id]) || '';
      const roman = charAlias(c, '罗马字') || ('CHARACTER ' + String(i + 1).padStart(2, '0'));
      return '<article class="char-card" style="--tilt:' + tilts[i % tilts.length] + ';--offset:' + offsets[i % offsets.length] + '">' +
        '<span class="char-no">' + String(i + 1).padStart(2, '0') + '</span>' +
        '<div class="char-pic">' +
          '<img src="' + esc(charImg(c)) + '" alt="' + esc(charName(c)) + '" loading="lazy" decoding="async" referrerpolicy="no-referrer">' +
          '<span class="char-name-onpic">' + esc(roman.toUpperCase()) + '</span>' +
          '<a class="char-open" href="' + esc(bgmCharacter(c.id)) + '" target="_blank" rel="noopener noreferrer" aria-label="在 Bangumi 查看 ' + esc(charName(c)) + '">↗</a>' +
        '</div>' +
        '<div class="char-info">' +
          '<p class="char-jp">' + esc(c.name || '') + '</p>' +
          '<h3 class="char-name">' + esc(charName(c)) + '</h3>' +
          '<p class="char-note">' + esc(note) + '</p>' +
          '<dl class="char-meta">' +
            '<div><dt>BIRTH</dt><dd>' + esc(charInfo(c, '生日') || '—') + '</dd></div>' +
            '<div><dt>HEIGHT</dt><dd>' + esc(charInfo(c, '身高') || '—') + '</dd></div>' +
            '<div><dt>BLOOD</dt><dd>' + esc(charInfo(c, '血型') || '—') + '</dd></div>' +
          '</dl>' +
        '</div>' +
      '</article>';
    }).join('');
  }

  function renderWatching(stats) {
    const box = $('#watch-board');
    if (!box) return;
    if (!stats.watching.length) {
      box.innerHTML = '<p class="empty">最近没有在看的条目。</p>';
      return;
    }
    box.innerHTML = stats.watching.map((c, i) => {
      const s = c.subject;
      const eps = s.eps || 0;
      const ep = c.ep_status || 0;
      const pct = eps ? clamp(Math.round((ep / eps) * 100), 0, 100) : 0;
      const d = dateParts(c.updated_at);
      const tags = (s.tags || []).slice(0, 3).join(' / ');
      return '<a class="watch-row" href="' + esc(bgmSubject(s.id)) + '" target="_blank" rel="noopener noreferrer">' +
        '<span class="watch-no">' + String(i + 1).padStart(2, '0') + '</span>' +
        '<img class="watch-cover" src="' + esc(imgSrc(s)) + '" alt="' + esc(titleOf(s)) + '" loading="lazy" decoding="async" referrerpolicy="no-referrer">' +
        '<div class="watch-main">' +
          '<h3>' + esc(titleOf(s)) + '</h3>' +
          '<div class="watch-sub"><b>EP.' + String(ep).padStart(2, '0') + (eps ? ' / ' + eps : '') + '</b><span>' + esc(tags || '在看') + '</span></div>' +
        '</div>' +
        '<div class="watch-progress">' +
          '<p><span>PROGRESS</span><b>' + (eps ? pct + '%' : '—') + '</b></p>' +
          '<div class="watch-bar"><i style="width:' + pct + '%"></i></div>' +
        '</div>' +
        '<div class="watch-date"><b>' + esc(d.day) + '</b>' + esc(d.month) + ' ' + esc(d.year) + '</div>' +
      '</a>';
    }).join('');
  }

  function renderWishlist(data, stats) {
    const section = $('#wishlist');
    if (!section) return;
    if (!stats.wish.length) { section.hidden = true; return; }

    setText('#wish-total', fmtInt(stats.wish.length));
    setText('#wish-note', CONTENT.wishlistNote || '');

    const grid = $('#wish-grid');
    if (!grid) return;
    grid.innerHTML = stats.wish.slice(0, 8).map((c, i) => {
      const s = c.subject;
      return '<a class="wish-card" href="' + esc(bgmSubject(s.id)) + '" target="_blank" rel="noopener noreferrer">' +
        '<span class="wish-pic">' +
          '<img src="' + esc(imgSrc(s)) + '" alt="' + esc(titleOf(s)) + '" loading="lazy" decoding="async" referrerpolicy="no-referrer">' +
          '<span class="wish-no">' + String(i + 1).padStart(2, '0') + '</span>' +
        '</span>' +
        '<span class="wish-info"><strong>' + esc(titleOf(s)) + '</strong><small>' + esc((s.date || '').slice(0, 4) || '—') + ' · 均分 ' + esc(s.score || '—') + '</small></span>' +
      '</a>';
    }).join('');

    $$('.shelf-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const step = Math.max(220, grid.clientWidth * 0.75);
        const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        grid.scrollBy({ left: Number(btn.dataset.dir) * step, behavior: reduce ? 'auto' : 'smooth' });
      });
    });
  }

  function renderRecords(stats) {
    const nums = $('#number-row');
    if (nums) {
      nums.innerHTML = [
        [fmtInt(stats.total), 'ALL TITLES', '总收藏'],
        [fmtInt(stats.completed), 'COMPLETED', '看完'],
        [fmtInt(stats.rated.length), 'RATED', '打过评分'],
        [stats.avg.toFixed(2), 'AVERAGE', '平均分'],
      ].map(([n, en, zh]) => '<div><strong>' + esc(n) + '</strong><span>' + esc(en) + '</span><small>' + esc(zh) + '</small></div>').join('');
    }

    const rating = $('#rating-chart');
    if (rating) {
      rating.innerHTML = Object.keys(stats.dist).map((score) => {
        const count = stats.dist[score];
        const pct = count ? Math.max(3, (count / stats.maxDist) * 100) : 0;
        return '<div class="bar-col' + (count === stats.maxDist ? ' is-hot' : '') + '" title="' + score + ' 分 · ' + count + ' 部">' +
          '<div class="bar" data-h="' + pct.toFixed(2) + '" style="height:0"><span class="bar-count">' + count + '</span></div>' +
          '<span class="bar-x">' + score + '</span>' +
        '</div>';
      }).join('');
    }
    if ($('#rating-note')) {
      $('#rating-note').textContent = fmtInt(stats.rated.length) + ' 部有评分 · 平均 ' + stats.avg.toFixed(2) + ' 分 · 只统计 4 分及以上';
    }

    const donut = $('#status-donut');
    if (donut) {
      const order = [2, 1, 3, 4, 5];
      const total = stats.total || 1;
      const C = 2 * Math.PI * 42;
      let acc = 0;
      const segs = order.map((type) => {
        const count = stats.byStatus[type] || 0;
        const len = (count / total) * C;
        const seg = '<circle class="seg" cx="50" cy="50" r="42" stroke="' + STATUS[type].color + '" stroke-dasharray="' + len.toFixed(2) + ' ' + (C - len).toFixed(2) + '" stroke-dashoffset="' + (-acc).toFixed(2) + '"></circle>';
        acc += len;
        return seg;
      }).join('');

      donut.innerHTML = '<div class="donut"><svg viewBox="0 0 100 100" role="img" aria-label="收藏状态分布">' +
        '<circle class="track" cx="50" cy="50" r="42"></circle>' + segs + '</svg>' +
        '<div class="donut-center"><b>' + fmtInt(stats.total) + '</b><span>TOTAL</span></div></div>' +
        '<ul class="status-legend">' + order.map((type) => (
          '<li><span class="dot" style="background:' + STATUS[type].color + '"></span><span>' + STATUS[type].zh + '</span><b>' + fmtInt(stats.byStatus[type] || 0) + '</b></li>'
        )).join('') + '</ul>';
    }

    const yearBox = $('#year-chart');
    if (yearBox) {
      const bars = stats.buckets.map((b, i) => {
        const pct = b.count ? Math.max(2, (b.count / stats.maxYear) * 100) : 0;
        return '<div class="year-col' + (b.count === stats.maxYear ? ' is-peak' : '') + '" title="' + b.label + ' · ' + b.count + ' 部">' +
          '<span class="ycount">' + b.count + '</span>' +
          '<div class="ybar" data-h="' + pct.toFixed(2) + '" style="height:0"></div>' +
        '</div>';
      }).join('');
      const labels = ['≤1999', '2005', '2010', '2015', '2020', '2026'];
      yearBox.innerHTML = '<div class="year-bars">' + bars + '</div>' +
        '<div class="year-label">' + labels.map((l) => '<span>' + l + '</span>').join('') + '</div>';
    }

    const cloud = $('#tag-cloud');
    if (cloud) {
      const min = stats.tags.length ? stats.tags[stats.tags.length - 1].count : 1;
      const span = Math.max(1, stats.tagPeak - min);
      cloud.innerHTML = stats.tags.map((t, i) => {
        const size = 11 + ((t.count - min) / span) * 18;
        return '<span class="cloud-tag' + (i < 3 ? ' is-top' : '') + '" style="font-size:' + size.toFixed(1) + 'px" title="' + esc(t.name) + ' · ' + t.count + ' 部">' +
          esc(t.name) + '<sup>' + t.count + '</sup>' +
        '</span>';
      }).join('');
    }

    const diff = $('#deviation-list');
    if (diff) {
      diff.innerHTML = stats.deviations.map(({ c, diff: d }) => {
        const s = c.subject;
        return '<a class="diff-row" href="' + esc(bgmSubject(s.id)) + '" target="_blank" rel="noopener noreferrer">' +
          '<img src="' + esc(imgSrc(s)) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">' +
          '<span class="diff-main">' +
            '<span class="diff-title">' + esc(titleOf(s)) + '</span>' +
            '<span class="diff-scores"><b>我 ' + c.rate + '</b><span>均分 ' + (s.score || '—') + '</span></span>' +
          '</span>' +
          '<span class="diff-badge ' + (d > 0 ? 'up' : 'down') + '">' + (d > 0 ? '+' : '') + d.toFixed(1) + '</span>' +
        '</a>';
      }).join('') || '<p class="panel-note">样本还不够形成分歧。</p>';
    }
  }

  function renderTasteMap(stats) {
    const box = $('#taste-scatter');
    if (!box) return;
    const points = stats.cols.filter((c) => c.rate > 0 && c.subject.score > 0);
    if (!points.length) {
      box.innerHTML = '<p class="panel-note">评分样本还不够。</p>';
      return;
    }

    const W = 640, H = 380;
    const m = { l: 46, r: 18, t: 22, b: 40 };
    const xMin = 4, xMax = 10, yMin = 4, yMax = 10;
    const px = (v) => m.l + ((clamp(v, xMin, xMax) - xMin) / (xMax - xMin)) * (W - m.l - m.r);
    const py = (v) => H - m.b - ((clamp(v, yMin, yMax) - yMin) / (yMax - yMin)) * (H - m.t - m.b);
    const colorOf = (type) => type === 2 ? '#c7000a' : type === 1 ? '#0b8ea6' : '#b8860b';

    const xTicks = [4, 6, 8, 10];
    const yTicks = [4, 6, 8, 10];
    const grid = xTicks.map((t) => '<line x1="' + px(t) + '" y1="' + py(yMin) + '" x2="' + px(t) + '" y2="' + py(yMax) + '" stroke="#d8cebc" stroke-dasharray="2 5"></line>' +
      '<text x="' + px(t) + '" y="' + (H - m.b + 15) + '" text-anchor="middle" class="scatter-tick">' + t + '</text>').join('') +
      yTicks.map((t) => '<line x1="' + px(xMin) + '" y1="' + py(t) + '" x2="' + px(xMax) + '" y2="' + py(t) + '" stroke="#d8cebc" stroke-dasharray="2 5"></line>' +
      '<text x="' + (m.l - 9) + '" y="' + (py(t) + 2.5) + '" text-anchor="end" class="scatter-tick">' + t + '</text>').join('');

    const sorted = points.slice().sort((a, b) => Math.abs(a.rate - a.subject.score) - Math.abs(b.rate - b.subject.score));
    const dots = sorted.map((c) => {
      const s = c.subject;
      return '<circle class="scatter-dot" cx="' + px(c.subject.score).toFixed(1) + '" cy="' + py(c.rate).toFixed(1) + '" r="2.7" fill="' + colorOf(c.subject_type) + '">' +
        '<title>' + esc(titleOf(s)) + ' — 我 ' + c.rate + ' / 均分 ' + s.score + '</title>' +
      '</circle>';
    }).join('');

    box.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="评分散点图：横轴是 Bangumi 均分，纵轴是我的评分，共 ' + points.length + ' 个评分点">' +
      '<rect x="' + m.l + '" y="' + m.t + '" width="' + (W - m.l - m.r) + '" height="' + (H - m.t - m.b) + '" fill="#fffdf8" stroke="#1c1a17" stroke-width="1.5"></rect>' +
      grid +
      '<line x1="' + px(4) + '" y1="' + py(4) + '" x2="' + px(10) + '" y2="' + py(10) + '" stroke="#c7000a" stroke-width="1.5" stroke-dasharray="5 5" opacity=".55"></line>' +
      '<text x="' + px(8.25) + '" y="' + (py(8.8) - 4) + '" class="scatter-side-label" fill="#c7000a">口味一致线</text>' +
      '<text x="' + (m.l + 8) + '" y="' + (m.t + 16) + '" class="scatter-side-label">我比大众更喜欢 ↗</text>' +
      '<text x="' + (W - m.r - 8) + '" y="' + (H - m.b - 8) + '" text-anchor="end" class="scatter-side-label">大众比我更喜欢 ↗</text>' +
      dots +
      '<text x="' + (W - m.r) + '" y="' + (H - 5) + '" text-anchor="end" class="scatter-axis-label">大众均分 →</text>' +
      '<text x="14" y="' + (m.t + 4) + '" class="scatter-axis-label">我的评分 ↑</text>' +
    '</svg>' +
    '<div class="taste-legend">' +
      '<span><i style="background:#c7000a"></i>动画</span>' +
      '<span><i style="background:#0b8ea6"></i>书籍</span>' +
      '<span><i style="background:#b8860b"></i>游戏</span>' +
      '<span class="taste-legend-count">' + fmtInt(points.length) + ' 个评分点</span>' +
    '</div>';

    const note = $('#taste-note');
    if (note) {
      const sign = stats.avgDiff >= 0 ? '+' : '−';
      note.textContent = fmtInt(points.length) + ' 个评分点 · 我的平均分与大众均分差 ' + sign + Math.abs(stats.avgDiff).toFixed(2) + ' 分 · 越靠上越喜欢，越靠右大众评价越高';
    }
  }

  function renderTop(stats) {
    const box = $('#top-grid');
    if (!box) return;
    box.innerHTML = [2, 1, 4].map((type) => {
      const rows = stats.top[type] || [];
      const list = rows.length ? rows.map((c, i) => {
        const s = c.subject;
        return '<a class="top-item" href="' + esc(bgmSubject(s.id)) + '" target="_blank" rel="noopener noreferrer">' +
          '<span class="top-rank">' + (i + 1) + '</span>' +
          '<img class="top-cover" src="' + esc(imgSrc(s)) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">' +
          '<span class="top-main"><span class="top-title">' + esc(titleOf(s)) + '</span><span class="top-sub">' + esc((s.date || '').slice(0, 4)) + ' · 均分 ' + esc(s.score || '—') + '</span></span>' +
          '<span class="top-score">' + c.rate + '<small>MY SCORE</small></span>' +
        '</a>';
      }).join('') : '<p class="panel-note" style="padding:16px">还没有评分。</p>';

      return '<div class="top-column">' +
        '<div class="top-head"><h3>' + TYPES[type].en + '</h3><span>' + TYPES[type].zh + ' · ' + (stats.byType[type] || 0) + ' 部</span></div>' +
        '<div class="top-list">' + list + '</div>' +
      '</div>';
    }).join('');
  }

  function renderArchive(data, stats) {
    const grid = $('#archive-grid');
    if (!grid) return;

    const quotas = { 2: 24, 1: 16, 4: 8 };
    const picks = [];
    const seen = new Set();

    Object.keys(quotas).forEach((type) => {
      const pool = stats.cols.filter((c) => c.subject_type === Number(type));
      const byRate = pool.slice().sort((a, b) => (b.rate - a.rate) || ((b.subject.score || 0) - (a.subject.score || 0)));
      const byRecent = pool.slice().sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
      const target = quotas[type];
      const half = Math.ceil(target / 2);
      byRate.slice(0, half).concat(byRecent.slice(0, target - half), byRate.slice(half), byRecent.slice(target - half)).some((c) => {
        if (picks.filter((p) => p.subject_type === Number(type)).length >= target) return true;
        if (seen.has(c.subject_id)) return false;
        seen.add(c.subject_id);
        picks.push(c);
        return false;
      });
    });

    // top up if a type was short
    stats.cols.slice().sort((a, b) => (b.rate - a.rate)).some((c) => {
      if (picks.length >= 48) return true;
      if (seen.has(c.subject_id)) return false;
      seen.add(c.subject_id);
      picks.push(c);
      return false;
    });

    state.archiveItems = picks.slice(0, 48);
    state.total = stats.total;

    grid.innerHTML = state.archiveItems.map((c) => {
      const s = c.subject;
      const score = c.rate || (s.score ? s.score.toFixed(1) : '');
      return '<a class="arch-item" data-type="' + c.subject_type + '" href="' + esc(bgmSubject(s.id)) + '" target="_blank" rel="noopener noreferrer" title="' + esc(titleOf(s)) + '">' +
        '<img src="' + esc((s.images && (s.images.small || s.images.common)) || PH) + '" alt="' + esc(titleOf(s)) + '" loading="lazy" decoding="async" referrerpolicy="no-referrer">' +
        (score ? '<span class="arch-score">' + esc(score) + '</span>' : '') +
        '<span class="arch-info"><span class="arch-title">' + esc(titleOf(s)) + '</span></span>' +
      '</a>';
    }).join('');

    const counts = { all: state.archiveItems.length, 2: 0, 1: 0, 4: 0 };
    state.archiveItems.forEach((c) => { counts[c.subject_type] = (counts[c.subject_type] || 0) + 1; });
    const filterButtons = $$('#archive-filters .filter');
    filterButtons.forEach((btn) => {
      const f = btn.dataset.filter;
      const span = $('span', btn);
      if (span) span.textContent = counts[f] || 0;
      btn.classList.toggle('is-on', f === 'all');
      btn.setAttribute('aria-pressed', String(f === 'all'));
      btn.addEventListener('click', () => applyArchiveFilter(f));
    });
    if ($('#archive-count')) $('#archive-count').textContent = counts.all + ' / ' + fmtInt(stats.total) + ' SHOWN';

    const more = $('.archive-more span');
    if (more) more.textContent = '全部 ' + fmtInt(stats.total) + ' 部收藏';
  }

  function applyArchiveFilter(filter) {
    state.filter = filter;
    $$('#archive-filters .filter').forEach((b) => {
      const on = b.dataset.filter === filter;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', String(on));
    });
    let shown = 0;
    $$('#archive-grid .arch-item').forEach((el) => {
      const ok = filter === 'all' || String(el.dataset.type) === String(filter);
      el.classList.toggle('is-hidden', !ok);
      if (ok) shown += 1;
    });
    if ($('#archive-count')) $('#archive-count').textContent = shown + ' / ' + fmtInt(state.total) + ' SHOWN';
  }

  function renderWords(stats) {
    const box = $('#word-grid');
    if (!box) return;
    const items = stats.comments.map((c) => ({
      text: c.comment,
      cite: '《' + titleOf(c.subject) + '》',
      img: imgSrc(c.subject),
    }));
    if (items.length < 3 && CONTENT.quote) {
      items.push({ text: CONTENT.quote, cite: '关于这个页面', img: '' });
    }
    box.innerHTML = items.slice(0, 3).map((it, i) => (
      '<article class="word-card"><span class="word-quote-mark" aria-hidden="true">“</span>' +
        '<span class="word-index" aria-hidden="true">0' + (i + 1) + '</span>' +
        '<blockquote>' + esc(it.text) + '</blockquote>' +
        '<cite>' + (it.img ? '<img src="' + esc(it.img) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">' : '') + esc(it.cite) + '</cite>' +
      '</article>'
    )).join('');
  }

  function renderTicker(stats) {
    const track = $('#ticker-track');
    if (!track) return;
    const items = [
      'TV ANIME ' + fmtInt(stats.byType[2] || 0),
      'MANGA / BOOKS ' + fmtInt(stats.byType[1] || 0),
      'GAME ' + fmtInt(stats.byType[4] || 0),
      'TOTAL ' + fmtInt(stats.total),
      'RATED ' + fmtInt(stats.rated.length),
      'WISH ' + fmtInt(stats.wish.length),
      'AVG ' + stats.avg.toFixed(2),
      'ARCHIVE 1965 — 2026',
    ];
    const html = items.map((t) => '<span>' + esc(t) + ' <b>✳</b></span>').join('');
    track.innerHTML = html + html;
  }

  function renderFooter(data, stats) {
    const d = (data.meta && data.meta.fetched_at) ? data.meta.fetched_at.slice(0, 10).replace(/-/g, '.') : '—';
    if ($('#snapshot-date')) $('#snapshot-date').textContent = d;
    const more = $('.archive-more span');
    if (more) more.textContent = '全部 ' + fmtInt(stats.total) + ' 部收藏';
  }

  /* ---------------- chrome: menu, scroll, reveal ---------------- */
  function bindChrome() {
    const menu = $('#menu');
    const button = $('#menu-button');
    let lastFocus = null;

    const openMenu = () => {
      lastFocus = document.activeElement;
      document.body.classList.add('menu-open');
      menu.classList.add('is-open');
      menu.setAttribute('aria-hidden', 'false');
      button.setAttribute('aria-expanded', 'true');
      const label = $('.sr-only', button);
      if (label) label.textContent = '关闭菜单';
      const first = $('.menu-link', menu);
      if (first) setTimeout(() => first.focus({ preventScroll: true }), 120);
    };
    const closeMenu = (restore = true) => {
      document.body.classList.remove('menu-open');
      menu.classList.remove('is-open');
      menu.setAttribute('aria-hidden', 'true');
      button.setAttribute('aria-expanded', 'false');
      const label = $('.sr-only', button);
      if (label) label.textContent = '打开菜单';
      if (restore && lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    };

    if (button && menu) {
      button.addEventListener('click', () => {
        if (menu.classList.contains('is-open')) closeMenu();
        else openMenu();
      });
      $$('.menu-link', menu).forEach((a) => a.addEventListener('click', () => {
        const href = a.getAttribute('href') || '';
        closeMenu(false);
        if (!href.startsWith('#')) return;
        const target = document.querySelector(href);
        if (!target) return;
        const heading = target.querySelector('h1, h2');
        if (!heading) return;
        setTimeout(() => {
          heading.setAttribute('tabindex', '-1');
          heading.focus({ preventScroll: true });
        }, 420);
      }));
      document.addEventListener('keydown', (e) => {
        if (!menu.classList.contains('is-open')) return;
        if (e.key === 'Escape') { closeMenu(); return; }
        if (e.key !== 'Tab') return;
        const focusables = $$('a[href], button:not([disabled])', menu).filter((el) => el.offsetParent !== null);
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      });
    }

    const head = $('.site-head');
    const progress = $('#progress');
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (head) {
        const scrolled = y > 20;
        head.classList.toggle('is-scrolled', scrolled);
        const goingDown = y > lastY + 4;
        const goingUp = y < lastY - 4;
        if (y > 220 && goingDown && !document.body.classList.contains('menu-open')) {
          head.classList.add('is-hidden');
        } else if (goingUp || y < 120) {
          head.classList.remove('is-hidden');
        }
      }
      if (progress) {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        progress.style.width = (max > 0 ? clamp((y / max) * 100, 0, 100) : 0) + '%';
      }
      lastY = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function initHeroParallax() {
    const art = $('.hero-art');
    if (!art) return;
    if (!window.matchMedia || !window.matchMedia('(pointer: fine)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const cards = $$('.stack-card', art);
    let raf = 0;
    art.addEventListener('pointermove', (e) => {
      const r = art.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        cards.forEach((card, i) => {
          const depth = (i % 3 + 1) * 3;
          card.style.translate = (x * depth).toFixed(1) + 'px ' + (y * depth).toFixed(1) + 'px';
        });
      });
    });
    art.addEventListener('pointerleave', () => {
      cancelAnimationFrame(raf);
      cards.forEach((card) => { card.style.translate = ''; });
    });
  }

  function initSpy() {
    const links = $$('.head-nav a');
    if (!links.length || !('IntersectionObserver' in window)) return;
    const map = new Map();
    links.forEach((a) => {
      const id = (a.getAttribute('href') || '').replace('#', '');
      if (id) map.set(id, a);
    });
    const set = (id) => {
      links.forEach((a) => a.classList.remove('is-active'));
      if (map.has(id)) map.get(id).classList.add('is-active');
    };
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => { if (entry.isIntersecting) set(entry.target.id); });
    }, { rootMargin: '-38% 0px -52% 0px', threshold: 0 });
    map.forEach((_, id) => {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    });
  }

  function initReveal() {
    const els = $$('.reveal');
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -6% 0px' });
    els.forEach((el, i) => {
      el.style.setProperty('--d', (Math.min(i % 3, 2) * 0.06) + 's');
      io.observe(el);
    });
    setTimeout(() => els.forEach((el) => el.classList.add('in')), 9000);
  }

  function initImageFallback() {
    document.addEventListener('error', (e) => {
      const img = e.target;
      if (!(img instanceof HTMLImageElement)) return;
      if (img.dataset.failed) return;
      img.dataset.failed = '1';
      img.src = PH;
      img.classList.add('is-fallback');
    }, true);
  }

  function animateBars() {
    requestAnimationFrame(() => {
      $$('.bar[data-h], .ybar[data-h]').forEach((el) => {
        el.style.height = el.dataset.h + '%';
      });
    });
  }

  function showDataError(err) {
    const main = $('#main');
    if (!main) return;
    const div = document.createElement('div');
    div.className = 'data-error';
    div.setAttribute('role', 'alert');
    div.innerHTML = '数据没有加载出来：<code>' + esc(err && err.message ? err.message : err) + '</code><br>' +
      '请确认 <code>data.json</code> 与页面在同一目录，并通过本地服务器打开（例如 <code>python3 -m http.server 8000</code>），不要直接双击 HTML。';
    main.prepend(div);
  }

  /* ---------------- helpers ---------------- */
  function setText(sel, text) {
    const el = $(sel);
    if (el) el.textContent = text == null ? '' : text;
  }

  function imgSrc(s) {
    const im = (s && s.images) || {};
    return im.common || im.medium || im.small || im.large || PH;
  }

  function charImg(c) {
    const im = (c && c.images) || {};
    return im.medium || im.large || im.small || PH;
  }

  function charName(c) {
    return charInfo(c, '简体中文名') || c.name_cn || c.name || '未知角色';
  }

  function charInfo(c, key) {
    const box = (c && c.infobox) || [];
    const hit = box.find((b) => b && b.key === key);
    if (!hit) return '';
    const value = hit.value;
    if (Array.isArray(value)) {
      return value.map((v) => (v && typeof v === 'object' ? (v.v || '') : String(v))).filter(Boolean).join(' / ');
    }
    return String(value || '').trim();
  }

  function charAlias(c, key) {
    const box = (c && c.infobox) || [];
    const aliases = box.find((b) => b && b.key === '别名');
    if (!aliases || !Array.isArray(aliases.value)) return '';
    const hit = aliases.value.find((v) => v && v.k === key);
    return hit ? String(hit.v || '') : '';
  }

  function featureSummary(text) {
    let t = String(text || '').replace(/\r/g, '').trim();
    const cut = t.indexOf('[简介原文]');
    if (cut > -1) t = t.slice(0, cut);
    t = t.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 2).join(' ');
    return t.length > 168 ? t.slice(0, 168) + '…' : t;
  }

  function seasonOf(date) {
    const y = String(date || '').slice(0, 4) || '—';
    const m = parseInt(String(date || '').slice(5, 7), 10);
    const season = !m ? '' : m <= 3 ? 'WINTER' : m <= 6 ? 'SPRING' : m <= 9 ? 'SUMMER' : 'AUTUMN';
    return (y + ' ' + season).trim();
  }

  function fmtDateShort(value) {
    const s = String(value || '').slice(0, 10);
    return s ? s.slice(5).replace('-', '.') : '—';
  }

  function dateParts(value) {
    const s = String(value || '').slice(0, 10);
    const [y, m, d] = s.split('-');
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    return { day: d || '—', month: months[Math.max(0, parseInt(m, 10) - 1)] || '', year: y || '' };
  }
})();
