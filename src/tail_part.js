
  /* ---------- 재생 상태 ---------- */
  const audio = new Audio();
  audio.preload = 'auto';
  audio.setAttribute('playsinline', '');
  let state = 'idle';           // idle | running | paused | done
  let run = null;               // 시작할 때의 설정 사본
  let url = null, raf = 0, wake = null;

  function setUrl(u) { if (url) URL.revokeObjectURL(url); url = u; audio.src = u || ''; }

  function start() {
    run = { t: cfg.t, a: ALARM < cfg.t ? ALARM : 0, r: HALVES, cd: cfg.cd, sv: cfg.sv };
    setUrl(renderWav(timeline(run)));
    audio.currentTime = 0;
    const p = audio.play();
    if (p && p.catch) p.catch(() => { toast('소리를 켜지 못했습니다. 다시 눌러 주세요.'); stop(); });
    state = 'running'; afterChange();
  }
  function pause() { audio.pause(); state = 'paused'; afterChange(); }
  function resume() { audio.play(); state = 'running'; afterChange(); }
  function stop() { audio.pause(); setUrl(null); state = 'idle'; run = null; if (typeof closePip === 'function') closePip(); afterChange(); }

  audio.addEventListener('ended', () => { if (state === 'running') { state = 'done'; afterChange(); setTimeout(() => closePip(), 4000); } });
  audio.addEventListener('pause', () => { if (state === 'running' && !audio.ended) { state = 'paused'; afterChange(); } });
  audio.addEventListener('play', () => { if (state === 'paused') { state = 'running'; afterChange(); } });
  audio.addEventListener('seeked', () => { last = ''; draw(); });   // 잠금화면에서 위치를 옮겨도 화면 갱신

  function afterChange() {
    cancelAnimationFrame(raf);
    document.body.classList.toggle('tm-running', state !== 'idle');
    if (state === 'running') loop(); else draw();
    if (state === 'running') keepAwake(); else releaseAwake();
    media();
    requestAnimationFrame(() => { last = ''; fitKey = ''; draw(); });
  }
  function loop() { draw(); raf = requestAnimationFrame(loop); }

  /* ---------- 화면 그리기 ---------- */
  const el = {
    root: $('view-timer'), main: $('tmMain'), setup: $('tmSetup'), runBox: $('tmRun'), label: $('tmLabel'), chip: $('tmChip'), sub: $('tmSub'),
    time: $('tmTime'), halfK: $('tmHalfK'), half: $('tmHalf'), total: $('tmTotal'),
    head: $('tmHead'), statL: $('tmStatL'), statR: $('tmStatR'), gear: $('tmGear'),
    stop: $('tmStop'), restart: $('tmRestart'), endBtn: $('tmEndBtn'), play: $('tmPlay'), icoPlay: $('tmIcoPlay'), icoPause: $('tmIcoPause')
  };
  let last = '', fitKey = '';
  let mini = { phase: 'idle', label: '', time: '', small: '' };
  function set(node, prop, v) { if (node[prop] !== v) node[prop] = v; }

  function draw() {
    const c = run || { t: cfg.t, a: ALARM, r: HALVES }, G = c.t * c.r;
    let phase = 'idle', label = '', chip = '', sub = '', time = '', word = false;
    let halfK = '전반 남은 시간', halfLeft = c.t, totalLeft = G;

    if (state !== 'idle') {
      const t = audio.currentTime || 0, end = halfStart(c, c.r - 1) + c.t;
      if (t < PRE && state !== 'done') {
        phase = 'ready'; label = '준비'; time = String(Math.max(1, Math.min(3, Math.ceil(PRE - t))));
      } else if (t < end && state !== 'done') {
        let k = 0; while (k < c.r - 1 && t >= halfStart(c, k) + c.t) k++;
        const hs = halfStart(c, k);
        if (t < hs) {
          // 키퍼 교체 휴식: 시계 멈춤, 끝나면 그대로 후반으로 이어짐
          phase = 'gk'; label = '키퍼 교체'; time = fmtUp(k * c.t); sub = '(' + fmt(hs - t) + ')';   // 키퍼 교체 남은 시간
          halfK = half(k) + ' 남은 시간'; halfLeft = c.t; totalLeft = G - k * c.t;
        } else {
          const inHalf = t - hs, left = c.t - inHalf, e = k * c.t + inHalf;
          halfK = half(k) + ' 남은 시간'; halfLeft = left; totalLeft = G - e;
          time = fmtUp(e); phase = 'play'; label = half(k);                      // 경과 시간(후반은 이어서)
          if (k < c.r - 1 && c.a > 0 && left <= c.a) { phase = 'alarm'; label = '키퍼 교체 준비'; }
        }
      } else {
        halfK = '후반 남은 시간'; halfLeft = 0; totalLeft = 0;
        if (state === 'done') { phase = 'done'; word = true; time = el.main.clientWidth < el.main.clientHeight ? '경기\n종료' : '경기 종료'; }   // 종료 화면은 '경기 종료'만 크게
        else { phase = 'last'; label = '막공!'; time = fmtUp(G + Math.min(LAST, t - end)); }  // 막공 동안에도 시계는 계속
      }
      if (state === 'paused') chip = '일시정지';
    }

    const key = [state, phase, label, chip, sub, time, halfK, fmt(halfLeft), fmt(totalLeft)].join('|');
    if (key === last) return; last = key;

    el.root.dataset.phase = phase;
    const running = state !== 'idle';
    el.setup.hidden = running; el.runBox.hidden = !running;
    el.head.hidden = !running; el.stop.hidden = !running;
    el.statL.hidden = !running; el.statR.hidden = !running; el.gear.hidden = running;
    if (!running) disarm();
    set(el.label, 'textContent', label); set(el.chip, 'textContent', chip); set(el.sub, 'textContent', sub);
    set(el.time, 'textContent', time); el.time.classList.toggle('word', word);
    set(el.halfK, 'textContent', halfK); set(el.half, 'textContent', fmt(halfLeft)); set(el.total, 'textContent', fmt(totalLeft));
    // 작은 화면(PiP)·좁은 창에서 쓰는 요약: 단계 이름 + 경과 시간 + 경기 남은 시간
    mini = { phase, label: phase === 'done' ? '경기 종료' : (sub ? label + ' ' + sub : label), time: phase === 'done' ? fmtUp(G + LAST) : time, small: '경기 남은 시간 ' + fmt(totalLeft) };   // 전체 경기 남은 시간
    set($('tmMini'), 'textContent', mini.small);
    $('tmPip').hidden = !(pipOK && (state === 'running' || state === 'paused') && phase !== 'done');
    syncNative((state === 'running' || state === 'paused') && phase !== 'done');
    drawPip();
    const playing = state === 'running';
    const restart = state === 'done', finish = phase === 'last';   // 막공 중엔 ■ 경기 종료
    el.icoPlay.toggleAttribute('hidden', playing || restart || finish); el.icoPause.toggleAttribute('hidden', !playing || finish);
    el.restart.hidden = !restart; el.endBtn.hidden = !finish; el.play.classList.toggle('restart', restart || finish);
    el.play.setAttribute('aria-label', restart ? '다시 시작' : finish ? '경기 종료' : playing ? '일시정지' : state === 'paused' ? '계속' : '시작');
    if (running) fitTime(time.length + (word ? 'w' : 'n') + (sub ? 's' : ''));
  }

  // 큰 숫자를 패널 폭·높이에 꽉 차게 맞춘다(전광판). 글자 수가 바뀔 때만 다시 계산.
  function fitTime(k) {
    const box = el.runBox, w = box.clientWidth - 16, h = box.clientHeight;
    if (!w || !h) return;
    k += '|' + w + 'x' + h;
    if (k === fitKey) return; fitKey = k;
    const used = el.label.offsetHeight + el.chip.offsetHeight + el.sub.offsetHeight + $('tmMini').offsetHeight + 24;
    el.time.style.fontSize = '100px';
    const tw = el.time.scrollWidth || 1;
    const lines = el.time.textContent.split('\n').length;
    const size = Math.max(60, Math.min(w / tw * 100 * 0.97, (h - used) / (lines > 1 ? 1.02 * lines : 0.9)));
    el.time.style.fontSize = Math.floor(size) + 'px';
  }
  window.addEventListener('resize', () => { fitKey = ''; last = ''; draw(); if (state === 'idle') { wheelM.refit(); wheelS.refit(); } });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { fitKey = ''; last = ''; draw(); if (state === 'idle') { wheelM.refit(); wheelS.refit(); } });

  /* ---------- 갤럭시 시계식 스크롤 휠 ---------- */
  const CYCLES = 7;
  function makeWheel(node, n, step, getV, setV) {
    const mid = Math.floor(CYCLES / 2);
    let h = '<div class="sp"></div>';
    for (let c = 0; c < CYCLES; c++) for (let v = 0; v < n; v++) h += '<div class="it" data-i="' + (c * n + v) + '">' + pad(v * step) + '</div>';
    node.innerHTML = h + '<div class="sp"></div>';
    const items = node.querySelectorAll('.it');
    let cur = -1, settleT = 0, ticking = false, user = false, touching = false, lastH = 0;   // user: 사람이 직접 돌릴 때만 값 변경
    const H = () => (items[0] && items[0].offsetHeight) || 100;
    const idx = () => Math.round(node.scrollTop / H());
    function mark() {
      ticking = false;
      const i = idx();
      if (i === cur) return;
      if (cur >= 0 && items[cur]) items[cur].classList.remove('on');
      if (items[i]) items[i].classList.add('on');
      cur = i;
      try { if (navigator.vibrate) navigator.vibrate(4); } catch (e) {}
    }
    function settle() {
      if (touching) { clearTimeout(settleT); settleT = setTimeout(settle, 140); return; }  // 손가락을 대고 있는 동안은 확정하지 않음
      if (!user || state !== 'idle' || !node.offsetParent) { mark(); return; }   // 화면 전환 때 생긴 스크롤은 무시
      user = false;
      const i = idx(), v = ((i % n) + n) % n;
      setV(v);
      // 가운데 묶음으로 몰래 되돌려 끝없이 돌아가게
      const want = mid * n + v;
      if (i !== want) { node.scrollTop = want * H(); }
      sync(false);
    }
    function sync(smooth) {
      lastH = H();
      const want = mid * n + getV();
      if (smooth) node.scrollTo({ top: want * H(), behavior: 'smooth' }); else node.scrollTop = want * H();
      node.setAttribute('aria-valuenow', String(getV() * step)); node.setAttribute('aria-valuetext', pad(getV() * step));
      mark();
    }
    ['pointerdown', 'touchstart', 'wheel', 'keydown'].forEach(ev => node.addEventListener(ev, () => { user = true; }, { passive: true }));
    node.addEventListener('touchstart', () => { touching = true; }, { passive: true });
    ['touchend', 'touchcancel'].forEach(ev => node.addEventListener(ev, () => { touching = false; }, { passive: true }));
    // 화면 크기가 바뀌어도(주소창 접힘 등) 칸 높이가 그대로면 돌리던 휠을 건드리지 않음
    function refit() { if (!user && !touching && H() !== lastH) sync(false); }
    node.addEventListener('scroll', () => {
      if (!ticking) { ticking = true; requestAnimationFrame(mark); }
      clearTimeout(settleT); settleT = setTimeout(settle, 140);
    }, { passive: true });
    node.addEventListener('click', e => {
      const it = e.target.closest('.it'); if (!it) return;
      node.scrollTo({ top: +it.dataset.i * H(), behavior: 'smooth' });
    });
    node.addEventListener('keydown', e => {
      const d = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
      if (!d) return; e.preventDefault();
      node.scrollTo({ top: (idx() + d) * H(), behavior: 'smooth' });
    });
    return { sync, refit };
  }
  function applyLimits() {
    cfg.t = Math.min(LIMIT.tMax, Math.max(LIMIT.tMin, cfg.t));
    save(); last = ''; draw();
  }
  // 분: 00~10, 초: 00·10·20·30·40·50
  const MAXM = LIMIT.tMax / 60;
  const wheelM = makeWheel($('tmWheelM'), MAXM + 1, 1, () => Math.floor(cfg.t / 60), v => {
    const before = cfg.t; cfg.t = v * 60 + (v >= MAXM ? 0 : cfg.t % 60); applyLimits();
    if (cfg.t !== before && cfg.t % 60 !== before % 60) wheelS.sync(true);
  });
  const wheelS = makeWheel($('tmWheelS'), 60 / LIMIT.step, LIMIT.step, () => (cfg.t % 60) / LIMIT.step, v => {
    const before = cfg.t; cfg.t = Math.floor(cfg.t / 60) * 60 + v * LIMIT.step; applyLimits();
    if (cfg.t % 60 !== v * LIMIT.step) wheelS.sync(true);   // 10분이면 00초, 0분이면 30초 이상으로 맞춤
    if (Math.floor(cfg.t / 60) !== Math.floor(before / 60)) wheelM.sync(true);
  });
  function syncWheels() { if (state === 'idle') { wheelM.sync(false); wheelS.sync(false); } }

  /* ---------- 화면 꺼짐 방지 · 잠금화면 컨트롤 ---------- */
  async function keepAwake() {
    try { if ('wakeLock' in navigator && !wake && document.visibilityState === 'visible') { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); } } catch (e) {}
  }
  function releaseAwake() { try { if (wake) wake.release(); } catch (e) {} wake = null; }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { last = ''; if (state === 'running') { keepAwake(); cancelAnimationFrame(raf); loop(); } else draw(); }
  });
  function media() {
    if (!('mediaSession' in navigator)) return;
    try {
      if (state === 'idle') { navigator.mediaSession.metadata = null; return; }
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'G풋살 경기 타이머', artist: '전·후반 ' + mmss((run || cfg).t),
        artwork: [{ src: 'icon-512.png', sizes: '512x512', type: 'image/png' }]
      });
      navigator.mediaSession.setActionHandler('play', () => { if (state === 'paused') resume(); });
      navigator.mediaSession.setActionHandler('pause', () => { if (state === 'running') pause(); });
    } catch (e) {}
  }

  /* ---------- 작은 화면(Picture-in-Picture) ----------
     타이머가 작동 중일 때만 버튼이 보인다. 화면 그림을 동영상으로 만들어 휴대폰의 '작은 창'으로 띄우므로
     다른 앱을 써도 위에 떠 있다. 소리는 기존 경기 오디오가 그대로 담당한다. */
  // 안드로이드 앱(WebView)에서는 휴대폰 기본 '화면 속 화면'을 직접 사용
  const NATIVE = window.FutsalApp || null;
  let nativeActive = null;
  function syncNative(active) {
    if (!NATIVE || active === nativeActive) return;
    nativeActive = active;
    try { NATIVE.setRunning(!!active); } catch (e) {}
  }
  const pipOK = !!NATIVE || !!(document.pictureInPictureEnabled || (window.HTMLVideoElement && 'webkitSetPresentationMode' in HTMLVideoElement.prototype))
    && !!(window.HTMLCanvasElement && HTMLCanvasElement.prototype.captureStream);
  let pipCanvas = null, pipCtx = null, pipVideo = null, pipTick = 0;
  const PIP_BG = { ready: '#FEFF65', play: '#B0FC66', alarm: '#FEFF65', gk: '#FEFF65', last: '#DE4837', done: '#FEFF65', idle: '#FEFF65' };
  function drawPip() {
    if (!pipCtx) return;
    const W = pipCanvas.width, H = pipCanvas.height, ctx = pipCtx, m = mini;
    const fg = m.phase === 'last' ? '#FFFFFF' : '#000000';
    ctx.fillStyle = PIP_BG[m.phase] || '#B0FC66'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '900 38px "Noto Sans KR", "Apple SD Gothic Neo", sans-serif'; ctx.fillText(m.label || '', W / 2, 52);
    let fs = 150; ctx.font = '800 ' + fs + 'px "Barlow Condensed", "Noto Sans KR", sans-serif';
    const tw = ctx.measureText(m.time || '').width; if (tw > W * 0.92) { fs = Math.floor(fs * W * 0.92 / tw); ctx.font = '800 ' + fs + 'px "Barlow Condensed", "Noto Sans KR", sans-serif'; }
    ctx.fillText(m.time || '', W / 2, 160);
    ctx.globalAlpha = 0.75; ctx.font = '700 28px "Noto Sans KR", "Apple SD Gothic Neo", sans-serif'; ctx.fillText(m.small || '', W / 2, 262); ctx.globalAlpha = 1;
  }
  async function openPip() {
    if (NATIVE) { try { NATIVE.enterPip(); } catch (e) {} return; }
    try {
      if (!pipCanvas) { pipCanvas = document.createElement('canvas'); pipCanvas.width = 480; pipCanvas.height = 300; pipCtx = pipCanvas.getContext('2d'); }
      drawPip();
      if (!pipVideo) {
        pipVideo = document.createElement('video');
        pipVideo.muted = true; pipVideo.playsInline = true; pipVideo.setAttribute('playsinline', ''); pipVideo.className = 'tm-pip-video';
        pipVideo.srcObject = pipCanvas.captureStream();
        document.body.appendChild(pipVideo);
        pipVideo.addEventListener('leavepictureinpicture', closePipLoop);
        pipVideo.addEventListener('webkitpresentationmodechanged', () => { if (pipVideo.webkitPresentationMode !== 'picture-in-picture') closePipLoop(); });
      }
      await pipVideo.play();
      if (pipVideo.readyState < 1) await new Promise(r => pipVideo.addEventListener('loadedmetadata', r, { once: true }));
      clearInterval(pipTick); pipTick = setInterval(() => { last = ''; draw(); }, 250);   // 화면이 가려져도 1초에 한 번 이상 갱신
      if (pipVideo.requestPictureInPicture) await pipVideo.requestPictureInPicture();
      else pipVideo.webkitSetPresentationMode('picture-in-picture');
    } catch (e) { toast('이 휴대폰에서는 작은 화면을 띄울 수 없습니다.'); closePipLoop(); }
  }
  function closePipLoop() { clearInterval(pipTick); pipTick = 0; }
  function closePip() {
    closePipLoop();
    try { if (document.pictureInPictureElement) document.exitPictureInPicture(); } catch (e) {}
    try { if (pipVideo && pipVideo.webkitPresentationMode === 'picture-in-picture') pipVideo.webkitSetPresentationMode('inline'); } catch (e) {}
  }
  audio.addEventListener('timeupdate', () => { if (pipTick) { last = ''; draw(); } });   // 백그라운드에서도 오디오 진행에 맞춰 갱신
  $('tmPip').addEventListener('click', openPip);

  /* ---------- 버튼 ---------- */
  el.play.addEventListener('click', () => {
    if (el.root.dataset.phase === 'last' || state === 'done') { stop(); requestAnimationFrame(() => syncWheels()); return; }  // 경기 종료·다시 시작: 첫 화면으로
    if (state === 'running') pause();
    else if (state === 'paused') resume();
    else if (state === 'done') { stop(); requestAnimationFrame(() => syncWheels()); }   // 다시 시작: 첫 화면으로
    else start();
  });
  // 경기 중 X는 실수 방지를 위해 두 번 눌러야 정지(3초 안에 한 번 더)
  let armTimer = 0;
  function disarm() { clearTimeout(armTimer); el.stop.classList.remove('armed'); el.stop.setAttribute('aria-label', '정지하고 처음으로'); }
  el.stop.addEventListener('click', () => {
    if (state === 'running' && !el.stop.classList.contains('armed')) {
      el.stop.classList.add('armed'); el.stop.setAttribute('aria-label', '한 번 더 누르면 정지');
      armTimer = setTimeout(disarm, 3000);
      return;
    }
    disarm(); stop();
    requestAnimationFrame(() => syncWheels());
  });

  /* ---------- 설정 시트 ---------- */
  const sheet = $('tmSheet'), swCd = $('tmCd');
  const sample = new Audio(); sample.setAttribute('playsinline', '');
  let sampleUrl = null, lastFocus = null;
  function paintSettings() {
    swCd.setAttribute('aria-checked', String(cfg.cd));
    sheet.querySelectorAll('[data-sv]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.sv === cfg.sv)));
  }
  function playSample(sv) {
    try {
      if (sampleUrl) URL.revokeObjectURL(sampleUrl);
      // 경기 시작 때처럼 한 번만 들려준다
      sampleUrl = renderWav({ ev: [{ t: 0.1, s: 'start', sv }], total: 1.15 });
      sample.src = sampleUrl; sample.currentTime = 0; sample.play().catch(() => {});
    } catch (e) {}
  }
  function openSheet() { lastFocus = document.activeElement; paintSettings(); sheet.hidden = false; swCd.focus(); }
  function closeSheet() { sheet.hidden = true; sample.pause(); if (lastFocus) lastFocus.focus(); }
  el.gear.addEventListener('click', openSheet);
  sheet.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) { closeSheet(); return; }
    if (e.target.closest('#tmCd')) { cfg.cd = !cfg.cd; save(); paintSettings(); return; }
    const b = e.target.closest('[data-sv]');
    if (b) { cfg.sv = b.dataset.sv; save(); paintSettings(); playSample(cfg.sv); }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !sheet.hidden) closeSheet(); });

  let toastTimer = 0;
  function toast(msg) {
    const t = $('tmToast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
  }

  /* ---------- 탭 ---------- */
  function appbarHeight() {
    const a = document.querySelector('.appbar');
    if (a && a.offsetHeight) document.documentElement.style.setProperty('--app-h', a.offsetHeight + 'px');
  }
  function showView() {
    const rot = location.hash === '#rotation';
    $('view-timer').hidden = rot; $('view-rotation').hidden = !rot;
    $('tabTimer').setAttribute('aria-selected', String(!rot));
    $('tabRotation').setAttribute('aria-selected', String(rot));
    document.body.classList.toggle('on-rotation', rot);
    document.title = rot ? 'G풋살 · 로테이션 구성' : 'G풋살 · 경기 타이머';
    if (!rot) { appbarHeight(); last = ''; fitKey = ''; draw(); requestAnimationFrame(() => syncWheels()); }
  }
  document.querySelectorAll('.appbar .tab').forEach(b => b.addEventListener('click', () => {
    const h = b.dataset.view === 'rotation' ? '#rotation' : '#timer';
    if (location.hash !== h) history.replaceState(null, '', h);
    showView(); window.scrollTo(0, 0);
  }));
  window.addEventListener('hashchange', showView);
  window.addEventListener('resize', appbarHeight);

  showView(); draw();

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  // 검증용 훅
  window.__tm = { timeline: () => timeline({ t: cfg.t, a: ALARM, r: HALVES, cd: cfg.cd, sv: cfg.sv }), cfg, PRE, audio,
    pipShot: () => { if (!pipCanvas) { pipCanvas = document.createElement('canvas'); pipCanvas.width = 480; pipCanvas.height = 300; pipCtx = pipCanvas.getContext('2d'); } last = ''; draw(); drawPip(); return pipCanvas.toDataURL(); } };
})();

