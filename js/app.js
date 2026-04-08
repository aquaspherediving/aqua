
// ============================================================
// HELPERS  
// ============================================================
function showLoading(on) {
  var el = document.getElementById('page-loading');
  if (el) el.classList.toggle('show', on);
}

function toggleMobileSidebar() {
  var sb = document.getElementById('dash-sidebar');
  var ov = document.getElementById('sidebar-overlay');
  if (!sb) return;
  sb.classList.toggle('open');
  if (ov) ov.classList.toggle('active', sb.classList.contains('open'));
}

// ============================================================
// AUTH
// ============================================================
let currentUser = null;

function doLogin() {
  const username = sanitize(document.getElementById('login-username').value);
  const password = document.getElementById('login-password').value;
  if (!username || !password) { toast('Please fill in all fields', 'error'); return; }
  const user = DB.find('users', u => u.username === username);
  if (!user || !DB.verifyHash(password, user.password)) {
    toast('Invalid username or password', 'error');
    return;
  }
  currentUser = user;
  DB.log(user.id, user.name, 'Login', `Logged in from web`);
  closeModal('login-modal');
  openDashboard();
}

function logout() {
  DB.log(currentUser.id, currentUser.name, 'Logout', 'User logged out');
  currentUser = null;
  document.getElementById('dashboard-view').classList.remove('active');
  toast('Logged out successfully', 'info');
}

