/* ============================================================
   KAI Admin Panel — Logic (GitHub API)
   ============================================================ */
'use strict';

const OWNER = 'kuladima';
const REPO  = 'dkkai-website';
const FILE  = 'data/content.json';
const SITE  = 'https://kuladima.github.io/dkkai-website';

let ghToken   = null;
let content   = null;
let fileSha   = null;
let currentPage = 'dashboard';

// ── Crypto helpers ────────────────────────────────────────────
async function hashPwd(pwd) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('kai_salt_' + pwd));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  ghToken = localStorage.getItem('kai_gh_token');
  const pwdHash = localStorage.getItem('kai_admin_pwd_hash');

  if (!ghToken) {
    // No token yet — first time setup
    showAuthMode('token');
  } else if (pwdHash) {
    // Token saved + password set → ask for password
    showAuthMode('password');
  } else {
    // Token saved, no password yet → go straight in, nudge to set password
    showApp();
    loadContent();
    setTimeout(() => toast('info', '💡 Порада: встановіть пароль у розділі Налаштування → Безпека'), 2000);
  }
});

// ── Auth modes ────────────────────────────────────────────────
function showAuthMode(mode) {
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
  document.getElementById('auth-mode-password').style.display = mode === 'password' ? 'block' : 'none';
  document.getElementById('auth-mode-token').style.display   = mode === 'token'    ? 'block' : 'none';
  document.getElementById('auth-error').classList.remove('show');
}
function showApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
}

// ── Password login ────────────────────────────────────────────
document.getElementById('btn-login-pwd').addEventListener('click', async () => {
  const pwd = document.getElementById('input-password').value;
  if (!pwd) return;
  const err = document.getElementById('auth-error');
  err.classList.remove('show');
  const hash = await hashPwd(pwd);
  if (hash === localStorage.getItem('kai_admin_pwd_hash')) {
    showApp();
    loadContent();
  } else {
    err.textContent = '❌ Невірний пароль';
    err.classList.add('show');
  }
});
document.getElementById('input-password')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btn-login-pwd').click();
});
document.getElementById('link-use-token')?.addEventListener('click', e => {
  e.preventDefault(); showAuthMode('token');
});

// ── Token login ───────────────────────────────────────────────
document.getElementById('btn-login-token').addEventListener('click', async () => {
  const token = document.getElementById('input-token').value.trim();
  if (!token) return;
  const err = document.getElementById('auth-error');
  err.classList.remove('show');
  document.getElementById('btn-login-token').textContent = 'Перевірка...';
  try {
    const r = await ghFetch('https://api.github.com/user', token);
    if (!r.ok) throw new Error('Невірний токен. Перевір права (потрібен scope: repo)');
    ghToken = token;
    localStorage.setItem('kai_gh_token', token);
    showApp();
    loadContent();
    setTimeout(() => toast('info', '💡 Встановіть пароль у Налаштуваннях → Безпека, щоб не вводити токен щоразу'), 2500);
  } catch(e) {
    err.textContent = '❌ ' + e.message;
    err.classList.add('show');
  } finally {
    document.getElementById('btn-login-token').textContent = 'Увійти з токеном';
  }
});
document.getElementById('input-token')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btn-login-token').click();
});

document.getElementById('btn-logout').addEventListener('click', () => {
  localStorage.removeItem('kai_gh_token');
  localStorage.removeItem('kai_admin_pwd_hash');
  ghToken = null; content = null; fileSha = null;
  showAuthMode('token');
});

// ── GitHub API ────────────────────────────────────────────────
function ghFetch(url, token, opts = {}) {
  return fetch(url, {
    ...opts,
    headers: {
      'Authorization': 'token ' + (token || ghToken),
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      ...(opts.headers || {})
    }
  });
}

