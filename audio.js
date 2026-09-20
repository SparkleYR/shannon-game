// audio.js — every sound effect is synthesized with Web Audio (no audio files).
// The cat's voice comes from the browser's SpeechSynthesis.
const Sfx = (() => {
  let ac, master, noiseBuf, staticSrc;
  function init(){
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain(); master.gain.value = 0.7; master.connect(ac.destination);
    const n = ac.sampleRate * 2, b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    noiseBuf = b;
  }
  function envGain(t0, a, peak, dur){
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    g.connect(master); return g;
  }
  function distCurve(k){ const n = 256, c = new Float32Array(n); for (let i = 0; i < n; i++){ const x = i * 2 / n - 1; c[i] = (1 + k) * x / (1 + k * Math.abs(x)); } return c; }
  function tone(o){
    if (!ac) return; const t0 = ac.currentTime + (o.t || 0), dur = o.dur || 0.2;
    const osc = ac.createOscillator(); osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(o.f || 440, t0);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t0 + dur);
    let node = osc;
    if (o.vib){ const l = ac.createOscillator(); l.frequency.value = o.vibF || 6; const lg = ac.createGain(); lg.gain.value = o.vib; l.connect(lg); lg.connect(osc.frequency); l.start(t0); l.stop(t0 + dur + 0.1); }
    if (o.dist){ const ws = ac.createWaveShaper(); ws.curve = distCurve(o.dist); node.connect(ws); node = ws; }
    if (o.lp){ const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; node.connect(f); node = f; }
    node.connect(envGain(t0, o.a || 0.005, o.gain || 0.2, dur));
    osc.start(t0); osc.stop(t0 + dur + 0.15);
  }
  function noise(o){
    if (!ac) return; const t0 = ac.currentTime + (o.t || 0), dur = o.dur || 0.2;
    const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ac.createBiquadFilter(); f.type = o.type || 'bandpass'; f.frequency.setValueAtTime(o.f || 1000, t0); f.Q.value = o.q || 1;
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t0 + dur);
    s.connect(f); f.connect(envGain(t0, o.a || 0.005, o.gain || 0.2, dur));
    s.start(t0); s.stop(t0 + dur + 0.1);
  }
  // ---- real cat recordings (Wikimedia Commons, CC0 / public domain / CC BY-SA), decoded into buffers.
  // Every caller falls back to the synth version when a file has not loaded.
  const CAT_URLS = {
    meow: 'https://upload.wikimedia.org/wikipedia/commons/c/c0/Maullido_de_gata_hembra_joven.ogg',   // CC0
    plead: 'https://upload.wikimedia.org/wikipedia/commons/6/6b/Meow_of_a_pleading_cat.oga',          // public domain
    impatient: 'https://upload.wikimedia.org/wikipedia/commons/c/c0/GettingOutImpatient.ogg',        // public domain
    hiss: 'https://upload.wikimedia.org/wikipedia/commons/5/56/Cat_hissing_-_Zabuhailo.wav',         // CC0
    purr: 'https://upload.wikimedia.org/wikipedia/commons/d/db/Purring_cat.oga'                      // public domain
  };
  const bufs = {}; let loading = null, voiceCur = null;
  function loadCats(){
    if (loading) return loading;
    const dec = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, 1, 44100); // decodes without a user gesture
    loading = Promise.all(Object.entries(CAT_URLS).map(async ([k, url]) => {
      try { const ab = await (await fetch(url, { mode: 'cors' })).arrayBuffer(); const buf = await dec.decodeAudioData(ab); buf.bestOffset = loudest(buf); bufs[k] = buf; }
      catch (e) { bufs[k] = null; }
    }));
    return loading;
  }
  // where the clip is loudest (start of the first real meow), so short cuts don't land on silence
  function loudest(buf){
    const d = buf.getChannelData(0), win = Math.floor(buf.sampleRate * 0.15); let best = 0, bestAt = 0;
    for (let i = 0; i + win < d.length; i += win >> 1){ let e = 0; for (let j = i; j < i + win; j += 4) e += d[j] * d[j]; if (e > best){ best = e; bestAt = i; } }
    return Math.max(0, bestAt / buf.sampleRate - 0.06);
  }
  // one voice: starting a new cat sound fades the previous one, and every clip is capped short
  function cat(name, o = {}){
    const b = bufs[name]; if (!ac || !b) return null;
    if (!o.loop && !o.layer && voiceCur){ voiceCur.stop(); voiceCur = null; }
    const s = ac.createBufferSource(); s.buffer = b; s.playbackRate.value = o.rate || 1; s.loop = !!o.loop;
    const t0 = ac.currentTime + (o.t || 0), gain = o.gain || 0.6, a = o.a || 0.02;
    const offset = o.offset != null ? o.offset : (b.bestOffset || 0);
    const dur = o.loop ? 0 : Math.min(o.dur || 99, (b.duration - offset) / (o.rate || 1));
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(gain, t0 + a);
    if (!o.loop){ g.gain.setValueAtTime(gain, t0 + Math.max(a, dur - 0.1)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); }
    s.connect(g); g.connect(master); s.start(t0, o.loop ? 0 : offset); if (!o.loop) s.stop(t0 + dur + 0.05);
    const h = { stop(){ try { g.gain.cancelScheduledValues(ac.currentTime); g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), ac.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.12); s.stop(ac.currentTime + 0.15); } catch (e) {} } };
    if (!o.loop && !o.layer) voiceCur = h;
    return h;
  }
  let purrHandle = null, wantPurr = false;
  return {
    init, ok: () => !!ac, loadCats, cat, info: () => Object.fromEntries(Object.entries(bufs).map(([k, b]) => [k, b ? [+b.duration.toFixed(2), +b.bestOffset.toFixed(2)] : null])),
    // cat voice (real recordings, synth fallback)
    catMeow(){ cat('meow', { gain: 0.6, dur: 0.9 }) || tone({type:'sawtooth', f:300, f2:600, dur:0.18, gain:0.08, lp:1800}); },
    catMrp(){ cat('plead', { rate: 1.3, gain: 0.45, dur: 0.45 }) || tone({type:'sawtooth', f:300, f2:600, dur:0.18, gain:0.08, lp:1800}); },
    catYowl(){ const h = cat('impatient', { rate: 0.85, gain: 0.8, dur: 1.1 }); tone({type:'sawtooth', f:520, f2:240, dur:0.55, gain: h ? 0.05 : 0.12, vib:25, vibF:28, dist:3, lp:2500}); },
    catHiss(){ cat('hiss', { rate: 1.15, gain: 0.9, offset: 0.0, dur: 0.7 }) || noise({type:'highpass', f:2500, dur:0.4, gain:0.12, a:0.02}); },
    catGrowl(){ cat('hiss', { rate: 0.45, gain: 0.5, offset: 0.0, dur: 1.3, a: 0.3 }); },
    catAngry(){ cat('impatient', { rate: 1.2, gain: 0.7, dur: 0.6 }) || tone({type:'sawtooth', f:400, f2:250, dur:0.3, gain:0.1, lp:2000}); },
    catTiny(){ cat('plead', { rate: 1.6, gain: 0.35, dur: 0.45 }) || this.mew(); },
    catStop(){ if (voiceCur){ voiceCur.stop(); voiceCur = null; } },
    purrStart(){ wantPurr = true; if (purrHandle) return; purrHandle = cat('purr', { loop: true, gain: 0.5, a: 0.6 }); if (!purrHandle && loading) loading.then(() => { if (wantPurr && !purrHandle) purrHandle = cat('purr', { loop: true, gain: 0.5, a: 0.6 }); }); },
    purrStop(){ wantPurr = false; if (purrHandle){ purrHandle.stop(); purrHandle = null; } },
    chirp(){ tone({type:'square', f:900, f2:1800, dur:0.09, gain:0.12}); tone({type:'square', f:1400, f2:2400, dur:0.07, gain:0.08, t:0.1}); },
    yowl(){ tone({type:'sawtooth', f:520, f2:240, dur:0.55, gain:0.12, vib:25, vibF:28, dist:3, lp:2500}); noise({f:1800, f2:900, q:2, dur:0.5, gain:0.04}); },
    mrp(){ tone({type:'sawtooth', f:300, f2:600, dur:0.18, gain:0.08, lp:1800}); },
    hiss(){ noise({type:'highpass', f:2500, dur:0.4, gain:0.12, a:0.02}); },
    screech(){ for (let i = 0; i < 4; i++) noise({type:'bandpass', f:2600 + i * 300, f2:4200, q:6, dur:0.12, gain:0.12, t:i * 0.11}); },
    whoosh(){ noise({type:'bandpass', f:1200, f2:300, q:1, dur:0.3, gain:0.1, a:0.05}); },
    thud(){ tone({type:'sine', f:110, f2:35, dur:0.16, gain:0.5}); noise({type:'lowpass', f:500, dur:0.08, gain:0.25}); },
    clack(){ noise({type:'lowpass', f:2500, dur:0.03, gain:0.5}); tone({type:'square', f:220, f2:90, dur:0.07, gain:0.35}); tone({type:'sine', f:80, dur:0.12, gain:0.3, t:0.01}); },
    boing(){ tone({type:'triangle', f:180, f2:520, dur:0.22, gain:0.14}); },
    rustle(){ for (let i = 0; i < 3; i++) noise({type:'bandpass', f:2000 + Math.random() * 1500, q:3, dur:0.08, gain:0.1, t:i * 0.06}); },
    tick(){ noise({type:'highpass', f:5000, dur:0.012, gain:0.25}); tone({type:'square', f:1800, dur:0.012, gain:0.05}); },
    stomp(){ tone({type:'sine', f:70, f2:25, dur:0.3, gain:0.9}); noise({type:'lowpass', f:250, dur:0.15, gain:0.4}); },
    demonYowl(){
      cat('hiss', { rate: 0.3, gain: 0.9, offset: 0.0, dur: 2.3, a: 0.2 }); cat('impatient', { rate: 0.4, gain: 0.7, t: 0.3, dur: 2.0, layer: true });
      tone({type:'sawtooth', f:62, dur:2.3, gain:0.5, a:0.15, vib:9, vibF:5.5, dist:12, lp:520});
      tone({type:'sawtooth', f:93, f2:70, dur:2.3, gain:0.3, a:0.2, vib:12, vibF:7, dist:12, lp:700});
      tone({type:'square', f:31, dur:2.3, gain:0.35, a:0.3, lp:200});
      noise({type:'lowpass', f:400, dur:2.2, gain:0.15, a:0.3});
    },
    glass(){ noise({type:'highpass', f:5500, dur:0.35, gain:0.4}); for (let i = 0; i < 8; i++) tone({type:'sine', f:2500 + Math.random() * 4500, dur:0.06 + Math.random() * 0.1, gain:0.08, t:Math.random() * 0.25}); },
    whistle(){ tone({type:'sine', f:2200, f2:500, dur:1.05, gain:0.12, a:0.05}); },
    crunch(){
      tone({type:'sine', f:60, f2:18, dur:0.7, gain:1.0}); noise({type:'lowpass', f:350, dur:0.55, gain:0.9});
      noise({type:'highpass', f:4000, dur:0.25, gain:0.35, t:0.02});
      for (let i = 0; i < 6; i++) tone({type:'sine', f:1500 + Math.random() * 5000, dur:0.05, gain:0.06, t:0.05 + Math.random() * 0.4});
    },
    staticOn(){ if (!ac || staticSrc) return; const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true; const g = ac.createGain(); g.gain.value = 0.18; s.connect(g); g.connect(master); s.start(); staticSrc = s; },
    staticOff(){ if (staticSrc){ staticSrc.stop(); staticSrc = null; } },
    pulltab(){ tone({type:'square', f:2600, f2:1200, dur:0.02, gain:0.25}); tone({type:'triangle', f:1400, f2:900, dur:0.06, gain:0.12, t:0.02}); noise({type:'highpass', f:6000, dur:0.18, gain:0.08, t:0.03, a:0.01}); },
    mew(){ tone({type:'triangle', f:700, f2:1300, dur:0.18, gain:0.12, a:0.02}); tone({type:'triangle', f:1300, f2:800, dur:0.22, gain:0.12, t:0.17, a:0.01}); },
    sparks(){ noise({type:'highpass', f:3000, dur:0.3, gain:0.06}); }
  };
})();

