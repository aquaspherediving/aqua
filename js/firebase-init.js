// ============================================================
// AquaSphere — Firebase Initialization (Compat SDK)
// js/firebase-init.js
// Uses window.firebase from CDN <script> tags — no ES modules
// ============================================================
var firebaseConfig = {
  apiKey:            "AIzaSyBB_-9ZWIVPeBAv97uKOJKClKqgdLpJdxU",
  authDomain:        "aquasphere-a76af.firebaseapp.com",
  projectId:         "aquasphere-a76af",
  storageBucket:     "aquasphere-a76af.firebasestorage.app",
  messagingSenderId: "64320444792",
  appId:             "1:64320444792:web:ec575daec32a52be67508d",
  measurementId:     "G-59QC3FVJBT"
};

firebase.initializeApp(firebaseConfig);
var db = firebase.firestore();

// Show Firebase connection status badge
function showFbStatus(ok, msg) {
  var el = document.getElementById('fb-status');
  if (!el) return;
  el.className = 'show ' + (ok ? 'ok' : 'err');
  el.innerHTML = '<span class="fb-dot"></span>' + (msg || (ok ? '🔥 Firebase Connected' : '⚠️ Offline Mode'));
  if (ok) setTimeout(function(){ el.classList.remove('show'); }, 3500);
}

// Verify connectivity
db.collection('_meta').limit(1).get()
  .then(function(){ showFbStatus(true); })
  .catch(function(e){ showFbStatus(false, '⚠️ ' + e.code); });
