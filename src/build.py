# G풋살 웹앱 조립: src/의 조각을 합쳐 app/index.html을 만든다.  사용법: python3 src/build.py
import os
D = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(D)
def rd(n): return open(os.path.join(D, n), encoding='utf-8').read()
src = rd('base-rotation.html')   # 원래 로테이션 보드(계산 로직)
css = rd('timer.css')
html = rd('timer.html')
js = rd('head_part.js') + rd('sound_part.js') + rd('tail_part.js')
rcss = rd('rot.css')
rhtml = rd('rot.html')
rjs = rd('rot.js')
src = src.replace('<title>풋살 로테이션 보드</title>', '''<title>G풋살</title>
<meta name="theme-color" content="#000000">
<meta name="description" content="G풋살: 풋살 경기 타이머와 로테이션 구성">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icon-192.png" type="image/png">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black">
<meta name="apple-mobile-web-app-title" content="G풋살">''', 1)
src = src.replace('<meta name="viewport" content="width=device-width, initial-scale=1">',
                  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">', 1)
old_font = 'family=Barlow+Condensed:wght@500;600&family=Barlow:wght@400;500;600&display=swap'
assert old_font in src
src = src.replace(old_font, 'family=Barlow+Condensed:wght@500;600;700;800&family=Barlow:wght@400;500;600&family=Noto+Sans+KR:wght@700;900&display=swap')
src = src.replace('</style>', css + rcss + '</style>', 1)
src = src.replace('<body>\n<div class="wrap">', '<body class="app">\n' + html + '\n<div id="view-rotation" role="tabpanel" aria-labelledby="tabRotation" hidden>\n<div class="wrap">\n' + rhtml, 1)
i = src.index('</div>\n<script>')
src = src[:i] + '</div>\n</div><!-- /view-rotation -->\n<script>' + src[i + len('</div>\n<script>'):]
src = src.replace('</body>', '<script>\n' + js + '</script>\n<script>\n' + rjs + '</script>\n</body>', 1)
# 번호별 누적·복사 문구: 결석 → 열외
assert src.count("'<span>결석<b>'") == 1 and src.count("' · 결석'") == 1
src = src.replace("'<span>결석<b>'", "'<span>열외<b>'").replace("' · 결석'", "' · 열외'")
open(os.path.join(ROOT, 'app', 'index.html'), 'w', encoding='utf-8').write(src)
print('ok', len(src))
