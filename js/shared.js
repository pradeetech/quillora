// ============================================================
// ArticleNest — Shared UI (Navbar auth + Helpers)
// ============================================================
import {
  auth, db, doc, getDoc, onAuthStateChanged, signOut, isAdminEmail
} from './firebase-config.js';

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
  const c = { Technology:'#4F6EF7', Education:'#10B981', Business:'#F59E0B', Lifestyle:'#EC4899' };
  return c[cat] || '#6B7280';
}
export function fmtDate(ts) {
  return ts?.toDate?.().toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' }) || '—';
}
export function articleCard(a, id) {
  const img = a.coverImage
    ? `<img src="${escapeHtml(a.coverImage)}" alt="${escapeHtml(a.title)}" loading="lazy">`
    : `<div class="card-placeholder" style="background:${categoryColor(a.category)}">${escapeHtml((a.category||'A')[0])}</div>`;
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

// ---------- Navbar Auth Area ----------
// Login නැත්නම්: Login / Sign Up buttons
// Normal user: Avatar + Logout (admin link පේන්නේ නෑ!)
// Admin: Dashboard link + Avatar + Logout
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