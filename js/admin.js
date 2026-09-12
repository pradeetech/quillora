// ============================================================
// Quillora — Admin Dashboard (Owner Only)
// ============================================================
import {
  db, auth, collection, getDocs, getDoc, doc, addDoc, updateDoc, deleteDoc,
  query, orderBy, serverTimestamp, onAuthStateChanged, signOut,
  sendEmailVerification, isAdminEmail
} from './firebase-config.js';

// 🔐 GUARD: admin විතරක් ඇතුළු වෙන්න පුළුවන්
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

// ---------- Quill Rich Text Editor ----------
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

function slugify(t) {
  return t.toLowerCase().trim().replace(/[^\w\s-]/g,'').replace(/[\s_]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');
}
function showMsg(type, text) {
  const m = document.getElementById('msg');
  m.className = 'alert ' + (type === 'ok' ? 'ok' : 'err');
  m.textContent = text;
  setTimeout(() => m.className = 'alert', 4000);
}

// ---------- Save / Update ----------
document.getElementById('saveBtn').addEventListener('click', async () => {
  const title    = document.getElementById('artTitle').value.trim();
  const category = document.getElementById('artCategory').value;
  const cover    = document.getElementById('artCover').value.trim();
  const content  = quill.root.innerHTML;
  const metaTitle = document.getElementById('artMetaTitle').value.trim() || title;
  const metaDesc  = document.getElementById('artMetaDesc').value.trim();
  const keywords  = document.getElementById('artKeywords').value.trim();

  if (!title) return showMsg('err', '❌ Title is required.');
  if (quill.getText().trim().length < 50) return showMsg('err', '❌ Content must be at least 50 characters.');
  if (!metaDesc) return showMsg('err', '❌ SEO meta description is required (Google එකේ පේන්නේ ඒකයි!).');

  const data = {
    title, slug: slugify(title), category, coverImage: cover || null, content,
    metaTitle, metaDescription: metaDesc, keywords,
    updatedAt: serverTimestamp()
  };
  try {
    if (editingId) {
      await updateDoc(doc(db, 'articles', editingId), data);
      showMsg('ok', '✅ Article updated!');
    } else {
      data.views = 0;
      data.published = true;
      data.createdAt = serverTimestamp();
      await addDoc(collection(db, 'articles'), data);
      showMsg('ok', '🎉 Article published! (sitemap.xml එකට URL එක add කරන්න අමතක කරන්න එපා)');
    }
    resetForm();
    loadTable();
  } catch (e) { showMsg('err', '❌ ' + e.message); }
});

function resetForm() {
  editingId = null;
  document.getElementById('editorTitle').textContent = '✍️ Write New Article';
  ['artTitle','artCover','artMetaTitle','artMetaDesc','artKeywords'].forEach(id => document.getElementById(id).value = '');
  quill.setContents([]);
}

// ---------- Articles Table ----------
async function loadTable() {
  const tbody = document.getElementById('articlesTable');
  try {
    const s = await getDocs(query(collection(db, 'articles'), orderBy('createdAt', 'desc')));
    if (s.empty) { tbody.innerHTML = '<tr><td colspan="5">No articles yet — write your first one! ✨</td></tr>'; return; }
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
  document.getElementById('artMetaTitle').value = a.metaTitle || '';
  document.getElementById('artMetaDesc').value = a.metaDescription || '';
  document.getElementById('artKeywords').value = a.keywords || '';
  quill.root.innerHTML = a.content;
  window.scrollTo({ top: 0, behavior: 'smooth' });
};
window.togglePublish = async (id, state) => {
  await updateDoc(doc(db, 'articles', id), { published: state, updatedAt: serverTimestamp() });
  loadTable();
};
window.deleteArticle = async id => {
  if (!confirm('⚠️ Permanently delete this article?')) return;
  await deleteDoc(doc(db, 'articles', id));
  loadTable();
};

loadTable();

// ---------- 🌙 Dark Mode Toggle (Admin) ----------
// Same localStorage key — main site එකේ dark නම් admin එකත් dark!
(function initAdminDarkMode() {
  const btn = document.getElementById('darkToggle');
  if (!btn) return;
  const saved = localStorage.getItem('quillora-theme');
  if (saved === 'dark') {
    document.body.classList.add('dark-mode');
    btn.textContent = '☀️';
  }
  btn.addEventListener('click', () => {
    const isDark = document.body.classList.toggle('dark-mode');
    btn.textContent = isDark ? '☀️' : '🌙';
    localStorage.setItem('quillora-theme', isDark ? 'dark' : 'light');
  });
})();
