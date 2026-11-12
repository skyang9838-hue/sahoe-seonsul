"""답 암시 검사: 평가 원문이 아닌 화면 문구(대사·안내·aria-label·index.html 글자)에 금지어가 없는지 본다.
원문 구역(1번)과 src:"원문" 대사는 빼고 본다. 걸리면 종료 코드 1."""
import re, sys, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
BANNED = ['권리', '자유', '책임', '침해', '거짓', '허위', '과장', '오염', '산재', '보험', '법', '제도',
          '대가', '노동력', '소득', '가계', '기업', '불공정', '문제', '나쁜', '잘못된']
app = (root / 'src' / 'app.html').read_text(encoding='utf-8')
idx = (root / 'src' / 'index.html').read_text(encoding='utf-8')

texts = []
dlg = app.split('   2. 대사 —')[1].split('   3. 구역 데이터')[0]
for m in re.finditer(r'text:\s*"((?:[^"\\]|\\.)*)"(,\s*src:\s*"([^"]+)")?', dlg):
    if m.group(3) in ('원문', '원문일부'):
        continue
    texts.append(('대사', m.group(1)))
rest = app.split('   3. 구역 데이터')[1]
# 코드 속 한글 문자열 (Q1~Q4·CHAPTERS 참조는 원문이라 제외됨)
for s in re.findall(r'"([^"\n]*[가-힣][^"\n]*)"', rest):
    texts.append(('코드', s))
for s in re.findall(r"'([^'\n]*[가-힣][^'\n]*)'", rest):
    texts.append(('코드', s))
body = re.sub(r'<(script|style)[^>]*>.*?</\1>', '', idx, flags=re.S)
for s in re.findall(r'>([^<]*[가-힣][^<]*)<', body):
    texts.append(('화면', s.strip()))
for s in re.findall(r'aria-label="([^"]+)"', idx + rest):
    texts.append(('aria', s))

# 허용: 문항 칸 이름처럼 원문에 이미 있는 낱말이 붙은 라벨
ALLOW = ['1번 가계', '1번 기업']
hits = []
for kind, t in texts:
    if t in ALLOW:
        continue
    for w in BANNED:
        if w in t:
            hits.append((kind, w, t))
print(f'검사 {len(texts)}개 문구, 걸림 {len(hits)}개')
for k, w, t in hits:
    print(f'  ✗ [{k}] "{w}" ← {t}')
sys.exit(1 if hits else 0)
