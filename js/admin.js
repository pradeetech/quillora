// ============================================================
// Quillora — Admin Dashboard (Owner Only) — Pro Edition
// ============================================================
import {
  db, auth, collection, getDocs, getDoc, doc, addDoc, updateDoc, deleteDoc,
  query, orderBy, serverTimestamp, onAuthStateChanged, signOut,
  sendEmailVerification, isAdminEmail
} from './firebase-config.js';

// 🔐 GUARD
onAuthStateChanged(auth, async user => {
  if (!user) return location.replace('../login.html?next=admin/dashboard.html');
  let role = 'user';
  try {
    const s = await getDoc(doc(db, 'users', user.uid));
    if (s.exists()) role = s.data().role;
  } catch (e) {}
  if (role !== 'admin' || !isAdminEmail(user.email)) {
    alert('⛔ Admin access only.');
    return location.replace('../index.html');
  }
  if (!user.emailVerified) document.getElementById('verifyBanner').style.display = 'flex';
});

document.getElementById('logoutBtn').addEventListener('click', () => signOut(auth));
document.getElementById('resendVerifyBtn')?.addEventListener('click', () => sendEmailVerification(auth.currentUser));

// ---------- Quill Editor ----------
const quill = new Quill('#editor', {
  theme: 'snow',
  placeholder: 'Write your article here… (headings, images, links, bold/italic)',
  modules: {
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      ['blockquote', 'code-block'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['link', 'image'],
      ['clean']
    ]
  }
});

let editingId = null;
let autosaveTimer = null;

