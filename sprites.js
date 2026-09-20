// sprites.js — all pixel art is drawn in code (1 canvas px = 1 game px), then blitted
// with nearest-neighbour scaling. The cat is an orange tabby so the dilated black eyes read.
const CatArt = (() => {
  const P = {
    fur:'#e8913f', dark:'#b95f28', belly:'#fbe9d0', eye:'#a6f03a', pupil:'#0a0a12', nose:'#e5697c',
    ear:'#f6b6a6', mouth:'#5a1a22', teeth:'#ffffff', card:'#c99a5b', card2:'#a97a3e', tape:'#e2cf8a'
  };
  const S = 40, B = 34; // sprite canvas size, feet baseline
  const cv = document.createElement('canvas'); cv.width = S; cv.height = S;
  const g = cv.getContext('2d');
  const r = (x, y, w, h, c) => { g.fillStyle = c || P.fur; g.fillRect(x, y, w, h); };
  const blob = (x, y, w, h, c) => { r(x + 1, y, w - 2, h, c); r(x, y + 1, w, h - 2, c); };
  const limb = (x, y, dx, dy, n, c, t = 2) => { for (let i = 0; i < n; i++) r(x + dx * i, y + dy * i, t, t, c); };

  function eye(x, y, w, h, mode, d = 0, look = 0){
    if (mode === 'squint'){ r(x, y + 1, w, 1, P.pupil); return; }
    if (mode === 'shut'){ r(x, y + 1, w, 1, P.dark); return; }
    r(x, y, w, h, P.eye);
    let pw = mode === 'wide' ? 2 : 1;
    if (mode === 'dilate') pw = Math.round(1 + (w - 1) * d);
    if (mode === 'black') pw = w;
    const px = Math.max(x, Math.min(x + w - pw, x + Math.floor((w - pw) / 2) + look));
    r(px, y, pw, h, P.pupil);
  }
  function headSide(x, y, mode, mode2, look = 0){ // 13x11, facing right, 3/4 view
    r(x + 1, y - 4, 3, 6); r(x + 8, y - 4, 3, 6); r(x + 2, y - 3, 1, 3, P.ear); r(x + 9, y - 3, 1, 3, P.ear);
    blob(x, y, 13, 11);
    eye(x + 4, y + 3, 3, 3, mode, 0, look); eye(x + 9, y + 3, 3, 3, mode2 || mode, 0, look);
    r(x + 10, y + 7, 2, 1, P.nose); r(x + 9, y + 8, 1, 1, P.mouth); r(x + 12, y + 8, 1, 1, P.mouth);
  }
  function headFront(x, y, mode, d){ // 16x14 front view
    r(x, y - 5, 4, 7); r(x + 12, y - 5, 4, 7); r(x + 1, y - 4, 2, 3, P.ear); r(x + 13, y - 4, 2, 3, P.ear);
    blob(x, y, 16, 14);
    eye(x + 3, y + 5, 4, 4, mode, d); eye(x + 9, y + 5, 4, 4, mode, d);
    r(x + 7, y + 10, 2, 1, P.nose); r(x + 6, y + 11, 1, 1, P.mouth); r(x + 9, y + 11, 1, 1, P.mouth);
  }
  const stripes = (x, y) => { r(x, y, 3, 1, P.dark); r(x + 5, y, 3, 1, P.dark); r(x + 10, y, 3, 1, P.dark); };

  const poses = {
    sit(o){
      r(6, B - 10, 2, 6); r(4, B - 12, 4, 2); r(2, B - 14, 3, 2);          // curled tail
      blob(10, B - 16, 14, 16); r(16, B - 11, 6, 9, P.belly);
      r(11, B - 15, 3, 1, P.dark); r(11, B - 12, 2, 1, P.dark); r(12, B - 9, 2, 1, P.dark);
      headSide(17, B - 27, o.eyes || (o.glare ? 'squint' : 'slit'), o.peek ? 'slit' : undefined, o.look | 0);
      if (o.pant){ r(26, B - 18, 2, 2, P.nose); }                          // tongue out
      if (o.tuck){ r(20, B - 3, 9, 3); r(28, B - 3, 3, 3, P.dark); }        // paws tucked (purring loaf)
      else if (o.swat){ limb(24, B - 14, 1, -1, 6); r(30, B - 21, 5, 4); } // paw raised
      else { r(22, B - 4, 12, 3); r(33, B - 5, 6, 4); }                     // paw on the lever
      r(10, B - 2, 6, 2, P.dark);
    },
    held(o){ // dangling by the scruff; scruff point is (20,2)
      r(19, 0, 3, 3, P.dark);
      r(12, 0, 3, 4); r(25, 0, 3, 4);
      blob(12, 3, 16, 12);
      eye(15, 8, 3, 2, 'squint'); eye(22, 8, 3, 2, 'squint');
      r(19, 12, 2, 1, P.nose); r(18, 13, 1, 1, P.mouth); r(21, 13, 1, 1, P.mouth);
      blob(14, 15, 12, 16); r(17, 20, 6, 9, P.belly);
      r(11, 16, 3, 12); r(26, 16, 3, 12);
      r(15, 31, 3, 6); r(22, 31, 3, 6);
      r(9, 24, 2, 10);
    },
    fly(o){ // spread eagle, yowling
      blob(8, B - 24, 18, 10); r(12, B - 20, 8, 4, P.belly); stripes(9, B - 24);
      headSide(23, B - 31, 'wide'); r(31, B - 23, 4, 3, P.mouth);
      limb(24, B - 27, 1, -1, 4); limb(24, B - 15, 1, 1, 4); limb(8, B - 27, -1, -1, 4); limb(8, B - 15, -1, 1, 4);
      limb(6, B - 20, -1, 0, 6);
    },
    run(o){
      const f = o.f | 0, by = f ? 1 : 0;
      blob(8, B - 16 - by, 18, 10); r(12, B - 11 - by, 8, 4, P.belly); stripes(9, B - 16 - by);
      headSide(23, B - 24 - by, 'slit');
      if (!f){ r(24, B - 6, 3, 6); r(28, B - 6, 3, 4); r(8, B - 6, 3, 6); r(12, B - 6, 3, 4); }
      else { r(22, B - 6, 3, 4); r(27, B - 6, 3, 6); r(6, B - 6, 3, 4); r(11, B - 6, 3, 6); }
      limb(6, B - 14, -1, -1, 5);
    },
    slide(o){
      blob(6, B - 8, 22, 8); r(10, B - 4, 10, 3, P.belly); stripes(8, B - 8);
      headSide(24, B - 15, 'squint');
      r(30, B - 4, 8, 3); r(2, B - 4, 6, 3); r(0, B - 9, 6, 2);
    },
    kick(o){ // flying drop-kick: hind legs forward, head trailing
      blob(4, B - 20, 18, 10); r(8, B - 16, 8, 4, P.belly); stripes(5, B - 20);
      headSide(0, B - 30, 'wide'); r(8, B - 22, 4, 3, P.mouth);
      r(21, B - 19, 12, 3); r(21, B - 13, 12, 3); r(32, B - 20, 5, 4, P.dark); r(32, B - 14, 5, 4, P.dark);
      r(6, B - 11, 3, 4); r(11, B - 11, 3, 4);
      limb(3, B - 21, -1, -1, 4);
    },
    skid(o){ // front legs planted, leaning back
      blob(8, B - 16, 18, 10); r(12, B - 11, 8, 4, P.belly); stripes(9, B - 16);
      headSide(23, B - 26, 'wide'); r(31, B - 18, 4, 3, P.mouth);
      r(28, B - 8, 3, 8); r(24, B - 8, 3, 8); r(6, B - 6, 3, 6); r(10, B - 6, 3, 6);
      limb(6, B - 14, -1, -1, 5);
    },
    stuck(o){ // upside-down cat wedged in a cardboard box, legs kicking
      const f = o.f | 0, L = f ? [10, 7, 12, 5] : [7, 11, 6, 12];
      r(9, B - 14 - L[0], 3, L[0] + 2); r(15, B - 14 - L[1], 3, L[1] + 2); r(22, B - 14 - L[2], 3, L[2] + 2); r(28, B - 14 - L[3], 3, L[3] + 2);
      r(8, B - 16 - L[0], 5, 3, P.dark); r(14, B - 16 - L[1], 5, 3, P.dark); r(21, B - 16 - L[2], 5, 3, P.dark); r(27, B - 16 - L[3], 5, 3, P.dark);
      r(f ? 0 : 2, B - 6, 6, 2);
      r(6, B - 14, 28, 14, P.card); r(6, B - 14, 28, 1, P.card2); r(6, B - 14, 1, 14, P.card2); r(33, B - 14, 1, 14, P.card2);
      r(4, B - 16, 8, 3, P.card2); r(28, B - 16, 8, 3, P.card2);
      r(19, B - 14, 2, 14, P.tape);
      r(10, B - 6, 12, 1, P.dark); r(21, B - 7, 1, 1, P.dark); r(21, B - 5, 1, 1, P.dark);
    },
    stand(o){ // standing; head can be side / quarter / front; pupils dilate with o.d
      blob(6, B - 16, 22, 10); r(10, B - 12, 10, 4, P.belly); stripes(8, B - 16);
      r(8, B - 6, 3, 6); r(12, B - 6, 3, 6); r(20, B - 6, 3, 6); r(24, B - 6, 3, 6);
      if (o.puff){ r(1, B - 28, 5, 16); r(0, B - 30, 7, 4); r(2, B - 26, 1, 2, P.dark); r(4, B - 20, 1, 2, P.dark); }
      else limb(5, B - 14, -1, -1, 6);
      if (o.head === 'side') headSide(24, B - 26, o.eyes || 'slit');
      else if (o.head === 'quarter') headFront(17, B - 30, o.eyes || 'slit', o.d);
      else headFront(12, B - 30, o.eyes || 'slit', o.d);
    },
    face(o){ // the charge: giant front face, dead black eyes
      const f = o.f | 0;
      if (f === 2){ r(0, 4, 9, 8); r(31, 4, 9, 8); r(2, 6, 4, 4, P.ear); r(34, 6, 4, 4, P.ear); }
      else { r(3, 0, 9, 10); r(28, 0, 9, 10); r(5, 2, 4, 6, P.ear); r(31, 2, 4, 6, P.ear); }
      blob(3, 7, 34, 30);
      r(6, 12, 3, 1, P.dark); r(31, 12, 3, 1, P.dark); r(17, 9, 6, 1, P.dark); r(18, 11, 4, 1, P.dark);
      if (f === 1){ r(8, 14, 10, 10, P.pupil); r(22, 14, 10, 10, P.pupil); }
      else { r(9, 15, 8, 8, P.pupil); r(23, 15, 8, 8, P.pupil); }
      r(18, 25, 4, 2, P.nose);
      const mh = f ? 9 : 6; r(13, 28, 14, mh, P.mouth);
      r(14, 28, 2, 3, P.teeth); r(24, 28, 2, 3, P.teeth); r(18, 28, 1, 2, P.teeth); r(21, 28, 1, 2, P.teeth);
      r(14, 28 + mh - 2, 2, 2, P.teeth); r(24, 28 + mh - 2, 2, 2, P.teeth);
      r(0, 26, 8, 1, P.belly); r(0, 30, 8, 1, P.belly); r(32, 26, 8, 1, P.belly); r(32, 30, 8, 1, P.belly);
    }
  };

  // draw pose so that its pivot lands on (x,y). Pivot = (20, B-10) i.e. mid-body; 'face' pivots at centre.
  function draw(ctx, pose, o, x, y, opt = {}){
    g.clearRect(0, 0, S, S); poses[pose](o || {});
    const pv = pose === 'face' ? [20, 20] : [20, B - 10];
    ctx.save(); ctx.translate(Math.round(x), Math.round(y));
    if (opt.rot) ctx.rotate(opt.rot);
    const sc = opt.scale || 1; ctx.scale((opt.flip ? -1 : 1) * sc, sc);
    if (opt.alpha != null) ctx.globalAlpha = opt.alpha;
    ctx.drawImage(cv, -pv[0], -pv[1]); ctx.restore();
  }
  // render a pose into another 40x40 context (used as the 3D billboard texture)
  function drawTo(ctx, pose, o, flip){
    g.clearRect(0, 0, S, S); poses[pose](o || {});
    ctx.clearRect(0, 0, S, S); ctx.save(); if (flip){ ctx.translate(S, 0); ctx.scale(-1, 1); } ctx.drawImage(cv, 0, 0); ctx.restore();
  }
  return { draw, drawTo, P, B };
})();

