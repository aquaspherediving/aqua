// ============================================================
// AquaSphere — Three.js Ocean Background
// js/three-bg.js  (THREE loaded globally via CDN script tag)
// ============================================================
function initThree() {
  var canvas = document.getElementById('bg-canvas');
  if (!canvas || !window.THREE) return;
  var THREE = window.THREE;

  var renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  var scene  = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 5;

  // Particle system
  var count  = 800;
  var geo    = new THREE.BufferGeometry();
  var pos    = new Float32Array(count * 3);
  var sizes  = new Float32Array(count);
  for (var i = 0; i < count; i++) {
    pos[i*3]   = (Math.random() - 0.5) * 20;
    pos[i*3+1] = (Math.random() - 0.5) * 20;
    pos[i*3+2] = (Math.random() - 0.5) * 10 - 2;
    sizes[i]   = Math.random() * 3 + 0.5;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos,   3));
  geo.setAttribute('size',     new THREE.BufferAttribute(sizes, 1));

  var mat = new THREE.PointsMaterial({
    color: 0x00d4ff, transparent: true, opacity: 0.4,
    sizeAttenuation: true, size: 0.05
  });
  var particles = new THREE.Points(geo, mat);
  scene.add(particles);

  // Wave mesh
  var waveGeo = new THREE.PlaneGeometry(30, 30, 60, 60);
  var waveMat = new THREE.MeshBasicMaterial({
    color: 0x004466, wireframe: true, transparent: true, opacity: 0.08
  });
  var wave = new THREE.Mesh(waveGeo, waveMat);
  wave.rotation.x = -Math.PI / 3;
  wave.position.y = -3;
  scene.add(wave);

  var t = 0;
  var origPos = waveGeo.attributes.position.array.slice();

  function animate() {
    requestAnimationFrame(animate);
    t += 0.008;
    var p2 = waveGeo.attributes.position.array;
    for (var j = 0; j < p2.length; j += 3) {
      var x = origPos[j], y = origPos[j+1];
      p2[j+2] = Math.sin(x * 0.5 + t) * 0.5 + Math.cos(y * 0.3 + t * 0.7) * 0.3;
    }
    waveGeo.attributes.position.needsUpdate = true;
    particles.rotation.y = t * 0.05;
    particles.rotation.x = Math.sin(t * 0.2) * 0.1;
    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener('resize', function() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}
