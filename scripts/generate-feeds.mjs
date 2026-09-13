// ============================================================
// Quillora — Auto Sitemap & RSS Generator + IndexNow Ping
// Firestore REST API → XML files → detect NEW articles → ping
// ============================================================
import { writeFileSync, readFileSync, existsSync } from 'fs';

const API_KEY = 'AIzaSyAemWn2O-rbc5wptLMh8MpIykKex041Y5M';
const PROJECT_ID = 'articlenest-001';
const BASE_URL = 'https://pradeetech.github.io/quillora';
const INDEXNOW_KEY = '52cb915a9453406fba697c91424afaae';
const STATE_FILE = 'scripts/article-ids.json';

const CATEGORIES = [
  'Technology', 'Business', 'Finance', 'Education', 'Science',
  'Health', 'Lifestyle', 'Career', 'Travel', 'Food', 'Sports',
  'Gaming', 'Entertainment', 'Home', 'News', 'Automotive',
  'Motivation', 'Design'
];

// ---------- Firestore REST API query ----------
async function fetchArticles() {
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'articles' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'published' },
              op: 'EQUAL',
              value: { booleanValue: true }
            }
          },
          orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
          limit: 500
        }
      })
    }
  );
  const data = await res.json();
  if (!res.ok || !Array.isArray(data)) {
    throw new Error('Firestore query failed: ' + JSON.stringify(data).slice(0, 300));
  }
  return data
    .filter(d => d.document)
    .map(d => {
      const f = d.document.fields || {};
      const id = d.document.name.split('/').pop();
      return {
        id,
        title: f.title?.stringValue || 'Untitled',
        description: f.metaDescription?.stringValue || '',
        category: f.category?.stringValue || 'General',
        createdAt: f.createdAt?.timestampValue || new Date().toISOString()
      };
    });
}

// ---------- XML escaping ----------
const esc = t => String(t || '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ==================== MAIN ====================
const articles = await fetchArticles();
console.log(`Fetched ${articles.length} published articles`);

// ========== SITEMAP ==========
let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${BASE_URL}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>
  <url><loc>${BASE_URL}/contact.html</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>
  <url><loc>${BASE_URL}/privacy.html</loc><changefreq>yearly</changefreq><priority>0.3</priority></url>
`;
for (const c of CATEGORIES) {
  sitemap += `  <url><loc>${BASE_URL}/category.html?cat=${encodeURIComponent(c)}</loc><changefreq>daily</changefreq><priority>0.8</priority></url>\n`;
}
for (const a of articles) {
  sitemap += `  <url><loc>${BASE_URL}/article.html?id=${a.id}</loc><changefreq>weekly</changefreq><priority>0.9</priority></url>\n`;
}
sitemap += '</urlset>';
writeFileSync('sitemap.xml', sitemap);
console.log('sitemap.xml generated');

// ========== RSS ==========
let rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Quillora — Where Every Story Takes Flight</title>
    <link>${BASE_URL}/</link>
    <description>Insightful articles on Technology, Business, Finance, Education, Science, Health, Lifestyle and more.</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
`;
for (const a of articles.slice(0, 20)) {
  const date = new Date(a.createdAt).toUTCString();
  rss += `    <item>
      <title>${esc(a.title)}</title>
      <link>${BASE_URL}/article.html?id=${a.id}</link>
      <guid isPermaLink="true">${BASE_URL}/article.html?id=${a.id}</guid>
      <description>${esc(a.description)}</description>
      <category>${esc(a.category)}</category>
      <pubDate>${date}</pubDate>
    </item>\n`;
}
rss += `  </channel>
</rss>`;
writeFileSync('rss.xml', rss);
console.log('rss.xml generated');

// ==================== ⚡ INDEXNOW — NEW ARTICLES AUTO PING ====================
// State file එකෙන් කලින් run එකේ article IDs compare කරලා
// අලුතින් ආපු articles විතරක් ping කරනවා (spam prevention!)
let previousIds = [];
if (existsSync(STATE_FILE)) {
  try { previousIds = JSON.parse(readFileSync(STATE_FILE, 'utf8')); } catch {}
}

const currentIds = articles.map(a => a.id);
const newIds = currentIds.filter(id => !previousIds.includes(id));

if (newIds.length > 0) {
  console.log(`New articles detected: ${newIds.length} — pinging IndexNow…`);
  const urls = newIds.map(id => `${BASE_URL}/article.html?id=${id}`);
  try {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: 'pradeetech.github.io',
        key: INDEXNOW_KEY,
        keyLocation: `${BASE_URL}/${INDEXNOW_KEY}.txt`,
        urlList: urls
      })
    });
    console.log(`IndexNow response: ${res.status}`);
    if (res.ok) {
      console.log('Bing/Yahoo/DDG notified instantly');
    } else {
      console.warn(`IndexNow ping failed (${res.status}) — manual ping කරන්න පුළුවන්`);
    }
  } catch (err) {
    console.warn('IndexNow ping error:', err.message);
  }
} else {
  console.log('No new articles — IndexNow ping skipped');
}

// State file update (හැම run එකකමම — first run එකේදීත්!)
writeFileSync(STATE_FILE, JSON.stringify(currentIds, null, 2));
console.log('State file updated');
console.log('ALL DONE');
