/* ===================== 풋살 로테이션 구성: 채팅식 문답 =====================
   질문과 답이 말풍선으로 위에서 아래로 쌓인다. 내가 한 답(노란 말풍선)을 누르면 그 질문부터 다시 고를 수 있다.
   답을 모은 뒤에는 기존 계산기(run/render)를 그대로 써서 경기별 배치를 보여준다. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const thread = $('rcThread');
  const SAVE_KEY = 'futsalRotation.last';
  const VESTS = [
    { k: '레드', c: '#FF2D2D' }, { k: '블루', c: '#1F5BFF' }, { k: '옐로우', c: '#FEFF65' }, { k: '블랙', c: '#111111' },
    { k: '핑크', c: '#FF5FB4' }, { k: '그린', c: '#2BD45B' }, { k: '화이트', c: '#FFFFFF' }
  ];
  const STEPS = ['start', 'vest', 'n', 'games', 'per', 'special', 'done'];

  // 답 모음
  let A = freshAnswers();
  function freshAnswers() { return { vest: '', n: 0, games: 9, per: '', types: [], special: null, cons: [] }; }

  function loadSaved() { try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { return null; } }
  function save() {
    try {
      if (!window.LAST) return;
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        a: A, last: LAST, cons: CONSTRAINTS, savedAt: Date.now()
      }));
    } catch (e) {}
  }

  /* ---------- 말풍선 ---------- */
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  // 카카오톡처럼: 왼쪽 프로필+이름+흰 말풍선, 오른쪽 노란 말풍선, 말풍선 옆 작은 시각
  const AV = '<div class="kt-av" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="1.7"><circle cx="12" cy="12" r="9"/><path d="M12 7.2l3.6 2.6-1.4 4.2h-4.4L8.4 9.8z"/><path d="M12 3v4.2M19.6 9.8h-4M17.3 18.6l-3.1-4.6M6.7 18.6l3.1-4.6M4.4 9.8h4"/></svg></div>';
  const nowText = () => { const d = new Date(), h = d.getHours(), m = String(d.getMinutes()).padStart(2, '0'); return (h < 12 ? '오전 ' : '오후 ') + (h % 12 || 12) + ':' + m; };
  function bot(html) {
    const row = document.createElement('div'); row.className = 'kt-row bot';
    row.innerHTML = AV + '<div class="kt-col"><div class="kt-name">G풋살 매니저</div><div class="kt-line"><div class="bub bot"></div><span class="kt-time">' + nowText() + '</span></div></div>';
    const d = row.querySelector('.bub'); d.innerHTML = html; thread.appendChild(row); return d;
  }
  function me(text, step) {
    const row = document.createElement('div'); row.className = 'kt-row me';
    row.innerHTML = '<span class="kt-time">' + nowText() + '</span>';
    const b = document.createElement('button'); b.type = 'button'; b.className = 'bub me';
    b.innerHTML = esc(text) + '<span class="edit" aria-hidden="true">수정</span>';
    b.setAttribute('aria-label', text + ' (눌러서 다시 고르기)');
    b.addEventListener('click', () => goTo(STEPS.indexOf(step)));
    row.appendChild(b); thread.appendChild(row); return b;
  }
  function panel() { const p = document.createElement('div'); p.className = 'rc-panel'; thread.appendChild(p); return p; }
  function chip(p, label, onClick, opt) {
    opt = opt || {};
    const b = document.createElement('button'); b.type = 'button';
    b.className = 'rc-chip' + (opt.primary ? ' primary' : '') + (opt.wide ? ' wide' : '');
    b.innerHTML = (opt.dot ? '<i class="dot" style="background:' + opt.dot + '"></i>' : '') + '<span>' + esc(label) + '</span>' +
      (opt.sub ? '<small>' + esc(opt.sub) + '</small>' : '');
    if (opt.disabled) b.disabled = true;
    b.addEventListener('click', onClick); p.appendChild(b); return b;
  }
  function scrollEnd() { requestAnimationFrame(() => { const last = thread.lastElementChild; if (last) last.scrollIntoView({ behavior: 'smooth', block: 'end' }); }); }

  /* ---------- 질문 흐름 ---------- */
  // step 번호까지의 문답을 다시 그리고, 해당 질문의 답 선택지를 보여준다
  let cur = 0;
  function goTo(step) {
    cur = step;
    $('result').style.display = 'none';
    thread.innerHTML = '';
    for (let i = 0; i < step; i++) { question(i, false); answered(i); }
    question(step, true);
  }
  function next() { goTo(cur + 1); }

  function question(i, live) {
    const s = STEPS[i];
    const text = {
      start: '주장님, 새로운 로테이션을 짜드릴까요?',
      vest: '팀 조끼 색상은 무엇입니까?',
      n: '팀 인원은 몇 명입니까?',
      games: '몇 경기를 뛰십니까?',
      per: '경기당 인원수는 몇 명입니까?',
      special: '지각자나 부상자가 있습니까?<br><span class="soft">(골키퍼 불가 인원 포함)</span>',
      done: '로테이션을 구성했습니다.<br><span class="soft">마음에 드시면 확인, 다른 조합을 보려면 다시 계산을 눌러 주세요.</span>'
    }[s];
    if (!live) { bot(text); return; }
    // 새 질문은 잠깐 '입력 중' 점을 보여준 뒤 나타남
    const typing = bot('<span class="typing"><i></i><i></i><i></i></span>');
    scrollEnd();
    setTimeout(() => { typing.innerHTML = text; options(s); scrollEnd(); }, reduce ? 0 : 380);
  }
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function answered(i) {
    const s = STEPS[i];
    if (s === 'start') me(A.loaded ? '직전 로테이션 불러오기' : '새로운 로테이션 구성', s);
    else if (s === 'vest') me(A.vest + ' 조끼', s);
    else if (s === 'n') me(A.n + '명', s);
    else if (s === 'games') me(A.games + '경기', s);
    else if (s === 'per') me(perText(), s);
    else if (s === 'special') me(A.special ? '있음 · ' + consText() : '없음', s);
  }
  function perText() {
    if (A.per === '6') return '전부 6:6';
    if (A.per === '5') return '전부 5:5';
    const c6 = A.types.filter(t => t === 6).length, c5 = A.types.length - c6;
    return '개별 입력 (6:6 ' + c6 + '경기 · 5:5 ' + c5 + '경기)';
  }
  const modeName = m => (m === 'exclude' ? '경기 열외(지각)' : '골키퍼 제외(부상)');
  function consText() {
    return A.cons.map(c => (c.player + 1) + '번 ' + c.to + '경기까지 ' + modeName(c.mode)).join(', ');
  }

  function options(s) {
    const p = panel();
    if (s === 'start') {
      chip(p, '새로운 로테이션 구성', () => { A = freshAnswers(); next(); }, { primary: true, wide: true });
      const saved = loadSaved();
      if (saved && saved.last) {
        const d = new Date(saved.savedAt || Date.now());
        const sub = (d.getMonth() + 1) + '/' + d.getDate() + ' · ' + (saved.a.vest || '') + ' · ' + saved.last.n + '명 · ' + saved.last.types.length + '경기';
        chip(p, '직전 로테이션 불러오기', () => loadPrevious(saved), { wide: true, sub });
      } else {
        chip(p, '직전 로테이션 불러오기', () => {}, { wide: true, sub: '저장된 로테이션이 없습니다', disabled: true });
      }
    } else if (s === 'vest') {
      VESTS.forEach(v => chip(p, v.k, () => { A.vest = v.k; next(); }, { dot: v.c }));
    } else if (s === 'n') {
      [5, 6, 7, 8, 9].forEach(n => chip(p, n + '명', () => setN(n)));
      const other = chip(p, '기타', () => {
        other.remove();
        const box = document.createElement('div'); box.className = 'rc-other';
        box.innerHTML = '<input type="number" id="rcOtherN" inputmode="numeric" min="2" max="30" placeholder="10" aria-label="팀원 수"><span>명</span>';
        const ok = document.createElement('button'); ok.type = 'button'; ok.className = 'rc-chip primary'; ok.textContent = '확인';
        ok.addEventListener('click', () => {
          const v = parseInt($('rcOtherN').value, 10);
          if (!v || v < 2 || v > 30) { hint(p, '2명부터 30명까지 입력해 주세요.'); return; }
          setN(v);
        });
        box.appendChild(ok); p.appendChild(box); $('rcOtherN').focus();
      });
    } else if (s === 'games') {
      p.classList.add('col');
      const w = document.createElement('div'); w.className = 'rc-wheel'; w.tabIndex = 0; w.setAttribute('role', 'spinbutton');
      w.setAttribute('aria-label', '경기 수'); w.setAttribute('aria-valuemin', '5'); w.setAttribute('aria-valuemax', '15');
      let h = '<div class="sp"></div>'; for (let g = 5; g <= 15; g++) h += '<div class="it" data-v="' + g + '">' + g + '<small>경기</small></div>';
      w.innerHTML = h + '<div class="sp"></div>';
      const band = document.createElement('div'); band.className = 'rc-wheel-wrap'; band.appendChild(w); p.appendChild(band);
      const items = w.querySelectorAll('.it'), H = () => items[0].offsetHeight || 56;
      const val = () => Math.min(15, Math.max(5, 5 + Math.round(w.scrollTop / H())));
      const mark = () => { const v = val(); items.forEach(it => it.classList.toggle('on', +it.dataset.v === v)); w.setAttribute('aria-valuenow', String(v)); };
      requestAnimationFrame(() => { w.scrollTop = (A.games - 5) * H(); mark(); });
      w.addEventListener('scroll', () => requestAnimationFrame(mark), { passive: true });
      w.addEventListener('click', e => { const it = e.target.closest('.it'); if (it) w.scrollTo({ top: (+it.dataset.v - 5) * H(), behavior: 'smooth' }); });
      w.addEventListener('keydown', e => {
        const d = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0; if (!d) return;
        e.preventDefault(); w.scrollTo({ top: (val() - 5 + d) * H(), behavior: 'smooth' });
      });
      chip(p, '확인', () => { A.games = val(); if (A.types.length !== A.games) A.types = []; next(); }, { primary: true, wide: true });
    } else if (s === 'per') {
      chip(p, '전부 6:6', () => { A.per = '6'; A.types = Array(A.games).fill(6); next(); }, { disabled: A.n < 6 });
      chip(p, '전부 5:5', () => { A.per = '5'; A.types = Array(A.games).fill(5); next(); }, { disabled: A.n < 5 });
      chip(p, '개별 입력', () => perEach(p), {});
      if (A.n < 5) hint(p, '팀원이 ' + A.n + '명이라 개별 입력에서 경기마다 인원을 정해 주세요.');
    } else if (s === 'special') {
      chip(p, '있음', () => specialForm(p));
      chip(p, '없음', () => { A.special = false; A.cons = []; compute(); });
    } else if (s === 'done') {
      chip(p, '확인', () => { save(); p.remove(); me('확인', 'done').disabled = true;
        const b = bot('저장했습니다. 다음에 <b>직전 로테이션 불러오기</b>로 바로 볼 수 있습니다.');
        const p2 = panel(); chip(p2, '새 로테이션 짜기', () => { A = freshAnswers(); goTo(0); }, { wide: true });
        scrollEnd(); void b; }, { primary: true });
      chip(p, '다시 계산', () => { A = freshAnswers(); goTo(0); window.scrollTo(0, 0); });   // 처음 질문부터 다시
    }
  }
  function hint(p, t) { let h = p.querySelector('.rc-hint'); if (!h) { h = document.createElement('p'); h.className = 'rc-hint'; p.appendChild(h); } h.textContent = t; }
  function setN(n) { A.n = n; A.cons = A.cons.filter(c => c.player < n); if (A.per === '6' && n < 6) A.per = ''; next(); }

  // 개별 입력: 경기마다 6:6 / 5:5
  function perEach(p) {
    p.innerHTML = ''; p.classList.add('col');
    if (A.types.length !== A.games) A.types = Array(A.games).fill(A.n >= 6 ? 6 : Math.min(5, A.n));
    const grid = document.createElement('div'); grid.className = 'rc-games';
    A.types.forEach((t, i) => {
      const row = document.createElement('div'); row.className = 'rc-game';
      row.innerHTML = '<span class="no">' + (i + 1) + '경기</span>';
      const seg = document.createElement('div'); seg.className = 'rc-seg';
      [6, 5].forEach(v => {
        const b = document.createElement('button'); b.type = 'button'; b.textContent = v + ':' + v;
        b.setAttribute('aria-pressed', String(t === v)); if (v > A.n) b.disabled = true;
        b.addEventListener('click', () => { A.types[i] = v; seg.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); });
        seg.appendChild(b);
      });
      row.appendChild(seg); grid.appendChild(row);
    });
    p.appendChild(grid);
    chip(p, '확인', () => { A.per = 'each'; next(); }, { primary: true, wide: true });
    scrollEnd();
  }

  // 특수 상황: [ ]번, [ ]경기까지, [열외 종류] 입력줄. '추가'를 누르면 입력줄이 하나 더 생기고,
  // '로테이션 구성'을 누르면 화면의 입력줄이 모두 그대로 적용된다(1경기부터 해당 경기까지)
  function specialForm(p) {
    p.innerHTML = ''; p.classList.add('col');
    const opt = (from, to, sel) => { let h = ''; for (let v = from; v <= to; v++) h += '<option value="' + v + '"' + (v === sel ? ' selected' : '') + '>' + v + '</option>'; return h; };
    let rows = A.cons.length ? A.cons.map(c => ({ player: c.player, to: c.to, mode: c.mode })) : [{ player: 0, to: 1, mode: 'exclude' }];
    const box = document.createElement('div'); box.className = 'rc-rows'; p.appendChild(box);
    const paint = () => {
      box.innerHTML = '';
      rows.forEach((r, i) => {
        const row = document.createElement('div'); row.className = 'rc-form';
        row.innerHTML =
          '<label><select data-k="player" aria-label="' + (i + 1) + '번째 선수 번호">' + opt(1, A.n, r.player + 1) + '</select><span>번,</span></label>' +
          '<label><select data-k="to" aria-label="' + (i + 1) + '번째 몇 경기까지">' + opt(1, A.games, r.to) + '</select><span>경기까지</span></label>' +
          '<div class="mode-seg" role="radiogroup" aria-label="' + (i + 1) + '번째 열외 종류">' +
            '<button type="button" role="radio" data-m="exclude" aria-checked="' + (r.mode === 'exclude') + '">경기 열외 (지각)</button>' +
            '<button type="button" role="radio" data-m="noKeeper" aria-checked="' + (r.mode === 'noKeeper') + '">골키퍼 제외 (부상)</button></div>';
        row.querySelectorAll('.mode-seg button').forEach(btn => btn.addEventListener('click', () => {
          r.mode = btn.dataset.m;
          row.querySelectorAll('.mode-seg button').forEach(x => x.setAttribute('aria-checked', String(x === btn)));
        }));
        row.querySelectorAll('select').forEach(sel => sel.addEventListener('change', () => {
          const k = sel.dataset.k; r[k] = k === 'player' ? +sel.value - 1 : +sel.value;
        }));
        if (rows.length > 1) {
          const x = document.createElement('button'); x.type = 'button'; x.className = 'rc-row-x'; x.textContent = '삭제';
          x.setAttribute('aria-label', (i + 1) + '번째 입력줄 삭제');
          x.addEventListener('click', () => { rows.splice(i, 1); paint(); });
          row.appendChild(x);
        }
        box.appendChild(row);
      });
      const tip = document.createElement('p'); tip.className = 'rc-hint';
      tip.textContent = '지각자나 부상자가 더 있다면 추가를 누르세요';
      box.appendChild(tip);
    };
    paint();
    chip(p, '+ 지각자·부상자 추가', () => { rows.push({ player: 0, to: 1, mode: 'exclude' }); paint(); scrollEnd(); }, {});
    chip(p, '로테이션 구성', () => {
      A.cons = rows.map(r => ({ player: r.player, from: 1, to: r.to, mode: r.mode }));
      A.special = A.cons.length > 0; compute();
    }, { primary: true });
    scrollEnd();
  }

  // 모은 답을 기존 계산기에 넣고 계산
  function compute() {
    $('teamName').value = A.vest;
    $('numPlayers').value = A.n;
    $('numGames').value = A.games;
    renderGames();
    const types = A.types.length === A.games ? A.types : Array(A.games).fill(A.per === '5' ? 5 : 6);
    document.querySelectorAll('#gameList .seg').forEach((seg, i) => {
      const btn = [...seg.children].find(b => b.textContent === types[i] + ':' + types[i]); if (btn) pick(btn, types[i]);
    });
    CONSTRAINTS = A.cons.map((c, i) => ({ id: i + 1, player: c.player, from: c.from, to: c.to, mode: c.mode }));
    CID = CONSTRAINTS.length + 1;
    renderConstraints();
    goTo(STEPS.indexOf('done'));
    setTimeout(() => { run(); save(); }, reduce ? 0 : 420);
  }

  function loadPrevious(saved) {
    A = Object.assign(freshAnswers(), saved.a || {}, { loaded: true });
    $('teamName').value = A.vest || '';
    $('numPlayers').value = saved.last.n;
    $('numGames').value = saved.last.types.length;
    renderGames();
    document.querySelectorAll('#gameList .seg').forEach((seg, i) => {
      const t = saved.last.types[i]; const btn = [...seg.children].find(b => b.textContent === t + ':' + t); if (btn) pick(btn, t);
    });
    CONSTRAINTS = saved.cons || []; CID = CONSTRAINTS.reduce((m, c) => Math.max(m, c.id || 0), 0) + 1; renderConstraints();
    LAST = saved.last;
    thread.innerHTML = '';
    bot('주장님, 새로운 로테이션을 짜드릴까요?');
    me('직전 로테이션 불러오기', 'start');
    const d = new Date(saved.savedAt || Date.now());
    bot('직전 로테이션을 불러왔습니다.<br><span class="soft">' + (d.getMonth() + 1) + '/' + d.getDate() + ' · ' + esc(A.vest || '') + ' 조끼 · ' + LAST.n + '명 · ' + LAST.types.length + '경기</span>');
    render(LAST.result, LAST.eval, LAST.n);   // 버튼 없이 바로 아래에 결과
  }

  let toastT = 0;
  function toast(msg) { const t = $('tmToast'); if (!t) return; t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2200); }

  // 결과 화면 '텍스트로 복사' 바로 아래: 새로운 로테이션 구성
  const copyBtn = $('copyBtn');
  if (copyBtn) {
    const nb = document.createElement('button'); nb.type = 'button'; nb.className = 'btn-new'; nb.id = 'newRotBtn';
    nb.textContent = '새로운 로테이션 구성';
    nb.addEventListener('click', () => { A = freshAnswers(); goTo(1); });
    copyBtn.insertAdjacentElement('afterend', nb);
    // '텍스트로 복사' → '카카오톡으로 공유': 휴대폰 공유 창을 띄워 카카오톡(단톡방)에 결과 전체를 바로 보냄.
    // 공유 창이 없는 환경(카카오톡 안 브라우저·PC 등)에서는 복사 후 붙여 넣기 안내.
    copyBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3C6.48 3 2 6.51 2 10.84c0 2.8 1.87 5.26 4.69 6.65l-.96 3.5c-.08.3.26.54.52.37l4.14-2.74c.53.06 1.06.1 1.61.1 5.52 0 10-3.51 10-7.88S17.52 3 12 3z"/></svg>카카오톡으로 공유';
    copyBtn.classList.add('btn-kakao');
    const hint = $('copyHint'); if (hint) hint.textContent = '공유 창에서 카카오톡을 고르면 위 배치가 그대로 단톡방에 올라갑니다.';
  }
  window.copyResultText = function () {
    if (typeof LAST === 'undefined' || !LAST) return;
    const text = window.buildShareText(LAST.n, LAST.result.games, LAST.result.rest, LAST.result.gk);
    const copy = () => {
      const ok = () => toast('복사했습니다. 카카오톡 대화창에 붙여 넣어 주세요.');
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok).catch(() => fallbackCopy(text, ok));
      else fallbackCopy(text, ok);
    };
    if (navigator.share && !/KAKAOTALK/i.test(navigator.userAgent || '')) {
      navigator.share({ text }).catch(e => { if (!e || e.name !== 'AbortError') copy(); });   // 사용자가 닫은 경우는 그대로
    } else copy();
  };

  goTo(0);
  window.__rot = { A: () => A, goTo };
  window.__rotSave = save;
})();

