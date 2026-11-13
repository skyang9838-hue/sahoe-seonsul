"""답 암시 검사 — 3D 판(game/src) 기준. 2D 판 웹앱/tools/check_hints.py를 옮겼다(원본 2D 파일은 그대로).

평가 원문이 아닌 화면 문구에 금지어가 없는지 본다.
  - 원문으로 빼는 것: exam.js 1번 구역(평가 원문), story.js의 src:'원문'·'원문일부' 대사,
    main.js 간판 중 한글본 문단 안에 그대로 있는 글자(광고판 인용 등)
  - 보는 것: story.js 안내 대사·퀘스트 문구·오프닝 안내·인물 이름, main.js 한글 문자열(간판·라벨·안내·구역 배너),
    exam.js 2번 구역 뒤 한글 문자열(토스트·확인 창·저장 안내), index.html 보이는 글자·aria-label·alt·title
금지어(BANNED)가 걸리면 종료 코드 1.
주의어(WATCH: 예시 답안의 핵심 낱말)는 원문 밖에서 쓰였는지 목록만 보여 준다(사람이 판단).
"""
import re, sys, zipfile, pathlib, html as H

root = pathlib.Path(__file__).resolve().parent.parent          # game/
repo = root.parent
src = root / 'src'
exam = (src / 'exam.js').read_text(encoding='utf-8')
story = (src / 'story.js').read_text(encoding='utf-8')
main = (src / 'main.js').read_text(encoding='utf-8')
idx = (root / 'index.html').read_text(encoding='utf-8')

# 2D 판과 같은 금지어 (채점 기준·예시 답안의 개념어)
BANNED = ['권리', '자유', '책임', '침해', '거짓', '허위', '과장', '오염', '산재', '보험', '법', '제도',
          '대가', '노동력', '소득', '가계', '기업', '불공정', '문제', '나쁜', '잘못된', '정당', '보상',
          '근로기준', '휴식', '초과', '수당', '소비자', '환경', '속이', '속였']
# 주의어: 예시 답안 정답 낱말 — 원문에는 있지만, 원문 밖에서 되풀이하면 그쪽으로 눈길이 간다
WATCH = ['월급', '돈', '고용', '판매', '팔', '1,200원', '광고', '채소', '더러운', '폐수', '강물', '다친', '다쳐',
         '점심', '밤 10시', '쉬지', '걱정', '가격', '품질', '비교', '취업', '일할 사람', '구해요']
# 허용: 원문 문항 칸 이름이 그대로 붙은 라벨
ALLOW = {'1번 가계', '1번 기업', '가계(꼬꼬네 가족):', '기업(불꽃식품):',
         '1번 (1) 가계', '1번 (1) 기업',          # 답 칸 이름(빈칸 안내용)
         '나) 다하지 못한 점', '나) 개선할 방법'}   # 3번 조건 나) 원문 낱말을 그대로 쓴 칸 이름표

hwpx = repo / '문항' / '시장경제 평가 문항 (그림·세로).hwpx'
# worktree처럼 문항/ 이 없는 곳에서는: python tools/check_hints.py --hwpx "<한글본 경로>"
if '--hwpx' in sys.argv:
    hwpx = pathlib.Path(sys.argv[sys.argv.index('--hwpx') + 1])
with zipfile.ZipFile(hwpx) as z:
    xml = z.read('Contents/section0.xml').decode('utf-8')
paras = set()
for p in re.findall(r'<hp:p\b(?:(?!<hp:p\b).)*?</hp:p>', xml, flags=re.S):
    t = ''.join(re.findall(r'<hp:t>(.*?)</hp:t>', p, flags=re.S))
    t = H.unescape(re.sub(r'<[^>]+>', '', t)).strip()
    if t:
        paras.add(t)

STR = r'(?:"((?:[^"\\\n]|\\.)*)"|\'((?:[^\'\\\n]|\\.)*)\'|`((?:[^`\\]|\\.)*)`)'


def unesc(s):
    return re.sub(r'\\(.)', lambda m: {'n': '\n'}.get(m.group(1), m.group(1)), s)


def lits(code):
    out = []
    for m in re.finditer(STR, code):
        s = next(g for g in m.groups() if g is not None) if any(g is not None for g in m.groups()) else ''
        out.append((code.count('\n', 0, m.start()) + 1, unesc(s)))
    return out


def strip_comments(code):
    # 줄 주석·블록 주석 지우기(문자열 안 // 는 드묾 — 주소 등은 한글이 없어 영향 없음). 줄 번호는 유지한다.
    code = re.sub(r'/\*.*?\*/', lambda m: '\n' * m.group(0).count('\n'), code, flags=re.S)
    return re.sub(r'(^|[^:\\])//[^\n]*', r'\1', code)


def is_quote(s):
    flat = re.sub(r'\s*\n\s*', ' ', s).strip()
    return len(flat) >= 4 and any(flat in p for p in paras)


texts = []   # (출처, 문구)
# story.js
LINE = re.compile(r'text:\s*' + STR + r'(\s*,\s*src:\s*[\'"]([^\'"]+)[\'"])?')
sj = strip_comments(story)
spans = []
for m in LINE.finditer(sj):
    t = unesc(next(g for g in m.groups()[:3] if g is not None))
    line = sj.count('\n', 0, m.start()) + 1
    spans.append((m.start(), m.end()))
    if m.group(5) in ('원문', '원문일부'):
        continue
    texts.append((f'story.js:{line} 대사', t))
rest = ''.join(ch if not any(a <= i < b for a, b in spans) else ' ' for i, ch in enumerate(sj))
for line, s in lits(rest):
    if re.search('[가-힣]', s):
        texts.append((f'story.js:{line}', s))
