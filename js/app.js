// ============================================================
// Quillora — Public Pages (Home / Article / Category / Search)
// Includes: Bookmarks + Related Articles + Newsletter
// ============================================================
import {
  auth, db, collection, getDocs, getDoc, doc, addDoc, query, orderBy, where, limit,
  startAfter, increment, updateDoc, setDoc, arrayUnion, arrayRemove, serverTimestamp
} from './firebase-config.js';
import { articleCard, escapeHtml, getExcerpt, fmtDate } from './shared.js';

const params = new URLSearchParams(location.search);
const page = (location.pathname.split('/').pop() || 'index.html');

// ==================== HOME ====================
async function initHome() {
  const tGrid = document.getElementById('trendingGrid');
  const lGrid = document.getElementById('latestGrid');
  const btn = document.getElementById('loadMoreBtn');
  try {
    const tq = query(collection(db,'articles'), where('published','==',true), orderBy('views','desc'), limit(3));
    const ts = await getDocs(tq);
    tGrid.innerHTML = ts.empty ? '<div class="empty">No articles yet — coming soon! ✨</div>'
      : ts.docs.map(d => articleCard(d.data(), d.id)).join('');
    let last = null;
    async function loadLatest(reset) {
      let q = query(collection(db,'articles'), where('published','==',true), orderBy('createdAt','desc'), limit(6));
      if (last) q = query(collection(db,'articles'), where('published','==',true), orderBy('createdAt','desc'), startAfter(last), limit(6));
      const s = await getDocs(q);
      if (reset) lGrid.innerHTML = '';
      if (s.empty && reset) { lGrid.innerHTML = '<div class="empty">No articles yet — coming soon! ✨</div>'; return; }
      lGrid.insertAdjacentHTML('beforeend', s.docs.map(d => articleCard(d.data(), d.id)).join(''));
      last = s.docs[s.docs.length-1] || last;
      if (btn) btn.style.display = s.size === 6 ? 'inline-block' : 'none';
    }
    await loadLatest(true);
    btn?.addEventListener('click', () => loadLatest(false));
  } catch (e) {
    console.error(e);
    tGrid.innerHTML = lGrid.innerHTML = '<div class="empty">⚠️ Database error — Firebase index/settings check කරන්න.</div>';
  }
}

// ==================== ARTICLE PAGE ====================
async function initArticle() {
  const box = document.getElementById('articleContent');
  const id = params.get('id');
  if (!id) return location.replace('index.html');
  try {
    const ref = doc(db, 'articles', id);
    const snap = await getDoc(ref);
    if (!snap.exists() || !snap.data().published) {
      box.innerHTML = '<div class="empty">Article not found. <a href="index.html">← Back to Home</a></div>';
      return;
    }
    const a = snap.data();
    updateDoc(ref, { views: increment(1) }).catch(()=>{});

    const desc = a.metaDescription || getExcerpt(a.content, 155);
    document.title = `${a.metaTitle || a.title} | Quillora`;
    setMeta('description', desc);
    if (a.keywords) setMeta('keywords', a.keywords);
    setMeta('og:title', a.title, true);
    setMeta('og:description', desc, true);
    setMeta('og:type', 'article', true);
    if (a.coverImage) setMeta('og:image', a.coverImage, true);
    injectJsonLd(a, desc);

    const url = encodeURIComponent(location.href);
    const title = encodeURIComponent(a.title);
    const saved = await isSaved(id);

    box.innerHTML = `
      <div class="article-header">
        <span class="card-category">${escapeHtml(a.category || 'General')}</span>
        <h1>${escapeHtml(a.title)}</h1>
        <div class="article-meta">
          📅 ${fmtDate(a.createdAt)} · 👁️ ${(a.views||0)+1} views · ⏱️ ${readTime(a.content)} min read
        </div>
        <button class="bookmark-btn ${saved ? 'saved' : ''}" id="bookmarkBtn">${saved ? '❤️ Saved' : '🤍 Save'}</button>
      </div>
      ${a.coverImage ? `<img class="article-cover" src="${escapeHtml(a.coverImage)}" alt="${escapeHtml(a.title)}">` : ''}
      <div class="article-body">${a.content}</div>
      ${a.keywords ? `<div class="article-tags">${a.keywords.split(',').map(k=>`<span class="tag">${escapeHtml(k.trim())}</span>`).join('')}</div>` : ''}
      <div class="share-section">
        <h4>Share this article</h4>
        <div class="share-buttons">
          <a class="share-btn fb" target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u=${url}">📘 Facebook</a>
          <a class="share-btn wa" target="_blank" rel="noopener" href="https://wa.me/?text=${title}%20${url}">💬 WhatsApp</a>
          <a class="share-btn tw" target="_blank" rel="noopener" href="https://twitter.com/intent/tweet?text=${title}&url=${url}">🐦 Twitter/X</a>
        </div>
      </div>
      <div class="related-section" id="relatedArticles">
        <h4>📚 You May Also Like</h4>
        <div class="article-grid related-grid" style="margin-top:16px;">
          <div class="loading">Finding related articles…</div>
        </div>
      </div>`;

    document.getElementById('bookmarkBtn')?.addEventListener('click', () => toggleSave(id));

    // ---------- 📚 Related Articles (same category, sorted by views) ----------
    loadRelated(a, id);
  } catch (e) {
    console.error(e);
    box.innerHTML = '<div class="empty">⚠️ Failed to load article.</div>';
  }
}

