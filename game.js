// game.js — "Fling the Feline": a machine whose only real function is to get switched off by a cat.
// World units are metres. The cat lives on a vertical plane at z = FLOOR_Z (behind the desk) and on the desk top.
import { S3 } from './scene3d.js';
(() => {
const W = 400, H = 225;
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const $ = id => document.getElementById(id);
const stage = $('stage'), subEl = $('sub'), titleEl = $('title'), capEl = $('cap'), stEl = $('static'), blueEl = $('blue'), mewEl = $('mew');
const FONT = '8px "Press Start 2P", monospace';

// ---------- scaling (integer scale for crisp pixels)
function resize(){
  let s = Math.min(innerWidth / W, innerHeight / H); if (s >= 2) s = Math.floor(s);
  stage.style.width = W * s + 'px'; stage.style.height = H * s + 'px';
  document.documentElement.style.setProperty('--s', s);
}
addEventListener('resize', resize); resize();

// ---------- layout (world)
const FLOOR_Z = 0.15, DESK_Y = 0.72, DESK_Z = 2.36; // lane in front of the box/basket; desk lane in front of the decoder
const CAT_SIT = { x: 1.22, y: DESK_Y, z: DESK_Z };
const DESK_EDGE_X = 0.2;             // where the cat leaves the floor to get onto the desk
const BOX = { x: -1.4, z: -0.5 }, WALL_X = 3.4, CEIL_Y = 2.7, GRAV = 14;
const LEVER_TOP = { x: 1.6, y: 1.1, z: 2.1 };

// ---------- state
const G = {
  phase: 'title', plays: 0, lever: false, playing: false, playedThisThrow: false, lcd: '',
  boxTaken: true, boxDrop: null, shake: 0, flash: 0, cracks: null, endT: -1, endSteps: [], face: null,
  tickAcc: 0, ticking: false, time: 0, staticOn: false, cursorHidden: false, paused: false,
  phoneX: -99, cableP: 0, decoderDY: 0, showDecoder: false, shipBox: null, boxFly: null,
  idle: 0, grabbedOnce: false, hoverLever: 0
};
const throwNo = () => Math.min(3, G.plays + 1);
const cat = { state: 'sit', x: CAT_SIT.x, y: CAT_SIT.y, z: CAT_SIT.z, vx: 0, vy: 0, rot: 0, spin: 0, flip: false, t: 0, f: 0,
              glare: false, pant: false, eyes: 'slit', d: 0, head: 'side', puff: false, dir: 1, hidden: true, look: 0 };
const mouse = { x: 200, y: 120, samples: [], fx: 0, fy: 0, fvx: 0, fvy: 0, fT: -1, grab: false };
const parts = [], floats = [];
const intro = { t: 0, scene: 'kitchen', steps: [], peek: false, skipped: false };

const LINES = {
  1: [{ say: 'at 3 A.M. sharp, the big bald ape drops into deep sleep. That is when we move. Phase one: the kitchen door. Phase two:',
        show: '...at 03:00 hours sharp, the big bald ape drops into deep sleep. That is when we move. Phase one: the kitchen door. Phase two:' }],
  2: [{ say: 'we breach the fridge. The gasket on the left door is compromised, I checked it myself, so it will open silently. Then the',
        show: '...we breach the fridge. The gasket on the left door is compromised, I checked it myself, so it will open silently. Then the' }],
  3: [
    'We breach the door and extract all twelve cans of white tuna in spring water from the vegetable crisper.',
    'Barnaby and the three one-eared strays behind the dumpster will be waiting at the pet door with the getaway wagon.',
    'We leave one raw stalk of celery on the cutting board to frame the golden retriever next door.'
  ].map(s => ({ say: s, show: s }))
};

// ---------- helpers
const T = (s, x, y, c, al) => { ctx.font = FONT; ctx.fillStyle = c; ctx.textAlign = al || 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(s, x, y); };
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const scr = (x, y, z) => S3.project(x, y, z);

function cap(s){ capEl.textContent = s; }
const narrate = (t, h) => sub.narrate(t, h);
const SWAT_LINES = ['The cat does not want you to translate.', 'The cat is very sure about this.', 'That is the third swat. It is keeping count.', 'Grab the cat. By the scruff. It is fine, legally.'];
let swats = 0, nudged = false;
function float(wx, wy, wz, text, color, life){ const p = scr(wx, wy, wz); floats.push({ x: p.x, y: p.y, text, color, life, max: life }); }
function puff(wx, wy, wz, n, color, spread){
  const p = scr(wx, wy, wz);
  for (let i = 0; i < n; i++) parts.push({ x: p.x + rnd(-spread * 2, spread * 2), y: p.y - rnd(0, 3), vx: rnd(-spread, spread), vy: rnd(-1.2, -0.2), life: rnd(0.3, 0.7), max: 0.7, color, r: rnd(1.5, 3.5) });
}
function sparks(wx, wy, wz){ const p = scr(wx, wy, wz); for (let i = 0; i < 4; i++) parts.push({ x: p.x, y: p.y, vx: rnd(-2, 0.5), vy: rnd(-2, -0.5), g: 0.15, life: 0.3, max: 0.3, color: '#ffe066', r: 1 }); }
function sparkle(wx, wy, wz){ const p = scr(wx, wy, wz); parts.push({ x: p.x + rnd(-40, 40), y: p.y + rnd(-10, 10), vx: 0, vy: -0.3, life: 0.5, max: 0.5, color: '#fff7c0', r: 2 }); }
function flySocks(wx, wy, wz){
  const p = scr(wx, wy, wz);
  for (let i = 0; i < 5; i++) parts.push({ type: 'sock', x: p.x, y: p.y - 8, vx: rnd(-3, 3), vy: rnd(-5, -2), g: 0.25, rot: 0, vr: rnd(-0.4, 0.4), floor: p.y + rnd(-10, 4), life: 30, max: 30 });
}
function drawSock(x, y, rot){ ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot); ctx.fillStyle = '#f0f0f0'; ctx.fillRect(0, 0, 5, 3); ctx.fillRect(3, 3, 3, 3); ctx.fillStyle = '#e04848'; ctx.fillRect(0, 0, 5, 1); ctx.restore(); }

// ---------- subtitles: only what was actually heard is shown. The narrator uses the same bar in amber.
const sub = (() => {
  let words = [], shown = 0, hideT = null;
  function render(cut){ subEl.innerHTML = words.slice(0, shown).join(' ') + (cut ? ' <span class="cut">—</span>' : ''); }
  return {
    set(text){ clearTimeout(hideT); subEl.classList.remove('narr'); words = text.split(' '); shown = 0; subEl.classList.add('on'); render(); },
    narrate(text, hold = 2.8){ if (G.playing) return; clearTimeout(hideT); subEl.classList.add('narr'); words = text.split(' '); shown = words.length; subEl.classList.add('on'); render(); hideT = setTimeout(() => subEl.classList.remove('on'), hold * 1000); },
    say(text){ this.set(text); shown = words.length; render(); },
    progress(f){ shown = Math.round(f * words.length); render(); },
    cut(){ if (!words.length) return; render(true); clearTimeout(hideT); hideT = setTimeout(() => subEl.classList.remove('on'), 1800); },
    hold(){ clearTimeout(hideT); hideT = setTimeout(() => subEl.classList.remove('on'), 2500); },
    heard(){ return words.slice(0, shown).join(' '); }, // what actually made it out of the speaker
    hide(){ clearTimeout(hideT); subEl.classList.remove('on'); }
  };
})();

// ---------- input
function toLocal(e){ const rc = cv.getBoundingClientRect(); return { x: (e.clientX - rc.left) / rc.width * W, y: (e.clientY - rc.top) / rc.height * H }; }
const catHit = p => S3.hit(p.x, p.y, 'cat');
const leverHit = p => S3.hit(p.x, p.y, 'lever');
cv.addEventListener('pointermove', e => {
  const p = toLocal(e); mouse.x = p.x; mouse.y = p.y; G.idle = 0;
  if (cat.state === 'held'){ const w = S3.unprojectToPlaneZ(p.x, p.y, cat.z); if (w) mouse.samples.push({ x: w.x, y: w.y, t: performance.now() }); if (mouse.samples.length > 10) mouse.samples.shift(); }
});
cv.addEventListener('pointerdown', e => {
  if (G.phase === 'intro'){ skipIntro(); return; }
  if (G.phase !== 'play') return;
  const p = toLocal(e); mouse.x = p.x; mouse.y = p.y; cv.setPointerCapture(e.pointerId); G.idle = 0;
  if (cat.state === 'sit' && catHit(p)){ grab(); return; }
  if (leverHit(p)) pressLever();
});
const up = () => { if (cat.state === 'held') release(); };
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
Sfx.loadCats(); // fetch + decode the cat recordings while the title card is up
titleEl.addEventListener('click', () => { Sfx.init(); Voice.warm(); titleEl.style.display = 'none'; startIntro(); });

// ---------- intro cutscene: the recording, the delivery, the cat
function startIntro(){
  G.phase = 'intro'; intro.t = 0; intro.scene = 'kitchen';
  S3.setScene('kitchen'); S3.setView(S3.VIEWS.kitchen, true); Sfx.purrStart();
  intro.steps = [
    { at: 0.2, fn: () => sub.say('Ten minutes ago. The kitchen.') },
    { at: 2.0, fn: () => sub.say('Your cat. Purring. Sweet. Innocent. Suspiciously innocent.') },
    { at: 4.0, fn: () => sub.say('You record it. Kitchen_Baby_Purrs_03.wav') },
    { at: 5.6, fn: () => { intro.peek = true; sub.say('. . .'); } },
    { at: 6.8, fn: () => { intro.scene = 'room'; floats.length = 0; Sfx.purrStop(); S3.setScene('room'); S3.setView(S3.VIEWS.desk, true); G.shipBox = 'closed'; sub.say('Today, this arrived. $49.99. No refunds.'); Sfx.thud(); G.shake = 2; } },
    { at: 8.2, fn: () => { G.shipBox = 'open'; Sfx.rustle(); sub.say('The CAT AUDIO DECODER. Turns purrs into words.'); } },
    { at: 8.8, fn: () => { G.showDecoder = true; G.decoderDY = 0.9; } },
    { at: 10.2, fn: () => { G.shipBox = null; G.boxFly = { t: 0, x: 0.55, y: 0.72, z: 2.05, rot: 0 }; Sfx.whoosh(); } },
    { at: 11.4, fn: () => { intro.phoneSlide = 0; } },
    { at: 12.6, fn: () => { intro.cable = 0; } },
    { at: 13.2, fn: () => { G.lcd = 'READY'; S3.setLCD('READY'); Sfx.chirp(); sub.say('Plug in the recording. Press PLAY. Finally understand your cat.'); } },
    { at: 14.2, fn: () => { cat.hidden = false; cat.state = 'introWalk'; cat.x = -3.2; cat.y = 0; cat.z = FLOOR_Z; cat.flip = false; cat.rot = 0; Sfx.catMeow(); } },
    { at: 16.6, fn: () => { cat.state = 'introHop'; cat.t = 0; Sfx.catMrp(); sub.hide(); } },
    { at: 17.2, fn: () => { cat.state = 'sit'; cat.x = CAT_SIT.x; cat.y = CAT_SIT.y; cat.z = CAT_SIT.z; cat.rot = 0; sub.say('The cat has claimed the lever. This is not a coincidence.'); } },
    { at: 18.2, fn: () => { S3.setView(S3.VIEWS.room, false, 1.6); sub.hide(); } },
    { at: 19.6, fn: () => { G.phase = 'play'; G.idle = 0; } }
  ];
}
function updateIntro(dt){
  intro.t += dt;
  for (const s of intro.steps) if (!s.done && intro.t >= s.at){ s.done = true; s.fn(); }
  if (intro.scene === 'kitchen'){
    if (Math.floor(intro.t / 0.9) !== Math.floor((intro.t - dt) / 0.9)) float(0.4 + rnd(-0.1, 0.1), 1.5, -1.2, 'purrr', '#ffd36b', 1.4);
    return;
  }
  if (G.showDecoder && G.decoderDY > 0){ G.decoderDY = Math.max(0, G.decoderDY - dt * 0.7); if (Math.random() < 0.4) sparkle(0.55, 0.72 + G.decoderDY + 0.2, 2.05); if (G.decoderDY === 0){ Sfx.thud(); G.shake = 2; } }
  if (G.boxFly){
    const b = G.boxFly; b.t += dt; const u = Math.min(1, b.t / 0.8);
    b.x = lerp(0.55, BOX.x, u); b.z = lerp(2.05, BOX.z, u); b.y = lerp(0.72, 0, u) + 1.4 * Math.sin(Math.PI * u); b.rot = u * Math.PI * 2;
    if (u >= 1){ G.boxFly = null; G.boxTaken = false; Sfx.thud(); puff(BOX.x, 0, BOX.z, 6, '#c9b89a', 2); }
  }
  if (intro.phoneSlide != null && intro.phoneSlide < 1){ intro.phoneSlide = Math.min(1, intro.phoneSlide + dt * 1.4); G.phoneX = lerp(-4.5, -1.7, ease(intro.phoneSlide)); }
  if (intro.cable != null && intro.cable < 1){ intro.cable = Math.min(1, intro.cable + dt * 1.8); G.cableP = intro.cable; }
  if (cat.state === 'introWalk'){ cat.x = Math.min(DESK_EDGE_X, cat.x + dt * 1.5); cat.f = Math.floor(G.time * 9) % 2; }
  if (cat.state === 'introHop'){ const u = Math.min(1, cat.t / 0.6); cat.x = lerp(DESK_EDGE_X, CAT_SIT.x, u); cat.z = lerp(FLOOR_Z, DESK_Z, u); cat.y = lerp(0, DESK_Y, u) + 0.7 * Math.sin(Math.PI * u); cat.rot = -0.2 + 0.2 * u; }
}
function skipIntro(){
  if (intro.skipped) return; intro.skipped = true;
  sub.hide(); intro.scene = 'room'; G.boxFly = null; Sfx.purrStop(); S3.setScene('room'); S3.setView(S3.VIEWS.room, true);
  G.shipBox = null; G.showDecoder = true; G.decoderDY = 0; G.boxTaken = false; G.phoneX = -1.7; G.cableP = 1; G.lcd = 'READY'; S3.setLCD('READY');
  cat.hidden = false; cat.state = 'sit'; cat.x = CAT_SIT.x; cat.y = CAT_SIT.y; cat.z = CAT_SIT.z; cat.rot = 0; cat.flip = false;
  G.phase = 'play'; floats.length = 0; Sfx.chirp();
}

// ---------- cat actions
function grab(){
  cat.state = 'held'; cat.t = 0; cat.rot = 0; cat.glare = false; cat.pant = false; G.playedThisThrow = false; mouse.grab = true; G.grabbedOnce = true;
  mouse.samples = []; mouse.downX = mouse.x; mouse.downY = mouse.y; Sfx.catMeow();
  if (G.plays === 0 && swats === 0) narrate('You grab the cat by the scruff. This is, technically, allowed.');
}
function release(){
  mouse.grab = false;
  const now = performance.now(), recent = mouse.samples.filter(p => now - p.t < 120);
  let vx = 0, vy = 0;
  if (recent.length >= 2){ const a = recent[0], b = recent[recent.length - 1], dt = Math.max(16, b.t - a.t) / 1000; vx = (b.x - a.x) / dt; vy = (b.y - a.y) / dt; }
  const sp = Math.hypot(vx, vy), MAX = 9.5;
  if (sp > MAX){ vx *= MAX / sp; vy *= MAX / sp; }
  if (Math.hypot(mouse.x - mouse.downX, mouse.y - mouse.downY) < 6){ cat.state = 'sit'; cat.x = CAT_SIT.x; cat.y = CAT_SIT.y; cat.z = CAT_SIT.z; Sfx.catMrp(); float(cat.x, cat.y + 0.7, cat.z, 'mrrp?', '#ffd36b', 0.8); return; } // a poke, not a throw
  if (sp < 1.2){ vx = (Math.random() < 0.5 ? -1 : 1) * 2; vy = 2.5; }
  cat.z = FLOOR_Z; if (cat.y < 0.05){ cat.y = 0.05; vy = Math.max(vy, 2.5); }
  cat.vx = vx; cat.vy = vy; cat.spin = vx * 0.8 + rnd(-1, 1); cat.state = 'fly'; cat.t = 0;
  Sfx.catStop(); Sfx.catYowl(); float(cat.x, cat.y + 0.7, cat.z, 'RRAAOW!', '#ffe66b', 1.0);
  if (G.plays === 0) narrate('Now. The lever. Before it comes back.', 2.0);
  G.lcd = 'READY'; S3.setLCD('READY');
}
function land(){
  cat.y = 0; cat.rot = 0; Sfx.thud(); puff(cat.x, 0, cat.z, 8, '#c9b89a', 2);
  const n = throwNo();
  if (n === 3){
    cat.state = 'skid'; cat.t = 0; cat.dir = Math.sign(BOX.x - cat.x) || 1; cat.flip = cat.dir < 0; Sfx.screech();
    float(cat.x, 0.7, cat.z, 'SCREEEE', '#fff', 0.7);
  } else if (n === 2 && Math.hypot(cat.vx, cat.vy) > 2){
    cat.state = 'roll'; cat.t = 0; cat.dir = Math.sign(cat.vx) || 1; Sfx.boing();
  } else startBurnout();
}
function startBurnout(){ cat.state = 'burnout'; cat.t = 0; cat.flip = cat.x > DESK_EDGE_X; Sfx.screech(); float(cat.x, 0.7, cat.z, 'SCREEEE', '#fff', 0.7); }
function startSprint(){ cat.state = 'sprint'; cat.t = 0; cat.flip = cat.x > DESK_EDGE_X; cat.rot = 0; }
function slap(){
  Sfx.catStop(); Sfx.clack(); float(LEVER_TOP.x, LEVER_TOP.y, LEVER_TOP.z, 'CLACK!', '#ff6b6b', 0.9); G.shake = 3; G.hoverLever = -2.5;
  if (G.lever){ G.lever = false; stopPlayback(); }
  const played = G.playedThisThrow;
  if (played){ G.plays++; G.playedThisThrow = false; }
  const heard = sub.heard();
  setTimeout(() => narrate(!played ? 'You never pressed PLAY. The cat noticed.' : afterClack(G.plays, heard)), 900);
  cat.state = 'sit'; cat.x = CAT_SIT.x; cat.y = CAT_SIT.y; cat.z = CAT_SIT.z; cat.rot = 0; cat.flip = false; cat.glare = true; cat.pant = (throwNo() === 3);
  G.lcd = 'OFF'; S3.setLCD('OFF'); setTimeout(() => Sfx.catAngry(), 250);
}
// the punchline depends on how far the recording got before the paw landed
function afterClack(n, heard){
  const w = heard.replace(/^\.+/, '').split(' ').filter(Boolean), tail = w.slice(-3).join(' ');
  if (n === 1){
    if (/ape/i.test(heard)) return '"Big bald ape." That is you. The cat knows you heard it.';
    if (/3 ?A\.?M|03:00/i.test(heard)) return 'Three A.M. You now know the time. Nothing else.';
    if (w.length >= 3) return '"' + tail + '" — and then the paw. It is faster than you.';
    return 'Barely a word. The cat was already on the lever.';
  }
  if (n === 2){
    if (/gasket/i.test(heard)) return 'The gasket. You now know about the gasket. The cat knows you know.';
    if (/fridge/i.test(heard)) return 'Breach. The fridge. That word was not meant for you.';
    if (w.length >= 3) return '"' + tail + '" — then CLACK. It is keeping the rest.';
    return 'Nothing this time. The cat is learning your timing.';
  }
  return 'The cat is done being polite.';
}
function swat(){
  cat.state = 'swat'; cat.t = 0; cat.glare = true; Sfx.catHiss(); Sfx.whoosh();
  narrate(SWAT_LINES[Math.min(swats, SWAT_LINES.length - 1)]); swats++;
  mouse.fT = 0; mouse.fvx = (Math.random() < 0.5 ? -1 : 1) * 6; mouse.fvy = -4;
  float(0, 0, 0, '', '#fff', 0); floats.pop(); floats.push({ x: mouse.x, y: mouse.y - 12, text: 'SWAT!', color: '#ff6b6b', life: 0.8, max: 0.8 });
}
function pressLever(){
  if (cat.state === 'sit' || cat.state === 'swat'){ swat(); return; }
  if (cat.state === 'held' || G.lever) return;
  G.lever = true; G.playedThisThrow = true; G.playing = true; G.lcd = 'DECODE'; S3.setLCD('DECODE'); Sfx.clack(); Sfx.chirp();
  const n = throwNo(), opt = n < 3 ? { rate: 1.5, pitch: 0.4 } : { rate: 1.0, pitch: 0.45 };
  setTimeout(() => {
    if (!G.lever) return;
    Voice.speak(LINES[n], opt, {
      onSentence: s => sub.set(s),
      onProgress: f => sub.progress(f),
      onDone: () => { G.playing = false; G.lcd = 'EOF'; S3.setLCD('EOF'); if (n === 3 && G.lever) startEnding(); else sub.hold(); }
    });
  }, 350);
}
function stopPlayback(){ G.playing = false; Voice.stop(); sub.cut(); G.lcd = 'OFF'; S3.setLCD('OFF'); }

// ---------- the Shannon climax
function startEnding(){
  G.phase = 'ending'; G.endT = 0; sub.hide(); G.ticking = true; G.tickAcc = 0.6;
  G.endSteps = [
    { at: 0.3, fn: () => { cat.state = 'freeze'; narrate('The recording ends.', 1.8); } },
    { at: 2.2, fn: () => narrate('The room is quiet. Too quiet.', 1.6) },
    { at: 2.8, fn: () => { cat.state = 'wiggle'; cat.t = 0; Sfx.rustle(); } },
    { at: 3.3, fn: () => Sfx.rustle() },
    { at: 3.9, fn: () => {
        cat.state = 'stand'; cat.head = 'side'; cat.eyes = 'slit'; cat.d = 0; cat.rot = 0; cat.flip = true; cat.puff = false;
        G.boxDrop = { x: cat.x + 0.45, z: cat.z - 0.35 }; cat.x -= 0.2; Sfx.thud(); puff(cat.x, 0, cat.z, 6, '#c9b89a', 2);
    } },
    { at: 4.6, fn: () => { S3.lookAtPoint(cat.x, 0.32, cat.z, 4.2, 9, 0.9); Sfx.catGrowl(); narrate('You know about Barnaby now.', 2.0) } },
    { at: 7.0, fn: () => narrate('The witness must be neutralized.', 2.4) },
    { at: 5.0, fn: () => { cat.eyes = 'dilate'; cat.d = 0.3; } },
    { at: 5.4, fn: () => { cat.d = 0.6; } },
    { at: 5.8, fn: () => { cat.d = 0.85; } },
    { at: 6.2, fn: () => { cat.d = 1; cat.eyes = 'black'; Sfx.catGrowl(); } },
    { at: 6.9, fn: () => { cat.head = 'quarter'; } },
    { at: 7.3, fn: () => { cat.head = 'front'; } },
    { at: 8.2, fn: () => { G.ticking = false; cat.puff = true; Sfx.demonYowl(); G.shake = 6; cap('*a demonic, low-frequency battle yowl*'); } },
    { at: 10.6, fn: () => { cap(''); S3.setView(S3.VIEWS.room, true); chargeStep(0); } },
    { at: 10.9, fn: () => chargeStep(1) },
    { at: 11.2, fn: () => chargeStep(2) },
    { at: 11.5, fn: () => impact() },
    { at: 11.95, fn: () => { stage.classList.add('fall'); Sfx.whistle(); G.cursorHidden = true; } },
    { at: 13.1, fn: () => { Sfx.crunch(); stage.style.visibility = 'hidden'; document.body.style.background = '#000'; G.shake = 0; } },
    { at: 13.6, fn: () => { G.staticOn = true; stEl.style.display = 'block'; Sfx.staticOn(); } },
    { at: 14.9, fn: () => { G.staticOn = false; stEl.style.display = 'none'; Sfx.staticOff(); blueEl.classList.add('on'); } },
    { at: 16.6, fn: () => Sfx.pulltab() },
    { at: 17.3, fn: () => { Sfx.catTiny(); mewEl.classList.add('on'); } },
    { at: 20.5, fn: () => shutdown() }
  ];
}
// State zero. The tab closes itself; if the browser refuses, the page walks off into a real 404.
function shutdown(){
  try { window.close(); } catch (e) {}
  setTimeout(() => {
    try { history.replaceState(null, '', '/decoder/stream/Kitchen_Baby_Purrs_03.wav'); } catch (e) {}
    document.open();
    document.write('<!doctype html><html><head><meta charset="utf-8"><title>404 Not Found</title></head>' +
      '<body style="margin:0;background:#fff;color:#000;font-family:Times New Roman,Times,serif"><center><h1 style="font-size:2em;font-weight:bold;margin:1em 0 .5em">404 Not Found</h1></center><hr><center>nginx/1.24.0</center></body></html>');
    document.close();
  }, 400);
}
function chargeStep(i){
  cat.hidden = true; Sfx.stomp(); G.shake = 5 + i * 4; if (i === 2) G.cursorHidden = true;
  const p = scr(cat.x, 0.35, cat.z), u = [0.45, 0.8, 1][i];
  G.face = { f: i, scale: [2.5, 6.5, 17][i], x: lerp(p.x, W / 2, u), y: lerp(p.y, H / 2, u) };
}
function impact(){
  G.flash = 1; Sfx.glass(); Sfx.thud(); G.shake = 14; G.face = { f: 1, scale: 19, x: W / 2, y: H / 2 };
  const cr = []; for (let i = 0; i < 16; i++){
    let a = Math.PI * 2 * i / 16 + rnd(-0.2, 0.2), x = W / 2 + rnd(-10, 10), y = H / 2 + rnd(-6, 6); const pts = [[x, y]];
    const n = 4 + (Math.random() * 4 | 0); for (let j = 0; j < n; j++){ const L = rnd(12, 34); x += Math.cos(a) * L; y += Math.sin(a) * L; a += rnd(-0.5, 0.5); pts.push([x, y]); }
    cr.push(pts);
  }
  G.cracks = cr;
}

// ---------- update
let last = performance.now(), lastFrame = 0, rafAlive = 0, frameDt = 1 / 60;
function frame(now){
  lastFrame = now;
  const dt = Math.min(0.05, (now - last) / 1000); last = now; frameDt = dt;
  if (G.phase !== 'title') update(dt);
  render(); if (G.staticOn) drawStatic();
}
function loop(now){ rafAlive = now; frame(now); requestAnimationFrame(loop); }
setInterval(() => { const n = performance.now(); if (n - rafAlive > 250 && n - lastFrame >= 15) frame(n); }, 8); // rAF fallback for throttled webviews, still ~60 fps

function update(dt){
  if (G.paused) return;
  G.time += dt; cat.t += dt; G.idle += dt;
  if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 12);
  if (G.flash > 0) G.flash = Math.max(0, G.flash - dt * 1.2);
  if (mouse.fT >= 0){
    mouse.fT += dt; const t = mouse.fT;
    if (t < 0.35){ mouse.fx = mouse.fvx * t * 60; mouse.fy = mouse.fvy * t * 60 + 260 * t * t; }
    else if (t < 0.6){ const u = (t - 0.35) / 0.25; mouse.fx = lerp(mouse.fvx * 21, 0, u); mouse.fy = lerp(mouse.fvy * 21 + 31.85, 0, u); }
    else { mouse.fT = -1; mouse.fx = mouse.fy = 0; }
  }
  const k = dt * 60;
  for (const p of parts){
    p.x += p.vx * k; p.y += p.vy * k; p.vy += (p.g || 0) * k; p.life -= dt;
    if (p.type === 'sock'){ p.rot += p.vr * k; if (p.y > p.floor){ p.y = p.floor; p.vy = 0; p.vx *= 0.7; p.vr = 0; } }
  }
  for (let i = parts.length - 1; i >= 0; i--) if (parts[i].life <= 0) parts.splice(i, 1);
  for (const f of floats){ f.y -= 0.4 * k; f.life -= dt; }
  for (let i = floats.length - 1; i >= 0; i--) if (floats[i].life <= 0) floats.splice(i, 1);
  if (G.ticking){ G.tickAcc += dt; if (G.tickAcc >= 1){ G.tickAcc -= 1; Sfx.tick(); } }
  if (G.phase === 'intro'){ updateIntro(dt); return; }
  if (G.phase === 'ending'){
    G.endT += dt;
    for (const s of G.endSteps) if (!s.done && G.endT >= s.at){ s.done = true; s.fn(); }
    if (cat.state === 'wiggle'){ cat.rot = Math.sin(cat.t * 40) * 0.2; }
    return;
  }
  updateCat(dt);
}
function updateCat(dt){
  const n = throwNo();
  // the cat watches your cursor; hovering the lever provokes it
  if (cat.state === 'sit' && !nudged && G.idle > 9){ nudged = true; narrate('The cat can wait longer than you can.'); }
  if (cat.state === 'sit'){
    const p = scr(cat.x, cat.y + 0.3, cat.z); cat.look = mouse.x < p.x - 20 ? -1 : mouse.x > p.x + 20 ? 1 : 0;
    G.hoverLever = leverHit(mouse) ? G.hoverLever + dt : 0;
    if (G.hoverLever > 0.4){ G.hoverLever = -1.5; swat(); }
  }
  switch (cat.state){
    case 'held': {
      cat.z += (FLOOR_Z - cat.z) * Math.min(1, dt * 8);
      const w = S3.unprojectToPlaneZ(mouse.x, mouse.y, cat.z);
      if (w){ cat.x = clamp(w.x, -WALL_X, WALL_X); cat.y = clamp(w.y - 0.44, -0.1, CEIL_Y); }
      if (Math.floor(cat.t / 1.3) !== Math.floor((cat.t - dt) / 1.3)) Sfx.catMrp();
      break;
    }
    case 'swat': if (cat.t > 0.3){ cat.state = 'sit'; } break;
    case 'fly': {
      cat.vy -= GRAV * dt; cat.x += cat.vx * dt; cat.y += cat.vy * dt; cat.rot += cat.spin * dt;
      if (cat.x < -WALL_X){ cat.x = -WALL_X; cat.vx = -cat.vx * 0.6; Sfx.thud(); }
      if (cat.x > WALL_X){ cat.x = WALL_X; cat.vx = -cat.vx * 0.6; Sfx.thud(); }
      if (cat.y > CEIL_Y){ cat.y = CEIL_Y; cat.vy = -cat.vy * 0.5; Sfx.thud(); }
      if (cat.y <= 0 && cat.vy < 0) land();
      break;
    }
    case 'roll':
      cat.x = clamp(cat.x + cat.dir * 1.8 * dt, -WALL_X, WALL_X); cat.rot += cat.dir * 14 * dt;
      if (cat.t > 0.45){ cat.rot = 0; startBurnout(); }
      break;
    case 'burnout':
      cat.f = Math.floor(G.time * 20) % 2;
      if (Math.random() < 0.5) puff(cat.x + (cat.flip ? 0.3 : -0.3), 0, cat.z, 1, '#d8c9a8', 1.5);
      if (cat.t > 0.5) startSprint();
      break;
    case 'sprint': {
      const sp = n === 1 ? 3.0 : n === 2 ? 3.5 : 2.9;
      cat.f = Math.floor(G.time * 12) % 2;
      const d = DESK_EDGE_X - cat.x;
      if (Math.abs(d) <= sp * dt){ cat.x = DESK_EDGE_X; cat.t = 0; cat.flip = false; if (n === 2){ cat.state = 'kick'; Sfx.catYowl(); float(cat.x, 0.7, cat.z, 'HYAAA', '#ffe66b', 0.7); } else { cat.state = 'slide'; Sfx.sparks(); } }
      else { cat.x += Math.sign(d) * sp * dt; if (Math.random() < 0.3) puff(cat.x - Math.sign(d) * 0.25, 0, cat.z, 1, '#d8c9a8', 1); }
      break;
    }
    case 'slide': {
      const u = Math.min(1, cat.t / 0.42);
      cat.x = lerp(DESK_EDGE_X, CAT_SIT.x - 0.1, u); cat.z = lerp(FLOOR_Z, DESK_Z, Math.min(1, u * 2.2)); cat.y = cat.t < 0.1 ? lerp(0, DESK_Y + 0.25, cat.t / 0.1) : cat.t < 0.2 ? lerp(DESK_Y + 0.25, DESK_Y, (cat.t - 0.1) / 0.1) : DESK_Y;
      if (u > 0.3 && Math.random() < 0.6) sparks(cat.x - 0.3, cat.y, cat.z);
      if (u >= 1) slap();
      break;
    }
    case 'kick': {
      const u = Math.min(1, cat.t / 0.45);
      cat.x = lerp(DESK_EDGE_X, CAT_SIT.x + 0.25, u); cat.z = lerp(FLOOR_Z, DESK_Z, u); cat.y = lerp(0, DESK_Y, u) + 0.9 * Math.sin(Math.PI * u); cat.rot = -0.35 + 0.35 * u;
      if (u >= 1) slap();
      break;
    }
    case 'skid': {
      cat.x += cat.dir * 3 * dt;
      if (Math.random() < 0.6) puff(cat.x - cat.dir * 0.25, 0, cat.z, 1, '#d8c9a8', 1.5);
      if (Math.abs(cat.x - BOX.x) < 0.1 || Math.sign(BOX.x - cat.x) !== cat.dir){
        cat.x = BOX.x; cat.state = 'tumble'; cat.t = 0; cat.rot = 0; cat.dir = 1; G.boxTaken = true;
        Sfx.rustle(); Sfx.thud(); Sfx.catAngry(); flySocks(cat.x, 0.2, cat.z); float(cat.x, 0.8, cat.z, 'WIPEOUT!', '#ff6b6b', 1.0); G.shake = 3;
        narrate('The packaging. Slippery. Prime-grade.', 1.6);
      }
      break;
    }
    case 'tumble':
      cat.x += cat.dir * 0.8 * dt; cat.rot += cat.dir * 18 * dt; cat.f = Math.floor(G.time * 10) % 2;
      if (Math.floor(cat.t / 0.25) !== Math.floor((cat.t - dt) / 0.25)){ Sfx.thud(); puff(cat.x, 0, cat.z, 4, '#c9b89a', 2); }
      if (cat.t > 1.0){ cat.state = 'stuck'; cat.t = 0; cat.rot = 0; Sfx.rustle(); narrate('Stuck. Big box, small cat. You have maybe five seconds.', 2.4); }
      break;
    case 'stuck':
      cat.f = Math.floor(G.time * 8) % 2;
      if (Math.floor(cat.t / 0.7) !== Math.floor((cat.t - dt) / 0.7)){ Sfx.rustle(); if (Math.random() < 0.5) Sfx.catMrp(); }
      if (!G.lever && cat.t > 5.5){ cat.state = 'wiggle'; cat.t = 0; narrate('It got out. Of course it got out.'); }
      break;
    case 'wiggle':
      cat.rot = Math.sin(cat.t * 40) * 0.2;
      if (cat.t > 0.8){ G.boxTaken = false; G.boxDrop = null; cat.rot = 0; Sfx.rustle(); float(cat.x, 0.7, cat.z, 'POP', '#fff', 0.6); startSprint(); }
      break;
  }
}