/* ---------- 안드로이드 앱 업데이트 알림 ----------
   안드로이드 앱(APK) 안에서만: GitHub의 최신 릴리스 번호가 설치된 앱보다 높으면 상단에 '새 버전' 안내.
   타이머가 돌고 있을 때는 띄우지 않음. 닫으면 그 버전에 대해서는 다시 띄우지 않음. */
(function () {
  const app = window.FutsalApp;
  if (!app || typeof app.version !== 'function') return;
  const APK = 'https://github.com/walkerkein/futsal/releases/latest/download/futsal-helper.apk';
  const SKIP = 'futsalUpdate.skip';
  let mine = 0; try { mine = Number(app.version()) || 0; } catch (e) { return; }
  if (!mine) return;
  fetch('https://api.github.com/repos/walkerkein/futsal/releases/latest', { cache: 'no-store' })
    .then(r => r.ok ? r.json() : null)
    .then(j => {
      const m = j && /(\d+)$/.exec(j.tag_name || ''); const latest = m ? Number(m[1]) : 0;
      if (latest <= mine) return;
      try { if (localStorage.getItem(SKIP) === String(latest)) return; } catch (e) {}
      const show = () => {
        if (document.body.classList.contains('tm-running')) { setTimeout(show, 5000); return; }
        const bar = document.createElement('div');
        bar.className = 'upd'; bar.setAttribute('role', 'status');
        bar.innerHTML = '<span>새 버전이 있습니다</span><a class="upd-go" href="' + APK + '">받기</a><button class="upd-x" aria-label="닫기">✕</button>';
        bar.querySelector('.upd-x').onclick = () => { try { localStorage.setItem(SKIP, String(latest)); } catch (e) {} bar.remove(); };
        bar.querySelector('.upd-go').onclick = () => setTimeout(() => bar.remove(), 300);
        document.body.prepend(bar);
      };
      show();
    })
    .catch(() => {});
})();

