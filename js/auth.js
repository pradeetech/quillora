// ============================================================
// Quillora — Auth Pages (Login / Register / Profile)
// Register form එකේ "admin" කියලා කිසිම වචනයක් නෑ —
// email එක secret list එකේ නම් විතරක් silent admin.
// ============================================================
import {
  auth, db, doc, getDoc, setDoc, updateDoc,
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, updateProfile, serverTimestamp, isAdminEmail,
  sendEmailVerification,
  GoogleAuthProvider, signInWithPopup
} from './firebase-config.js';
import { articleCard, escapeHtml, fmtDate } from './shared.js';

function showAuthError(msg) {
  const e = document.getElementById('authError');
  if (e) { e.textContent = msg; e.className = 'alert err'; }
}

// ==================== REGISTER ====================
const regForm = document.getElementById('registerForm');
if (regForm) {
  onAuthStateChanged(auth, u => { if (u) location.replace('index.html'); });
  regForm.addEventListener('submit', async e => {
    e.preventDefault();
    document.getElementById('authError').className = 'alert';
    const name  = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim().toLowerCase();
    const pass  = document.getElementById('regPass').value;
    const pass2 = document.getElementById('regPass2').value;
    if (name.length < 2)   return showAuthError('Please enter your name.');
    if (pass.length < 6)   return showAuthError('Password must be at least 6 characters.');
    if (pass !== pass2)    return showAuthError('Passwords do not match.');
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(cred.user, { displayName: name });
      await sendEmailVerification(cred.user).catch(() => {});
      const role = isAdminEmail(cred.user.email) ? 'admin' : 'user';
      await setDoc(doc(db, 'users', cred.user.uid), {
        name, email, role, bookmarks: [], createdAt: serverTimestamp()
      });
      location.href = role === 'admin' ? 'admin/dashboard.html' : 'index.html';
    } catch (ex) {
      showAuthError(
        ex.code === 'auth/email-already-in-use' ? 'This email is already registered — try logging in.' :
        ex.code === 'auth/invalid-email'        ? 'Invalid email address.' :
        ex.code === 'auth/weak-password'        ? 'Password is too weak.' :
        'Registration failed. Please try again.');
    }
  });
}

// ==================== LOGIN ====================
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    document.getElementById('authError').className = 'alert';
    const email = document.getElementById('loginEmail').value.trim();
    const pass  = document.getElementById('loginPass').value;
    try {
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      const snap = await getDoc(doc(db, 'users', cred.user.uid));
      const role = snap.exists() ? snap.data().role : 'user';
      const next = new URLSearchParams(location.search).get('next');
      const admin = role === 'admin' && isAdminEmail(cred.user.email);
      location.href = next ? next : (admin ? 'admin/dashboard.html' : 'index.html');
    } catch {
      showAuthError('❌ Invalid email or password.');
    }
  });
}

// ==================== GOOGLE SIGN-IN ====================
async function handleGoogleSignIn() {
  const err = document.getElementById('authError');
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    const email = (user.email || '').toLowerCase();
    const role = isAdminEmail(email) ? 'admin' : 'user';

    const ref = doc(db, 'users', user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        name: user.displayName || email.split('@')[0],
        email: email,
        role: role,
        bookmarks: [],
        createdAt: serverTimestamp()
      });
    }

    const next = new URLSearchParams(location.search).get('next');
    location.href = next ? next : (role === 'admin' ? 'admin/dashboard.html' : 'index.html');
  } catch (ex) {
    if (err) {
      err.textContent = ex.code === 'auth/popup-closed-by-user'
        ? 'Google popup එක close කරාවා — නැවත try කරන්න.'
        : '❌ Google sign-in failed: ' + ex.message;
      err.className = 'alert err';
    }
  }
}

document.getElementById('googleLoginBtn')?.addEventListener('click', handleGoogleSignIn);
document.getElementById('googleRegisterBtn')?.addEventListener('click', handleGoogleSignIn);

// ==================== PROFILE ====================
const profileBody = document.getElementById('profileBody');
if (profileBody) {
  onAuthStateChanged(auth, async u => {
    if (!u) return location.replace('login.html?next=profile.html');
    let data = { name: u.displayName || 'Reader', email: u.email, role: 'user', createdAt: null, bookmarks: [] };
    try {
      const snap = await getDoc(doc(db, 'users', u.uid));
      if (snap.exists()) data = { ...data, ...snap.data() };
    } catch (e) {}
    const admin = data.role === 'admin' && isAdminEmail(u.email);
    document.getElementById('profileAvatar').textContent = (data.name[0]||'U').toUpperCase();
    profileBody.innerHTML = `
      <h1>${escapeHtml(data.name)}</h1>
      <p class="muted">📧 ${escapeHtml(data.email)}</p>
      <p>
        <span class="role-badge ${admin ? 'admin' : ''}">${admin ? '⚙️ Administrator' : '📖 Reader'}</span>
        <span class="muted">· Member since ${fmtDate(data.createdAt)}</span>
      </p>
      ${!u.emailVerified ? '<div class="alert warn">✉️ Please verify your email — check your inbox.</div>' : ''}
      <div class="profile-actions">
        ${admin ? '<a href="admin/dashboard.html" class="btn primary">⚙️ Go to Dashboard</a>' : ''}
        <button class="btn outline" id="editNameBtn">✏️ Edit Name</button>
        <button class="btn outline danger" id="logoutBtn">Logout</button>
      </div>`;
    document.getElementById('logoutBtn').addEventListener('click', async () => {
      await signOut(auth); location.href = 'index.html';
    });
    document.getElementById('editNameBtn').addEventListener('click', async () => {
      const newName = prompt('Your new name:', data.name);
      if (!newName || newName.trim().length < 2) return;
      await updateDoc(doc(db,'users',u.uid), { name: newName.trim() });
      await updateProfile(u, { displayName: newName.trim() });
      location.reload();
    });
    // ❤️ Saved articles
    const wrap = document.getElementById('savedArticles');
    const ids = data.bookmarks || [];
    if (!ids.length) {
      wrap.innerHTML = '<div class="empty">No saved articles yet. Open an article and press 🤍 Save.</div>';
    } else {
      try {
        const snaps = await Promise.all(ids.map(id => getDoc(doc(db,'articles',id))));
        wrap.innerHTML = '<div class="article-grid">' +
          snaps.filter(s => s.exists()).map(s => articleCard(s.data(), s.id)).join('') + '</div>';
      } catch { wrap.innerHTML = '<div class="empty">⚠️ Could not load saved articles.</div>'; }
    }
  });
}
