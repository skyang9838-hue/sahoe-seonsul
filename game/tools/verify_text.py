"""평가 원문 대조 (엄격·양방향) — 3D 판(game/src) 기준.
2D 판 웹앱/tools/verify_text.py를 옮겼다. 원본 2D 파일은 그대로 둔다.

기준: 문항/시장경제 평가 문항.hwpx (Contents/section0.xml의 가장 안쪽 문단)

1) 앱 → 한글본
   - src/exam.js 1번 구역(「1. 평가 원문」 ~ 「2. 화면·상태」)의 문자열은 한글본 문단 하나와 통째로 같아야 한다.
     (2번 빈칸 문장은 앞뒤 조각을 '(　　　　　　)' 전각 공백 6칸으로 이어 붙여 비교)
   - src/story.js의 src:'원문' 대사(DIALOGUE·OPENING)도 한글본 문단 하나와 통째로 같아야 한다.
     src:'원문일부'는 한글본 문단 안에 그대로 들어 있어야 한다.
   - src/main.js 간판(signPlane) 글자 중 원문을 인용한 것(줄바꿈을 띄어쓰기로 바꿔 한글본 문단 안에 있는 것)은 목록으로 보여 준다.
2) 한글본 → 앱
   - 지시문부터 4번 조건 나)까지 한글본 문단이 exam.js 1번 구역에 하나도 빠짐없이 있어야 한다.
   - <자료 1> 이야기 문단(1~3장)이 대사(src:'원문')에 모두, 한글본 순서대로 나오는지 본다.
3) 렌더링 규칙: 2번 빈칸을 그리는 exam.js 코드가 기대하는 모양('(' 로 끝남, ')을/를' 로 시작)인지 본다.
4) 연출 세기: 같은 대사 묶음의 원문 줄끼리 cut·fade가 같고 cam이 모두 있거나 모두 없는지 본다.
하나라도 어긋나면 종료 코드 1.
"""
import re, sys, zipfile, pathlib, html as H

root = pathlib.Path(__file__).resolve().parent.parent          # game/
repo = root.parent
src = root / 'src'
exam = (src / 'exam.js').read_text(encoding='utf-8')
story = (src / 'story.js').read_text(encoding='utf-8')
main = (src / 'main.js').read_text(encoding='utf-8')
hwpx = repo / '문항' / '시장경제 평가 문항.hwpx'
# 다른 판과 대조: python tools/verify_text.py --hwpx "<한글본 경로>"
if '--hwpx' in sys.argv:
    hwpx = pathlib.Path(sys.argv[sys.argv.index('--hwpx') + 1])
print('기준:', hwpx.name)

# ── 한글본 문단 ──
with zipfile.ZipFile(hwpx) as z:
    xml = z.read('Contents/section0.xml').decode('utf-8')
ordered = []
for p in re.findall(r'<hp:p\b(?:(?!<hp:p\b).)*?</hp:p>', xml, flags=re.S):
    t = ''.join(re.findall(r'<hp:t>(.*?)</hp:t>', p, flags=re.S))
    t = H.unescape(re.sub(r'<[^>]+>', '', t)).strip()
    if t:
        ordered.append(t)
pset = set(ordered)


def js_unescape(s):
    return re.sub(r'\\(.)', lambda m: {'n': '\n', 't': '\t'}.get(m.group(1), m.group(1)), s)


STR = r'(?:"((?:[^"\\\n]|\\.)*)"|\'((?:[^\'\\\n]|\\.)*)\')'


def strings(code):
    for m in re.finditer(STR, code):
        yield js_unescape(m.group(1) if m.group(1) is not None else m.group(2))


fails = []

# ── 1) exam.js 1번 구역 ──
try:
    sec = exam.split('1. 평가 원문')[1].split('2. 화면·상태')[0]
except IndexError:
    print('exam.js에서 1번 구역 표시를 찾지 못했습니다'); sys.exit(1)
sec = re.sub(r'/\*.*?\*/', '', sec, flags=re.S)
app_strings = []
q2 = re.search(r'lines:\s*\[\s*\[\s*' + STR + r'\s*,\s*' + STR + r'\s*\]\s*,\s*\[\s*' + STR + r'\s*,\s*' + STR + r'\s*\]', sec)
q2parts = set()
if not q2:
    fails.append('(2번 빈칸 문장 lines 구조를 찾지 못함)')