/* ---------- 설정 > 홈 화면에 바로가기 ----------
   앱 설치가 아니라 '브라우저로 여는 바로가기'를 만든다(manifest display: browser).
   웹페이지가 버튼으로 바로가기를 직접 만들 수는 없어서(브라우저 정책), 폰에 맞는 추가 방법을 펼쳐 보여 준다.
   카카오톡 안이면 먼저 다른 브라우저로 연다. 안드로이드 앱(APK) 안에서는 줄을 숨김. */
(function () {
  const row = document.getElementById('tmInstallRow'), btn = document.getElementById('tmInstall'), help = document.getElementById('tmInstallHelp');
  if (!row || window.FutsalApp) return;
  const ua = navigator.userAgent || '';
  const isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const inKakao = /KAKAOTALK/i.test(ua), isSamsung = /SamsungBrowser/i.test(ua), isCriOS = /CriOS/i.test(ua);
  row.hidden = false;
  if (inKakao) btn.textContent = '브라우저로 열기';   // 카카오톡 안에서는 바로가기를 만들 수 없음
  function text() {
    if (isIOS) return isCriOS
      ? '주소창 오른쪽 <b>공유 버튼</b> → <b>홈 화면에 추가</b> → <b>추가</b>'
      : '화면 아래 <b>공유 버튼</b>(네모에서 위로 화살표) → <b>홈 화면에 추가</b> → <b>추가</b>';
    if (isSamsung) return '화면 아래 <b>≡</b> → <b>현재 페이지 추가</b> → <b>홈 화면</b>';
    return '오른쪽 위 <b>⋮</b> → <b>홈 화면에 추가</b> → <b>바로가기 만들기</b>(또는 <b>추가</b>)';
  }
  btn.addEventListener('click', () => {
    if (inKakao) { location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(location.href); return; }
    const open = help.hidden;
    if (open) help.innerHTML = text();
    help.hidden = !open; btn.setAttribute('aria-expanded', String(open)); btn.textContent = open ? '닫기' : '방법 보기';
  });
})();
