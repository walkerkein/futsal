  /* ---------- 부저음 합성 ---------- */
  // freqs: 동시에 울릴 주파수들(두 개를 살짝 어긋나게 겹치면 경기장 부저처럼 거친 소리)
  function mixTone(buf, sr, t, dur, freqs, gain, maxH) {
    const start = Math.round(t * sr), n = Math.round(dur * sr);
    const parts = [];
    for (const f of freqs) for (let h = 1; f * h < sr * 0.45 && h <= (maxH || 99); h += 2) parts.push([2 * Math.PI * f * h / sr, 1 / h]);
    const norm = parts.reduce((s, p) => s + p[1], 0);
    const atk = 0.005 * sr, rel = 0.04 * sr;
    for (let i = 0; i < n; i++) {
      const j = start + i; if (j < 0 || j >= buf.length) continue;
      const env = Math.min(1, i / atk, (n - i) / rel);
      let v = 0; for (const p of parts) v += Math.sin(p[0] * i) * p[1];
      buf[j] += gain * env * v / norm;
    }
  }
  // 심판 호루라기: 2.8kHz 근처 고음 + 안에 든 구슬이 만드는 빠른 떨림(약 30Hz) + 숨소리
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  function mixWhistle(buf, sr, t, dur, gain) {
    const start = Math.round(t * sr), n = Math.round(dur * sr);
    const f0 = 2850, dev = 220, trill = 31, atk = 0.02 * sr, rel = 0.06 * sr;
    let ph = 0, lp = 0;
    for (let i = 0; i < n; i++) {
      const j = start + i; if (j < 0 || j >= buf.length) continue;
      const tt = i / sr;
      const rise = Math.min(1, tt / 0.04);                      // 불기 시작할 때 음이 살짝 올라감
      const wob = Math.sin(2 * Math.PI * trill * tt);
      const f = f0 * (0.93 + 0.07 * rise) + dev * wob;
      ph += 2 * Math.PI * f / sr;
      let v = Math.sin(ph) * (0.78 + 0.22 * wob);
      if (2 * f < sr * 0.45) v += 0.18 * Math.sin(2 * ph);
      lp += 0.35 * (rnd() - lp); v += 0.12 * lp;                  // 숨소리
      const env = Math.min(1, i / atk, (n - i) / rel);
      buf[j] += gain * env * v;
    }
  }
  // 알림음 한 번 불기: 설정의 휘슬 또는 부저음
  function blow(b, sr, t, dur, sv) {
    if (sv === 'buzzer') mixTone(b, sr, t, dur + 0.05, [1760], 0.6, 3);
    else mixWhistle(b, sr, t, dur, 0.8);
  }
  const SND = {
    tick:  (b, sr, t) => mixTone(b, sr, t, 0.16, [880], 0.6, 7),                 // 삑 (3·2·1)
    warn:  (b, sr, t) => [0, 0.14, 0.5, 0.64].forEach(d => mixTone(b, sr, t + d, 0.09, [1318], 0.55, 5)), // 삐빅 삐빅 (교체 10초 전)
    start: (b, sr, t, sv) => blow(b, sr, t, 0.9, sv),                            // 1번: 삐익~ (경기 시작)
    gk:    (b, sr, t, sv) => { blow(b, sr, t, 0.32, sv); blow(b, sr, t + 0.5, 0.32, sv); },   // 2번: 삑- 삑- (키퍼 교체)
    end:   (b, sr, t, sv) => { blow(b, sr, t, 0.3, sv); blow(b, sr, t + 0.45, 0.3, sv); blow(b, sr, t + 0.9, 1.3, sv); } // 3번: 삑 삑 삐이익 (경기 종료)
  };

  // 타임라인: 시점별로 낼 소리 목록
  function timeline(c) {
    const ev = [], sv = c.sv;
    const countdown = (t0, s) => { if (c.cd !== false) [3, 2, 1].forEach(k => ev.push({ t: t0 - k, s: 'tick' })); ev.push({ t: t0, s, sv }); };
    countdown(halfStart(c, 0), 'start');                    // (삑 삑 삑) + 알림음 1번 (전반 시작)
    for (let k = 1; k < c.r; k++) {
      const he = halfStart(c, k - 1) + c.t;                 // 전반 끝 = 키퍼 교체 휴식 시작(시계 멈춤)
      if (c.a > 0 && c.a < c.t) ev.push({ t: he - c.a, s: 'warn' });
      ev.push({ t: he, s: 'gk', sv });                      // 알림음 2번 (키퍼 교체)
      // 휴식 15초가 끝나면 소리 없이 그대로 후반 시작
    }
    const end = halfStart(c, c.r - 1) + c.t;
    countdown(end, 'end');                                  // (삑 삑 삑) + 알림음 3번 (경기 종료·막공)
    return { ev, total: end + LAST };
  }

  function renderWav(tl) {
    const sr = tl.total <= 20 * 60 ? 16000 : tl.total <= 40 * 60 ? 11025 : 8000;
    const n = Math.ceil(tl.total * sr), buf = new Float32Array(n);
    for (const e of tl.ev) SND[e.s](buf, sr, e.t, e.sv);
    let peak = 0; for (let i = 0; i < n; i++) { const a = Math.abs(buf[i]); if (a > peak) peak = a; }
    const amp = peak > 0 ? 0.97 / peak : 1;   // 경기장에서 잘 들리도록 최대 음량으로
    for (let i = 0; i < n; i++) buf[i] *= amp;
    const ab = new ArrayBuffer(44 + n * 2), dv = new DataView(ab);
    const str = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
    dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
    dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
    str(36, 'data'); dv.setUint32(40, n * 2, true);
    const pcm = new Int16Array(ab, 44, n);
    for (let i = 0; i < n; i++) { const v = buf[i]; pcm[i] = v >= 1 ? 32767 : v <= -1 ? -32768 : v * 32767; }
    return URL.createObjectURL(new Blob([ab], { type: 'audio/wav' }));
  }
