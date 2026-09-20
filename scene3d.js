// scene3d.js — the rooms are real 3D (Three.js, fetched from jsDelivr), built voxel-style from boxes
// with flat Lambert shading and one warm shadow-casting lamp. It renders at 400x225 and the browser
// upscales with nearest-neighbour, so it still reads as pixel art. The cat is a billboard sprite whose
// texture is redrawn from the pixel-art poses every frame, so the desk occludes it properly.
import * as THREE from 'three';

export const S3 = (() => {
  const W = 400, H = 225;
  let renderer, camera, active, scenes = {};
  const view = { pos: new THREE.Vector3(0, 3.8, 6.3), target: new THREE.Vector3(0, 0.9, 0.3), fov: 33 };
  const goal = { pos: view.pos.clone(), target: view.target.clone(), fov: 33, speed: 2 };
  const R = {}; // named objects of the living room
  const K = {}; // kitchen
  let cat = {}, shadowBlob, lcdTex, lcdCtx, phoneTex, phoneCtx, clockHands = [];
  const ray = new THREE.Raycaster();

  // ---- helpers
  function tex(w, h, draw, rx = 1, ry = 1){
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.colorSpace = THREE.SRGBColorSpace;
    t.userData.redraw = () => { draw(c.getContext('2d'), w, h); t.needsUpdate = true; }; return t;
  }
  const lam = (color, extra = {}) => new THREE.MeshLambertMaterial(Object.assign({ color }, extra));
  function box(parent, w, h, d, m, x, y, z, opts = {}){ // y = bottom
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof m === 'string' || typeof m === 'number' ? lam(m) : m);
    mesh.position.set(x, y + h / 2, z); mesh.castShadow = opts.cast !== false; mesh.receiveShadow = opts.receive !== false;
    if (opts.ry) mesh.rotation.y = opts.ry; if (opts.rx) mesh.rotation.x = opts.rx; if (opts.rz) mesh.rotation.z = opts.rz;
    parent.add(mesh); return mesh;
  }
  function cyl(parent, r, h, m, x, y, z, seg = 10){
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), typeof m === 'string' || typeof m === 'number' ? lam(m) : m);
    mesh.position.set(x, y + h / 2, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  function plane(parent, w, h, m, x, y, z, rx = 0, ry = 0){
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, 0); mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  const px = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };

  // ---- textures
  const T = {};
  function makeTextures(){
    T.planks = tex(64, 64, (g) => { px(g, 0, 0, 64, 64, '#7a5233'); for (let y = 0; y < 64; y += 16){ px(g, 0, y, 64, 1, '#5c3b23'); const off = (y / 16) % 2 * 32; px(g, off, y, 1, 16, '#5c3b23'); for (let x = 0; x < 64; x += 5) px(g, (x + y) % 64, y + 7, 2, 1, '#8b5f3d'); } }, 7, 6);
    T.wallpaper = tex(32, 32, (g) => { px(g, 0, 0, 32, 32, '#4a4f78'); px(g, 3, 0, 4, 32, '#50568a'); px(g, 19, 0, 4, 32, '#50568a'); px(g, 11, 0, 1, 32, '#454a70'); px(g, 27, 0, 1, 32, '#454a70'); }, 24, 8);
    T.wallSide = tex(32, 32, (g) => { px(g, 0, 0, 32, 32, '#3f4468'); px(g, 3, 0, 4, 32, '#454a72'); px(g, 19, 0, 4, 32, '#454a72'); }, 20, 8);
    T.rug = tex(64, 44, (g) => { px(g, 0, 0, 64, 44, '#8d3b46'); px(g, 3, 3, 58, 38, '#a24853'); px(g, 6, 6, 52, 32, '#8d3b46'); g.fillStyle = '#d3aa4c'; for (let x = 12; x < 56; x += 12){ g.fillRect(x + 1, 20, 1, 3); g.fillRect(x, 21, 3, 1); } px(g, 0, 0, 64, 1, '#d3aa4c'); px(g, 0, 43, 64, 1, '#d3aa4c'); px(g, 0, 0, 1, 44, '#d3aa4c'); px(g, 63, 0, 1, 44, '#d3aa4c'); });
    T.sky = tex(64, 40, (g) => { px(g, 0, 0, 64, 40, '#121629'); g.fillStyle = '#cfd6ff'; for (const s of [[8, 6], [20, 14], [30, 5], [50, 12], [58, 26], [14, 30], [40, 33], [26, 24]]) g.fillRect(s[0], s[1], 1, 1); px(g, 44, 8, 8, 8, '#f4efc4'); px(g, 43, 9, 1, 6, '#f4efc4'); px(g, 52, 9, 1, 6, '#f4efc4'); px(g, 44, 7, 8, 1, '#f4efc4'); px(g, 44, 16, 8, 1, '#f4efc4'); px(g, 46, 10, 2, 2, '#e0d9a8'); });
    T.cardboard = tex(32, 32, (g) => { px(g, 0, 0, 32, 32, '#c99a5b'); px(g, 15, 0, 2, 32, '#e2cf8a'); px(g, 8, 22, 14, 1, '#5a3a1a'); px(g, 21, 21, 1, 1, '#5a3a1a'); px(g, 21, 23, 1, 1, '#5a3a1a'); });
    T.lattice = tex(16, 16, (g) => { px(g, 0, 0, 16, 16, '#4d90c8'); px(g, 0, 0, 16, 1, '#3b74a4'); px(g, 0, 0, 1, 16, '#3b74a4'); px(g, 8, 0, 1, 16, '#3b74a4'); px(g, 0, 8, 16, 1, '#3b74a4'); }, 4, 3);
    T.tiles = tex(32, 32, (g) => { px(g, 0, 0, 32, 32, '#e8e0c8'); px(g, 0, 0, 32, 1, '#cfc6a8'); px(g, 0, 0, 1, 32, '#cfc6a8'); px(g, 16, 0, 1, 32, '#cfc6a8'); px(g, 0, 16, 32, 1, '#cfc6a8'); }, 14, 6);
    T.checker = tex(32, 32, (g) => { px(g, 0, 0, 32, 32, '#5c4a44'); px(g, 0, 0, 16, 16, '#6a5852'); px(g, 16, 16, 16, 16, '#6a5852'); }, 12, 10);
    T.label = tex(96, 16, (g) => { px(g, 0, 0, 96, 16, '#f3e9b8'); g.font = '8px "Press Start 2P", monospace'; g.fillStyle = '#222'; g.fillText('PLAY/DECODE', 4, 12); });
    T.shipLabel = tex(96, 32, (g) => { px(g, 0, 0, 96, 32, '#f3e9b8'); g.font = '8px "Press Start 2P", monospace'; g.fillStyle = '#222'; g.fillText('CAT AUDIO', 12, 13); g.fillText('DECODER', 20, 26); });
    T.deskWood = tex(64, 32, (g) => { px(g, 0, 0, 64, 32, '#b07a44'); for (let y = 3; y < 32; y += 7){ px(g, 0, y, 64, 1, '#9e6b3a'); px(g, (y * 9) % 64, y + 3, 20, 1, '#c48a50'); } }, 9, 1);
    T.tuna = tex(16, 8, (g) => { px(g, 0, 0, 16, 8, '#3b6fb5'); px(g, 3, 3, 10, 2, '#e8e8f0'); });
    // Nyan Cat poster: navy sky, rainbow trail, pop-tart body, grey cat
    T.nyan = tex(48, 32, (g) => {
      px(g, 0, 0, 48, 32, '#f4efe0'); px(g, 2, 2, 44, 28, '#0b2e5a');
      g.fillStyle = '#dfe8ff'; for (const s of [[5, 5], [12, 22], [38, 6], [43, 16], [30, 26], [20, 4], [42, 26], [8, 14]]){ g.fillRect(s[0], s[1], 1, 1); g.fillRect(s[0] - 1, s[1], 3, 1); g.fillRect(s[0], s[1] - 1, 1, 3); }
      ['#ff2a2a', '#ff9a1a', '#ffe81a', '#33d33a', '#2a8aff', '#7a3aff'].forEach((c, i) => { px(g, 3, 10 + i * 2, 15, 2, c); });
      px(g, 17, 8, 16, 16, '#f5d69c'); px(g, 19, 10, 12, 12, '#f99ac4'); g.fillStyle = '#e04a92'; for (const d of [[21, 12], [27, 13], [24, 17], [29, 19], [21, 19]]) g.fillRect(d[0], d[1], 1, 1);
      px(g, 30, 12, 10, 9, '#8f8f95'); px(g, 30, 10, 2, 2, '#8f8f95'); px(g, 38, 10, 2, 2, '#8f8f95');
      px(g, 32, 15, 1, 1, '#111'); px(g, 37, 15, 1, 1, '#111'); px(g, 31, 17, 2, 1, '#f2a0c0'); px(g, 38, 17, 2, 1, '#f2a0c0'); px(g, 34, 18, 2, 1, '#111');
      px(g, 19, 24, 2, 2, '#8f8f95'); px(g, 23, 24, 2, 2, '#8f8f95'); px(g, 30, 24, 2, 2, '#8f8f95'); px(g, 35, 24, 2, 2, '#8f8f95'); px(g, 14, 20, 3, 2, '#8f8f95');
    });
    // Space Invader mini poster
    T.invader = tex(28, 24, (g) => {
      px(g, 0, 0, 28, 24, '#eee8d8'); px(g, 2, 2, 24, 20, '#111318');
      const rows = ['..X.....X..', '...X...X...', '..XXXXXXX..', '.XX.XXX.XX.', 'XXXXXXXXXXX', 'X.XXXXXXX.X', 'X.X.....X.X', '...XX.XX...'];
      rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] === 'X') px(g, 3 + x * 2, 4 + y * 2, 2, 2, '#5cff5c'); });
    });
    // Rubik's cube faces (three different scrambles, reused on opposite sides)
    const rub = ['#e02020', '#ffffff', '#2050e0', '#f0a000', '#20b040', '#ffe000'];
    T.rubik = [0, 1, 2].map(k => tex(12, 12, (g) => { px(g, 0, 0, 12, 12, '#111'); for (let i = 0; i < 9; i++) px(g, 1 + (i % 3) * 4, 1 + Math.floor(i / 3) * 4, 3, 3, rub[(i * 7 + k * 5 + Math.floor(i / 3)) % 6]); }));
    lcdCtx = document.createElement('canvas').getContext('2d'); lcdCtx.canvas.width = 64; lcdCtx.canvas.height = 16;
    lcdTex = new THREE.CanvasTexture(lcdCtx.canvas); lcdTex.magFilter = lcdTex.minFilter = THREE.NearestFilter; lcdTex.colorSpace = THREE.SRGBColorSpace;
    phoneCtx = document.createElement('canvas').getContext('2d'); phoneCtx.canvas.width = 48; phoneCtx.canvas.height = 24;
    phoneTex = new THREE.CanvasTexture(phoneCtx.canvas); phoneTex.magFilter = phoneTex.minFilter = THREE.NearestFilter; phoneTex.colorSpace = THREE.SRGBColorSpace;
  }
  function setLCD(text){ const g = lcdCtx; px(g, 0, 0, 64, 16, '#123018'); px(g, 1, 1, 62, 14, '#1b4a24'); g.font = '8px "Press Start 2P", monospace'; g.fillStyle = '#7cff5a'; g.fillText(text || '', 4, 12); lcdTex.needsUpdate = true; }
  function drawPhone(time, playing){ const g = phoneCtx; px(g, 0, 0, 48, 24, '#0e1a22'); px(g, 4, 4, 3, 3, '#ff3b3b'); for (let i = 0; i < 16; i++){ const h = 2 + Math.round(2 + 3 * Math.sin(i * 1.7 + (playing ? time * 14 : 0))); px(g, 10 + i * 2, 15 - Math.floor(h / 2), 1, h, playing ? '#7cff5a' : '#3fbf6f'); } phoneTex.needsUpdate = true; }

  // ---- the living room
  function buildRoom(){
    const s = new THREE.Scene(); s.background = new THREE.Color('#0e0c14');
    s.add(new THREE.AmbientLight(0x9aa0d0, 0.55));
    const hemi = new THREE.HemisphereLight(0x5560a0, 0x3a2414, 0.5); s.add(hemi);
    const moon = new THREE.DirectionalLight(0x9fb0ff, 0.6); moon.position.set(-1, 4, -6); s.add(moon);
    const lamp = new THREE.PointLight(0xffc880, 26, 12, 1.7); lamp.position.set(3.05, 1.72, -1.5); lamp.castShadow = true; lamp.shadow.mapSize.set(512, 512); lamp.shadow.bias = -0.004; s.add(lamp); R.lamp = lamp;
    // shell
    plane(s, 8.6, 7.4, lam(0xffffff, { map: T.planks }), 0, 0, 0, -Math.PI / 2);
    plane(s, 7.2, 3, lam(0xffffff, { map: T.wallpaper }), 0, 1.5, -3.6);
    plane(s, 7.4, 3, lam(0xffffff, { map: T.wallSide }), -3.6, 1.5, 0.1, 0, Math.PI / 2);
    plane(s, 7.4, 3, lam(0xffffff, { map: T.wallSide }), 3.6, 1.5, 0.1, 0, -Math.PI / 2);
    box(s, 7.2, 0.12, 0.05, '#262040', 0, 0, -3.58); box(s, 0.05, 0.12, 7.4, '#262040', -3.58, 0, 0.1); box(s, 0.05, 0.12, 7.4, '#262040', 3.58, 0, 0.1);
    // window + curtains
    box(s, 2.2, 1.4, 0.08, '#cfc8b4', 0, 1.25, -3.56, { cast: false });
    plane(s, 2.0, 1.2, new THREE.MeshBasicMaterial({ map: T.sky }), 0, 1.95, -3.51);
    box(s, 0.06, 1.2, 0.03, '#cfc8b4', 0, 1.35, -3.5, { cast: false }); box(s, 2.0, 0.06, 0.03, '#cfc8b4', 0, 1.92, -3.5, { cast: false });
    box(s, 0.3, 1.7, 0.12, '#7a3b4a', -1.25, 1.05, -3.5); box(s, 0.3, 1.7, 0.12, '#7a3b4a', 1.25, 1.05, -3.5); box(s, 3.0, 0.05, 0.05, '#8a7a5a', 0, 2.75, -3.48);
    // clock
    const clock = new THREE.Group(); clock.position.set(2.1, 2.05, -3.55); s.add(clock);
    const rim = cyl(clock, 0.26, 0.05, '#2a2a33', 0, 0, 0, 12); rim.rotation.x = Math.PI / 2; rim.position.set(0, 0, 0);
    const face = cyl(clock, 0.23, 0.06, '#efe6c8', 0, 0, 0.01, 12); face.rotation.x = Math.PI / 2; face.position.set(0, 0, 0.01);
    clockHands = [box(clock, 0.03, 0.13, 0.02, '#222', 0, 0, 0.05, { cast: false }), box(clock, 0.02, 0.19, 0.02, '#222', 0, 0, 0.055, { cast: false }), box(clock, 0.01, 0.2, 0.02, '#c33', 0, 0, 0.06, { cast: false })];
    for (const h of clockHands){ h.geometry.translate(0, h.geometry.parameters.height / 2, 0); h.position.y = 0; }
    // shelf: books and a suspicious can of tuna
    box(s, 1.36, 0.05, 0.28, '#5a3a22', -2.3, 1.7, -3.46);
    [['#c0392b', 0.12, 0.34], ['#2980b9', 0.1, 0.28], ['#27ae60', 0.14, 0.38], ['#f39c12', 0.1, 0.26], ['#8e44ad', 0.12, 0.3]].forEach((b, i) => box(s, b[1], b[2], 0.22, b[0], -2.82 + i * 0.15, 1.75, -3.46));
    // Shannon's useless box: the original machine whose only job is turning itself off
    box(s, 0.16, 0.08, 0.12, '#1c1c22', -1.98, 1.75, -3.42); box(s, 0.16, 0.01, 0.12, '#2c2c34', -1.98, 1.83, -3.42, { cast: false });
    box(s, 0.02, 0.03, 0.02, '#d02020', -1.94, 1.84, -3.4, { cast: false }); box(s, 0.05, 0.015, 0.015, '#e8c39a', -2.0, 1.845, -3.4, { cast: false, rz: 0.5 });
    const can = cyl(s, 0.09, 0.12, lam(0xffffff, { map: T.tuna }), -1.73, 1.75, -3.46, 10);
    // wall art: a Space Invader above the shelf, Nyan Cat over the armchair
    box(s, 0.02, 0.36, 0.42, '#3a2a1a', -3.58, 1.32, -1.9, { cast: false }); plane(s, 0.38, 0.32, lam(0xffffff, { map: T.invader }), -3.565, 1.5, -1.9, 0, Math.PI / 2);
    box(s, 0.72, 0.48, 0.02, '#3a2a1a', 2.7, 1.27, -3.58, { cast: false }); plane(s, 0.68, 0.44, lam(0xffffff, { map: T.nyan }), 2.7, 1.51, -3.565);
    // couch
    const couch = new THREE.Group(); couch.position.set(-2.3, 0, -2.75); s.add(couch);
    box(couch, 2.0, 0.42, 0.9, '#3a7a6a', 0, 0.08, 0); box(couch, 2.0, 0.12, 0.9, '#4c9080', 0, 0.5, 0.02);
    box(couch, 2.0, 0.6, 0.25, '#2f6b5e', 0, 0.5, -0.33); box(couch, 0.9, 0.5, 0.12, '#4c9080', -0.5, 0.55, -0.2); box(couch, 0.9, 0.5, 0.12, '#4c9080', 0.5, 0.55, -0.2);
    box(couch, 0.22, 0.75, 0.9, '#2c5f52', -1.11, 0.08, 0); box(couch, 0.22, 0.75, 0.9, '#2c5f52', 1.11, 0.08, 0);
    box(couch, 0.4, 0.3, 0.12, '#e0c060', -0.55, 0.6, -0.12); [-0.9, 0.9].forEach(x => box(couch, 0.08, 0.08, 0.08, '#2b1d12', x, 0, 0.3));
    // armchair
    const chair = new THREE.Group(); chair.position.set(2.5, 0, -2.55); s.add(chair);
    box(chair, 1.1, 0.42, 0.9, '#6d4b7d', 0, 0.08, 0); box(chair, 1.0, 0.12, 0.85, '#8c6a9e', 0, 0.5, 0.02);
    box(chair, 1.1, 0.7, 0.25, '#5d3f6d', 0, 0.5, -0.33); box(chair, 0.8, 0.5, 0.12, '#8c6a9e', 0, 0.55, -0.2);
    box(chair, 0.2, 0.75, 0.9, '#4d3360', -0.65, 0.08, 0); box(chair, 0.2, 0.75, 0.9, '#4d3360', 0.65, 0.08, 0); [-0.45, 0.45].forEach(x => box(chair, 0.08, 0.08, 0.08, '#2b1d12', x, 0, 0.3));
    // plant
    cyl(s, 0.18, 0.3, '#a55a3a', -0.8, 0, -3.1, 8); cyl(s, 0.2, 0.05, '#8a4a2e', -0.8, 0.3, -3.1, 8);
    box(s, 0.3, 0.3, 0.3, '#3d8b46', -0.95, 0.35, -3.1); box(s, 0.34, 0.36, 0.34, '#48a052', -0.75, 0.5, -3.15); box(s, 0.26, 0.26, 0.26, '#3d8b46', -0.6, 0.38, -3.0);
    // floor lamp
    cyl(s, 0.03, 1.7, '#3a3a44', 3.05, 0, -1.5, 6); cyl(s, 0.22, 0.05, '#2a2a33', 3.05, 0, -1.5, 8);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.38, 8, 1, true), new THREE.MeshLambertMaterial({ color: '#e2c56b', emissive: '#c9a640', emissiveIntensity: 0.9, side: THREE.DoubleSide }));
    shade.position.set(3.05, 1.85, -1.5); s.add(shade);
    // rug
    box(s, 3.4, 0.02, 2.3, lam(0xffffff, { map: T.rug }), 0, 0, -1.3, { cast: false });
    // cardboard box on the floor (the decoder's packaging) — standing and lying versions
    R.boxFloor = new THREE.Group(); s.add(R.boxFloor);
    box(R.boxFloor, 0.6, 0.4, 0.5, lam(0xffffff, { map: T.cardboard }), 0, 0, 0);
    box(R.boxFloor, 0.24, 0.02, 0.5, '#b8894c', -0.3, 0.4, 0, { rz: 1.2 }); box(R.boxFloor, 0.24, 0.02, 0.5, '#b8894c', 0.3, 0.4, 0, { rz: -1.2 });
    R.boxLying = new THREE.Group(); s.add(R.boxLying); R.boxLying.visible = false;
    box(R.boxLying, 0.6, 0.5, 0.4, lam(0xffffff, { map: T.cardboard }), 0, 0, 0); box(R.boxLying, 0.02, 0.4, 0.3, '#4a2e12', 0.3, 0.05, 0);
    // laundry basket + socks
    R.basket = new THREE.Group(); R.basket.position.set(2.4, 0, -0.4); s.add(R.basket);
    box(R.basket, 0.55, 0.36, 0.45, lam(0xffffff, { map: T.lattice }), 0, 0, 0); box(R.basket, 0.6, 0.04, 0.5, '#5fa4dc', 0, 0.36, 0);
    [[-0.5, -0.1, 0.02], [-0.2, 0.25, 0], [2.9, -0.2, 0]].forEach(p => { box(s, 0.12, 0.03, 0.08, '#f0f0f0', p[0], p[2], p[1], { cast: false }); box(s, 0.12, 0.035, 0.02, '#e04848', p[0], p[2], p[1] - 0.04, { cast: false }); });
    // desk
    box(s, 7.1, 0.06, 0.95, lam(0xffffff, { map: T.deskWood }), 0, 0.66, 2.05); box(s, 7.1, 0.66, 0.06, '#7d4f2b', 0, 0, 2.5); box(s, 7.1, 0.02, 0.06, '#d19a5c', 0, 0.72, 1.58, { cast: false });
    // Rubik's cube, unsolved, right of the lever
    const cube = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), [0, 1, 2, 0, 1, 2].map(k => lam(0xffffff, { map: T.rubik[k] }))); cube.position.set(2.3, 0.8, 1.95); cube.rotation.y = 0.4; cube.castShadow = cube.receiveShadow = true; s.add(cube);
    box(s, 1.6, 0.4, 0.04, '#6d4324', -1.2, 0.15, 2.53, { cast: false }); box(s, 0.3, 0.05, 0.03, '#c9a24c', -1.2, 0.33, 2.55, { cast: false });
    plane(s, 1.32, 0.22, new THREE.MeshBasicMaterial({ map: T.label }), 1.5, 0.5, 2.535);
    // mug
    cyl(s, 0.1, 0.2, '#d94f4f', -2.5, 0.72, 2.0, 10); box(s, 0.05, 0.1, 0.04, '#d94f4f', -2.38, 0.76, 2.0);
    // phone + cable
    R.phone = new THREE.Group(); R.phone.position.set(-1.7, 0.72, 2.15); R.phone.rotation.y = -0.25; s.add(R.phone);
    box(R.phone, 0.5, 0.025, 0.26, '#14141c', 0, 0, 0); plane(R.phone, 0.44, 0.2, new THREE.MeshBasicMaterial({ map: phoneTex }), 0, 0.026, 0, -Math.PI / 2);
    R.cable = box(s, 1.4, 0.02, 0.02, '#222', -0.6, 0.72, 2.12, { cast: false }); R.cable.geometry.translate(0.7, 0, 0); R.cable.position.x = -1.45;
    // the decoder
    R.decoder = new THREE.Group(); R.decoder.position.set(0.55, 0.72, 2.05); s.add(R.decoder);
    box(R.decoder, 1.3, 0.22, 0.45, '#e5dcc3', 0, 0, 0); box(R.decoder, 1.3, 0.01, 0.45, '#f1e9d3', 0, 0.22, 0, { cast: false });
    box(R.decoder, 0.28, 0.14, 0.01, '#2a2a30', -0.44, 0.04, 0.225, { cast: false }); for (let i = 0; i < 5; i++) box(R.decoder, 0.24, 0.012, 0.01, '#4a4a52', -0.44, 0.055 + i * 0.026, 0.23, { cast: false });
    R.led = box(R.decoder, 0.06, 0.06, 0.01, new THREE.MeshLambertMaterial({ color: '#7a2020', emissive: '#7a2020', emissiveIntensity: 0.6 }), -0.2, 0.08, 0.23, { cast: false });
    plane(R.decoder, 0.6, 0.15, new THREE.MeshBasicMaterial({ map: lcdTex }), 0.15, 0.11, 0.231);
    for (let i = 0; i < 5; i++) box(R.decoder, 0.1, 0.005, 0.2, '#d9d0b5', -0.5 + i * 0.25, 0.23, -0.05, { cast: false });
    box(R.decoder, 0.05, 0.05, 0.01, '#2a2a30', 0.55, 0.06, 0.23, { cast: false });
    // the lever unit
    R.lever = new THREE.Group(); R.lever.position.set(1.6, 0.72, 2.1); s.add(R.lever);
    R.leverBody = box(R.lever, 0.36, 0.32, 0.36, '#2c2c36', 0, 0, 0); box(R.lever, 0.05, 0.22, 0.01, '#0b0b10', 0, 0.05, 0.181, { cast: false });
    R.knob = box(R.lever, 0.2, 0.09, 0.06, new THREE.MeshLambertMaterial({ color: '#2aa34a', emissive: '#1c7a36', emissiveIntensity: 0.3 }), 0, 0.03, 0.2);
    box(R.lever, 0.03, 0.03, 0.01, new THREE.MeshBasicMaterial({ color: '#3cff5a' }), -0.14, 0.26, 0.181, { cast: false }); box(R.lever, 0.03, 0.03, 0.01, new THREE.MeshBasicMaterial({ color: '#ff4040' }), -0.14, 0.03, 0.181, { cast: false });
    // shipping box (intro)
    R.ship = new THREE.Group(); R.ship.position.set(0.55, 0.72, 2.05); R.ship.visible = false; s.add(R.ship);
    box(R.ship, 1.6, 0.6, 0.7, lam(0xffffff, { map: T.cardboard }), 0, 0, 0); plane(R.ship, 0.8, 0.27, new THREE.MeshBasicMaterial({ map: T.shipLabel }), 0, 0.3, 0.352);
    R.shipLid = box(R.ship, 1.6, 0.02, 0.7, '#d9ad6d', 0, 0.6, 0);
    R.shipFlapL = box(R.ship, 0.02, 0.36, 0.7, '#b8894c', -0.8, 0.6, 0); R.shipFlapR = box(R.ship, 0.02, 0.36, 0.7, '#b8894c', 0.8, 0.6, 0); R.shipFlapL.visible = R.shipFlapR.visible = false;
    scenes.room = s;
  }

  // ---- the kitchen (intro flashback)
  function buildKitchen(){
    const s = new THREE.Scene(); s.background = new THREE.Color('#d9cfb0');
    s.add(new THREE.AmbientLight(0xfff4e0, 0.7));
    const lamp = new THREE.PointLight(0xffe0a0, 18, 9, 1.6); lamp.position.set(0.3, 2.3, -0.9); lamp.castShadow = true; lamp.shadow.mapSize.set(512, 512); lamp.shadow.bias = -0.004; s.add(lamp);
    plane(s, 9, 6, lam(0xffffff, { map: T.checker }), 0, 0, 0, -Math.PI / 2);
    plane(s, 9, 2.8, lam(0xffffff, { map: T.tiles }), 0, 1.4, -1.6);
    box(s, 9, 0.6, 0.02, '#d9cfb0', 0, 2.2, -1.59, { cast: false });
    // hanging lamp
    cyl(s, 0.01, 0.5, '#444', 0.3, 2.3, -0.9, 4);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.25, 8, 1, true), new THREE.MeshLambertMaterial({ color: '#e2c56b', emissive: '#e0b840', emissiveIntensity: 0.9, side: THREE.DoubleSide })); shade.position.set(0.3, 2.35, -0.9); s.add(shade);
    // window (night)
    box(s, 1.7, 1.1, 0.06, '#cfc8b4', -0.3, 1.35, -1.58, { cast: false }); plane(s, 1.5, 0.9, new THREE.MeshBasicMaterial({ map: T.sky }), -0.3, 1.9, -1.54);
    box(s, 0.05, 0.9, 0.03, '#cfc8b4', -0.3, 1.45, -1.53, { cast: false }); box(s, 1.5, 0.05, 0.03, '#cfc8b4', -0.3, 1.88, -1.53, { cast: false });
    // counter + cabinets
    box(s, 5.2, 0.86, 0.62, '#8a5a3a', 0.2, 0, -1.28); box(s, 5.24, 0.06, 0.68, '#c8c2b8', 0.2, 0.86, -1.28);
    for (let i = 0; i < 6; i++){ box(s, 0.02, 0.86, 0.02, '#5a3a22', -2.2 + i * 0.86, 0, -0.96, { cast: false }); box(s, 0.12, 0.02, 0.02, '#d4b040', -1.8 + i * 0.86, 0.5, -0.95, { cast: false }); }
    box(s, 5.2, 0.02, 0.02, '#5a3a22', 0.2, 0.42, -0.96, { cast: false });
    // fridge with the compromised gasket
    box(s, 0.95, 1.95, 0.75, '#e2e4ea', 3.32, 0, -1.2); box(s, 0.96, 0.02, 0.76, '#aab', 3.32, 1.3, -1.2, { cast: false });
    box(s, 0.04, 0.3, 0.03, '#888', 2.92, 1.45, -0.82, { cast: false }); box(s, 0.04, 0.6, 0.03, '#888', 2.92, 0.5, -0.82, { cast: false });
    box(s, 0.03, 1.28, 0.03, '#e8d070', 2.85, 0.02, -0.84, { cast: false }); box(s, 0.05, 0.12, 0.04, '#e8d070', 2.83, 0.6, -0.83, { cast: false });
    box(s, 0.12, 0.1, 0.01, '#e74c3c', 3.52, 1.7, -0.82, { cast: false }); box(s, 0.14, 0.17, 0.01, '#fffbe0', 3.68, 1.62, -0.82, { cast: false });
    // door with a pet flap
    box(s, 0.9, 2.1, 0.08, '#8a5a3a', -3.1, 0, -1.55); box(s, 0.6, 0.7, 0.02, '#7a4b2c', -3.1, 1.2, -1.5, { cast: false }); box(s, 0.05, 0.08, 0.04, '#d4b040', -2.75, 1.0, -1.49, { cast: false });
    box(s, 0.42, 0.4, 0.03, '#5a3a22', -3.1, 0.05, -1.5, { cast: false }); box(s, 0.34, 0.32, 0.02, '#c9bda8', -3.1, 0.08, -1.48, { cast: false });
    // cutting board + celery, kibble bowl
    box(s, 0.5, 0.03, 0.3, '#c99a5b', -1.4, 0.92, -1.25); box(s, 0.32, 0.03, 0.05, '#7ec850', -1.42, 0.95, -1.25); box(s, 0.06, 0.08, 0.06, '#a8e070', -1.22, 0.95, -1.25);
    cyl(s, 0.14, 0.07, '#3b6fb5', 1.7, 0.92, -1.2, 10); cyl(s, 0.1, 0.03, '#b98a4a', 1.7, 0.99, -1.2, 8);
    scenes.kitchen = s;
  }

  // ---- cat billboard
  function makeCat(){
    const c = document.createElement('canvas'); c.width = 40; c.height = 40; cat.ctx = c.getContext('2d');
    cat.tex = new THREE.CanvasTexture(c); cat.tex.magFilter = cat.tex.minFilter = THREE.NearestFilter; cat.tex.colorSpace = THREE.SRGBColorSpace;
    cat.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: cat.tex, transparent: true, alphaTest: 0.2 }));
    cat.size = 0.8;
    shadowBlob = new THREE.Mesh(new THREE.CircleGeometry(0.2, 10), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
    shadowBlob.rotation.x = -Math.PI / 2;
  }
  // draw the pose, place the sprite so its feet sit at (x, y, z)
  function setCat(o){
    CatArt.drawTo(cat.ctx, o.pose, o.o, o.flip); cat.tex.needsUpdate = true;
    const sz = o.size || cat.size;
    cat.sprite.scale.set(sz, sz, 1); cat.sprite.material.rotation = -(o.rot || 0);
    cat.sprite.position.set(o.x, o.y + sz * 14 / 40, o.z + 0.001); cat.sprite.visible = !o.hidden;
    shadowBlob.visible = !o.hidden && o.ground != null; if (o.ground != null){ const h = Math.max(0, o.y - o.ground); shadowBlob.position.set(o.x, o.ground + 0.025, o.z); const k = Math.max(0.25, 1 - h * 0.6); shadowBlob.scale.set(k, k, 1); shadowBlob.material.opacity = 0.35 * k; }
  }
  function setScene(name){
    if (active) { active.remove(cat.sprite); active.remove(shadowBlob); }
    active = scenes[name]; active.add(cat.sprite); active.add(shadowBlob);
  }

  // ---- camera
  const VIEWS = {
    room: { pos: [0, 3.8, 6.3], target: [0, 1.0, 0.3], fov: 35 },
    desk: { pos: [0.3, 2.6, 5.4], target: [0.2, 0.8, 1.9], fov: 26 },
    kitchen: { pos: [0.2, 1.8, 3.6], target: [0.3, 1.05, -1.0], fov: 40 }
  };
  function setView(v, instant, speed = 2){
    goal.pos.set(...v.pos); goal.target.set(...v.target); goal.fov = v.fov; goal.speed = speed;
    if (instant){ view.pos.copy(goal.pos); view.target.copy(goal.target); view.fov = goal.fov; }
  }
  function lookAtPoint(x, y, z, dist, fov, speed){ // dolly toward a point (the stare)
    const dir = new THREE.Vector3().subVectors(view.pos, new THREE.Vector3(x, y, z)).normalize();
    goal.pos.set(x + dir.x * dist, y + dir.y * dist, z + dir.z * dist); goal.target.set(x, y, z); goal.fov = fov; goal.speed = speed;
  }
  function update(dt, st){
    const k = Math.min(1, dt * goal.speed);
    view.pos.lerp(goal.pos, k); view.target.lerp(goal.target, k); view.fov += (goal.fov - view.fov) * k;
    camera.position.copy(view.pos); camera.lookAt(view.target); camera.fov = view.fov; camera.updateProjectionMatrix();
    if (active === scenes.room){
      const d = new Date(), sec = d.getSeconds(), min = d.getMinutes() + sec / 60, hr = (d.getHours() % 12) + min / 60;
      clockHands[0].rotation.z = -hr / 12 * Math.PI * 2; clockHands[1].rotation.z = -min / 60 * Math.PI * 2; clockHands[2].rotation.z = -sec / 60 * Math.PI * 2;
      const on = st.lever, blink = st.blink && Math.floor(st.time * 4) % 2 === 0;
      R.knob.position.y = (on ? 0.245 : 0.03) + 0.045; R.knob.material.color.set(on || blink ? '#3ddc63' : '#2aa34a'); R.knob.material.emissiveIntensity = on || blink ? 0.9 : 0.3;
      R.led.material.color.set(on || blink ? '#3cff5a' : '#7a2020'); R.led.material.emissive.set(on || blink ? '#3cff5a' : '#7a2020'); R.led.material.emissiveIntensity = on || blink ? 1.2 : 0.5;
      R.lamp.intensity = 26 + Math.sin(st.time * 30) * 0.4 + Math.sin(st.time * 7) * 0.6;
      R.boxFloor.visible = !st.boxTaken && !st.boxFly; if (st.boxFly){ R.boxFloor.visible = true; R.boxFloor.position.set(st.boxFly.x, st.boxFly.y, st.boxFly.z); R.boxFloor.rotation.z = st.boxFly.rot; } else { R.boxFloor.position.set(st.BOX.x, 0.02, st.BOX.z); R.boxFloor.rotation.z = 0; }
      R.boxLying.visible = !!st.boxDrop; if (st.boxDrop) R.boxLying.position.set(st.boxDrop.x, 0.02, st.boxDrop.z);
      R.decoder.visible = st.showDecoder; R.decoder.position.y = 0.72 + (st.decoderDY || 0);
      R.ship.visible = !!st.shipBox; R.shipLid.visible = st.shipBox === 'closed'; R.shipFlapL.visible = R.shipFlapR.visible = st.shipBox === 'open';
      R.phone.visible = st.phoneX > -9; R.phone.position.x = st.phoneX; R.cable.scale.x = Math.max(0.001, st.cableP); R.cable.visible = st.cableP > 0;
      drawPhone(st.time, st.playing);
    }
  }
  function render(){ renderer.render(active, camera); }

  // ---- screen <-> world
  const v3 = new THREE.Vector3();
  function project(x, y, z){ v3.set(x, y, z).project(camera); return { x: (v3.x + 1) / 2 * W, y: (1 - v3.y) / 2 * H, behind: v3.z > 1 }; }
  function unprojectToPlaneZ(sx, sy, z){
    ray.setFromCamera(new THREE.Vector2(sx / W * 2 - 1, 1 - sy / H * 2), camera);
    const p = new THREE.Vector3(); ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), -z), p); return p;
  }
  function hit(sx, sy, what){
    ray.setFromCamera(new THREE.Vector2(sx / W * 2 - 1, 1 - sy / H * 2), camera);
    const obj = what === 'cat' ? cat.sprite : R.lever; return ray.intersectObject(obj, true).length > 0;
  }

  function init(canvas){
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.BasicShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    camera = new THREE.PerspectiveCamera(22, W / H, 0.1, 60);
    makeTextures(); buildRoom(); buildKitchen(); makeCat(); setLCD(''); setScene('room'); setView(VIEWS.room, true);
  }
  return { init, setScene, setView, VIEWS, lookAtPoint, update, render, setCat, setLCD, project, unprojectToPlaneZ, hit, get view(){ return view; }, refreshLabels(){ T.label.userData.redraw(); T.shipLabel.userData.redraw(); } };
})();
