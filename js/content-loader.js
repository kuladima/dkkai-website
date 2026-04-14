/* ============================================================
   KAI Content Loader — injects content.json into pages
   ============================================================ */
(function () {
  'use strict';

  const BASE = (function () {
    // detect if served from GitHub Pages subdirectory
    const p = window.location.pathname;
    const m = p.match(/^(\/[^/]+)\//);
    return m ? m[1] : '';
  })();

  function get(obj, path) {
    return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : null), obj);
  }

  function renderNews(items) {
    return items.map(n => `
      <article class="news-card" data-cat="${n.cat}">
        <div class="news-thumb">${n.icon}</div>
        <div>
          <span class="news-cat">${n.catLabel}</span>
          <h3><a href="${n.url}">${n.title}</a></h3>
          <p class="news-meta">🗓 ${n.date} &nbsp;·&nbsp; 👁 ${n.views} переглядів</p>
        </div>
      </article>`).join('');
  }

  function renderEvents(items) {
    return items.map(e => `
      <div class="event-item">
        <div class="event-date">${e.date}</div>
        <div class="event-title">${e.title}</div>
        <div class="event-type">${e.type}</div>
      </div>`).join('') +
      `<div class="mt-8 text-center"><a href="#" class="btn btn-outline btn-sm" style="width:100%">Всі події →</a></div>`;
  }

  function renderFacultyCards(items) {
    const preview = items.slice(0, 5);
    const cards = preview.map(f => `
      <a href="faculties.html#${f.id}" class="faculty-card">
        <div class="faculty-icon">${f.icon}</div>
        <h3>${f.name}</h3>
        <p>${f.description}</p>
        <span class="faculty-tag">${f.programs} спеціальностей →</span>
      </a>`).join('');
    return cards + `
      <a href="faculties.html" class="faculty-card" style="border-style:dashed;background:var(--kai-bg);">
        <div class="faculty-icon">🏫</div>
        <h3>Переглянути всі факультети</h3>
        <p>9 факультетів + Київський фаховий коледж</p>
        <span class="faculty-tag" style="color:var(--kai-blue);">Всі факультети →</span>
      </a>`;
  }

  function renderPartners(items) {
    return items.map(p => `<div class="partner-logo">${p}</div>`).join('');
  }

  function renderStatsSection(items) {
    return items.map(s => `
      <div>
        <div class="stat-number counter" data-target="${s.value}" data-suffix="${s.suffix}">${s.value.toLocaleString('uk-UA')}${s.suffix}</div>
        <div class="stat-label">${s.label}</div>
      </div>`).join('');
  }

  function applyContent(data) {
    // Simple text replacements
    document.querySelectorAll('[data-ck]').forEach(el => {
      const val = get(data, el.dataset.ck);
      if (val !== null) el.innerHTML = val;
    });

    // List renderers
    document.querySelectorAll('[data-ck-list]').forEach(el => {
      const key = el.dataset.ckList;
      const items = get(data, key);
      if (!Array.isArray(items)) return;
      switch (key) {
        case 'home.news':           el.innerHTML = renderNews(items); break;
        case 'home.events':         el.innerHTML = renderEvents(items); break;
        case 'faculties.list':      el.innerHTML = renderFacultyCards(items); break;
        case 'home.partners':       el.innerHTML = renderPartners(items); break;
        case 'home.statsSection':   el.innerHTML = renderStatsSection(items); break;
      }
    });

    // topbar phone / email / address
    document.querySelectorAll('[data-ck-phone]').forEach(el => { el.textContent = data.site.phone; el.href = 'tel:' + data.site.phone.replace(/\D/g,''); });
    document.querySelectorAll('[data-ck-email]').forEach(el => { el.textContent = data.site.email; el.href = 'mailto:' + data.site.email; });

    // Re-init counters that were just injected
    if (typeof initCounters === 'function') initCounters();
    if (typeof initNewsFilter === 'function') initNewsFilter();
  }

  fetch(BASE + '/data/content.json?v=' + Date.now())
    .then(r => r.json())
    .then(applyContent)
    .catch(() => { /* fallback: keep hardcoded HTML */ });
})();