function spriteFromRows(rows, map){
  const h = rows.length, w = rows[0].length, c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  rows.forEach((row, y) => { for (let x = 0; x < w; x++){ const ch = row[x]; if (map[ch]){ g.fillStyle = map[ch]; g.fillRect(x, y, 1, 1); } } });
  return c;
}
const CURSOR = {
  point: spriteFromRows([
    '..kk......', '.kwwk.....', '.kwwkkk...', '.kwwkwwkk.', '.kwwkwwkwk', 'kkwwwwwwwk',
    'kwkwwwwwwk', '.kwwwwwwk.', '..kwwwwwk.', '...kwwwwk.', '...kkkkkk.'], { k:'#111', w:'#fff' }),
  open: spriteFromRows([
    '..k.k.k...', '.kwkwkwkk.', '.kwwwwwkwk', 'kkwwwwwwwk', 'kwkwwwwwwk', '.kwwwwwwk.', '..kwwwwk..', '...kkkk...'], { k:'#111', w:'#fff' }),
  fist: spriteFromRows([
    '...kkkkk..', '..kwwwwwk.', '.kwwwwwwwk', 'kwkwkwkwwk', 'kwwwwwwwwk', '.kwwwwwwk.', '..kkkkkk..'], { k:'#111', w:'#fff' })
};
const TUX = spriteFromRows([
  '..kkkk..', '.kkkkkk.', '.kwkkwk.', '.kkoook.', 'kkwwwwkk', 'kkwwwwkk', 'kkwwwwkk', '.kwwwwk.', '.kkkkkk.', '.oo..oo.'
], { k:'#111', w:'#fff', o:'#f5a623' });