else:
    g = q2.groups()
    a, b, c, d = [js_unescape(g[i] if g[i] is not None else g[i + 1]) for i in (0, 2, 4, 6)]
    q2parts = {a, b, c, d}
    app_strings += [a + '　' * 6 + b, c + '　' * 6 + d]
    # 3) 렌더링 규칙(exam.js qHTML: pre = ln[0].slice(0,-1), post = ln[1].slice(0,5))
    for x in (a, c):
        if not x.endswith('('):
            fails.append('(2번 앞 조각이 "("로 끝나지 않음: ' + x + ')')
    for y in (b, d):
        if not y.startswith(')을/를'):
            fails.append('(2번 뒤 조각이 ")을/를"로 시작하지 않음: ' + y + ')')
    if 'ln[0].slice(0, -1)' not in exam or 'ln[1].slice(0, 5)' not in exam:
        fails.append('(2번 빈칸 렌더링 코드가 바뀜 — slice 규칙 다시 확인)')
for s in strings(sec):
    if s in q2parts or not re.search(r'[가-힣]', s) or len(s) < 2:
        continue
    app_strings.append(s)
exam_fail = [s for s in app_strings if s not in pset]
print(f'[exam.js → 한글본] {len(app_strings)}개 대조, 불일치 {len(exam_fail)}개')
for s in exam_fail:
    print('  ✗', repr(s))
fails += exam_fail

# ── 1) story.js 원문 대사 ──
LINE = re.compile(r'text:\s*(?:' + STR + r')\s*,\s*src:\s*[\'"](원문|원문일부)[\'"]')
dlg_lines = []   # (종류, 문장)
for m in LINE.finditer(story):
    t = js_unescape(m.group(1) if m.group(1) is not None else m.group(2))
    dlg_lines.append((m.group(3), t))
dfail = []
for kind, t in dlg_lines:
    ok = (t in pset) if kind == '원문' else any(t in p0 for p0 in pset)
    if not ok:
        dfail.append(t)
print(f'[story.js 원문 대사 → 한글본] {len(dlg_lines)}개 대조, 불일치 {len(dfail)}개')
for t in dfail:
    print('  ✗', repr(t))
fails += dfail

# ── 1) main.js 간판 글자 ──
signs = []
for m in re.finditer(r'signPlane\(\s*(?:' + STR + r')', main):
    signs.append(js_unescape(m.group(1) if m.group(1) is not None else m.group(2)))
for m in re.finditer(r'signPlane\(\s*([A-Za-z_]\w*\[[^\]]*\])', main):
    signs.append('(변수) ' + m.group(1))
quoted = []
for s in signs:
    flat = re.sub(r'\s*\n\s*', ' ', s)
    if any(flat in p0 for p0 in pset) and len(flat) >= 4:
        quoted.append(s)
print(f'[main.js 간판] {len(signs)}개, 원문 인용 {len(quoted)}개: ' + ', '.join(repr(q) for q in quoted))
others = [s for s in signs if s not in quoted]
print('  (원문 아닌 간판 → check_hints.py가 본다) ' + ', '.join(repr(s) for s in others))
# 원문 속 작은따옴표 인용('불꽃면', '채소가 가득한 건강한 라면!' 등)과 비슷한데 글자가 다른 간판 → 실패
import difflib
cites = sorted({q for p0 in pset for q in re.findall(r"'([^']{2,})'", p0)})
near_miss = []
for s in others:
    flat = re.sub(r'\s*\n\s*', ' ', s)
    for q in cites:
        if flat != q and difflib.SequenceMatcher(None, flat, q).ratio() >= 0.6:
            near_miss.append((s, q))
for s, q in near_miss:
    print(f'  ✗ 원문 인용과 비슷하지만 다름: {s!r} ↔ 원문 {q!r}')
fails += [f'(간판 {s!r})' for s, q in near_miss]