// ---------- 📚 Related Articles Loader ----------
async function loadRelated(article, excludeId) {
  const rwrap = document.getElementById('relatedArticles');
  if (!rwrap) return;
  const grid = rwrap.querySelector('.related-grid');
  try {
    // පළවෙනි attempt: same category + views order
    const rq = query(collection(db,'articles'),
      where('published','==',true),
      where('category','==',article.category || 'Technology'),
      orderBy('views','desc'), limit(4));
    const rs = await getDocs(rq);
    const related = rs.docs.filter(d => d.id !== excludeId).slice(0, 3);
    grid.innerHTML = related.length
      ? related.map(d => articleCard(d.data(), d.id)).join('')
      : '<div class="empty" style="padding:16px;">More stories coming soon! ✨</div>';
  } catch (err) {
    console.warn('related (indexed query failed, trying fallback):', err);
    // 🔄 Fallback: index නැත්නම් — category filter විතරක් (order නැතුව)
    try {
      const fq = query(collection(db,'articles'),
        where('published','==',true),
        where('category','==',article.category || 'Technology'),
        limit(6));
      const fs = await getDocs(fq);
      const related = fs.docs.filter(d => d.id !== excludeId).slice(0, 3);
      grid.innerHTML = related.length
        ? related.map(d => articleCard(d.data(), d.id)).join('')
        : '<div class="empty" style="padding:16px;">More stories coming soon! ✨</div>';
    } catch (err2) {
      grid.innerHTML = '<div class="empty" style="padding:16px;">⚠️ Could not load related articles.</div>';
      console.error('related fallback failed:', err2);
    }
  }
}

// ==================== 🤍 Bookmarks ====================
async function myBookmarkIds() {
  const u = auth.currentUser;
  if (!u) return null;
  try {
    const s = await getDoc(doc(db, 'users', u.uid));
    return s.exists() ? (s.data().bookmarks || []) : [];
  } catch { return []; }
}
async function isSaved(id) { return (await myBookmarkIds())?.includes(id) || false; }
async function toggleSave(id) {
  const u = auth.currentUser;
  if (!u) return location.href = 'login.html?next=' + encodeURIComponent(location.pathname + location.search);
  const ref = doc(db, 'users', u.uid);
  const ids = await myBookmarkIds();
  const saved = ids.includes(id);
  try {
    await updateDoc(ref, { bookmarks: saved ? arrayRemove(id) : arrayUnion(id) });
  } catch {
    await setDoc(ref, { bookmarks: saved ? [] : [id] }, { merge: true });
  }
  const btn = document.getElementById('bookmarkBtn');
  btn.classList.toggle('saved', !saved);
  btn.textContent = saved ? '🤍 Save' : '❤️ Saved';
}

// ==================== CATEGORY ====================
async function initCategory() {
  const grid = document.getElementById('categoryGrid');
  const cat = params.get('cat') || 'Technology';
  document.getElementById('categoryTitle').textContent = cat;
  document.title = `${cat} Articles | Quillora`;
  try {
    const q = query(collection(db,'articles'), where('published','==',true), where('category','==',cat), orderBy('createdAt','desc'));
    const s = await getDocs(q);
    grid.innerHTML = s.empty ? `<div class="empty">No ${escapeHtml(cat)} articles yet. ✨</div>`
      : s.docs.map(d => articleCard(d.data(), d.id)).join('');
  } catch (e) { console.error(e); grid.innerHTML = '<div class="empty">⚠️ Failed to load category.</div>'; }
}

// ==================== SEARCH ====================
async function initSearch() {
  const grid = document.getElementById('searchResults');
  const term = (params.get('q') || '').trim();
  document.getElementById('searchTerm').textContent = term || '…';
  document.title = `Search: ${term} | Quillora`;
  if (!term) { grid.innerHTML = '<div class="empty">Type something in the search bar 🔍</div>'; return; }
  const t = term.toLowerCase();
  try {
    const q = query(collection(db,'articles'), where('published','==',true), limit(300));
    const s = await getDocs(q);
    const hits = s.docs.filter(d => {
      const a = d.data();
      return (a.title||'').toLowerCase().includes(t)
        || (a.keywords||'').toLowerCase().includes(t)
        || (a.category||'').toLowerCase().includes(t)
        || String(a.content||'').toLowerCase().includes(t);
    });
    grid.innerHTML = hits.length
      ? hits.map(d => articleCard(d.data(), d.id)).join('')
      : `<div class="empty">No results for "<strong>${escapeHtml(term)}</strong>". Try different keywords.</div>`;
  } catch (e) { console.error(e); grid.innerHTML = '<div class="empty">⚠️ Search failed.</div>'; }
}

// ==================== Helpers ====================
function setMeta(name, content, prop = false) {
  let el = document.querySelector(`meta[${prop?'property':'name'}="${name}"]`);
  if (!el) { el = document.createElement('meta'); el.setAttribute(prop?'property':'name', name); document.head.appendChild(el); }
  el.setAttribute('content', content);
}
function readTime(html) {
  return Math.max(1, Math.ceil(String(html||'').replace(/<[^>]*>/g,' ').split(/\s+/).filter(Boolean).length / 200));
}
function injectJsonLd(a, desc) {
  const s = document.createElement('script');
  s.type = 'application/ld+json';
  s.textContent = JSON.stringify({
    '@context':'https://schema.org', '@type':'Article',
    headline: a.title, description: desc,
    datePublished: a.createdAt?.toDate?.().toISOString?.(),
    author: { '@type':'Person', name: 'Quillora' },
    publisher: { '@type':'Organization', name:'Quillora' }
  });
  document.head.appendChild(s);
}

// ==================== Router ====================
if (page === 'index.html' || page === '') initHome();
else if (page === 'article.html') initArticle();
else if (page === 'category.html') initCategory();
else if (page === 'search.html') initSearch();
