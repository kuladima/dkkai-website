/* ============================================================
   KAI UNIVERSITY — Main JavaScript
   ============================================================ */

'use strict';

// ── Language data ──────────────────────────────────────────
const i18n = {
  uk: {
    nav_about:    'Про університет',
    nav_vstup:    'Вступ 2026',
    nav_faculties:'Факультети',
    nav_students: 'Студентам',
    nav_contacts: 'Контакти',
    btn_cabinet:  'Кабінет студента',
    btn_online:   'KAI Online',
    hero_badge:   'Вступна кампанія 2026',
    hero_h1:      'Твоє майбутнє <span>починається тут</span>',
    hero_sub:     'Київський авіаційний інститут — один із провідних технічних університетів України. 80+ років традицій, сучасні технології, міжнародні програми.',
    hero_cta1:    'Обрати програму',
    hero_cta2:    'Подати заявку',
    section_news: 'Новини та події',
    section_fac:  'Факультети',
    section_prog: 'Освітні програми',
    footer_copy:  '© 2026 Державний університет «Київський авіаційний інститут»',
  },
  en: {
    nav_about:    'About',
    nav_vstup:    'Admissions 2026',
    nav_faculties:'Faculties',
    nav_students: 'Students',
    nav_contacts: 'Contacts',
    btn_cabinet:  'Student Portal',
    btn_online:   'KAI Online',
    hero_badge:   'Admission Campaign 2026',
    hero_h1:      'Your future <span>starts here</span>',
    hero_sub:     'Kyiv Aviation Institute — one of Ukraine\'s leading technical universities. 80+ years of tradition, modern technology, international programmes.',
    hero_cta1:    'Choose a programme',
    hero_cta2:    'Apply now',
    section_news: 'News & Events',
    section_fac:  'Faculties',
    section_prog: 'Academic Programmes',
    footer_copy:  '© 2026 State University "Kyiv Aviation Institute"',
  }
};

let currentLang = localStorage.getItem('kai_lang') || 'uk';

// ── DOM Ready ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initLang();
  initNav();
  initHamburger();
  initTabs();
  initProgramFilter();
  initCounters();
  initModal();
  initChatbot();
  initStickyHeader();
  initNewsFilter();
});

// ── Language Switcher ──────────────────────────────────────
function initLang() {
  document.querySelectorAll('.lang-btn').forEach(btn => {
    if (btn.dataset.lang === currentLang) btn.classList.add('active');
    btn.addEventListener('click', () => {
      currentLang = btn.dataset.lang;
      localStorage.setItem('kai_lang', currentLang);
      document.querySelectorAll('.lang-btn').forEach(b => b.classList.toggle('active', b.dataset.lang === currentLang));
      applyLang(currentLang);
    });
  });
  applyLang(currentLang);
}

function applyLang(lang) {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (i18n[lang] && i18n[lang][key]) {
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.placeholder = i18n[lang][key];
      } else {
        el.innerHTML = i18n[lang][key];
      }
    }
  });
  document.documentElement.lang = lang;
  document.querySelectorAll('.lang-only').forEach(el => {
    el.style.display = el.dataset.lang === lang ? '' : 'none';
  });
}

// ── Navigation ─────────────────────────────────────────────
function initNav() {
  // Active nav highlighting
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link').forEach(link => {
    if (link.getAttribute('href') === currentPage) {
      link.classList.add('active');
    }
  });
}

// ── Hamburger ──────────────────────────────────────────────
function initHamburger() {
  const btn = document.querySelector('.hamburger');
  const nav = document.querySelector('.main-nav');
  if (!btn || !nav) return;
  btn.addEventListener('click', () => {
    nav.classList.toggle('open');
    btn.setAttribute('aria-expanded', nav.classList.contains('open'));
  });
  // Close on outside click
  document.addEventListener('click', e => {
    if (!btn.contains(e.target) && !nav.contains(e.target)) {
      nav.classList.remove('open');
    }
  });
}

// ── Sticky header shadow ───────────────────────────────────
function initStickyHeader() {
  const header = document.querySelector('.site-header');
  if (!header) return;
  window.addEventListener('scroll', () => {
    header.style.boxShadow = window.scrollY > 10
      ? '0 2px 16px rgba(0,0,0,.12)'
      : '0 1px 3px rgba(0,0,0,.08)';
  }, { passive: true });
}