# ── 2) 한글본 → exam.js ──
try:
    i0 = next(i for i, t in enumerate(ordered) if t.startswith('※ 다음'))
    i1 = next(i for i, t in enumerate(ordered) if t.startswith('나) 불꽃식품이 사회적 책임'))
    # (세로판처럼 자료 제목이 <자료 N> 으로 나뉜 판도 같은 범위를 쓴다)
except StopIteration:
    print('한글본에서 문항 범위를 찾지 못했습니다'); sys.exit(1)
SKIP = {'구분', '이야기'}
need = [t for t in ordered[i0:i1 + 1] if t not in SKIP]
aset = set(app_strings)
miss = [t for t in need if t not in aset]
print(f'[한글본 → exam.js] {len(need)}개 문단 확인, 빠짐 {len(miss)}개')
for t in miss:
    print('  ✗', repr(t))
fails += miss

# ── 2) 이야기 문단 → 대사 (빠짐·순서) ──
try:
    s0 = ordered.index('이야기') + 1 if '이야기' in ordered else i0 + 1
    s1 = next(i for i, t in enumerate(ordered) if t.startswith('1. <자료 1>'))
except (ValueError, StopIteration):
    print('한글본에서 이야기 범위를 찾지 못했습니다'); sys.exit(1)
# 이야기 문단 = 문장으로 끝나는 것(자료 제목·장 제목·표 머리는 뺀다)
story_paras = [t for t in ordered[s0:s1] if t not in SKIP and not t.startswith('<자료') and not re.match(r'^\d장\.', t) and re.search(r'[.!?]["\']?$', t)]
said = [t for k, t in dlg_lines if k == '원문']
smiss = [t for t in story_paras if t not in said]
# story.js에 적힌 순서: OPENING은 파일 뒤쪽에 있지만 게임에서는 맨 먼저 나온다
open_part = story.split('export const OPENING')[1] if 'export const OPENING' in story else ''
open_said = [js_unescape(m.group(1) if m.group(1) is not None else m.group(2)) for m in LINE.finditer(open_part) if m.group(3) == '원문']
play_order = open_said + [t for t in said if t not in open_said]
seq = [t for t in play_order if t in story_paras]
order_ok = seq == [t for t in story_paras if t in seq]
dup = sorted({t for t in said if said.count(t) > 1})
print(f'[이야기 → 대사] {len(story_paras)}개 문단, 대사에 없음 {len(smiss)}개, 순서 {"맞음" if order_ok else "어긋남"}, 두 번 나옴 {len(dup)}개')
for t in smiss:
    print('  ✗ 대사에 없음:', repr(t))
for t in dup:
    print('  · 두 번 나옴:', repr(t))
if not order_ok:
    fails.append('(대사 순서가 한글본과 다름)')
fails += smiss
# ── 4) 같은 장 원문 줄의 연출 세기 (답이 될 줄만 세게 보여 주지 않게) ──
#   한 대사 묶음(ramen·rollcall·meeting) 안의 원문 줄끼리 cut·fade가 같고, cam은 모두 있거나 모두 없어야 한다.
dsec = story.split('export const DIALOGUE')[1].split('export const OPENING')[0]
groups, cur = {}, None
for ln in dsec.splitlines():
    mk = re.match(r'\s*(\w+)\s*:\s*\[', ln)
    if mk: cur = mk.group(1)
    for obj in re.findall(r'\{[^{}]*\}', ln):
        if re.search(r"src:\s*'원문'", obj):
            fx = (bool(re.search(r'cut:\s*true', obj)), bool(re.search(r'fade:\s*true', obj)), bool(re.search(r"cam:\s*'", obj)))
            groups.setdefault(cur, []).append(fx)
efail = [k for k, v in groups.items() if len(set(v)) > 1]
print(f'[원문 줄 연출 세기] 묶음 {len(groups)}개 (' + ', '.join(f'{k} {len(v)}줄' for k, v in groups.items()) + f'), 어긋남 {len(efail)}개')
for k in efail:
    print(f'  ✗ {k}: 줄마다 (cut, fade, cam) = {groups[k]}')
fails += [f'(연출 세기 {k})' for k in efail]
if len(app_strings) < 25:
    print('대조 항목이 너무 적습니다'); sys.exit(1)
print('통과' if not fails else f'실패 {len(fails)}건')
sys.exit(1 if fails else 0)