/* ===== 결과 화면: 한 경기 = 한 줄 (휴식 → 키퍼 → 필드, 칸 크기는 화면 폭에 맞춤) ===== */
(function () {
  'use strict';
  const orig = window.render;
  if (typeof orig !== 'function') return;
  const sort = a => a.slice().sort((x, y) => x - y);
  const pills = (arr, cls) => sort(arr).map(i => '<span class="pl ' + cls + '">' + (i + 1) + '</span>').join('');
  let lastRes = null;
  function fit() {
    const box = document.getElementById('schedule'), gl = box && box.querySelector('.gl');
    if (!gl || !lastRes) return;
    const g = lastRes.games;
    const mr = Math.max(1, ...g.map(x => x.resting.length + (x.excluded || []).length));
    const mk = Math.max(1, ...g.map(x => x.gks.length));
    const mf = Math.max(1, ...g.map(x => x.playing.length - x.gks.length));
    // 필드 칸은 휴식·키퍼 칸의 0.82배 크기. 폭 = 경기번호 40 + 칸 사이 3곳 + 칸 안 간격 4px
    const avail = gl.clientWidth - 8 - 40 - 3 * 8 - 4 * (mr - 1 + mk - 1 + mf - 1);
    const pw = Math.max(22, Math.min(36, Math.floor(avail / (mr + mk + mf * 0.82))));
    gl.style.setProperty('--pw', pw + 'px'); gl.style.setProperty('--fw', Math.floor(pw * 0.82) + 'px');
    gl.style.setProperty('--rc', mr); gl.style.setProperty('--kc', mk);
  }
  window.addEventListener('resize', fit);
  window.render = function (res, ev, n) {
    orig(res, ev, n);
    lastRes = res;
    const games = res.games;
    let h = '<div class="gl">' +
      '<div class="gr head"><span>경기</span><span>휴식</span><span>키퍼</span><span>필드</span></div>';
    games.forEach((g, i) => {
      const field = g.playing.filter(p => !g.gks.includes(p));
      const ex = g.excluded || [];
      h += '<div class="gr" role="group" aria-label="' + (i + 1) + '경기 ' + g.playCount + '대' + g.playCount +
        ', 휴식 ' + (sort(g.resting).map(x => x + 1).join('·') || '없음') + (ex.length ? ', 열외 ' + sort(ex).map(x => x + 1).join('·') : '') +
        ', 키퍼 ' + sort(g.gks).map(x => x + 1).join('·') + '번, 필드 ' + sort(field).map(x => x + 1).join('·') + '">' +
        '<div class="gno"><b>' + (i + 1) + '</b><small>' + g.playCount + ':' + g.playCount + '</small></div>' +
        '<div class="rs">' + (g.resting.length || ex.length ? pills(g.resting, 'r') + pills(ex, 'x') : '<span class="none">—</span>') + '</div>' +
        '<div class="gk">' + pills(g.gks, 'k') + '</div>' +
        '<div class="fd">' + pills(field, 'f') + '</div>' +
        '</div>';
    });
    // 범례: 번호 없이 색 모양만(빈 회색 = 휴식, 빈 노랑 = 키퍼, 회색 테두리 = 필드, 빨간 테두리 = 열외)
    const lg = (c, t) => '<span class="lg"><span class="pl ' + c + '"></span>' + t + '</span>';
    h += '</div><p class="gl-note">' + lg('r', '휴식') + lg('k', '키퍼') + lg('f', '필드') +
      (games.some(g => (g.excluded || []).length) ? lg('x', '열외(지각·부상)') : '') + '</p>';
    document.getElementById('schedule').innerHTML = h;
    fit();
    buildMid(res, n);
  };

  // 경기 도중 부상자·조퇴자: 경기 전 질문과 같은 구성
  //   현재 [ ]경기까지 완료 / 입력줄([ ]번 [ ]경기부터 + [열외 | 골키퍼 제외]) / + 추가 / 이후부터 다시 계산
  // 계산이 끝날 때마다(새 로테이션·다시 계산 모두) 접힌 상태 + 빈칸으로 되돌린다
  function buildMid(res, n) {
    const sec = document.getElementById('midSection'); if (!sec) return;
    sec.open = false;
    const sum = sec.querySelector('summary'); if (sum) sum.innerHTML = '경기 도중 부상자나 조퇴자 발생 <span class="chev">▾</span>';
    const body = sec.querySelector('.fold-body'); if (!body) return;
    const G = res.games.length;
    const opt = (from, to, sel) => { let h = '<option value=""' + (sel === '' ? ' selected' : '') + '></option>'; for (let v = from; v <= to; v++) h += '<option value="' + v + '"' + (v === sel ? ' selected' : '') + '>' + v + '</option>'; return h; };
    const mids = CONSTRAINTS.filter(c => c.mid);
    let done = '';
    let rows = [{ player: '', from: '', mode: 'exclude' }];
    body.innerHTML =
      '<input type="hidden" id="lockedCount" value="0">' +
      '<div class="mid">' +
        '<div class="mid-line">현재 <select id="midDone" aria-label="완료된 경기 수">' + opt(0, G - 1, '') + '</select> 경기까지 완료</div>' +
        '<div class="rc-rows" id="midRows"></div>' +
        '<button type="button" class="mid-add" id="midAdd">+ 부상자·조퇴자 추가</button>' +
        '<button type="button" class="btn-lg" id="midGo">이후부터 다시 계산</button>' +
        '<p class="mid-err" id="midErr" role="alert"></p>' +
        (mids.length ? '<div class="mid-list">' + mids.map(c => '<span>' + (c.player + 1) + '번 ' + c.from + '경기부터 ' + (c.mode === 'exclude' ? '열외' : '골키퍼 제외') + '</span>').join('') + '</div>' : '') +
        '<p class="fold-lead">완료한 경기는 그대로 두고, 그 다음 경기부터 로테이션을 다시 짭니다.</p>' +
      '</div>';
    const $$ = id => document.getElementById(id);
    const box = $$('midRows'), err = $$('midErr');
    const minFrom = () => (done === '' ? 1 : done + 1);
    function paint() {
      box.innerHTML = '';
      rows.forEach((r, i) => {
        if (r.from !== '' && r.from < minFrom()) r.from = minFrom();
        const row = document.createElement('div'); row.className = 'rc-form';
        row.innerHTML =
          '<label><select data-k="player" aria-label="' + (i + 1) + '번째 선수 번호">' + opt(1, n, r.player === '' ? '' : r.player + 1) + '</select><span>번</span></label>' +
          '<label><select data-k="from" aria-label="' + (i + 1) + '번째 몇 경기부터">' + opt(minFrom(), G, r.from) + '</select><span>경기부터</span></label>' +
          '<div class="mode-seg" role="radiogroup" aria-label="' + (i + 1) + '번째 종류">' +
            '<button type="button" role="radio" data-m="exclude" aria-checked="' + (r.mode === 'exclude') + '">열외 (부상·조퇴 등)</button>' +
            '<button type="button" role="radio" data-m="noKeeper" aria-checked="' + (r.mode === 'noKeeper') + '">골키퍼 제외</button></div>';
        row.querySelectorAll('select').forEach(sel => sel.addEventListener('change', () => {
          err.textContent = '';
          const v = sel.value === '' ? '' : +sel.value;
          if (sel.dataset.k === 'player') r.player = v === '' ? '' : v - 1; else { r.from = v; r.auto = false; }
        }));
        row.querySelectorAll('.mode-seg button').forEach(btn => btn.addEventListener('click', () => {
          err.textContent = ''; r.mode = btn.dataset.m;
          row.querySelectorAll('.mode-seg button').forEach(x => x.setAttribute('aria-checked', String(x === btn)));
        }));
        if (rows.length > 1) {
          const x = document.createElement('button'); x.type = 'button'; x.className = 'rc-row-x'; x.textContent = '삭제';
          x.setAttribute('aria-label', (i + 1) + '번째 입력줄 삭제');
          x.addEventListener('click', () => { rows.splice(i, 1); paint(); });
          row.appendChild(x);
        }
        box.appendChild(row);
      });
      const tip = document.createElement('p'); tip.className = 'rc-hint';
      tip.textContent = '부상자나 조퇴자가 더 있다면 추가를 누르세요';
      box.appendChild(tip);
    }
    paint();
    // 완료 경기를 고르면 '경기부터' 칸이 자동으로 그 다음 경기로 채워짐(직접 고른 값은 더 늦을 때만 유지)
    $$('midDone').addEventListener('change', e => {
      err.textContent = ''; done = e.target.value === '' ? '' : +e.target.value;
      rows.forEach(r => { if (done !== '' && (r.from === '' || r.auto || r.from < done + 1)) { r.from = done + 1; r.auto = true; } });
      paint();
    });
    $$('midAdd').addEventListener('click', () => { rows.push({ player: '', from: done === '' ? '' : done + 1, auto: done !== '', mode: 'exclude' }); paint(); });
    $$('midGo').addEventListener('click', () => {
      if (done === '' || rows.some(r => r.player === '' || r.from === '' || r.mode === '')) { err.textContent = '빈칸을 모두 골라 주세요.'; return; }
      rows.forEach(r => CONSTRAINTS.push({ id: CID++, player: r.player, from: Math.max(done + 1, r.from), to: G, mode: r.mode, mid: true }));
      renderConstraints();
      $$('lockedCount').value = done;
      runContinue();
      try { if (window.__rotSave) window.__rotSave(); } catch (e) {}
    });
  }
})();