// ── Tabs ───────────────────────────────────────────────────
function initTabs() {
  document.querySelectorAll('.tabs').forEach(tabGroup => {
    const btns = tabGroup.querySelectorAll('.tab-btn');
    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.tab;
        btns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const panel = document.querySelector(`#${target}`);
        const allPanels = document.querySelectorAll('.tab-content');
        allPanels.forEach(p => p.classList.remove('active'));
        if (panel) panel.classList.add('active');
      });
    });
  });
}

// ── Programme Filter ───────────────────────────────────────
function initProgramFilter() {
  const searchInput = document.getElementById('prog-search');
  const levelFilter = document.getElementById('prog-level');
  const facultyFilter = document.getElementById('prog-faculty');
  const cards = document.querySelectorAll('.program-card[data-level]');
  if (!searchInput && !cards.length) return;

  function applyFilter() {
    const q = searchInput ? searchInput.value.toLowerCase() : '';
    const level = levelFilter ? levelFilter.value : '';
    const fac = facultyFilter ? facultyFilter.value : '';

    cards.forEach(card => {
      const title = card.querySelector('h4')?.textContent.toLowerCase() || '';
      const cardLevel = card.dataset.level || '';
      const cardFac = card.dataset.faculty || '';
      const matchQ = !q || title.includes(q);
      const matchLevel = !level || cardLevel === level;
      const matchFac = !fac || cardFac === fac;
      card.style.display = matchQ && matchLevel && matchFac ? '' : 'none';
    });
  }

  if (searchInput) searchInput.addEventListener('input', applyFilter);
  if (levelFilter) levelFilter.addEventListener('change', applyFilter);
  if (facultyFilter) facultyFilter.addEventListener('change', applyFilter);
}

// ── News filter ────────────────────────────────────────────
function initNewsFilter() {
  const filterBtns = document.querySelectorAll('.news-filter-btn');
  const newsCards = document.querySelectorAll('.news-card[data-cat]');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const cat = btn.dataset.cat;
      newsCards.forEach(card => {
        card.style.display = !cat || card.dataset.cat === cat ? '' : 'none';
      });
    });
  });
}

// ── Animated Counters ──────────────────────────────────────
function initCounters() {
  const counters = document.querySelectorAll('.counter');
  if (!counters.length) return;
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });
  counters.forEach(c => observer.observe(c));
}

function animateCounter(el) {
  const target = parseInt(el.dataset.target, 10);
  const suffix = el.dataset.suffix || '';
  const duration = 1800;
  const step = target / (duration / 16);
  let current = 0;
  const timer = setInterval(() => {
    current = Math.min(current + step, target);
    el.textContent = Math.floor(current).toLocaleString('uk-UA') + suffix;
    if (current >= target) clearInterval(timer);
  }, 16);
}

// ── Modal ──────────────────────────────────────────────────
function initModal() {
  // Open
  document.querySelectorAll('[data-modal]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      const id = btn.dataset.modal;
      const overlay = document.getElementById(id);
      if (overlay) {
        overlay.classList.add('open');
        document.body.style.overflow = 'hidden';
      }
    });
  });
  // Close
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.querySelector('.modal-close')?.addEventListener('click', () => closeModal(overlay));
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(overlay); });
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.open').forEach(closeModal);
  });
}
function closeModal(overlay) {
  overlay.classList.remove('open');
  document.body.style.overflow = '';
}

// ── Chatbot widget ─────────────────────────────────────────
function initChatbot() {
  const btn = document.getElementById('chatbot-btn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    alert('Чат-бот: у реальному проєкті тут відкривається вікно онлайн-консультанта (Tidio / власна інтеграція).');
  });
}

// ── Form submission (demo) ─────────────────────────────────
document.addEventListener('submit', e => {
  if (e.target.classList.contains('kai-form')) {
    e.preventDefault();
    const btn = e.target.querySelector('[type=submit]');
    const original = btn.textContent;
    btn.textContent = '✓ Надіслано!';
    btn.disabled = true;
    setTimeout(() => {
      btn.textContent = original;
      btn.disabled = false;
      e.target.reset();
      const overlay = e.target.closest('.modal-overlay');
      if (overlay) closeModal(overlay);
    }, 2500);
  }
});

// ── Smooth scroll for anchor links ────────────────────────
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', e => {
    const target = document.querySelector(link.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});
