# G풋살 저장소 안내 (작업자용)

지라운드·이리차 회원 전용 풋살 도우미. GitHub Pages(`https://walkerkein.github.io/futsal/`)로 배포된다.

## 구성
- `index.html` — 랜딩 페이지(직접 편집). 상단 안내 문구 "지라운드와 이리차 회원을 위한 풋살 도우미입니다. 무분별한 배포를 금지합니다."는 유지.
- `app/` — 웹앱(경기 타이머 + 로테이션 구성). **`app/index.html`은 직접 고치지 말고 `src/`를 고친 뒤 조립**한다.
  - `app/sw.js` — 오프라인 캐시. 아이콘·manifest 등 캐시 파일을 바꾸면 `VERSION`을 올린다(페이지는 매번 서버 확인).
- `src/` — 웹앱 원본 조각. 조립: `python3 src/build.py` → `app/index.html` 생성.
  - `base-rotation.html`: 원래 로테이션 보드(계산 로직 run/runContinue 등). 그 위에 아래 조각을 끼워 넣음.
  - 타이머: `timer.html`, `timer.css`, `head_part.js`(상수·시간 계산), `sound_part.js`(휘슬·부저 WAV 합성, 경기 전체를 한 오디오로 렌더), `tail_part.js`(화면·휠·설정·작은 화면·업데이트 띠).
  - 로테이션: `rot.html`, `rot.css`, `rot.js`(카카오톡식 문답, 결과 표, 경기 도중 변경, 복사 문구).
- `img/` — 랜딩 페이지 스크린샷.
- `android/` — 웹앱을 띄우는 안드로이드 앱(WebView, 작은 창 자동 전환, 진행 중 알림, 시스템 바 여백, `FutsalApp` JS 브리지: setRunning/enterPip/version).
- `.github/workflows/android.yml` — `android/**` 변경이 main에 오면 APK 빌드 → 릴리스 `v1.<run_number>`에 `futsal-helper.apk` 게시. 서명은 저장소 비밀값 `KEYSTORE_B64`, `KEYSTORE_PASSWORD`(별칭 futsal). 열쇠 파일은 절대 커밋하지 않는다.

## 배포 방식
- 회원 배포는 **웹앱 + 홈 화면에 추가**가 기본(안드로이드·아이폰 공통). 랜딩에 APK 다운로드 버튼은 두지 않음 — 삼성 갤럭시(One UI 9) 피싱 앱 탐지가 스토어 밖 APK를 '잠재적으로 유해한 앱'으로 경고하기 때문.
- 기존 APK 설치자는 그대로 사용 가능(웹을 불러옴). 유료 판매는 나중에 법인 명의 구글 플레이 등록 예정.

## 반영 방식
- 화면·기능 수정(`src/`, `app/`, `index.html`): main에 올리면 1~2분 뒤 Pages 반영. 안드로이드 앱도 웹을 불러오므로 재설치 불필요.
- 안드로이드 고유 기능 수정(`android/`): 새 APK 자동 빌드. 사용자는 다시 받아 덮어쓰기 설치.

## 디자인 원칙(사용자 확정 사항)
- 타이머 색: 대기·키퍼·알림 노랑 #FEFF65, 경기 중 연두 #B0FC66, 막공 빨강 #DE4837(흰 글씨), 하단 바 검정. 상단 탭은 흑백.
- 로테이션: 카카오톡 대화 스타일(배경 #B2C7D9, 답 칩 #F2F2F2, 강조 #FEE500), 질문자 이름 'G풋살 매니저'.
- 앱 이름 'G풋살', 아이콘: 빨간 바탕 + 검은 축구공 + 가운데 빨간 원 안의 흰 G.
- 문체: 존댓말, 짧게.