async function loadContent() {
  showLoading('Завантаження контенту...');
  try {
    const r = await ghFetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE}`);
    if (!r.ok) throw new Error('Не вдалося завантажити content.json');
    const data = await r.json();
    fileSha = data.sha;
    content = JSON.parse(decodeURIComponent(escape(atob(data.content.replace(/\n/g, '')))));
    renderCurrentPage();
    updateDeployStatus();
  } catch(e) {
    toast('error', '❌ ' + e.message);
  } finally {
    hideLoading();
  }
}

async function saveContent() {
  const btn = document.getElementById('btn-save');
  btn.disabled = true;
  btn.textContent = '⏳ Збереження...';
  try {
    // Collect all form data into content object
    collectFormData();
    // Get fresh SHA
    const rGet = await ghFetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE}`);
    const dataGet = await rGet.json();
    fileSha = dataGet.sha;
    // Encode and PUT
    const body = JSON.stringify({
      message: 'Update site content via admin panel',
      content: btoa(unescape(encodeURIComponent(JSON.stringify(content, null, 2)))),
      sha: fileSha
    });
    const r = await ghFetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE}`, null, { method: 'PUT', body });
    if (!r.ok) { const e = await r.json(); throw new Error(e.message || 'Помилка збереження'); }
    toast('success', '✅ Збережено! Сайт оновлюється (~60 сек)');
    setStatus('deploying');
    setTimeout(() => { setStatus('deployed'); toast('info', '🌐 Сайт оновлений! <a href="' + SITE + '" target="_blank" style="color:inherit;text-decoration:underline">Відкрити →</a>'); }, 75000);
  } catch(e) {
    toast('error', '❌ ' + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '💾 Зберегти';
  }
}

document.getElementById('btn-save').addEventListener('click', saveContent);

// ── Navigation ────────────────────────────────────────────────
document.querySelectorAll('.sidebar-link[data-page]').forEach(link => {
  link.addEventListener('click', () => {
    currentPage = link.dataset.page;
    document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
    link.classList.add('active');
    document.querySelectorAll('.page-view').forEach(p => p.classList.remove('active'));
    const view = document.getElementById('page-' + currentPage);
    if (view) { view.classList.add('active'); renderCurrentPage(); }
    document.getElementById('topbar-title').textContent = link.querySelector('.label').textContent;
  });
});

function renderCurrentPage() {
  if (!content) return;
  switch(currentPage) {
    case 'dashboard':   renderDashboard(); break;
    case 'home':        renderHome(); break;
    case 'about':       renderAbout(); break;
    case 'faculties':   renderFaculties(); break;
    case 'contacts':    renderContacts(); break;
    case 'settings':    renderSettings(); break;
  }
}

// ── Collapse toggle ───────────────────────────────────────────
document.addEventListener('click', e => {
  const h = e.target.closest('.section-card-header');
  if (!h) return;
  h.classList.toggle('open');
  const body = h.nextElementSibling;
  if (body) body.classList.toggle('collapsed');
});

// ── Dashboard ─────────────────────────────────────────────────
function renderDashboard() {
  if (!content) return;
  const el = document.getElementById('dash-stats');
  if (!el) return;
  el.innerHTML = `
    <div class="dash-card"><div class="dash-card-icon">📰</div><div class="dash-card-value">${content.home.news.length}</div><div class="dash-card-label">Новин</div></div>
    <div class="dash-card"><div class="dash-card-icon">📅</div><div class="dash-card-value">${content.home.events.length}</div><div class="dash-card-label">Подій</div></div>
    <div class="dash-card"><div class="dash-card-icon">🎓</div><div class="dash-card-value">${content.faculties.programs.length}</div><div class="dash-card-label">Програм</div></div>
    <div class="dash-card"><div class="dash-card-icon">🏫</div><div class="dash-card-value">${content.faculties.list.length}</div><div class="dash-card-label">Факультетів</div></div>
    <div class="dash-card"><div class="dash-card-icon">👥</div><div class="dash-card-value">${content.about.leadership.length}</div><div class="dash-card-label">Керівників</div></div>
    <div class="dash-card"><div class="dash-card-icon">📞</div><div class="dash-card-value">${content.contacts.departments.length}</div><div class="dash-card-label">Підрозділів</div></div>`;
}

// ── HOME ──────────────────────────────────────────────────────
function renderHome() {
  const el = document.getElementById('home-content');
  if (!el || !content) return;
  const h = content.home.hero;
  el.innerHTML = `
    <div class="section-card">
      <div class="section-card-header open"><h3>🦸 Hero секція</h3><span class="collapse-icon">▾</span></div>
      <div class="section-card-body">
        <div class="field-row">
          <div class="field"><label>Badge текст</label><input data-path="home.hero.badge" value="${esc(h.badge)}"></div>
          <div class="field"><label>CTA 1 текст</label><input data-path="home.hero.cta1Text" value="${esc(h.cta1Text)}"></div>
        </div>
        <div class="field-row single"><div class="field"><label>Заголовок</label><input data-path="home.hero.title" value="${esc(h.title)}"></div></div>
        <div class="field-row single"><div class="field"><label>Підзаголовок</label><textarea data-path="home.hero.subtitle">${esc(h.subtitle)}</textarea></div></div>
        <div class="field-row">
          <div class="field"><label>CTA 1 URL</label><input data-path="home.hero.cta1Url" value="${esc(h.cta1Url)}"></div>
          <div class="field"><label>CTA 2 текст</label><input data-path="home.hero.cta2Text" value="${esc(h.cta2Text)}"></div>
        </div>
      </div>
    </div>

    <div class="section-card">
      <div class="section-card-header open"><h3>📊 Статистика (Hero)</h3><span class="collapse-icon">▾</span></div>
      <div class="section-card-body">
        ${arrayEditor('home.heroStats', content.home.heroStats, heroStatFields, 'Додати показник')}
      </div>
    </div>

    <div class="section-card">
      <div class="section-card-header open"><h3>📰 Новини</h3><span class="collapse-icon">▾</span></div>
      <div class="section-card-body">
        ${arrayEditor('home.news', content.home.news, newsFields, 'Додати новину')}
      </div>
    </div>

    <div class="section-card">
      <div class="section-card-header open"><h3>📅 Події</h3><span class="collapse-icon">▾</span></div>
      <div class="section-card-body">
        ${arrayEditor('home.events', content.home.events, eventFields, 'Додати подію')}
      </div>
    </div>

    <div class="section-card">
      <div class="section-card-header"><h3>🏆 Партнери</h3><span class="collapse-icon">▾</span></div>
      <div class="section-card-body collapsed">
        ${arrayEditor('home.partners', content.home.partners, partnerFields, 'Додати партнера')}
      </div>
    </div>`;
}

// ── ABOUT ─────────────────────────────────────────────────────
function renderAbout() {
  const el = document.getElementById('about-content');
  if (!el || !content) return;
  const m = content.about.mission;
  el.innerHTML = `
    <div class="section-card">
      <div class="section-card-header open"><h3>🎯 Місія</h3><span class="collapse-icon">▾</span></div>
      <div class="section-card-body">
        <div class="field-row single"><div class="field"><label>Заголовок</label><input data-path="about.mission.title" value="${esc(m.title)}"></div></div>
        <div class="field-row single"><div class="field"><label>Текст 1</label><textarea data-path="about.mission.text1">${esc(m.text1)}</textarea></div></div>
        <div class="field-row single"><div class="field"><label>Текст 2</label><textarea data-path="about.mission.text2">${esc(m.text2)}</textarea></div></div>
        <div class="field-row single"><div class="field"><label>Цитата (highlight)</label><textarea data-path="about.mission.highlight">${esc(m.highlight)}</textarea></div></div>
      </div>
    </div>
    <div class="section-card">
      <div class="section-card-header open"><h3>💡 Цінності</h3><span class="collapse-icon">▾</span></div>
      <div class="section-card-body">${arrayEditor('about.values', content.about.values, valueFields, 'Додати цінність')}</div>
    </div>
    <div class="section-card">
      <div class="section-card-header open"><h3>👥 Керівництво</h3><span class="collapse-icon">▾</span></div>
      <div class="section-card-body">${arrayEditor('about.leadership', content.about.leadership, leaderFields, 'Додати керівника')}</div>
    </div>
    <div class="section-card">
      <div class="section-card-header"><h3>🚀 Стратегія</h3><span class="collapse-icon">▾</span></div>
      <div class="section-card-body collapsed">${arrayEditor('about.strategy', content.about.strategy, strategyFields, 'Додати напрям')}</div>
    </div>`;
}

// ── FACULTIES ─────────────────────────────────────────────────
function renderFaculties() {
  const el = document.getElementById('faculties-content');
  if (!el || !content) return;
  el.innerHTML = `
    <div class="section-card">
      <div class="section-card-header open"><h3>🏫 Факультети</h3><span class="collapse-icon">▾</span></div>
      <div class="section-card-body">${arrayEditor('faculties.list', content.faculties.list, facultyFields, 'Додати факультет')}</div>
    </div>
    <div class="section-card">
      <div class="section-card-header open"><h3>📚 Освітні програми</h3><span class="collapse-icon">▾</span></div>
      <div class="section-card-body">${arrayEditor('faculties.programs', content.faculties.programs, programFields, 'Додати програму')}</div>
    </div>`;
}

// ── CONTACTS ──────────────────────────────────────────────────
function renderContacts() {
  const el = document.getElementById('contacts-content');
  if (!el || !content) return;
  const c = content.contacts;
  const block = (label, pathPfx, obj) => `
    <div class="section-card">
      <div class="section-card-header open"><h3>${label}</h3><span class="collapse-icon">▾</span></div>
      <div class="section-card-body">
        <div class="field-row"><div class="field"><label>Телефон</label><input data-path="${pathPfx}.phone" value="${esc(obj.phone)}"></div><div class="field"><label>Email</label><input data-path="${pathPfx}.email" value="${esc(obj.email)}"></div></div>
        <div class="field-row single"><div class="field"><label>Адреса</label><input data-path="${pathPfx}.address" value="${esc(obj.address)}"></div></div>
        <div class="field-row single"><div class="field"><label>Графік роботи</label><input data-path="${pathPfx}.hours" value="${esc(obj.hours)}"></div></div>
      </div>
    </div>`;
  el.innerHTML = block('🏛 Головний корпус', 'contacts.main', c.main) +
    block('📋 Приймальна комісія', 'contacts.admissions', c.admissions) + `
    <div class="section-card">
      <div class="section-card-header open"><h3>🏢 Підрозділи</h3><span class="collapse-icon">▾</span></div>
      <div class="section-card-body">${arrayEditor('contacts.departments', c.departments, deptFields, 'Додати підрозділ')}</div>
    </div>`;
}

// ── SETTINGS ──────────────────────────────────────────────────
function renderSettings() {
  const el = document.getElementById('settings-content');
  if (!el || !content) return;
  const s = content.site;
  el.innerHTML = `
    <div class="section-card">
      <div class="section-card-header open"><h3>⚙️ Загальні налаштування</h3><span class="collapse-icon">▾</span></div>
      <div class="section-card-body">
        <div class="field-row single"><div class="field"><label>Назва сайту</label><input data-path="site.title" value="${esc(s.title)}"></div></div>
        <div class="field-row single"><div class="field"><label>Опис (meta description)</label><textarea data-path="site.description">${esc(s.description)}</textarea></div></div>
        <div class="field-row">
          <div class="field"><label>Телефон</label><input data-path="site.phone" value="${esc(s.phone)}"></div>
          <div class="field"><label>Email</label><input data-path="site.email" value="${esc(s.email)}"></div>
        </div>
        <div class="field-row single"><div class="field"><label>Адреса</label><input data-path="site.address" value="${esc(s.address)}"></div></div>
      </div>
    </div>
    <div class="section-card">
      <div class="section-card-header open"><h3>📱 Соціальні мережі</h3><span class="collapse-icon">▾</span></div>
      <div class="section-card-body">
        <div class="field-row">
          <div class="field"><label>Facebook</label><input data-path="site.socials.facebook" value="${esc(s.socials.facebook)}"></div>
          <div class="field"><label>Instagram</label><input data-path="site.socials.instagram" value="${esc(s.socials.instagram)}"></div>
        </div>
        <div class="field-row">
          <div class="field"><label>Telegram</label><input data-path="site.socials.telegram" value="${esc(s.socials.telegram)}"></div>
          <div class="field"><label>YouTube</label><input data-path="site.socials.youtube" value="${esc(s.socials.youtube)}"></div>
        </div>
        <div class="field-row single">
          <div class="field"><label>LinkedIn</label><input data-path="site.socials.linkedin" value="${esc(s.socials.linkedin)}"></div>
        </div>
      </div>
    </div>

    <div class="section-card">
      <div class="section-card-header open"><h3>🔐 Безпека адмін-панелі</h3><span class="collapse-icon">▾</span></div>
      <div class="section-card-body">
        <p class="help-text" style="margin-bottom:16px;">
          ${localStorage.getItem('kai_admin_pwd_hash')
            ? '✅ Пароль встановлено. Для входу достатньо пароля.'
            : '⚠️ Пароль не встановлено. Для входу потрібен GitHub токен.'}
        </p>
        <div class="field-row">
          <div class="field"><label>Новий пароль</label><input type="password" id="sec-new-pwd" placeholder="Мінімум 6 символів" autocomplete="new-password"></div>
          <div class="field"><label>Підтвердити пароль</label><input type="password" id="sec-confirm-pwd" placeholder="Повторіть пароль" autocomplete="new-password"></div>
        </div>
        <div style="display:flex;gap:10px;margin-top:4px;">
          <button class="btn-save" style="padding:9px 20px;font-size:.85rem;" onclick="saveAdminPassword()">🔒 Зберегти пароль</button>
          ${localStorage.getItem('kai_admin_pwd_hash')
            ? '<button onclick="removeAdminPassword()" style="padding:9px 20px;background:#fee2e2;color:#991b1b;border-radius:8px;font-size:.85rem;font-weight:600;cursor:pointer;">🗑 Видалити пароль</button>'
            : ''}
        </div>
        <div class="divider"></div>
        <p class="help-text" style="margin-bottom:12px;">GitHub токен зберігається у браузері. Для заміни токена:</p>
        <div class="field-row single">
          <div class="field"><label>Новий GitHub токен</label><input type="password" id="sec-new-token" placeholder="ghp_xxxxxxxxxxxxxxxxxxxx" autocomplete="off"></div>
        </div>
        <button class="btn-save" style="padding:9px 20px;font-size:.85rem;" onclick="updateGhToken()">🔑 Оновити токен</button>
      </div>
    </div>`;
}

async function saveAdminPassword() {
  const newPwd = document.getElementById('sec-new-pwd').value;
  const confirmPwd = document.getElementById('sec-confirm-pwd').value;
  if (!newPwd) return toast('error', '❌ Введіть пароль');
  if (newPwd.length < 6) return toast('error', '❌ Пароль має бути не менше 6 символів');
  if (newPwd !== confirmPwd) return toast('error', '❌ Паролі не збігаються');
  const hash = await hashPwd(newPwd);
  localStorage.setItem('kai_admin_pwd_hash', hash);
  toast('success', '✅ Пароль встановлено! Тепер для входу достатньо пароля.');
  renderSettings(); // refresh to show updated state
}

function removeAdminPassword() {
  if (!confirm('Видалити пароль? Для входу знову знадобиться GitHub токен.')) return;
  localStorage.removeItem('kai_admin_pwd_hash');
  toast('info', 'ℹ️ Пароль видалено');
  renderSettings();
}

async function updateGhToken() {
  const token = document.getElementById('sec-new-token').value.trim();
  if (!token) return toast('error', '❌ Введіть токен');
  const r = await ghFetch('https://api.github.com/user', token);
  if (!r.ok) return toast('error', '❌ Невірний токен');
  ghToken = token;
  localStorage.setItem('kai_gh_token', token);
  document.getElementById('sec-new-token').value = '';
  toast('success', '✅ GitHub токен оновлено');
}

// ── Array editor builder ──────────────────────────────────────
function arrayEditor(path, items, fieldsFn, addLabel) {
  if (!Array.isArray(items)) return '<p class="help-text">Немає даних</p>';
  const rows = items.map((item, i) => `
    <div class="array-item" data-array="${path}" data-index="${i}">
      <div class="array-item-header">
        <span class="array-item-title">${itemTitle(item, i)}</span>
        <div class="array-item-actions">
          <button class="btn-move" onclick="moveItem('${path}',${i},-1)">↑</button>
          <button class="btn-move" onclick="moveItem('${path}',${i},1)">↓</button>
          <button class="btn-delete" onclick="deleteItem('${path}',${i})">✕ Видалити</button>
        </div>
      </div>
      ${fieldsFn(item, path, i)}
    </div>`).join('');
  return `<div class="array-editor" id="arr-${path.replace(/\./g,'-')}">${rows}</div>
    <button class="btn-add-item" onclick="addItem('${path}')">＋ ${addLabel}</button>`;
}

function itemTitle(item, i) {
  return item.title || item.name || item.date || item.label || `Запис ${i + 1}`;
}

// ── Field templates ───────────────────────────────────────────
function heroStatFields(item, path, i) {
  return `<div class="field-row triple">
    <div class="field"><label>Значення</label><input data-path="${path}[${i}].value" type="number" value="${item.value}"></div>
    <div class="field"><label>Суфікс</label><input data-path="${path}[${i}].suffix" value="${esc(item.suffix)}"></div>
    <div class="field"><label>Підпис</label><input data-path="${path}[${i}].label" value="${esc(item.label)}"></div>
  </div>`;
}
function newsFields(item, path, i) {
  return `<div class="field-row">
    <div class="field"><label>Іконка</label><input data-path="${path}[${i}].icon" value="${esc(item.icon)}"></div>
    <div class="field"><label>Категорія (news/science/event)</label><input data-path="${path}[${i}].cat" value="${esc(item.cat)}"></div>
  </div>
  <div class="field-row">
    <div class="field"><label>Назва категорії</label><input data-path="${path}[${i}].catLabel" value="${esc(item.catLabel)}"></div>
    <div class="field"><label>Дата</label><input data-path="${path}[${i}].date" value="${esc(item.date)}"></div>
  </div>
  <div class="field-row single"><div class="field"><label>Заголовок</label><input data-path="${path}[${i}].title" value="${esc(item.title)}"></div></div>
  <div class="field-row">
    <div class="field"><label>Перегляди</label><input data-path="${path}[${i}].views" value="${esc(item.views)}"></div>
    <div class="field"><label>URL</label><input data-path="${path}[${i}].url" value="${esc(item.url)}"></div>
  </div>`;
}
function eventFields(item, path, i) {
  return `<div class="field-row">
    <div class="field"><label>Дата</label><input data-path="${path}[${i}].date" value="${esc(item.date)}"></div>
    <div class="field"><label>Тип події</label><input data-path="${path}[${i}].type" value="${esc(item.type)}"></div>
  </div>
  <div class="field-row single"><div class="field"><label>Назва</label><input data-path="${path}[${i}].title" value="${esc(item.title)}"></div></div>`;
}
function partnerFields(item, path, i) {
  return `<div class="field-row single"><div class="field"><label>Назва партнера</label><input data-path="${path}[${i}]" value="${esc(item)}"></div></div>`;
}
function valueFields(item, path, i) {
  return `<div class="field-row">
    <div class="field"><label>Іконка</label><input data-path="${path}[${i}].icon" value="${esc(item.icon)}"></div>
    <div class="field"><label>Назва</label><input data-path="${path}[${i}].title" value="${esc(item.title)}"></div>
  </div>
  <div class="field-row single"><div class="field"><label>Опис</label><textarea data-path="${path}[${i}].text">${esc(item.text)}</textarea></div></div>`;
}
function leaderFields(item, path, i) {
  return `<div class="field-row triple">
    <div class="field"><label>Іконка</label><input data-path="${path}[${i}].icon" value="${esc(item.icon)}"></div>
    <div class="field"><label>Ім'я</label><input data-path="${path}[${i}].name" value="${esc(item.name)}"></div>
    <div class="field"><label>Email</label><input data-path="${path}[${i}].email" value="${esc(item.email)}"></div>
  </div>
  <div class="field-row single"><div class="field"><label>Посада</label><input data-path="${path}[${i}].role" value="${esc(item.role)}"></div></div>`;
}
function strategyFields(item, path, i) {
  return `<div class="field-row">
    <div class="field"><label>Іконка</label><input data-path="${path}[${i}].icon" value="${esc(item.icon)}"></div>
    <div class="field"><label>Назва</label><input data-path="${path}[${i}].title" value="${esc(item.title)}"></div>
  </div>
  <div class="field-row single"><div class="field"><label>Опис</label><textarea data-path="${path}[${i}].text">${esc(item.text)}</textarea></div></div>`;
}
function facultyFields(item, path, i) {
  return `<div class="field-row">
    <div class="field"><label>Іконка</label><input data-path="${path}[${i}].icon" value="${esc(item.icon)}"></div>
    <div class="field"><label>ID</label><input data-path="${path}[${i}].id" value="${esc(item.id)}"></div>
  </div>
  <div class="field-row single"><div class="field"><label>Назва</label><input data-path="${path}[${i}].name" value="${esc(item.name)}"></div></div>
  <div class="field-row single"><div class="field"><label>Опис</label><textarea data-path="${path}[${i}].description">${esc(item.description)}</textarea></div></div>
  <div class="field-row">
    <div class="field"><label>Декан/Директор</label><input data-path="${path}[${i}].dean" value="${esc(item.dean)}"></div>
    <div class="field"><label>К-сть програм</label><input type="number" data-path="${path}[${i}].programs" value="${item.programs}"></div>
  </div>`;
}
function programFields(item, path, i) {
  return `<div class="field-row triple">
    <div class="field"><label>Рівень (bachelor/master/phd)</label><input data-path="${path}[${i}].level" value="${esc(item.level)}"></div>
    <div class="field"><label>Назва рівня (UA)</label><input data-path="${path}[${i}].levelLabel" value="${esc(item.levelLabel)}"></div>
    <div class="field"><label>Факультет ID</label><input data-path="${path}[${i}].faculty" value="${esc(item.faculty)}"></div>
  </div>
  <div class="field-row single"><div class="field"><label>Назва програми</label><input data-path="${path}[${i}].title" value="${esc(item.title)}"></div></div>
  <div class="field-row triple">
    <div class="field"><label>Тривалість</label><input data-path="${path}[${i}].duration" value="${esc(item.duration)}"></div>
    <div class="field"><label>Мова</label><input data-path="${path}[${i}].language" value="${esc(item.language)}"></div>
    <div class="field"><label>Фінансування</label><input data-path="${path}[${i}].funding" value="${esc(item.funding)}"></div>
  </div>`;
}
function deptFields(item, path, i) {
  return `<div class="field-row">
    <div class="field"><label>Іконка</label><input data-path="${path}[${i}].icon" value="${esc(item.icon)}"></div>
    <div class="field"><label>Назва</label><input data-path="${path}[${i}].name" value="${esc(item.name)}"></div>
  </div>
  <div class="field-row triple">
    <div class="field"><label>Телефон</label><input data-path="${path}[${i}].phone" value="${esc(item.phone)}"></div>
    <div class="field"><label>Email</label><input data-path="${path}[${i}].email" value="${esc(item.email)}"></div>
    <div class="field"><label>Розташування</label><input data-path="${path}[${i}].location" value="${esc(item.location)}"></div>
  </div>`;
}

// ── Array mutations ───────────────────────────────────────────
function getArr(path) {
  const parts = path.split('.');
  let obj = content;
  for (const p of parts) obj = obj[p];
  return obj;
}
function setArr(path, arr) {
  const parts = path.split('.');
  let obj = content;
  for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]];
  obj[parts[parts.length - 1]] = arr;
}
function deleteItem(path, idx) {
  collectFormData();
  const arr = getArr(path);
  arr.splice(idx, 1);
  renderCurrentPage();
}
function moveItem(path, idx, dir) {
  collectFormData();
  const arr = getArr(path);
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= arr.length) return;
  [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
  renderCurrentPage();
}
function addItem(path) {
  collectFormData();
  const arr = getArr(path);
  const tmpl = makeTemplate(path);
  arr.push(tmpl);
  renderCurrentPage();
  setTimeout(() => {
    const container = document.getElementById('arr-' + path.replace(/\./g, '-'));
    if (container) container.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 100);
}
function makeTemplate(path) {
  if (path === 'home.news') return { id: Date.now(), cat: 'news', icon: '📰', catLabel: 'Новини', title: 'Нова новина', date: 'Квітень 2026', views: '0', url: '#' };
  if (path === 'home.events') return { id: Date.now(), date: 'ДАТА', title: 'Нова подія', type: '📅 Тип' };
  if (path === 'home.heroStats') return { value: 0, suffix: '+', label: 'Показник' };
  if (path === 'home.partners') return 'Новий партнер';
  if (path === 'about.values') return { icon: '⭐', title: 'Нова цінність', text: 'Опис' };
  if (path === 'about.leadership') return { icon: '👤', name: 'Ім\'я', role: 'Посада', email: 'email@kai.edu.ua' };
  if (path === 'about.strategy') return { icon: '🎯', title: 'Напрям', text: 'Опис' };
  if (path === 'faculties.list') return { id: 'new-faculty', icon: '🏫', name: 'Новий факультет', description: 'Опис', dean: 'Декан:', programs: 0 };
  if (path === 'faculties.programs') return { id: Date.now(), level: 'bachelor', levelLabel: 'Бакалавр', title: 'Нова програма', faculty: 'cs', facultyLabel: 'Факультет', duration: '4 роки', language: 'UA', funding: 'Контракт' };
  if (path === 'contacts.departments') return { icon: '🏢', name: 'Новий відділ', phone: '', email: '', location: '' };
  return {};
}

// ── Collect form data ─────────────────────────────────────────
function collectFormData() {
  document.querySelectorAll('[data-path]').forEach(el => {
    const path = el.dataset.path;
    const value = el.tagName === 'TEXTAREA' ? el.value : (el.type === 'number' ? Number(el.value) : el.value);
    setPath(content, path, value);
  });
}

function setPath(obj, path, value) {
  // supports both dot notation and array brackets: home.news[0].title
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur[parts[i]] === undefined) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

// ── UI helpers ────────────────────────────────────────────────
function esc(str) {
  if (str === undefined || str === null) return '';
  return String(str).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function toast(type, msg) {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.innerHTML = msg;
  c.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 4500);
}

function showLoading(msg) {
  let lo = document.getElementById('loading-overlay');
  if (!lo) { lo = document.createElement('div'); lo.id = 'loading-overlay'; lo.className = 'loading-overlay'; lo.innerHTML = `<div class="spinner"></div><p></p>`; document.body.appendChild(lo); }
  lo.querySelector('p').textContent = msg || 'Завантаження...';
  lo.style.display = 'flex';
}
function hideLoading() {
  const lo = document.getElementById('loading-overlay');
  if (lo) lo.style.display = 'none';
}

function setStatus(state) {
  const badge = document.getElementById('deploy-status');
  if (!badge) return;
  if (state === 'deploying') { badge.className = 'status-badge deploying'; badge.innerHTML = '<span class="status-dot"></span> Оновлюється...'; }
  else if (state === 'deployed') { badge.className = 'status-badge deployed'; badge.innerHTML = '<span class="status-dot"></span> Опубліковано'; }
  else { badge.className = 'status-badge'; badge.innerHTML = '<span class="status-dot"></span> Готово'; }
}

function updateDeployStatus() {
  setStatus('deployed');
}

// Preview button
document.getElementById('btn-preview')?.addEventListener('click', () => window.open(SITE, '_blank'));