/* ===== 텍스트로 복사: 단톡방용 간단한 형식 =====
   블루팀 풋살 로테이션 (총 9경기)
   1경기 휴식 1,2 | GK 3,4
   (번호별 누적은 넣지 않음. 열외자는 휴식에 포함, 휴식이 없으면 GK만, 경기 인원이 섞여 있으면 '(5:5)' 표시) */
(function () {
  'use strict';
  window.buildShareText = function (n, games) {
    const team = (document.getElementById('teamName').value || '').trim();
    const nums = arr => arr.slice().sort((a, b) => a - b).map(x => x + 1).join(',');
    // 처음 설정한 경기 인원이 섞여 있을 때만 (5:5) 표시 (열외로 인원이 줄어든 경우는 표시 안 함)
    const types = (window.LAST && LAST.types) || games.map(g => g.playCount);
    const mixed = new Set(types).size > 1;
    const lines = [(team ? team + '팀 ' : '') + '풋살 로테이션 (총 ' + games.length + '경기)', ''];
    games.forEach((g, i) => {
      // 열외자도 휴식에 포함, 휴식이 없으면 GK만
      const off = g.resting.concat(g.excluded || []);
      lines.push((i + 1) + '경기' + (mixed ? ' (' + types[i] + ':' + types[i] + ')' : '') +
        (off.length ? ' 휴식 ' + nums(off) + ' |' : '') + ' GK ' + (nums(g.gks) || '-'));
    });
    return lines.join('\n');
  };
})();
