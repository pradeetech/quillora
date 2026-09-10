// ============================================================
// Quillora — Shared UI (Navbar auth + Categories + Privacy + Helpers)
// ============================================================
import {
  auth, db, doc, getDoc, onAuthStateChanged, signOut, isAdminEmail
} from './firebase-config.js';

// ---------- 📂 Main Categories (18) ----------
export const MAIN_CATEGORIES = [
  "Technology", "Business", "Finance", "Education", "Science",
  "Health", "Lifestyle", "Career", "Travel", "Food", "Sports",
  "Gaming", "Entertainment", "Home", "News", "Automotive",
  "Motivation", "Design"
];

// ---------- Helpers ----------
export function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str ?? '';
  return d.innerHTML;
}
export function getExcerpt(html, len = 120) {
  const t = String(html || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  return t.length > len ? t.slice(0, len) + '…' : t;
}
export function categoryColor(cat) {
  const c = {
    Technology:'#4F6EF7', Business:'#F59E0B', Finance:'#10B981',
    Education:'#8B5CF6', Science:'#06B6D4', Health:'#EF4444',
    Lifestyle:'#EC4899', Career:'#6366F1', Travel:'#14B8A6',
    Food:'#F97316', Sports:'#22C55E', Gaming:'#A855F7',
    Entertainment:'#EAB308', Home:'#F43F5E', News:'#64748B',
    Automotive:'#94A3B8', Motivation:'#FB7185', Design:'#D946EF'
  };
  return c[cat] || '#4F6EF7';
}
export function fmtDate(ts) {
  return ts?.toDate?.().toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' }) || '—';
}
export function articleCard(a, id) {
  const img = a.coverImage
    ? `<img src="${escapeHtml(a.coverImage)}" alt="${escapeHtml(a.title)}" loading="lazy">`
    : `<div class="card-placeholder" style="background:${categoryColor(a.category)}">${escapeHtml((a.category||'Q')[0])}</div>`;
  return `
  <article class="article-card">
    <a href="article.html?id=${id}" class="card-image">${img}</a>
    <div class="card-body">
      <span class="card-category">${escapeHtml(a.category || 'General')}</span>
      <h3><a href="article.html?id=${id}">${escapeHtml(a.title)}</a></h3>
      <p class="card-excerpt">${escapeHtml(getExcerpt(a.content))}</p>
      <div class="card-meta">
        <span>📅 ${fmtDate(a.createdAt)}</span>
        <span>👁️ ${a.views || 0}</span>
      </div>
    </div>
  </article>`;
}

// ---------- 📂 Categories Dropdown + 🔒 Privacy Link (navbar auto-inject) ----------
(function injectCategoriesNav() {
  const nav = document.querySelector('.main-nav');
  if (!nav || nav.querySelector('.nav-dropdown')) return;
  const drop = document.createElement('div');
  drop.className = 'nav-dropdown';
  drop.innerHTML = `
    <a href="#" class="drop-toggle">Categories <span class="caret">▾</span></a>
    <div class="dropdown-menu">
      ${MAIN_CATEGORIES.map(c => `<a href="category.html?cat=${encodeURIComponent(c)}">${c}</a>`).join('')}
    </div>`;
  const about = nav.querySelector('a[href="contact.html"]');
  if (about) nav.insertBefore(drop, about); else nav.appendChild(drop);

  // 🔒 Privacy Policy link (About ට පස්සේ add කරනවා)
  if (!nav.querySelector('a[href="privacy.html"]')) {
    const priv = document.createElement('a');
    priv.href = 'privacy.html';
    priv.textContent = 'Privacy';
    nav.appendChild(priv);
  }

  // 📜 Terms of Service link (Privacy ට පස්සේ)
  if (!nav.querySelector('a[href="terms.html"]')) {
    const terms = document.createElement('a');
    terms.href = 'terms.html';
    terms.textContent = 'Terms';
    nav.appendChild(terms);
  }

  // Click toggle (touch devices)
  drop.querySelector('.drop-toggle').addEventListener('click', e => {
    e.preventDefault();
    drop.classList.toggle('open');
  });
  document.addEventListener('click', e => {
    if (!drop.contains(e.target)) drop.classList.remove('open');
  });
})();

// ---------- 🏷️ Category Pills (homepage #categoryPills තියෙනවා නම්) ----------
(function injectCategoryPills() {
  const wrap = document.getElementById('categoryPills');
  if (!wrap) return;
  wrap.innerHTML = MAIN_CATEGORIES.map(c =>
    `<a class="cat-pill" href="category.html?cat=${encodeURIComponent(c)}">
       <span class="dot" style="background:${categoryColor(c)}"></span>${c}
     </a>`).join('');
})();

// ---------- Navbar Auth Area ----------
onAuthStateChanged(auth, async (user) => {
  const area = document.getElementById('authArea');
  if (!area) return;
  if (user) {
    let name = user.displayName || user.email.split('@')[0];
    let role = 'user';
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (snap.exists()) { name = snap.data().name || name; role = snap.data().role || 'user'; }
    } catch (e) { console.warn(e); }
    const admin = role === 'admin' && isAdminEmail(user.email);
    area.innerHTML = `
      ${admin ? `<a href="admin/dashboard.html" class="nav-btn admin-link">⚙️ Dashboard</a>` : ''}
      <a href="profile.html" class="nav-avatar" title="${escapeHtml(name)}">${escapeHtml((name[0]||'U').toUpperCase())}</a>
      <button class="nav-btn" id="navLogout">Logout</button>`;
    document.getElementById('navLogout')?.addEventListener('click', async () => {
      await signOut(auth);
      location.href = 'index.html';
    });
  } else {
    area.innerHTML = `
      <a href="login.html" class="nav-btn">Login</a>
      <a href="register.html" class="nav-btn primary">Sign Up</a>`;
  }
});

// ---------- Mobile menu + footer year ----------
document.getElementById('menuToggle')?.addEventListener('click', () => {
  document.getElementById('mainNav')?.classList.toggle('open');
});
const y = document.getElementById('year');
if (y) y.textContent = new Date().getFullYear();