// ============================================================
// SANITIZATION (XSS prevention)
// ============================================================
function sanitize(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#x27;')
    .replace(/\//g,'&#x2F;');
}

function safe(str) { return str ? sanitize(String(str)) : ''; }

// ============================================================
// DASHBOARD
// ============================================================
const ADMIN_NAV = [
  { section: 'Overview' },
  { id: 'dashboard', icon: '🏠', label: 'Dashboard' },
  { id: 'analytics', icon: '📊', label: 'Analytics' },
  { section: 'Management' },
  { id: 'instructors', icon: '👨‍🏫', label: 'Instructors' },
  { id: 'divers', icon: '🤿', label: 'Divers' },
  { id: 'sites', icon: '📍', label: 'Dive Sites' },
  { id: 'events', icon: '📅', label: 'Events' },
  { section: 'Content' },
  { id: 'gallery-admin', icon: '🖼️', label: 'Gallery' },
  { section: 'Tools' },
  { id: 'checklist', icon: '✅', label: 'Checklists' },
  { id: 'reports', icon: '📋', label: 'Reports' },
  { id: 'logs', icon: '📝', label: 'Activity Logs' },
  { id: 'backup', icon: '💾', label: 'Backup' },
  { section: 'Account' },
  { id: 'profile', icon: '👤', label: 'My Profile' }
];

const INSTRUCTOR_NAV = [
  { section: 'Overview' },
  { id: 'dashboard', icon: '🏠', label: 'Dashboard' },
  { id: 'analytics', icon: '📊', label: 'Analytics' },
  { section: 'Management' },
  { id: 'divers', icon: '🤿', label: 'Divers' },
  { id: 'sites', icon: '📍', label: 'Dive Sites' },
  { id: 'events', icon: '📅', label: 'Events' },
  { section: 'Tools' },
  { id: 'checklist', icon: '✅', label: 'Checklists' },
  { id: 'reports', icon: '📋', label: 'Reports' },
  { section: 'Account' },
  { id: 'profile', icon: '👤', label: 'My Profile' }
];

function openDashboard() {
  document.getElementById('dashboard-view').classList.add('active');
  document.getElementById('dash-user-name').textContent = currentUser.name;
  document.getElementById('dash-user-role').textContent = currentUser.role === 'admin' ? 'Administrator' : 'Instructor';
  buildSidebar();
  // Add mobile sidebar toggle to dash header
  var dt = document.querySelector('.dash-page.active .dash-header');
  if (!document.getElementById('sidebar-toggle-btn')) {
    var toggleBtn = document.createElement('button');
    toggleBtn.id = 'sidebar-toggle-btn';
    toggleBtn.className = 'sidebar-toggle';
    toggleBtn.innerHTML = '&#9776;';
    toggleBtn.onclick = toggleMobileSidebar;
    var dashMain = document.getElementById('dash-main');
    if (dashMain) {
      dashMain.addEventListener('click', function(e) {
        // noop - handled by overlay
      });
    }
  }
  navigateTo('dashboard');
  loadProfile();
}

function buildSidebar() {
  const nav = currentUser.role === 'admin' ? ADMIN_NAV : INSTRUCTOR_NAV;
  const el = document.getElementById('sidebar-nav');
  el.innerHTML = nav.map(item => {
    if (item.section) return `<div class="sidebar-section">${item.section}</div>`;
    return `<div class="sidebar-item" id="nav-${item.id}" onclick="navigateTo('${item.id}')">
      <span class="icon">${item.icon}</span>${item.label}
    </div>`;
  }).join('');
}

function navigateTo(page) {
  document.querySelectorAll('.dash-page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
  // Auto-close sidebar on mobile nav
  var sb = document.getElementById('dash-sidebar');
  var ov = document.getElementById('sidebar-overlay');
  if (sb && window.innerWidth <= 640) {
    sb.classList.remove('open');
    if (ov) ov.classList.remove('active');
  }
  const pageEl = document.getElementById('page-' + page);
  if (pageEl) pageEl.classList.add('active');
  const navEl = document.getElementById('nav-' + page);
  if (navEl) navEl.classList.add('active');
  // Load page data
  const loaders = {
    'dashboard': loadDashboard,
    'instructors': loadInstructors,
    'divers': loadDivers,
    'sites': loadSites,
    'events': loadEvents,
    'gallery-admin': loadGalleryAdmin,
    'logs': loadLogs,
    'reports': loadReports,
    'analytics': loadAnalytics,
    'checklist': loadChecklist
  };
  if (loaders[page]) loaders[page]();
}

// ============================================================
// DASHBOARD HOME
// ============================================================
function loadDashboard() {
  const divers = DB.get('divers');
  const sites = DB.get('sites');
  const events = DB.get('events');
  const instructors = DB.get('users').filter(u => u.role === 'instructor');
  const logs = DB.get('logs');

  const h = new Date().getHours();
  const greet = h < 12 ? 'Good Morning' : h < 18 ? 'Good Afternoon' : 'Good Evening';
  document.getElementById('dash-greeting').textContent = `${greet}, ${currentUser.name}! 👋`;

  const kpis = currentUser.role === 'admin'
    ? [
        { icon:'🤿', value: divers.length, label:'Total Divers' },
        { icon:'👨‍🏫', value: instructors.length, label:'Instructors' },
        { icon:'📍', value: sites.length, label:'Dive Sites' },
        { icon:'📅', value: events.length, label:'Events' }
      ]
    : [
        { icon:'🤿', value: divers.filter(d => d.instructorId === currentUser.id).length, label:'My Divers' },
        { icon:'📅', value: events.length, label:'Events' },
        { icon:'📍', value: sites.length, label:'Dive Sites' },
        { icon:'✅', value: DB.get('checklists').length, label:'Checklists' }
      ];

  document.getElementById('kpi-grid').innerHTML = kpis.map(k => `
    <div class="kpi-card glass">
      <span class="kpi-icon">${k.icon}</span>
      <div class="kpi-value">${k.value}</div>
      <div class="kpi-label">${k.label}</div>
    </div>
  `).join('');

  // Chart
  const months = [8,12,15,10,18,22,25,20,16,14,19,11];
  document.getElementById('activity-chart').innerHTML = months.map((v,i) => 
    `<div class="chart-bar" style="height:${v/25*100}%" title="${v} dives"></div>`
  ).join('');

  // Activity feed
  document.getElementById('activity-feed').innerHTML = logs.slice(0,6).map(l => `
    <div class="activity-item">
      <div class="activity-dot"></div>
      <div>
        <div class="activity-text">${safe(l.action)} – <span style="color:var(--text-dim)">${safe(l.user)}</span></div>
        <div class="activity-time">${formatTime(l.time)}</div>
      </div>
    </div>
  `).join('');
}

// ============================================================
// INSTRUCTORS
// ============================================================
function loadInstructors() {
  const instructors = DB.get('users').filter(u => u.role === 'instructor');
  const tbody = document.getElementById('inst-tbody');
  if (!instructors.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="icon">👨‍🏫</div><p>No instructors yet</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = instructors.map(i => `
    <tr>
      <td><div style="display:flex;align-items:center;gap:10px"><div class="avatar">${safe(i.name[0])}</div>${safe(i.name)}</div></td>
      <td><code style="color:var(--cyan)">${safe(i.username)}</code></td>
      <td>${safe(i.email)}</td>
      <td>${i.certifications ? `<span class="badge badge-cyan">${safe(i.certifications)}</span>` : '–'}</td>
      <td><span class="badge badge-success">Active</span></td>
      <td>
        <button class="btn btn-glass btn-sm" onclick="deleteUser(${i.id})">🗑</button>
      </td>
    </tr>
  `).join('');
}

function deleteUser(id) {
  if (!confirm('Delete this user?')) return;
  DB.delete('users', id);
  DB.log(currentUser.id, currentUser.name, 'Delete User', `Deleted user ID ${id}`);
  toast('User deleted', 'success');
  loadInstructors();
}

// ============================================================
// DIVERS
// ============================================================
function loadDivers() {
  let divers = DB.get('divers');
  if (currentUser.role === 'instructor') divers = divers.filter(d => d.instructorId === currentUser.id);
  const users = DB.get('users');
  const tbody = document.getElementById('divers-tbody');
  if (!divers.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="icon">🤿</div><p>No divers yet</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = divers.map(d => {
    const inst = users.find(u => u.id === d.instructorId);
    return `
      <tr>
        <td><div style="display:flex;align-items:center;gap:10px"><div class="avatar">${safe(d.name[0])}</div>${safe(d.name)}</div></td>
        <td>${safe(d.email)}</td>
        <td><span class="badge badge-cyan">${safe(d.level)}</span></td>
        <td>${safe(d.certifications || '–')}</td>
        <td><span style="font-family:Space Mono">${d.totalDives || 0}</span></td>
        <td>${inst ? safe(inst.name) : '–'}</td>
        <td style="display:flex;gap:6px">
          <button class="btn btn-glass btn-sm" onclick="generateDiverReport(${d.id})">📋</button>
          <button class="btn btn-glass btn-sm" onclick="deleteDiver(${d.id})">🗑</button>
        </td>
      </tr>
    `;
  }).join('');
}

function deleteDiver(id) {
  if (!confirm('Delete this diver?')) return;
  DB.delete('divers', id);
  DB.log(currentUser.id, currentUser.name, 'Delete Diver', `Deleted diver ID ${id}`);
  toast('Diver deleted', 'success');
  loadDivers();
}

// ============================================================
// SITES
// ============================================================
function loadSites() {
  const sites = DB.get('sites');
  const grid = document.getElementById('sites-grid');
  if (!sites.length) {
    grid.innerHTML = `<div class="empty-state"><div class="icon">📍</div><p>No dive sites added yet</p></div>`;
    return;
  }
  grid.innerHTML = sites.map(s => `
    <div class="glass" style="padding:24px;border-radius:var(--radius);">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">
        <span style="font-size:32px">📍</span>
        <span class="badge ${s.difficulty === 'Beginner' ? 'badge-success' : s.difficulty === 'Advanced' ? 'badge-danger' : 'badge-warning'}">${safe(s.difficulty)}</span>
      </div>
      <h3 style="font-size:18px;margin-bottom:8px">${safe(s.name)}</h3>
      <p style="color:var(--text-dim);font-size:13px;margin-bottom:16px">${safe(s.description)}</p>
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        <div style="font-size:12px;color:var(--text-dim)">📏 Depth: <span style="color:var(--cyan)">${safe(s.depth)}</span></div>
        <div style="font-size:12px;color:var(--text-dim)">👁 Vis: <span style="color:var(--cyan)">${safe(s.visibility)}</span></div>
      </div>
      ${currentUser.role === 'admin' ? `<button class="btn btn-danger btn-sm" style="margin-top:16px" onclick="deleteSite(${s.id})">Delete</button>` : ''}
    </div>
  `).join('');
}

function deleteSite(id) {
  if (!confirm('Delete this site?')) return;
  DB.delete('sites', id);
  toast('Site deleted', 'success');
  loadSites();
}

// ============================================================
// EVENTS
// ============================================================
function loadEvents() {
  const events = DB.get('events');
  const grid = document.getElementById('events-grid');
  if (!events.length) {
    grid.innerHTML = `<div class="empty-state"><div class="icon">📅</div><p>No events yet</p></div>`;
    return;
  }
  grid.innerHTML = events.map(e => `
    <div class="glass" style="padding:24px;border-radius:var(--radius);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <span class="badge badge-cyan">${safe(e.date)}</span>
        <span style="color:var(--teal);font-size:13px">${safe(e.time)}</span>
      </div>
      <h3 style="font-size:18px;margin-bottom:8px">${safe(e.title)}</h3>
      <p style="color:var(--text-dim);font-size:13px;margin-bottom:16px">${safe(e.description)}</p>
      <div style="font-size:13px;color:var(--text-dim)">📍 ${safe(e.site)}</div>
      <div style="margin-top:12px">
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px">
          <span>Registrations</span>
          <span style="color:var(--cyan)">${e.registrations || 0}/${e.maxParticipants}</span>
        </div>
        <div class="progress">
          <div class="progress-bar" style="width:${((e.registrations||0)/e.maxParticipants)*100}%"></div>
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-top:16px">
        <button class="btn btn-glass btn-sm" onclick="registerEvent(${e.id})">Register</button>
        ${currentUser.role === 'admin' ? `<button class="btn btn-danger btn-sm" onclick="deleteEvent(${e.id})">Delete</button>` : ''}
      </div>
    </div>
  `).join('');
}

function registerEvent(id) {
  const ev = DB.find('events', e => e.id === id);
  if (!ev) return;
  if ((ev.registrations || 0) >= ev.maxParticipants) { toast('Event is full!', 'error'); return; }
  DB.update('events', id, { registrations: (ev.registrations || 0) + 1 });
  DB.log(currentUser.id, currentUser.name, 'Event Registration', `Registered for: ${ev.title}`);
  toast('Registered for event!', 'success');
  loadEvents();
}

function deleteEvent(id) {
  if (!confirm('Delete this event?')) return;
  DB.delete('events', id);
  toast('Event deleted', 'success');
  loadEvents();
}

// ============================================================
// GALLERY
// ============================================================
function loadPublicGallery() {
  const photos = DB.get('gallery');
  const grid = document.getElementById('gallery-grid');
  const empty = document.getElementById('gallery-empty');
  if (!photos.length) {
    grid.style.display = 'none';
    empty.style.display = 'block';
    return;
  }
  grid.style.display = 'grid';
  empty.style.display = 'none';
  grid.innerHTML = photos.map((p,i) => `
    <div class="gallery-item" onclick="openLightbox(${i})">
      <img src="${p.src}" alt="Gallery photo">
      <div class="gallery-overlay">
        <div class="gallery-desc">${safe(p.description)}</div>
      </div>
    </div>
  `).join('');
}

function loadGalleryAdmin() {
  const photos = DB.get('gallery');
  const grid = document.getElementById('gallery-admin-grid');
  if (!photos.length) {
    grid.innerHTML = `<div class="empty-state"><div class="icon">🖼️</div><p>No photos uploaded yet</p></div>`;
    return;
  }
  grid.innerHTML = photos.map((p,i) => `
    <div class="gallery-item">
      <img src="${p.src}" alt="">
      <div class="gallery-overlay" style="opacity:1;align-items:flex-end">
        <div style="width:100%;display:flex;justify-content:space-between;align-items:center">
          <div class="gallery-desc">${safe(p.description)}</div>
          <button class="btn btn-danger btn-sm" onclick="deletePhoto(${p.id},event)">✕</button>
        </div>
      </div>
    </div>
  `).join('');
}

function deletePhoto(id, e) {
  e.stopPropagation();
  if (!confirm('Delete this photo?')) return;
  DB.delete('gallery', id);
  DB.log(currentUser.id, currentUser.name, 'Delete Photo', `Deleted gallery photo`);
  toast('Photo deleted', 'success');
  loadGalleryAdmin();
  loadPublicGallery();
}

let galleryFileData = null;

function previewGalleryFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { toast('File too large (max 5MB)', 'error'); return; }
  const reader = new FileReader();
  reader.onload = ev => {
    galleryFileData = ev.target.result;
    document.getElementById('gallery-preview-img').src = galleryFileData;
    document.getElementById('gallery-preview').style.display = 'block';
    document.getElementById('upload-area').style.display = 'none';
  };
  reader.readAsDataURL(file);
}

function uploadGalleryPhoto() {
  if (!galleryFileData) { toast('Please select a photo', 'error'); return; }
  const desc = sanitize(document.getElementById('gallery-desc-input').value.trim());
  DB.add('gallery', { src: galleryFileData, description: desc, uploadedBy: currentUser.name });
  DB.log(currentUser.id, currentUser.name, 'Upload Photo', `Added photo to gallery`);
  galleryFileData = null;
  document.getElementById('gallery-preview').style.display = 'none';
  document.getElementById('upload-area').style.display = 'block';
  document.getElementById('gallery-desc-input').value = '';
  document.getElementById('gallery-file').value = '';
  closeModal('gallery-modal');
  toast('Photo published to gallery!', 'success');
  loadGalleryAdmin();
  loadPublicGallery();
}

function openGalleryUpload() {
  galleryFileData = null;
  document.getElementById('gallery-preview').style.display = 'none';
  document.getElementById('upload-area').style.display = 'block';
  document.getElementById('gallery-desc-input').value = '';
  openModal('gallery-modal');
}

function openLightbox(index) {
  const photos = DB.get('gallery');
  if (!photos[index]) return;
  document.getElementById('lightbox-img').src = photos[index].src;
  document.getElementById('lightbox-desc').textContent = photos[index].description;
  document.getElementById('lightbox').classList.add('active');
}

function closeLightbox(e) {
  if (e.target.id === 'lightbox') closeLightboxBtn();
}

function closeLightboxBtn() {
  document.getElementById('lightbox').classList.remove('active');
}

// ============================================================
// LOGS
// ============================================================
function loadLogs() {
  const logs = DB.get('logs');
  const tbody = document.getElementById('logs-tbody');
  tbody.innerHTML = logs.map(l => `
    <tr>
      <td style="font-size:12px;font-family:Space Mono">${formatTime(l.time)}</td>
      <td>${safe(l.user)}</td>
      <td><span class="badge badge-cyan">${safe(l.action)}</span></td>
      <td style="color:var(--text-dim);font-size:13px">${safe(l.details)}</td>
    </tr>
  `).join('');
}

function clearLogs() {
  if (!confirm('Clear all logs?')) return;
  // Delete all log docs in Firestore and clear cache
  var logs = DB.get('logs');
  logs.forEach(function(l) { try { db.collection('logs').doc(String(l._fid||l.id)).delete(); } catch(e){} });
  // Clear local cache
  var cacheStr = localStorage.getItem('aq_cache');
  if (cacheStr) {
    try { var c = JSON.parse(cacheStr); c.logs = []; localStorage.setItem('aq_cache', JSON.stringify(c)); } catch(e){}
  }
  // Re-init logs in DB cache
  DB.get('logs').splice(0);
  DB.log(currentUser.id, currentUser.name, 'Clear Logs', 'Activity logs cleared');
  loadLogs();
  toast('Logs cleared', 'success');
}

// ============================================================
// ANALYTICS
// ============================================================
function loadAnalytics() {
  const divers = DB.get('divers');
  const sites = DB.get('sites');
  const events = DB.get('events');
  const totalDives = divers.reduce((a, d) => a + (d.totalDives || 0), 0);

  document.getElementById('analytics-kpi').innerHTML = [
    { icon:'🎯', value: totalDives, label:'Total Dives Logged' },
    { icon:'📈', value: Math.round(totalDives / Math.max(divers.length, 1)), label:'Avg Dives per Diver' },
    { icon:'🏆', value: divers.filter(d => d.level === 'Advanced OW').length, label:'Advanced Divers' },
    { icon:'🌊', value: sites.length, label:'Active Sites' }
  ].map(k => `
    <div class="kpi-card glass">
      <span class="kpi-icon">${k.icon}</span>
      <div class="kpi-value">${k.value}</div>
      <div class="kpi-label">${k.label}</div>
    </div>
  `).join('');

  const months = [5,8,12,15,10,18,22,20,16,14,19,11];
  document.getElementById('analytics-chart-1').innerHTML = months.map((v,i) => 
    `<div class="chart-bar" style="height:${v/25*100}%" title="${v} dives"></div>`
  ).join('');

  const levels = {};
  divers.forEach(d => { levels[d.level] = (levels[d.level] || 0) + 1; });
  document.getElementById('course-dist').innerHTML = Object.entries(levels).map(([k,v]) => `
    <div style="margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px">
        <span>${safe(k)}</span><span style="color:var(--cyan)">${v}</span>
      </div>
      <div class="progress"><div class="progress-bar" style="width:${v/divers.length*100}%"></div></div>
    </div>
  `).join('') || '<p style="color:var(--text-dim);font-size:13px">No divers data yet</p>';
}

// ============================================================
// CHECKLIST
// ============================================================
function loadChecklist() {
  buildOWChecklist();
  buildPoolChecklist();
}

function switchChecklist(type, btn) {
  document.querySelectorAll('.tabs .tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('checklist-ow').style.display = type === 'ow' ? 'block' : 'none';
  document.getElementById('checklist-pool').style.display = type === 'pool' ? 'block' : 'none';
}

function buildOWChecklist() {
  const divers = DB.get('divers');
  const sites = DB.get('sites');
  const users = DB.get('users').filter(u => u.role === 'instructor' || u.role === 'admin');
  
  document.getElementById('checklist-ow').innerHTML = `
    <h2 style="font-family:Playfair Display,serif;margin-bottom:4px">Pre-Dive Checklist</h2>
    <p style="color:var(--cyan);font-size:13px;margin-bottom:28px">Open Water Session — Must be completed before every dive</p>
    <div class="form-row">
      <div class="form-group">
        <label>Diver Name</label>
        <select id="ow-diver">
          <option value="">Select diver...</option>
          ${divers.map(d => `<option value="${d.id}">${safe(d.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Instructor / Dive Leader</label>
        <select id="ow-instructor">
          <option value="">Select instructor...</option>
          ${users.map(u => `<option value="${u.id}">${safe(u.name)}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Date</label><input type="date" id="ow-date" value="${new Date().toISOString().split('T')[0]}"></div>
      <div class="form-group"><label>Time</label><input type="time" id="ow-time" value="${new Date().toTimeString().slice(0,5)}"></div>
    </div>
    <div class="form-group">
      <label>Dive Site</label>
      <select id="ow-site">
        <option value="">Select site...</option>
        ${sites.map(s => `<option value="${s.name}">${safe(s.name)}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>Planned Dive</label>
      <select id="ow-plan">
        <option>OW Training</option><option>AOW</option><option>Fun Dive</option><option>Skills</option><option>Refresh</option>
      </select>
    </div>
    <div class="divider"></div>
    <div class="checklist-section">
      <div class="checklist-section-title">A. Health & Fit-To-Dive Check</div>
      <div class="checkbox-group">
        ${['Diver reports feeling well (no cold, congestion, fatigue)','No alcohol/drugs in last 12 hours','No recent injuries / medical concerns','Medical form completed and reviewed','Diver hydrated before entry'].map((l,i) => `
          <label class="checkbox-item"><input type="checkbox" id="ow-a${i}"><label for="ow-a${i}">${l}</label></label>
        `).join('')}
      </div>
    </div>
    <div class="checklist-section">
      <div class="checklist-section-title">B. Equipment Check – Open Water</div>
      <p style="font-size:12px;color:var(--cyan);margin-bottom:10px;font-weight:600">Personal Gear</p>
      <div class="checkbox-group">
        ${['Wetsuit/Drysuit appropriate for temperature','Gloves / hood (if needed)','Mask, snorkel, fins inspected','Weights secure and checked'].map((l,i) => `
          <label class="checkbox-item"><input type="checkbox" id="ow-b${i}"><label for="ow-b${i}">${l}</label></label>
        `).join('')}
      </div>
      <p style="font-size:12px;color:var(--cyan);margin:16px 0 10px;font-weight:600">SCUBA Gear</p>
      <div class="checkbox-group">
        ${['Cylinder valve + O-ring checked','Regulator functioning (primary + alternate)','BCD inflates/deflates','LPI working','Computer functioning','Leak test completed'].map((l,i) => `
          <label class="checkbox-item"><input type="checkbox" id="ow-b2${i}"><label for="ow-b2${i}">${l}</label></label>
        `).join('')}
      </div>
      <p style="font-size:12px;color:var(--cyan);margin:16px 0 10px;font-weight:600">Cylinder Pressure (Mandatory)</p>
      <div class="form-row">
        <div class="form-group"><label>Starting Pressure (bar)</label><input type="number" id="ow-press-start" placeholder="e.g. 200"></div>
        <div class="form-group"><label>Ending Pressure (bar)</label><input type="number" id="ow-press-end" placeholder="e.g. 50"></div>
      </div>
    </div>
    <div class="checklist-section">
      <div class="checklist-section-title">C. Site & Environment Check</div>
      <div class="checkbox-group">
        ${['Weather acceptable','Entry/Exit points briefed','Marine life hazards explained','Surface support in place','Emergency O2 ready'].map((l,i) => `
          <label class="checkbox-item"><input type="checkbox" id="ow-c${i}"><label for="ow-c${i}">${l}</label></label>
        `).join('')}
      </div>
      <div class="form-row" style="margin-top:16px">
        <div class="form-group"><label>Current</label><select id="ow-current"><option>None</option><option>Mild</option><option>Strong</option></select></div>
        <div class="form-group"><label>Visibility (m)</label><input type="number" id="ow-vis" placeholder="e.g. 20"></div>
      </div>
    </div>
    <div class="checklist-section">
      <div class="checklist-section-title">D. Dive Plan Confirmation</div>
      <div class="form-row">
        <div class="form-group"><label>Max Depth (m)</label><input type="number" id="ow-depth" placeholder="e.g. 18"></div>
        <div class="form-group"><label>Expected Bottom Time (min)</label><input type="number" id="ow-bt" placeholder="e.g. 45"></div>
      </div>
      <div class="form-group"><label>Skills Planned</label><input type="text" id="ow-skills" placeholder="e.g. Navigation, Buoyancy"></div>
      <div class="checkbox-group">
        ${['Signals reviewed','Lost buddy procedure','Neutral buoyancy before descent','SMB / surfacing procedure'].map((l,i) => `
          <label class="checkbox-item"><input type="checkbox" id="ow-d${i}"><label for="ow-d${i}">${l}</label></label>
        `).join('')}
      </div>
    </div>
    <div class="checklist-section">
      <div class="checklist-section-title">E. Final BWRAF Check</div>
      <div class="checkbox-group">
        ${['B – BCD','W – Weights','R – Releases','A – Air','F – Final OK'].map((l,i) => `
          <label class="checkbox-item"><input type="checkbox" id="ow-e${i}"><label for="ow-e${i}">${l}</label></label>
        `).join('')}
      </div>
    </div>
    <div class="divider"></div>
    <div class="form-row">
      <div class="form-group"><label>Diver Signature</label><input type="text" id="ow-sig-diver" placeholder="Type full name as signature"></div>
      <div class="form-group"><label>Instructor Signature</label><input type="text" id="ow-sig-inst" placeholder="Type full name as signature"></div>
    </div>
    <div style="display:flex;gap:12px;margin-top:8px">
      <button class="btn btn-primary" onclick="saveChecklist('ow')">💾 Save Checklist</button>
      <button class="btn btn-glass" onclick="generateChecklistPDF('ow')">📄 Generate PDF Report</button>
    </div>
  `;
}

function buildPoolChecklist() {
  const divers = DB.get('divers');
  const users = DB.get('users').filter(u => u.role === 'instructor' || u.role === 'admin');
  
  document.getElementById('checklist-pool').innerHTML = `
    <h2 style="font-family:Playfair Display,serif;margin-bottom:4px">Pre-Dive Checklist</h2>
    <p style="color:var(--cyan);font-size:13px;margin-bottom:28px">Pool / Confined Water Session — Must be completed before every session</p>
    <div class="form-row">
      <div class="form-group">
        <label>Student Name</label>
        <select id="pool-student">
          <option value="">Select student...</option>
          ${divers.map(d => `<option value="${d.id}">${safe(d.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Instructor</label>
        <select id="pool-instructor">
          <option value="">Select instructor...</option>
          ${users.map(u => `<option value="${u.id}">${safe(u.name)}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Date</label><input type="date" id="pool-date" value="${new Date().toISOString().split('T')[0]}"></div>
      <div class="form-group"><label>Pool</label><input type="text" id="pool-name" placeholder="Pool name/location"></div>
    </div>
    <div class="form-group">
      <label>Session Type</label>
      <select id="pool-type">
        <option>Try Scuba</option><option>Pool Training</option><option>Skills</option><option>Refresh</option>
      </select>
    </div>
    <div class="divider"></div>
    <div class="checklist-section">
      <div class="checklist-section-title">A. Health Check</div>
      <div class="checkbox-group">
        ${['Student feels well and fit','No breathing issues / blocked nose','No open wounds','No recent injuries','Medical form completed'].map((l,i) => `
          <label class="checkbox-item"><input type="checkbox" id="pool-a${i}"><label for="pool-a${i}">${l}</label></label>
        `).join('')}
      </div>
    </div>
    <div class="checklist-section">
      <div class="checklist-section-title">B. Equipment Check – Pool</div>
      <p style="font-size:12px;color:var(--cyan);margin-bottom:10px;font-weight:600">Personal Gear</p>
      <div class="checkbox-group">
        ${['Mask fits and clear','Fins correct size','Boots (if required)'].map((l,i) => `
          <label class="checkbox-item"><input type="checkbox" id="pool-b${i}"><label for="pool-b${i}">${l}</label></label>
        `).join('')}
      </div>
      <p style="font-size:12px;color:var(--cyan);margin:16px 0 10px;font-weight:600">SCUBA Gear</p>
      <div class="checkbox-group">
        ${['Tank valve OK','Regulator functioning (primary + alternate)','BCD inflates/deflates','LPI working properly','Weight system (if needed)','Leak test completed'].map((l,i) => `
          <label class="checkbox-item"><input type="checkbox" id="pool-b2${i}"><label for="pool-b2${i}">${l}</label></label>
        `).join('')}
      </div>
      <div class="form-row" style="margin-top:16px">
        <div class="form-group"><label>Starting Pressure (bar)</label><input type="number" id="pool-press-start" placeholder="e.g. 200"></div>
        <div class="form-group"><label>Ending Pressure (bar)</label><input type="number" id="pool-press-end" placeholder="e.g. 50"></div>
      </div>
    </div>
    <div class="checklist-section">
      <div class="checklist-section-title">C. Pool Safety Check</div>
      <div class="checkbox-group">
        ${['Pool depth confirmed','Slippery surfaces briefed','Emergency exit shown','First Aid kit available','Emergency O2 available'].map((l,i) => `
          <label class="checkbox-item"><input type="checkbox" id="pool-c${i}"><label for="pool-c${i}">${l}</label></label>
        `).join('')}
      </div>
    </div>
    <div class="checklist-section">
      <div class="checklist-section-title">D. Session Plan</div>
      <div class="checkbox-group">
        ${['Equipment handling','Breathing underwater','Buoyancy basics','Regulator recovery/clear','Mask skills','Signals / safety procedures'].map((l,i) => `
          <label class="checkbox-item"><input type="checkbox" id="pool-d${i}"><label for="pool-d${i}">${l}</label></label>
        `).join('')}
      </div>
    </div>
    <div class="checklist-section">
      <div class="checklist-section-title">E. Final Check</div>
      <div class="checkbox-group">
        ${['BWRAF completed','Student comfortable to begin','Instructor confirms equipment fit'].map((l,i) => `
          <label class="checkbox-item"><input type="checkbox" id="pool-e${i}"><label for="pool-e${i}">${l}</label></label>
        `).join('')}
      </div>
    </div>
    <div class="divider"></div>
    <div class="form-row">
      <div class="form-group"><label>Student Signature</label><input type="text" id="pool-sig-student" placeholder="Type full name as signature"></div>
      <div class="form-group"><label>Instructor Signature</label><input type="text" id="pool-sig-inst" placeholder="Type full name as signature"></div>
    </div>
    <div style="display:flex;gap:12px;margin-top:8px">
      <button class="btn btn-primary" onclick="saveChecklist('pool')">💾 Save Checklist</button>
      <button class="btn btn-glass" onclick="generateChecklistPDF('pool')">📄 Generate PDF Report</button>
    </div>
  `;
}

function saveChecklist(type) {
  const divers = DB.get('divers');
  const users = DB.get('users');
  const isOW = type === 'ow';
  const prefix = isOW ? 'ow' : 'pool';
  const diverId = document.getElementById(`${prefix}-${isOW ? 'diver' : 'student'}`).value;
  const diver = divers.find(d => d.id == diverId);
  const instId = document.getElementById(`${prefix}-instructor`).value;
  const inst = users.find(u => u.id == instId);
  DB.add('checklists', {
    type, diverName: diver ? diver.name : 'Unknown',
    instructorName: inst ? inst.name : 'Unknown',
    date: document.getElementById(`${prefix}-date`).value,
    submittedBy: currentUser.id
  });
  DB.log(currentUser.id, currentUser.name, 'Save Checklist', `${isOW ? 'Open Water' : 'Pool'} checklist saved`);
  toast('Checklist saved!', 'success');
}

// ============================================================
// REPORTS
// ============================================================
function loadReports() {
  const reports = [
    { title:'Diver Report', desc:'Full report for a specific diver including certifications and dive history', icon:'🤿', fn:'generateDiversSummaryReport' },
    { title:'Dive Site Report', desc:'List of all registered dive sites with details', icon:'📍', fn:'generateSitesReport' },
    { title:'Events Report', desc:'Upcoming and past events with registration data', icon:'📅', fn:'generateEventsReport' },
    { title:'Activity Log Report', desc:'System activity audit trail', icon:'📝', fn:'generateLogsReport' },
    { title:'Instructor Summary', desc:'Overview of all instructors and their divers', icon:'👨‍🏫', fn:'generateInstructorsReport' },
    { title:'Checklist Archive', desc:'All saved pre-dive checklists', icon:'✅', fn:'generateChecklistsReport' }
  ];

  document.getElementById('reports-grid').innerHTML = reports
    .filter(r => currentUser.role === 'admin' || !['generateInstructorsReport','generateLogsReport'].includes(r.fn))
    .map(r => `
      <div class="glass glass-hover" style="padding:28px;border-radius:var(--radius);cursor:pointer" onclick="${r.fn}()">
        <div style="font-size:36px;margin-bottom:16px">${r.icon}</div>
        <h3 style="font-size:16px;margin-bottom:8px">${r.title}</h3>
        <p style="color:var(--text-dim);font-size:13px;margin-bottom:20px">${r.desc}</p>
        <button class="btn btn-glass btn-sm">📄 Generate PDF</button>
      </div>
    `).join('');
}


function generateDiverReport(id) {
  const diver = DB.find('divers', d => d.id === id);
  if (!diver) return;
  const inst = DB.find('users', u => u.id === diver.instructorId);
  makePDF('Diver_Report', [
    { type:'section', text:'DIVER PROFILE REPORT' },
    { type:'spacer' },
    { type:'row', label:'Full Name', value: diver.name },
    { type:'row', label:'Email', value: diver.email },
    { type:'row', label:'Phone', value: diver.phone },
    { type:'row', label:'Date of Birth', value: diver.dob },
    { type:'row', label:'Dive Level', value: diver.level },
    { type:'row', label:'Certifications', value: diver.certifications || 'None' },
    { type:'row', label:'Total Dives', value: diver.totalDives || 0 },
    { type:'row', label:'Instructor', value: inst ? inst.name : 'Unassigned' },
    { type:'row', label:'Medical Form', value: diver.medicalForm ? 'Completed' : 'Pending' },
    { type:'row', label:'Enrolled', value: new Date(diver.createdAt).toLocaleDateString() },
    { type:'divider' },
    { type:'text', text:'This report was automatically generated by the AquaSphere Diving Center management system. All data is encrypted and stored securely.', bold: false }
  ]);
}

function generateDiversSummaryReport() {
  const divers = DB.get('divers');
  const content = [
    { type:'section', text:'DIVERS SUMMARY REPORT' },
    { type:'spacer' },
    { type:'row', label:'Total Divers', value: divers.length },
    { type:'row', label:'Generated By', value: currentUser.name },
    { type:'row', label:'Date', value: new Date().toLocaleDateString() },
    { type:'divider' }
  ];
  divers.forEach((d, i) => {
    content.push({ type:'text', text: `${i+1}. ${d.name} — ${d.level} — ${d.totalDives || 0} dives`, bold: true });
  });
  makePDF('Divers_Summary', content);
}

function generateSitesReport() {
  const sites = DB.get('sites');
  const content = [
    { type:'section', text:'DIVE SITES REPORT' },
    { type:'spacer' },
    { type:'row', label:'Total Sites', value: sites.length },
    { type:'divider' }
  ];
  sites.forEach(s => {
    content.push(
      { type:'text', text: s.name, bold: true },
      { type:'row', label:'Depth', value: s.depth },
      { type:'row', label:'Visibility', value: s.visibility },
      { type:'row', label:'Difficulty', value: s.difficulty },
      { type:'spacer', h:4 }
    );
  });
  makePDF('Dive_Sites_Report', content);
}

function generateEventsReport() {
  const events = DB.get('events');
  const content = [{ type:'section', text:'EVENTS REPORT' }, { type:'spacer' }];
  events.forEach(e => {
    content.push(
      { type:'text', text: e.title, bold: true },
      { type:'row', label:'Date', value: e.date },
      { type:'row', label:'Site', value: e.site },
      { type:'row', label:'Registrations', value: `${e.registrations||0}/${e.maxParticipants}` },
      { type:'spacer', h:4 }
    );
  });
  makePDF('Events_Report', content);
}

function generateLogsReport() {
  const logs = DB.get('logs').slice(0,50);
  const content = [{ type:'section', text:'ACTIVITY LOG REPORT' }, { type:'spacer' }];
  logs.forEach(l => {
    content.push({ type:'text', text: `[${new Date(l.time).toLocaleString()}] ${l.user}: ${l.action} — ${l.details}` });
  });
  makePDF('Activity_Logs', content);
}

function generateInstructorsReport() {
  const instructors = DB.get('users').filter(u => u.role === 'instructor');
  const divers = DB.get('divers');
  const content = [{ type:'section', text:'INSTRUCTORS REPORT' }, { type:'spacer' }];
  instructors.forEach(i => {
    const myDivers = divers.filter(d => d.instructorId === i.id);
    content.push(
      { type:'text', text: i.name, bold: true },
      { type:'row', label:'Email', value: i.email },
      { type:'row', label:'Certifications', value: i.certifications || 'N/A' },
      { type:'row', label:'Total Divers', value: myDivers.length },
      { type:'spacer', h:4 }
    );
  });
  makePDF('Instructors_Report', content);
}

function generateChecklistsReport() {
  const checklists = DB.get('checklists');
  const content = [
    { type:'section', text:'CHECKLIST ARCHIVE REPORT' },
    { type:'spacer' },
    { type:'row', label:'Total Checklists', value: checklists.length },
    { type:'divider' }
  ];
  checklists.forEach(c => {
    content.push({ type:'text', text: `${c.type.toUpperCase()} — ${c.diverName} / ${c.instructorName} — ${c.date}` });
  });
  makePDF('Checklist_Archive', content);
}

// ============================================================
// CREATE MODALS
// ============================================================
function openCreateModal(type) {
  const modal = document.getElementById('create-modal');
  const titles = { instructor:'Add Instructor', diver:'Add Diver', site:'Add Dive Site', event:'Create Event' };
  document.getElementById('create-modal-title').textContent = titles[type];
  document.getElementById('create-modal-sub').textContent = 'Fill in the details below';
  document.getElementById('create-modal-body').innerHTML = getCreateForm(type);
  openModal('create-modal');
}

function getCreateForm(type) {
  const users = DB.get('users').filter(u => u.role === 'instructor' || u.role === 'admin');
  const sites = DB.get('sites');
  if (type === 'instructor') return `
    <div class="form-group"><label>Full Name</label><input type="text" id="ci-name" placeholder="Jane Instructor"></div>
    <div class="form-row">
      <div class="form-group"><label>Username</label><input type="text" id="ci-username" placeholder="jinstructor"></div>
      <div class="form-group"><label>Password</label><input type="password" id="ci-password" placeholder="Min 8 chars"></div>
    </div>
    <div class="form-group"><label>Email</label><input type="email" id="ci-email" placeholder="jane@aquasphere.com"></div>
    <div class="form-group"><label>Phone</label><input type="tel" id="ci-phone" placeholder="+1 234 567 8900"></div>
    <div class="form-group"><label>Certifications</label><input type="text" id="ci-certs" placeholder="PADI OWSI, EFR"></div>
    <button class="btn btn-primary" style="width:100%;margin-top:8px" onclick="createInstructor()">Create Instructor</button>
  `;
  if (type === 'diver') return `
    <div class="form-row">
      <div class="form-group"><label>Full Name</label><input type="text" id="cd-name" placeholder="John Diver"></div>
      <div class="form-group"><label>Date of Birth</label><input type="date" id="cd-dob"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Email</label><input type="email" id="cd-email" placeholder="john@email.com"></div>
      <div class="form-group"><label>Phone</label><input type="tel" id="cd-phone" placeholder="+1 555 0100"></div>
    </div>
    <div class="form-group"><label>Emergency Contact</label><input type="text" id="cd-emergency" placeholder="Name & Phone"></div>
    <div class="form-row">
      <div class="form-group"><label>Dive Level</label>
        <select id="cd-level">
          <option>Open Water</option><option>Advanced OW</option><option>Rescue Diver</option><option>Divemaster</option><option>Beginner</option>
        </select>
      </div>
      <div class="form-group"><label>Total Dives</label><input type="number" id="cd-dives" placeholder="0" min="0"></div>
    </div>
    <div class="form-group"><label>Certifications</label><input type="text" id="cd-certs" placeholder="e.g. PADI OW, AOW"></div>
    <div class="form-group"><label>Assign Instructor</label>
      <select id="cd-instructor">
        <option value="">Select instructor...</option>
        ${users.map(u => `<option value="${u.id}">${safe(u.name)}</option>`).join('')}
      </select>
    </div>
    <label class="checkbox-item" style="margin-bottom:16px"><input type="checkbox" id="cd-medical"><label for="cd-medical">Medical form completed and on file</label></label>
    <div class="form-group"><label>Notes / Medical Conditions</label><textarea id="cd-notes" placeholder="Any relevant health information..."></textarea></div>
    <button class="btn btn-primary" style="width:100%;margin-top:8px" onclick="createDiver()">Add Diver</button>
  `;
  if (type === 'site') return `
    <div class="form-group"><label>Site Name</label><input type="text" id="cs-name" placeholder="Blue Lagoon"></div>
    <div class="form-row">
      <div class="form-group"><label>Max Depth</label><input type="text" id="cs-depth" placeholder="e.g. 18m"></div>
      <div class="form-group"><label>Visibility</label><input type="text" id="cs-vis" placeholder="e.g. 25m"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Type</label><select id="cs-type"><option>Open Water</option><option>Pool</option><option>Shore Dive</option><option>Boat Dive</option></select></div>
      <div class="form-group"><label>Difficulty</label><select id="cs-diff"><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select></div>
    </div>
    <div class="form-group"><label>Description</label><textarea id="cs-desc" placeholder="Describe the dive site..."></textarea></div>
    <button class="btn btn-primary" style="width:100%;margin-top:8px" onclick="createSite()">Add Site</button>
  `;
  if (type === 'event') return `
    <div class="form-group"><label>Event Title</label><input type="text" id="ce-title" placeholder="Night Dive Adventure"></div>
    <div class="form-row">
      <div class="form-group"><label>Date</label><input type="date" id="ce-date"></div>
      <div class="form-group"><label>Time</label><input type="time" id="ce-time"></div>
    </div>
    <div class="form-group"><label>Dive Site</label>
      <select id="ce-site">
        <option value="">Select site...</option>
        ${sites.map(s => `<option value="${s.name}">${safe(s.name)}</option>`).join('')}
        <option value="Pool">Pool</option>
      </select>
    </div>
    <div class="form-group"><label>Max Participants</label><input type="number" id="ce-max" value="8" min="1"></div>
    <div class="form-group"><label>Description</label><textarea id="ce-desc" placeholder="Describe the event..."></textarea></div>
    <button class="btn btn-primary" style="width:100%;margin-top:8px" onclick="createEvent()">Create Event</button>
  `;
}

function createInstructor() {
  const name = sanitize(document.getElementById('ci-name').value.trim());
  const username = sanitize(document.getElementById('ci-username').value.trim());
  const password = document.getElementById('ci-password').value;
  const email = sanitize(document.getElementById('ci-email').value.trim());
  if (!name || !username || !password || !email) { toast('Please fill required fields', 'error'); return; }
  if (password.length < 8) { toast('Password must be at least 8 characters', 'error'); return; }
  if (DB.find('users', u => u.username === username)) { toast('Username already taken', 'error'); return; }
  DB.add('users', {
    username, role:'instructor', name, email,
    phone: sanitize(document.getElementById('ci-phone').value),
    certifications: sanitize(document.getElementById('ci-certs').value),
    password: DB._hash(password)
  });
  DB.log(currentUser.id, currentUser.name, 'Create Instructor', `Created instructor: ${name}`);
  closeModal('create-modal');
  toast(`Instructor ${name} created!`, 'success');
  loadInstructors();
}

function createDiver() {
  const name = sanitize(document.getElementById('cd-name').value.trim());
  const email = sanitize(document.getElementById('cd-email').value.trim());
  if (!name || !email) { toast('Name and email required', 'error'); return; }
  DB.add('divers', {
    name, email,
    phone: sanitize(document.getElementById('cd-phone').value),
    dob: document.getElementById('cd-dob').value,
    emergency: sanitize(document.getElementById('cd-emergency').value),
    level: document.getElementById('cd-level').value,
    certifications: sanitize(document.getElementById('cd-certs').value),
    totalDives: parseInt(document.getElementById('cd-dives').value) || 0,
    instructorId: parseInt(document.getElementById('cd-instructor').value) || currentUser.id,
    medicalForm: document.getElementById('cd-medical').checked,
    notes: sanitize(document.getElementById('cd-notes').value)
  });
  DB.log(currentUser.id, currentUser.name, 'Add Diver', `Added diver: ${name}`);
  closeModal('create-modal');
  toast(`Diver ${name} added!`, 'success');
  loadDivers();
}

function createSite() {
  const name = sanitize(document.getElementById('cs-name').value.trim());
  if (!name) { toast('Site name required', 'error'); return; }
  DB.add('sites', {
    name,
    depth: sanitize(document.getElementById('cs-depth').value),
    visibility: sanitize(document.getElementById('cs-vis').value),
    type: document.getElementById('cs-type').value,
    difficulty: document.getElementById('cs-diff').value,
    description: sanitize(document.getElementById('cs-desc').value)
  });
  DB.log(currentUser.id, currentUser.name, 'Add Site', `Added site: ${name}`);
  closeModal('create-modal');
  toast(`Site ${name} added!`, 'success');
  loadSites();
}

function createEvent() {
  const title = sanitize(document.getElementById('ce-title').value.trim());
  const date = document.getElementById('ce-date').value;
  if (!title || !date) { toast('Title and date required', 'error'); return; }
  DB.add('events', {
    title, date,
    time: document.getElementById('ce-time').value,
    site: sanitize(document.getElementById('ce-site').value),
    maxParticipants: parseInt(document.getElementById('ce-max').value) || 8,
    registrations: 0,
    description: sanitize(document.getElementById('ce-desc').value)
  });
  DB.log(currentUser.id, currentUser.name, 'Create Event', `Created event: ${title}`);
  closeModal('create-modal');
  toast(`Event created!`, 'success');
  loadEvents();
}

// ============================================================
// PROFILE
// ============================================================
function loadProfile() {
  if (!currentUser) return;
  document.getElementById('profile-fullname').value = currentUser.name || '';
  document.getElementById('profile-email').value = currentUser.email || '';
  document.getElementById('profile-phone').value = currentUser.phone || '';
  document.getElementById('profile-bio').value = currentUser.bio || '';
  document.getElementById('profile-name-display').textContent = currentUser.name;
  document.getElementById('profile-role-display').textContent = currentUser.role === 'admin' ? 'Administrator' : 'Instructor';
  document.getElementById('profile-avatar').textContent = currentUser.name?.[0]?.toUpperCase() || 'U';
}

function saveProfile() {
  const name = sanitize(document.getElementById('profile-fullname').value.trim());
  if (!name) { toast('Name required', 'error'); return; }
  const updates = {
    name,
    email: sanitize(document.getElementById('profile-email').value),
    phone: sanitize(document.getElementById('profile-phone').value),
    bio: sanitize(document.getElementById('profile-bio').value)
  };
  DB.update('users', currentUser.id, updates);
  Object.assign(currentUser, updates);
  DB.log(currentUser.id, currentUser.name, 'Update Profile', 'Profile information updated');
  document.getElementById('dash-user-name').textContent = currentUser.name;
  loadProfile();
  toast('Profile updated!', 'success');
}

function changePassword() {
  const oldPass = document.getElementById('profile-old-pass').value;
  const newPass = document.getElementById('profile-new-pass').value;
  const confirm = document.getElementById('profile-confirm-pass').value;
  if (!DB.verifyHash(oldPass, currentUser.password)) { toast('Current password incorrect', 'error'); return; }
  if (newPass.length < 8) { toast('New password must be at least 8 chars', 'error'); return; }
  if (newPass !== confirm) { toast('Passwords do not match', 'error'); return; }
  DB.update('users', currentUser.id, { password: DB._hash(newPass) });
  currentUser.password = DB._hash(newPass);
  DB.log(currentUser.id, currentUser.name, 'Change Password', 'Password changed successfully');
  document.getElementById('profile-old-pass').value = '';
  document.getElementById('profile-new-pass').value = '';
  document.getElementById('profile-confirm-pass').value = '';
  toast('Password changed!', 'success');
}

// ============================================================
// BACKUP
// ============================================================
function backupData() {
  const data = JSON.stringify(DB.exportBackup(), null, 2);
  const blob = new Blob([data], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `aquasphere_backup_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  DB.log(currentUser.id, currentUser.name, 'Backup', 'Data backup downloaded');
  toast('Backup downloaded!', 'success');
}

function restoreData(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      if (!data.users || !data.divers) { toast('Invalid backup file', 'error'); return; }
      // Restore into cache
      ['users','divers','sites','events','gallery','logs','checklists'].forEach(function(t){
        if (data[t]) { try { var c=JSON.parse(localStorage.getItem('aq_cache')||'{}'); c[t]=data[t]; localStorage.setItem('aq_cache',JSON.stringify(c)); } catch(e){} }
      });
      toast('Data restored! Refreshing...', 'success');
      setTimeout(() => location.reload(), 1500);
    } catch { toast('Could not parse backup file', 'error'); }
  };
  reader.readAsText(file);
}

// ============================================================
// UTILITIES
// ============================================================
function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }
function openLogin() { openModal('login-modal'); }

function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icons = { success:'✅', error:'❌', info:'ℹ️' };
  el.innerHTML = `<span>${icons[type]}</span><span>${sanitize(msg)}</span>`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
}

function filterTable(tableId, query) {
  const q = query.toLowerCase();
  const rows = document.querySelectorAll(`#${tableId} tbody tr`);
  rows.forEach(r => {
    r.style.display = r.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
}

function scrollToSection(id) {
  document.getElementById(id)?.scrollIntoView({ behavior:'smooth' });
  document.getElementById('nav-links').classList.remove('open');
}

function toggleMobileNav() {
  document.getElementById('nav-links').classList.toggle('open');
}

function openWhatsApp() {
  window.open('https://wa.me/YOUR_NUMBER?text=Hello%20AquaSphere%20Diving%20Center!%20I%20am%20interested%20in%20your%20courses.', '_blank');
}

function openGoogleReview() {
  window.open('https://g.page/r/YOUR_REVIEW_LINK/review', '_blank');
}

// Counter animation
function animateCounter(el, target) {
  let n = 0;
  const step = Math.ceil(target / 60);
  const timer = setInterval(() => {
    n = Math.min(n + step, target);
    el.textContent = n + (el.id === 'stat-years' ? '+' : '+');
    if (n >= target) clearInterval(timer);
  }, 30);
}

// ============================================================
// PUBLIC SERVICES DATA
// ============================================================
function loadPublicServices() {
  const services = [
    { icon:'🌊', title:'Open Water Diver', desc:'Your gateway to the underwater world. Complete PADI certification in 3-4 days including pool and open water sessions.', price:'$299' },
    { icon:'🎓', title:'Advanced Open Water', desc:'Take your skills deeper. Explore navigation, deep diving, and specialty dives with our expert instructors.', price:'$349' },
    { icon:'🚑', title:'Rescue Diver', desc:'Learn to manage dive emergencies and help others. A transformative course that makes you a more confident diver.', price:'$399' },
    { icon:'🤿', title:'Try Scuba', desc:'Experience scuba diving for the first time in a safe, fun pool session. No experience required!', price:'$89' },
    { icon:'⚓', title:'Divemaster', desc:'Take the first step into dive leadership. Become a dive professional and lead certified divers.', price:'$599' },
    { icon:'🐠', title:'Fun Dives', desc:'Already certified? Join our daily guided dives to the most spectacular sites in the area.', price:'$79' }
  ];

  document.getElementById('services-grid').innerHTML = services.map(s => `
    <div class="service-card glass glass-hover reveal">
      <div class="service-icon">${s.icon}</div>
      <div class="service-title">${s.title}</div>
      <div class="service-desc">${s.desc}</div>
      <div class="service-price">${s.price}</div>
    </div>
  `).join('');
}

// ============================================================
// THREE.JS OCEAN BACKGROUND
// ============================================================
function initThree() {
  const canvas = document.getElementById('bg-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, alpha:true, antialias:true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, innerWidth/innerHeight, 0.1, 1000);
  camera.position.z = 5;

  // Particle system (bubbles)
  const count = 800;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i*3] = (Math.random()-0.5) * 20;
    pos[i*3+1] = (Math.random()-0.5) * 20;
    pos[i*3+2] = (Math.random()-0.5) * 10 - 2;
    sizes[i] = Math.random() * 3 + 0.5;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  const mat = new THREE.PointsMaterial({
    color: 0x00d4ff,
    transparent: true,
    opacity: 0.4,
    sizeAttenuation: true,
    size: 0.05
  });

  const particles = new THREE.Points(geo, mat);
  scene.add(particles);

  // Wave mesh
  const waveGeo = new THREE.PlaneGeometry(30, 30, 60, 60);
  const waveMat = new THREE.MeshBasicMaterial({
    color: 0x004466,
    wireframe: true,
    transparent: true,
    opacity: 0.08
  });
  const wave = new THREE.Mesh(waveGeo, waveMat);
  wave.rotation.x = -Math.PI / 3;
  wave.position.y = -3;
  scene.add(wave);

  let t = 0;
  const origPos = waveGeo.attributes.position.array.slice();

  function animate() {
    requestAnimationFrame(animate);
    t += 0.008;

    // Animate wave vertices
    const pos2 = waveGeo.attributes.position.array;
    for (let i = 0; i < pos2.length; i += 3) {
      const x = origPos[i], y = origPos[i+1];
      pos2[i+2] = Math.sin(x * 0.5 + t) * 0.5 + Math.cos(y * 0.3 + t * 0.7) * 0.3;
    }
    waveGeo.attributes.position.needsUpdate = true;

    particles.rotation.y = t * 0.05;
    particles.rotation.x = Math.sin(t * 0.2) * 0.1;

    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
}

// ============================================================
// SCROLL REVEAL
// ============================================================
function initScrollReveal() {
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
}

// ============================================================
// INIT
// ============================================================

// ============================================================
// INIT  
// ============================================================
document.addEventListener('DOMContentLoaded', async function() {
  // Show loading
  showLoading(true);
  
  try {
    await DB.init();
  } catch(e) {
    console.warn('DB init error:', e);
  }
  
  initThree();
  loadPublicServices();
  loadPublicGallery();

  // Counter animation on scroll
  var statsObs = new IntersectionObserver(function(entries) {
    if (entries[0].isIntersecting) {
      animateCounter(document.getElementById('stat-divers'), DB.get('divers').length + 500);
      animateCounter(document.getElementById('stat-dives'), 2800);
      animateCounter(document.getElementById('stat-sites'), DB.get('sites').length + 10);
      animateCounter(document.getElementById('stat-years'), 15);
      statsObs.disconnect();
    }
  }, { threshold: 0.5 });
  var hero = document.getElementById('hero');
  if (hero) statsObs.observe(hero);

  setTimeout(initScrollReveal, 100);

  window.addEventListener('scroll', function() {
    var navbar = document.getElementById('navbar');
    if (navbar) navbar.style.background = scrollY > 60 ? 'rgba(2,11,24,0.95)' : 'rgba(2,11,24,0.7)';
  });

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.active').forEach(function(m){ m.classList.remove('active'); });
      var lb = document.getElementById('lightbox');
      if (lb) lb.classList.remove('active');
    }
  });

  // Mobile sidebar
  document.addEventListener('click', function(e) {
    var overlay = document.getElementById('sidebar-overlay');
    if (overlay && e.target === overlay) {
      var sb = document.getElementById('dash-sidebar');
      if (sb) sb.classList.remove('open');
      overlay.classList.remove('active');
    }
  });

  showLoading(false);
});
