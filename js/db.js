// ============================================================
// AquaSphere — Database Layer (Firestore + local cache)
// js/db.js
// 
// Provides the EXACT same synchronous API as the original 
// localStorage DB so all app code works unchanged:
//   DB.get(table)         → returns array from cache
//   DB.find(table, fn)    → returns item from cache
//   DB.add(table, item)   → writes to cache + Firestore async
//   DB.update(table, id, updates)
//   DB.delete(table, id)
//   DB.log(userId, user, action, details)
//   DB._hash(str)         → password hash
//   DB.verifyHash(str, hash)
// ============================================================

var DB = (function() {
  // ── In-memory cache ───────────────────────────────────────
  var _cache = {
    users: [], divers: [], sites: [], events: [],
    gallery: [], logs: [], checklists: []
  };
  var _loaded = false;

  // ── Password hash (identical to original) ─────────────────
  function _hash(str) {
    var h = 0;
    str = String(str);
    for (var i = 0; i < str.length; i++) {
      h = Math.imul(31, h) + str.charCodeAt(i) | 0;
    }
    return 'aqh_' + Math.abs(h).toString(36) + '_' + str.length;
  }

  function verifyHash(str, hash) {
    return _hash(str) === hash;
  }

  // ── Generate unique id ────────────────────────────────────
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  // ── Persist cache to localStorage ────────────────────────
  function saveLocal() {
    try {
      localStorage.setItem('aq_cache', JSON.stringify(_cache));
    } catch(e) {}
  }

  // ── Load localStorage fallback ────────────────────────────
  function loadLocal() {
    try {
      var s = localStorage.getItem('aq_cache');
      if (s) { var d = JSON.parse(s); Object.assign(_cache, d); return true; }
      // Migrate from old format
      s = localStorage.getItem('aquasphere_db_v1');
      if (s) {
        var old = JSON.parse(s);
        ['users','divers','sites','events','gallery','logs','checklists'].forEach(function(t) {
          if (old[t]) _cache[t] = old[t];
        });
        return true;
      }
    } catch(e) {}
    return false;
  }

  // ── Seed defaults ─────────────────────────────────────────
  function seedDefaults() {
    _cache.users = [
      { id:'admin', _fid:'admin', username:'admin', password:_hash('admin123'), role:'admin', name:'Alex Marine', email:'admin@aquasphere.com', phone:'+1 234 567 8900', bio:'PADI Course Director with 15 years experience', createdAt:new Date().toISOString() },
      { id:'instructor', _fid:'instructor', username:'instructor', password:_hash('inst123'), role:'instructor', name:'Sarah Depths', email:'sarah@aquasphere.com', phone:'+1 234 567 8901', bio:'PADI Divemaster & Open Water Instructor', certifications:'PADI OWSI, EFR', createdAt:new Date().toISOString() }
    ];
    _cache.divers = [
      { id:'d1', _fid:'d1', name:'James Coral', email:'james@email.com', phone:'+1 555 0101', dob:'1990-05-15', level:'Open Water', certifications:'PADI OW', totalDives:24, instructorId:'instructor', medicalForm:true, createdAt:new Date().toISOString() },
      { id:'d2', _fid:'d2', name:'Emma Wave', email:'emma@email.com', phone:'+1 555 0102', dob:'1995-09-22', level:'Advanced OW', certifications:'PADI OW, AOW', totalDives:67, instructorId:'instructor', medicalForm:true, createdAt:new Date().toISOString() }
    ];
    _cache.sites = [
      { id:'s1', _fid:'s1', name:'Blue Lagoon', depth:'18m', type:'Open Water', description:'Crystal clear water with stunning coral formations', visibility:'25m', difficulty:'Beginner', createdAt:new Date().toISOString() },
      { id:'s2', _fid:'s2', name:'Shark Reef', depth:'30m', type:'Open Water', description:'Advanced site with pelagic species encounters', visibility:'20m', difficulty:'Advanced', createdAt:new Date().toISOString() }
    ];
    _cache.events = [
      { id:'e1', _fid:'e1', title:'Night Dive Adventure', date:'2025-08-15', time:'20:00', site:'Blue Lagoon', description:'Experience the reef after dark', maxParticipants:8, registrations:3, createdAt:new Date().toISOString() }
    ];
    _cache.logs = [
      { id:'l1', _fid:'l1', userId:'system', user:'System', action:'Initialized', details:'AquaSphere started', time:new Date().toISOString() }
    ];
    saveLocal();
  }

  // ── Sync Firestore → cache ────────────────────────────────
  async function syncFromFirestore() {
    var tables = ['users','divers','sites','events','gallery','checklists'];
    try {
      var snapshots = await Promise.all(tables.map(function(t) {
        return db.collection(t).orderBy('createdAt','desc').get();
      }));
      tables.forEach(function(t, i) {
        var docs = snapshots[i].docs.map(function(d) {
          return Object.assign({ id: d.id, _fid: d.id }, d.data());
        });
        _cache[t] = docs;
      });
      var logSnap = await db.collection('logs').orderBy('time','desc').limit(300).get();
      _cache.logs = logSnap.docs.map(function(d) {
        return Object.assign({ id: d.id, _fid: d.id }, d.data());
      });
      saveLocal();
      return true;
    } catch(e) {
      console.warn('Firestore sync failed:', e.message);
      return false;
    }
  }

  // ── Write defaults to Firestore ───────────────────────────
  async function writeDefaultsToFirestore() {
    try {
      var batch = db.batch();
      batch.set(db.collection('users').doc('admin'), _cache.users[0]);
      batch.set(db.collection('users').doc('instructor'), _cache.users[1]);
      await batch.commit();
      for (var i = 0; i < _cache.divers.length; i++) {
        var d = _cache.divers[i];
        await db.collection('divers').doc(d.id).set(d);
      }
      for (var j = 0; j < _cache.sites.length; j++) {
        var s = _cache.sites[j];
        await db.collection('sites').doc(s.id).set(s);
      }
      for (var k = 0; k < _cache.events.length; k++) {
        var ev = _cache.events[k];
        await db.collection('events').doc(ev.id).set(ev);
      }
    } catch(e) {
      console.warn('Could not write defaults to Firestore:', e.message);
    }
  }

  // ── Public init ───────────────────────────────────────────
  async function init() {
    loadLocal();
    var synced = await syncFromFirestore();
    if (!synced || _cache.users.length === 0) {
      if (_cache.users.length === 0) seedDefaults();
      await writeDefaultsToFirestore();
    }
    _loaded = true;
  }

  // ── CRUD ──────────────────────────────────────────────────
  function get(table) { return _cache[table] || []; }

  function find(table, fn) { return (_cache[table] || []).find(fn) || null; }

  function add(table, item) {
    item.id = uid();
    item._fid = item.id;
    item.createdAt = item.createdAt || new Date().toISOString();
    if (!_cache[table]) _cache[table] = [];
    _cache[table].unshift(item);
    saveLocal();
    // Async write to Firestore
    db.collection(table).doc(item.id).set(item)
      .catch(function(e) { console.warn('Firestore add error:', e.message); });
    return item;
  }

  function update(table, id, updates) {
    var arr = _cache[table] || [];
    var idx = arr.findIndex(function(r) { return r.id === id; });
    if (idx === -1) return;
    updates.updatedAt = new Date().toISOString();
    arr[idx] = Object.assign({}, arr[idx], updates);
    _cache[table] = arr;
    saveLocal();
    var fid = arr[idx]._fid || id;
    db.collection(table).doc(String(fid)).update(updates)
      .catch(function(e) { console.warn('Firestore update error:', e.message); });
    return arr[idx];
  }

  function del(table, id) {
    var arr = _cache[table] || [];
    var item = arr.find(function(r) { return r.id === id; });
    _cache[table] = arr.filter(function(r) { return r.id !== id; });
    saveLocal();
    if (item) {
      var fid = item._fid || id;
      db.collection(table).doc(String(fid)).delete()
        .catch(function(e) { console.warn('Firestore delete error:', e.message); });
    }
  }

  function log(userId, user, action, details) {
    var entry = {
      id: uid(), _fid: '',
      userId: String(userId), user: String(user || ''),
      action: String(action || ''), details: String(details || ''),
      time: new Date().toISOString()
    };
    if (!_cache.logs) _cache.logs = [];
    _cache.logs.unshift(entry);
    if (_cache.logs.length > 500) _cache.logs = _cache.logs.slice(0, 500);
    saveLocal();
    db.collection('logs').add(entry)
      .catch(function(e) { console.warn('Log write error:', e.message); });
  }

  // ── Export backup ─────────────────────────────────────────
  function exportBackup() {
    return {
      exportedAt: new Date().toISOString(),
      users: _cache.users, divers: _cache.divers,
      sites: _cache.sites, events: _cache.events,
      gallery: _cache.gallery, logs: _cache.logs, checklists: _cache.checklists
    };
  }

  return {
    init: init,
    get: get, find: find, add: add,
    update: update, delete: del, log: log,
    _hash: _hash, verifyHash: verifyHash,
    exportBackup: exportBackup
  };
})();