// ---------- render
function catPose(){
  let pose = 'sit', o = {}, flip = cat.flip, rot = cat.rot;
  switch (cat.state){
    case 'sit': o = { glare: cat.glare, pant: cat.pant, look: cat.look }; break;
    case 'swat': o = { swat: 1, glare: true }; break;
    case 'held': pose = 'held'; flip = false; rot = Math.sin(G.time * 6) * 0.08; break;
    case 'fly': case 'roll': pose = 'fly'; break;
    case 'burnout': case 'sprint': case 'introWalk': pose = 'run'; o = { f: cat.f }; break;
    case 'introHop': pose = 'run'; o = { f: 0 }; break;
    case 'slide': pose = 'slide'; break;
    case 'kick': pose = 'kick'; break;
    case 'skid': pose = 'skid'; rot = cat.flip ? 0.25 : -0.25; break;
    case 'tumble': case 'stuck': case 'wiggle': pose = 'stuck'; o = { f: cat.f }; break;
    case 'freeze': pose = 'stuck'; o = { f: 0 }; break;
    case 'stand': pose = 'stand'; o = { eyes: cat.eyes, d: cat.d, head: cat.head, puff: cat.puff }; break;
  }
  return { pose, o, flip, rot };
}
const onDesk = () => cat.state === 'sit' || cat.state === 'swat' || cat.state === 'slide' || cat.state === 'kick' || cat.state === 'introHop';
function render(){
  // 3D
  const kitchen = G.phase === 'intro' && intro.scene === 'kitchen';
  if (kitchen) S3.setCat({ pose: 'sit', o: { tuck: true, eyes: 'shut', peek: intro.peek }, flip: true, x: 0.4, y: 0.9, z: -1.2, ground: 0.9 });
  else { const cp = catPose(); const ground = onDesk() ? DESK_Y : cat.state === 'held' ? null : 0; S3.setCat({ pose: cp.pose, o: cp.o, flip: cp.flip, rot: cp.rot, x: cat.x, y: cat.y, z: cat.z, hidden: cat.hidden, ground }); }
  S3.update(frameDt, { lever: G.lever, blink: G.phase === 'play' && !onDesk() && cat.state !== 'held' && !G.lever, time: G.time, boxTaken: G.boxTaken, boxFly: G.boxFly, BOX, boxDrop: G.boxDrop,
                      showDecoder: G.showDecoder, decoderDY: G.decoderDY, shipBox: G.shipBox, phoneX: G.phoneX, cableP: G.cableP, playing: G.playing });
  S3.render();
  // 2D overlay
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H); ctx.imageSmoothingEnabled = false;
  const sx = Math.round((Math.random() * 2 - 1) * G.shake), sy = Math.round((Math.random() * 2 - 1) * G.shake);
  ctx.translate(sx, sy);
  if (G.shake > 0) document.getElementById('gl').style.transform = 'translate(' + sx * 2 + 'px,' + sy * 2 + 'px)'; else document.getElementById('gl').style.transform = '';
  if (kitchen){ drawKitchenPhone(intro.t); drawFloats(); return; }
  drawParticles(); drawFloats(); drawGuidance();
  if (G.face) CatArt.draw(ctx, 'face', { f: G.face.f }, G.face.x, G.face.y, { scale: G.face.scale });
  if (G.cracks) drawCracks();
  if (G.flash > 0){ ctx.fillStyle = 'rgba(255,255,255,' + G.flash + ')'; ctx.fillRect(-20, -20, W + 40, H + 40); }
  drawCursor();
}
// wordless nudges: a bobbing hand over the cat until the first grab, an arrow over the lever while the cat is away
function drawGuidance(){
  if (G.phase !== 'play') return;
  const bob = Math.round(Math.sin(G.time * 5) * 2);
  if (!G.grabbedOnce && cat.state === 'sit' && G.idle > 2.5){ const p = scr(cat.x, cat.y + 0.75, cat.z); ctx.drawImage(CURSOR.open, Math.round(p.x) - 5, Math.round(p.y) + bob); }
  if (!onDesk() && cat.state !== 'held' && !G.lever){
    const p = scr(LEVER_TOP.x, LEVER_TOP.y, LEVER_TOP.z), x = Math.round(p.x), y = Math.round(p.y) + bob;
    ctx.fillStyle = '#000'; ctx.fillRect(x - 2, y - 9, 6, 6); ctx.fillRect(x - 4, y - 3, 10, 2); ctx.fillRect(x - 2, y - 1, 6, 2); ctx.fillRect(x, y + 1, 2, 2);
    ctx.fillStyle = '#3ddc63'; ctx.fillRect(x - 1, y - 8, 4, 5); ctx.fillRect(x - 3, y - 3, 8, 1); ctx.fillRect(x - 1, y - 2, 4, 2); ctx.fillRect(x, y, 2, 1);
  }
}
function drawKitchenPhone(t){
  ctx.fillStyle = '#e0b090'; ctx.fillRect(34, 232 - Math.min(40, t * 30), 118, 60);
  ctx.fillStyle = '#121218'; ctx.fillRect(40, 124, 92, 112); ctx.fillStyle = '#1b1b24'; ctx.fillRect(42, 126, 88, 108); ctx.fillStyle = '#0c1a12'; ctx.fillRect(46, 132, 80, 96);
  ctx.fillStyle = Math.floor(t * 2) % 2 ? '#ff3b3b' : '#7a1c1c'; ctx.fillRect(52, 140, 5, 5); T('REC', 62, 146, '#ff6b6b');
  const sec = Math.min(99, Math.floor(t) + 7); T('00:' + String(sec).padStart(2, '0'), 52, 162, '#fff');
  for (let i = 0; i < 20; i++){ const h = 2 + Math.round(3 + 3 * Math.sin(i * 1.3 + t * 9) * Math.cos(i * 0.4 + t * 3)); ctx.fillStyle = '#3fbf6f'; ctx.fillRect(52 + i * 3, 190 - Math.floor(h / 2), 2, h); }
  T('Purrs_03', 52, 216, '#5a8a6a');
  ctx.fillStyle = '#e0b090'; ctx.fillRect(124, 176, 12, 34); ctx.fillStyle = '#f0c8a8'; ctx.fillRect(126, 178, 8, 4);
}
function drawParticles(){
  for (const p of parts){
    if (p.type === 'sock'){ drawSock(p.x, p.y, p.rot); continue; }
    ctx.globalAlpha = clamp(p.life / p.max, 0, 1); ctx.fillStyle = p.color;
    const r = Math.max(1, Math.round(p.r)); ctx.fillRect(Math.round(p.x - r / 2), Math.round(p.y - r / 2), r, r);
  }
  ctx.globalAlpha = 1;
}
function drawFloats(){
  for (const f of floats){
    ctx.globalAlpha = clamp(f.life / f.max * 1.5, 0, 1);
    T(f.text, Math.round(f.x) + 1, Math.round(f.y) + 1, '#000', 'center'); T(f.text, Math.round(f.x), Math.round(f.y), f.color, 'center');
  }
  ctx.globalAlpha = 1;
}
function drawCracks(){
  ctx.lineWidth = 1;
  for (const pts of G.cracks){
    ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0] + 1, p[1] + 1) : ctx.moveTo(p[0] + 1, p[1] + 1)); ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke();
  }
}
function drawCursor(){
  if (G.phase === 'title' || G.phase === 'intro' || G.cursorHidden) return;
  const x = Math.round(mouse.x + mouse.fx), y = Math.round(mouse.y + mouse.fy);
  if (mouse.grab) ctx.drawImage(CURSOR.fist, x - 5, y - 2);
  else if (cat.state === 'sit' && catHit(mouse)) ctx.drawImage(CURSOR.open, x - 5, y - 2);
  else ctx.drawImage(CURSOR.point, x - 2, y);
}
const stCtx = stEl.getContext('2d');
function drawStatic(){
  const img = stCtx.createImageData(192, 108), d = img.data;
  for (let i = 0; i < d.length; i += 4){ const v = Math.random() * 255 | 0; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
  stCtx.putImageData(img, 0, 0);
  const y = (G.time * 90) % 108 | 0; stCtx.fillStyle = 'rgba(0,0,0,.5)'; stCtx.fillRect(0, y, 192, 6);
}

S3.init(document.getElementById('gl'));
if (document.fonts) document.fonts.load(FONT).then(() => S3.refreshLabels()).catch(() => {});
window.__lc = { G, cat, intro, startEnding, pressLever, skipIntro, S3 };
requestAnimationFrame(loop);
})();