// Voice — gruff cat monologue via SpeechSynthesis, with word-level subtitle progress.
const Voice = (() => {
  const hasSS = 'speechSynthesis' in window;
  let voice = null, cancelled = false, cur = null;
  function pick(){
    if (!hasSS) return null; const vs = speechSynthesis.getVoices(); if (!vs.length) return null;
    const pref = ['Google UK English Male', 'Microsoft David', 'Microsoft Mark', 'Microsoft George', 'Daniel', 'Alex', 'Fred', 'Google US English'];
    for (const p of pref){ const v = vs.find(v => v.name.startsWith(p)); if (v) return v; }
    return vs.find(v => /^en/i.test(v.lang) && /male/i.test(v.name)) || vs.find(v => /^en/i.test(v.lang)) || vs[0];
  }
  function warm(){ if (!hasSS) return; speechSynthesis.getVoices(); speechSynthesis.onvoiceschanged = () => { voice = pick(); }; voice = pick(); }
  function fallback(ln, opt, cb, done, words){
    const est = words / (2.6 * (opt.rate || 1)) * 1000, t0 = performance.now();
    const iv = setInterval(() => {
      if (cancelled){ clearInterval(iv); return; }
      const f = Math.min(1, (performance.now() - t0) / est); cb.onProgress && cb.onProgress(f);
      if (f >= 1){ clearInterval(iv); setTimeout(done, 150); }
    }, 60);
  }
  function one(ln, opt, cb, done){
    cb.onSentence && cb.onSentence(ln.show);
    const words = ln.say.split(/\s+/).filter(Boolean).length;
    if (!hasSS){ fallback(ln, opt, cb, done, words); return; }
    const u = new SpeechSynthesisUtterance(ln.say); cur = u;
    if (!voice) voice = pick(); if (voice) u.voice = voice;
    u.rate = opt.rate || 1; u.pitch = opt.pitch || 0.5; u.volume = 1;
    let gotB = false, started = false, finished = false;
    const est = words / (2.6 * u.rate) * 1000, t0 = performance.now();
    const iv = setInterval(() => { if (gotB || finished) return; cb.onProgress && cb.onProgress(Math.min(1, (performance.now() - t0) / est)); }, 80);
    const fin = () => { if (finished) return; finished = true; clearInterval(iv); if (!cancelled){ cb.onProgress && cb.onProgress(1); setTimeout(done, 120); } };
    u.onstart = () => { started = true; };
    u.onboundary = e => { gotB = true; const w = ln.say.slice(0, e.charIndex).split(/\s+/).filter(Boolean).length; cb.onProgress && cb.onProgress(w / words); };
    u.onend = fin; u.onerror = fin;
    // if no voice ever starts (no voices installed), fall back to timed subtitles
    setTimeout(() => { if (!started && !finished && !cancelled){ finished = true; clearInterval(iv); speechSynthesis.cancel(); fallback(ln, opt, cb, done, words); } }, 2500);
    speechSynthesis.speak(u);
  }
  function speak(lines, opt, cb){
    cancelled = false; let i = 0;
    if (hasSS) speechSynthesis.cancel();
    const next = () => { if (cancelled) return; if (i >= lines.length){ cb.onDone && cb.onDone(); return; } one(lines[i++], opt, cb, next); };
    setTimeout(next, 60);
  }
  function stop(){ cancelled = true; if (hasSS) speechSynthesis.cancel(); }
  return { warm, speak, stop };
})();