function slugify(t) {
  return t.toLowerCase().trim().replace(/[^\w\s-]/g,'').replace(/[\s_]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');
}
function showMsg(type, text) {
  const m = document.getElementById('msg');
  m.className = 'alert ' + (type === 'ok' ? 'ok' : 'err');
  m.textContent = text;
  setTimeout(() => m.className = 'alert', 4000);
}

// ==================== ✨ LIVE STATS ====================
function updateStats() {
  const title = document.getElementById('artTitle').value.trim();
  const text = quill.getText().trim();
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
  const readMin = Math.max(1, Math.ceil(words / 200));
  const desc = document.getElementById('artMetaDesc').value.trim().length;
  const keys = document.getElementById('artKeywords').value.trim();
  const keyCount = keys ? keys.split(',').filter(k => k.trim()).length : 0;

  document.getElementById('statWords').textContent = words;
  document.getElementById('statRead').textContent = readMin;

  const descBox = document.getElementById('seoDescBox');
  document.getElementById('statDesc').textContent = desc;
  descBox.classList.remove('good','warn','bad');
  if (desc >= 120 && desc <= 160) descBox.classList.add('good');
  else if (desc > 0) descBox.classList.add('warn');
  else descBox.classList.add('bad');

  const keyBox = document.getElementById('seoKeyBox');
  document.getElementById('statKeys').textContent = keyCount;
  keyBox.classList.remove('good','warn','bad');
  if (keyCount >= 2) keyBox.classList.add('good');
  else if (keyCount === 1) keyBox.classList.add('warn');
  else keyBox.classList.add('bad');

  // SEO checks
  const cT = document.getElementById('chkTitle');
  cT.innerHTML = title.length >= 30 && title.length <= 65
    ? '<span class="ok">✔</span> Title: good length (' + title.length + ' chars)'
    : '<span class="err">✘</span> Title: 30–65 chars ideal (now ' + title.length + ')';

  const cD = document.getElementById('chkDesc');
  cD.innerHTML = desc >= 120 && desc <= 160
    ? '<span class="ok">✔</span> Meta description: perfect (' + desc + ' chars)'
    : '<span class="err">✘</span> Meta description: 120–160 chars ideal (now ' + desc + ')';

  const cC = document.getElementById('chkContent');
  cC.innerHTML = words >= 800
    ? '<span class="ok">✔</span> Content: strong length (' + words + ' words)'
    : '<span class="err">✘</span> Content: 800+ words ideal for SEO (now ' + words + ')';

  const cK = document.getElementById('chkKeys');
  cK.innerHTML = keyCount >= 2
    ? '<span class="ok">✔</span> Keywords: ' + keyCount + ' set'
    : '<span class="err">✘</span> Keywords: add 2+ (subcategories)';
}

// Listen to all inputs
['artTitle','artMetaDesc','artKeywords'].forEach(id =>
  document.getElementById(id).addEventListener('input', updateStats)
);
quill.on('text-change', () => {
  updateStats();
  scheduleAutosave();
});
document.getElementById('artTitle').addEventListener('input', scheduleAutosave);

// ==================== 💾 AUTO-SAVE DRAFT ====================
function scheduleAutosave() {
  clearTimeout(autosaveTimer);
  document.getElementById('autosaveInd').textContent = '💾 Saving draft…';
  document.getElementById('autosaveInd').className = 'autosave-ind saving';
  autosaveTimer = setTimeout(saveDraft, 2000);
}

async function saveDraft() {
  const title = document.getElementById('artTitle').value.trim();
  if (!title || editingId) return; // Only autosave NEW articles (draft mode)
  const draftData = {
    title, slug: slugify(title),
    content: quill.root.innerHTML,
    coverImage: document.getElementById('artCover').value.trim() || null,
    metaDesc: document.getElementById('artMetaDesc').value.trim(),
    keywords: document.getElementById('artKeywords').value.trim(),
    savedAt: new Date().toISOString()
  };
  localStorage.setItem('quillora_draft', JSON.stringify(draftData));
  document.getElementById('autosaveInd').textContent = '✅ Draft saved locally';
  document.getElementById('autosaveInd').className = 'autosave-ind saved';
}

// Load draft on page open (if exists & no editing)
(function loadDraft() {
  const draft = localStorage.getItem('quillora_draft');
  if (!draft) return;
  try {
    const d = JSON.parse(draft);
    if (d.title && !confirm('💾 Unsaved draft found: "' + d.title + '"\n\nRestore it?')) {
      localStorage.removeItem('quillora_draft');
      return;
    }
    document.getElementById('artTitle').value = d.title || '';
    document.getElementById('artCover').value = d.coverImage || '';
    document.getElementById('artMetaDesc').value = d.metaDesc || '';
    document.getElementById('artKeywords').value = d.keywords || '';
    if (d.content) quill.root.innerHTML = d.content;
    updateStats();
    showMsg('ok', '📄 Draft restored!');
  } catch {}
})();

// ==================== 🖼️ COVER PREVIEW ====================
document.getElementById('artCover').addEventListener('input', e => {
  const url = e.target.value.trim();
  const prev = document.getElementById('coverPreview');
  if (url && (url.startsWith('http'))) {
    prev.src = url;
    prev.classList.add('show');
  } else {
    prev.classList.remove('show');
  }
});

// ==================== 👀 PREVIEW TAB ====================
document.getElementById('tabEditor').addEventListener('click', () => switchTab('editor'));
document.getElementById('tabPreview').addEventListener('click', () => switchTab('preview'));

function switchTab(tab) {
  const edBtn = document.getElementById('tabEditor');
  const pvBtn = document.getElementById('tabPreview');
  if (tab === 'editor') {
    edBtn.classList.add('active'); pvBtn.classList.remove('active');
    // Hide preview frame, show editor sections
    document.querySelectorAll('.preview-frame').forEach(f => f.remove());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    pvBtn.classList.add('active'); edBtn.classList.remove('active');
    showPreview();
  }
}

function showPreview() {
  // Remove existing preview
  document.querySelectorAll('.preview-frame').forEach(f => f.remove());
  const title = document.getElementById('artTitle').value.trim() || '(No title)';
  const category = document.getElementById('artCategory').value;
  const cover = document.getElementById('artCover').value.trim();
  const content = quill.root.innerHTML;

  const pv = document.createElement('div');
  pv.className = 'preview-frame show';
  pv.innerHTML = `
    <div class="pv-topbar" style="background:var(--dark); color:#fff; padding:10px 20px; border-radius:10px; margin-bottom:24px; font-family:'Segoe UI',sans-serif; font-size:.85rem;">
      👁️ This is how your article will appear to readers
    </div>
    <div class="pv-category">${escapeHtml(category)}</div>
    <div class="pv-title">${escapeHtml(title)}</div>
    ${cover ? `<img src="${escapeHtml(cover)}" alt="cover" style="margin-bottom:20px;">` : ''}
    <div class="pv-body">${content}</div>
  `;
  // Insert after the stats bar (top of page)
  const wrap = document.querySelector('.admin-wrap');
  wrap.insertBefore(pv, wrap.children[2]);
  pv.scrollIntoView({ behavior: 'smooth' });
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str ?? '';
  return d.innerHTML;
}

// ==================== Save / Update ====================
document.getElementById('saveBtn').addEventListener('click', async () => {
  const title    = document.getElementById('artTitle').value.trim();
  const category = document.getElementById('artCategory').value;
  const cover    = document.getElementById('artCover').value.trim();
  const content  = quill.root.innerHTML;
  const metaTitle = document.getElementById('artMetaTitle').value.trim() || title;
  const metaDesc  = document.getElementById('artMetaDesc').value.trim();
  const keywords  = document.getElementById('artKeywords').value.trim();

  if (!title) return showMsg('err', 'Title is required.');
  if (quill.getText().trim().length < 50) return showMsg('err', 'Content must be at least 50 characters.');
  if (!metaDesc) return showMsg('err', 'SEO meta description is required!');

  const data = {
    title, slug: slugify(title), category, coverImage: cover || null, content,
    metaTitle, metaDescription: metaDesc, keywords,
    updatedAt: serverTimestamp()
  };
  try {
    if (editingId) {
      await updateDoc(doc(db, 'articles', editingId), data);
      showMsg('ok', '✅ Article updated! Now: sitemap auto + GSC + social share.');
    } else {
      data.views = 0;
      data.published = true;
      data.createdAt = serverTimestamp();
      await addDoc(collection(db, 'articles'), data);
      showMsg('ok', '🎉 Article published! Auto-feeds will sync within 6h. Share on social + GSC request now!');
    }
    localStorage.removeItem('quillora_draft'); // Clear draft
    resetForm();
    loadTable();
  } catch (e) { showMsg('err', '❌ ' + e.message); }
});

function resetForm() {
  editingId = null;
  document.getElementById('editorTitle').textContent = '✍️ Write New Article';
  ['artTitle','artCover','artMetaTitle','artMetaDesc','artKeywords'].forEach(id => document.getElementById(id).value = '');
  quill.setContents([]);
  document.getElementById('coverPreview').classList.remove('show');
  localStorage.removeItem('quillora_draft');
  updateStats();
  document.querySelectorAll('.preview-frame').forEach(f => f.remove());
}

// ==================== Articles Table ====================
async function loadTable() {
  const tbody = document.getElementById('articlesTable');
  try {
    const s = await getDocs(query(collection(db, 'articles'), orderBy('createdAt', 'desc')));
    if (s.empty) { tbody.innerHTML = '<tr><td colspan="5">No articles yet — write your first one!</td></tr>'; return; }
    tbody.innerHTML = s.docs.map(d => {
      const a = d.data();
      return `<tr>
        <td><strong>${escapeHtml(a.title)}</strong><br>
            <small style="color:#6b7280">${fmtDate(a.createdAt)} · article.html?id=${d.id}</small></td>
        <td>${escapeHtml(a.category)}</td>
        <td>${a.views || 0}</td>
        <td><span class="badge ${a.published ? 'pub' : 'draft'}">${a.published ? 'Published' : 'Draft'}</span></td>
        <td class="actions">
          <button class="act-edit" onclick="editArticle('${d.id}')">Edit</button>
          <button class="act-tog" onclick="togglePublish('${d.id}', ${!a.published})">${a.published ? 'Unpublish' : 'Publish'}</button>
          <button class="act-del" onclick="deleteArticle('${d.id}')">Delete</button>
        </td>
      </tr>`;
    }).join('');
  } catch (e) { tbody.innerHTML = `<tr><td colspan="5">Error: ${e.message}</td></tr>`; }
}
function escapeHtml(str) { const d = document.createElement('div'); d.textContent = str ?? ''; return d.innerHTML; }
function fmtDate(ts) { return ts?.toDate?.().toLocaleDateString() || '—'; }

window.editArticle = async id => {
  const s = await getDoc(doc(db, 'articles', id));
  if (!s.exists()) return;
  const a = s.data();
  editingId = id;
  document.getElementById('editorTitle').textContent = '✏️ Editing: ' + a.title;
  document.getElementById('artTitle').value = a.title;
  document.getElementById('artCategory').value = a.category || 'Technology';
  document.getElementById('artCover').value = a.coverImage || '';
  if (a.coverImage) {
    const prev = document.getElementById('coverPreview');
    prev.src = a.coverImage;
    prev.classList.add('show');
  }
  document.getElementById('artMetaTitle').value = a.metaTitle || '';
  document.getElementById('artMetaDesc').value = a.metaDescription || '';
  document.getElementById('artKeywords').value = a.keywords || '';
  quill.root.innerHTML = a.content;
  updateStats();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};
window.togglePublish = async (id, state) => {
  await updateDoc(doc(db, 'articles', id), { published: state, updatedAt: serverTimestamp() });
  loadTable();
};
window.deleteArticle = async id => {
  if (!confirm('Permanently delete this article?')) return;
  await deleteDoc(doc(db, 'articles', id));
  loadTable();
};

loadTable();