# main.js
mj = strip_comments(main)
mj = re.sub(r"'\s*\+\s*String\.fromCharCode\(10\)\s*\+\s*'", r'\\n', mj)   # 줄바꿈 이어 붙인 간판 글자를 하나로
for line, s in lits(mj):
    if not re.search('[가-힣]', s) or re.search(r'console\.', mj.split('\n')[line - 1]):
        continue
    if is_quote(s):
        continue   # 원문 인용(verify_text.py가 글자 대조)
    texts.append((f'main.js:{line}', s))
# exam.js (1번 원문 구역 뒤)
# (구역 표시는 주석 안에 있으므로 주석을 지우기 전에 자른다 — 전에는 지운 뒤에 찾아서 2번 구역을 통째로 못 봤다)
cut = exam.find('2. 화면·상태')
if cut < 0:
    print('exam.js에서 2번 구역 표시를 찾지 못했습니다'); sys.exit(1)
ej = strip_comments(exam[cut:])
n_exam = 0
for line, s in lits(ej):
    if re.search('[가-힣]', s):
        texts.append((f'exam.js:{exam.count(chr(10), 0, cut) + line}', s)); n_exam += 1
if n_exam < 20:
    print(f'exam.js 화면 문구가 너무 적게 잡혔습니다({n_exam}개)'); sys.exit(1)
# index.html
body = re.sub(r'<(script|style)[^>]*>.*?</\1>', '', idx, flags=re.S)
for m in re.finditer(r'>([^<]*[가-힣][^<]*)<', body):
    texts.append((f'index.html:{body.count(chr(10), 0, m.start()) + 1}', H.unescape(m.group(1).strip())))
for m in re.finditer(r'(?:aria-label|alt|title|placeholder)="([^"]*[가-힣][^"]*)"', idx):
    texts.append((f'index.html:{idx.count(chr(10), 0, m.start()) + 1} 속성', m.group(1)))

hits, watch = [], []
for where, t in texts:
    if t.strip() in ALLOW:
        continue
    for w in BANNED:
        if w in t:
            hits.append((where, w, t))
    for w in WATCH:
        if w in t:
            watch.append((where, w, t))
print(f'검사 {len(texts)}개 문구, 금지어 걸림 {len(hits)}개')
for where, w, t in hits:
    print(f'  ✗ [{where}] "{w}" ← {t!r}')
print(f'주의어(원문 밖 정답 낱말) {len(watch)}개 — 사람이 판단')
for where, w, t in watch:
    print(f'  · [{where}] "{w}" ← {t!r}')

# ── 제출 뒤 돌아다니기 대사(story.js의 이름+Roam): 인정 단어(실제 목록)가 하나도 없어야 한다 ──
#   실제 목록은 공개 저장소에 없다 — 이 컴퓨터의 비공개 파일에서만 읽는다(없으면 건너뛰고 알린다):
#   server/private/keywords.json(채점용, .gitignore) · 문항/키워드 채점 기준 (꼬꼬의 첫 출근).html(.gitignore)
import json
kw = set()
def walk(v):
    if isinstance(v, str):
        if re.search('[가-힣]', v): kw.add(v.strip())
    elif isinstance(v, dict):
        for x in v.values(): walk(x)
    elif isinstance(v, list):
        for x in v: walk(x)
priv = repo / 'server' / 'private' / 'keywords.json'
if priv.exists():
    try: walk(json.loads(priv.read_text(encoding='utf-8')))
    except Exception as e: print('  (비공개 인정 단어 JSON을 읽지 못함:', e, ')')
kwhtml = repo / '문항' / '키워드 채점 기준 (꼬꼬의 첫 출근).html'
if kwhtml.exists():
    for m in re.finditer(r'<span class="kw">(.*?)</span>', kwhtml.read_text(encoding='utf-8'), flags=re.S):
        w = H.unescape(re.sub(r'<[^>]+>', '', m.group(1))).strip()
        if w: kw.add(w)
kw = {w for w in kw if len(w) <= 20}
roam = []
dsec = sj.split('export const DIALOGUE')[1].split('export const OPENING')[0] if 'export const DIALOGUE' in sj else ''
cur = None
for ln in dsec.splitlines():
    mk = re.match(r'\s*(\w+)\s*:\s*\[', ln)
    if mk: cur = mk.group(1)
    if cur and cur.endswith('Roam'):
        for m in re.finditer(r"text:\s*'((?:[^'\\]|\\.)*)'", ln):
            roam.append((cur, unesc(m.group(1))))
roam_hits = []
for k, t in roam:
    flat = re.sub(r'\s', '', t)
    for w in kw:
        wf = re.sub(r'\s', '', w)
        if not wf: continue
        if len(wf) == 1:   # 한 글자 낱말(돈·법·강·값 등)은 어절 첫 글자일 때만
            if re.search(r'(^|[\s"(])' + re.escape(wf), t): roam_hits.append((k, w, t))
        elif wf in flat:
            roam_hits.append((k, w, t))
if not kw:
    print(f'제출 뒤 대사 {len(roam)}줄 — 비공개 인정 단어 목록이 이 컴퓨터에 없어 건너뜀(금지어 검사만 함)')
else:
    print(f'제출 뒤 대사 {len(roam)}줄 × 인정 단어 {len(kw)}개, 걸림 {len(roam_hits)}개')
    for k, w, t in roam_hits:
        print(f'  ✗ [{k}] 인정 단어 ← {t!r}')   # 단어 자체는 화면에만(로그에 목록을 남기지 않게 낱말은 안 찍음)
if len(roam) < 10:
    print('제출 뒤 대사가 너무 적게 잡혔습니다'); hits.append(('story.js', 'Roam', '(대사 묶음 못 찾음)'))
sys.exit(1 if hits or roam_hits else 0)
