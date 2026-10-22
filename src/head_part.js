/* ===================== 풋살 경기 타이머 =====================
   핵심 아이디어: 시작 버튼을 누르는 순간 경기 전체(준비 3초 + 전반 + 후반 + 막공)를
   "무음 + 정해진 시점의 부저·휘슬"로 이어 붙인 오디오 한 개로 만들어 재생한다.
   음악처럼 재생되므로 화면이 꺼지거나 다른 앱을 써도 정확한 시점에 소리가 난다.
   화면 표시는 그 오디오의 재생 위치(currentTime)를 기준으로 계산한다. */
(function () {
  'use strict';

  const PRE = 3.4;               // 준비 구간(앞 0.4초는 재생 시작 여유)
  const BREAK = 15;              // 전반이 끝나고 시계를 멈춘 채 키퍼를 교체하는 시간(초)
  const LAST = 30;               // 막공 시간(초): 시계는 계속 흐르고, 이후 경기 종료
  const ALARM = 10;              // 키퍼 교체 몇 초 전에 알릴지
  const HALVES = 2;              // 전반·후반
  const LIMIT = { tMin: 30, tMax: 10 * 60, step: 10 };   // 30초~10분, 10초 단위
  const KEY = 'futsalTimer.v1';

  /* ---------- 설정: 전·후반 경기시간(초) ---------- */
  // t: 전·후반 경기시간(초), cd: 3·2·1 카운트다운 소리, sv: 시작 알림(whistle | buzzer)
  const cfg = { t: 300, cd: true, sv: 'whistle' };
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s && Number.isFinite(s.t)) cfg.t = Math.min(LIMIT.tMax, Math.max(LIMIT.tMin, Math.round(s.t / LIMIT.step) * LIMIT.step));
    if (s && typeof s.cd === 'boolean') cfg.cd = s.cd;
    if (s && (s.sv === 'whistle' || s.sv === 'buzzer')) cfg.sv = s.sv;
  } catch (e) { /* 저장소를 못 쓰는 환경이면 기본값 사용 */ }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) {} }

  const $ = id => document.getElementById(id);
  const pad = n => String(n).padStart(2, '0');
  const half = k => (k === 0 ? '전반' : '후반');
  const mmss = s => pad(Math.floor(s / 60)) + ':' + pad(s % 60);
  const fmt = sec => mmss(Math.max(0, Math.ceil(sec - 1e-6)));   // 남은 시간(올림)
  // k번째 하프가 시작되는 오디오 시점(사이마다 키퍼 교체 휴식 BREAK초)
  const halfStart = (c, k) => PRE + k * (c.t + BREAK);
  const fmtUp = sec => mmss(Math.max(0, Math.floor(sec + 1e-6))); // 경과 시간(내림)

