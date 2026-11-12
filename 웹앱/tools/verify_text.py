"""평가 원문 대조 (엄격): 한글본(문항/시장경제 평가 문항.hwpx)의 문단과 글자 그대로 같아야 한다.
1) 앱 → 한글본: app.html 1번 구역 문자열과 src:"원문" 대사가 한글본 문단 하나와 통째로 같아야 한다.
   (2번 빈칸 문장은 앞뒤 조각을 '(　　　　　　)' 전각 공백 6칸으로 이어 붙여 비교)
2) 한글본 → 앱: 지시문부터 4번 조건 나)까지 한글본 문단이 앱에 하나도 빠짐없이 있어야 한다.
하나라도 어긋나면 종료 코드 1."""
import re, sys, zipfile, pathlib, html as H
root = pathlib.Path(__file__).resolve().parent.parent
app = (root / 'src' / 'app.html').read_text(encoding='utf-8')
hwpx = root.parent / '문항' / '시장경제 평가 문항.hwpx'
with zipfile.ZipFile(hwpx) as z:
    xml = z.read('Contents/section0.xml').decode('utf-8')
paras = []
for p in re.findall(r'<hp:p\b.*?</hp:p>', xml, flags=re.S):
    if re.search(r'<hp:p\b', p[5:]):  # 표를 품은 바깥 문단은 건너뛴다(안쪽 문단이 따로 잡힘)
        inner = p
    t = ''.join(re.findall(r'<hp:t>(.*?)</hp:t>', p, flags=re.S))
    t = H.unescape(re.sub(r'<[^>]+>', '', t)).strip()
    if t: paras.append(t)
# 겹친 문단(바깥+안쪽)으로 생긴 긴 덩어리는 짧은 문단 목록으로 대체
pset = set()
for p in re.findall(r'<hp:p\b(?:(?!<hp:p\b).)*?</hp:p>', xml, flags=re.S):
    t = ''.join(re.findall(r'<hp:t>(.*?)</hp:t>', p, flags=re.S))
    t = H.unescape(re.sub(r'<[^>]+>', '', t)).strip()
    if t: pset.add(t)
ordered = [t for t in paras if t in pset]

def unq(s): return s.replace('\\"', '"')
sec = app.split('   2. 대사 —')[0]
dlg = app.split('   2. 대사 —')[1].split('   3. 구역 데이터')[0]
app_strings = []
q2 = re.search(r'lines:\s*\[\s*\["((?:[^"\\]|\\.)*)",\s*"((?:[^"\\]|\\.)*)"\],\s*\["((?:[^"\\]|\\.)*)",\s*"((?:[^"\\]|\\.)*)"\]', sec)
q2parts = set()
if q2:
    a, b, c, d = map(unq, q2.groups())
    q2parts = {a, b, c, d}
    app_strings += [a + '　' * 6 + b, c + '　' * 6 + d]
for s in re.findall(r'"((?:[^"\\]|\\.)*)"', sec):
    s = unq(s)
    if s in q2parts or not re.search(r'[가-힣]', s) or len(s) < 2: continue
    app_strings.append(s)
for m in re.finditer(r'text:\s*"((?:[^"\\]|\\.)*)",\s*src:\s*"원문"', dlg):
    app_strings.append(unq(m.group(1)))

part_fail = []
for m in re.finditer(r'text:\s*"((?:[^"\\]|\\.)*)",\s*src:\s*"원문일부"', dlg):
    t = unq(m.group(1))
    if not any(t in p0 for p0 in pset): part_fail.append(t)
fails = [s for s in app_strings if s not in pset] + part_fail
print(f'[앱→한글본] {len(app_strings)}개 대조, 불일치 {len(fails)}개')
for s in fails: print('  ✗', s)

# 한글본 → 앱 (지시문 ~ 4번 조건 나))
try:
    i0 = next(i for i, t in enumerate(ordered) if t.startswith('※ 다음'))
    i1 = next(i for i, t in enumerate(ordered) if t.startswith('나) 불꽃식품이 사회적 책임'))
except StopIteration:
    print('한글본에서 문항 범위를 찾지 못했습니다'); sys.exit(1)
SKIP = {'구분', '이야기'}
need = [t for t in ordered[i0:i1 + 1] if t not in SKIP]
aset = set(app_strings)
miss = [t for t in need if t not in aset]
print(f'[한글본→앱] {len(need)}개 문단 확인, 빠짐 {len(miss)}개')
for t in miss: print('  ✗', t)
if len(app_strings) < 25: print('대조 항목이 너무 적습니다'); sys.exit(1)
sys.exit(1 if (fails or miss) else 0)
