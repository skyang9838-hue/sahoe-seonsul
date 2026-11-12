# (그림).hwpx의 자료 표(3열)를 장마다 [제목 / 그림 / 이야기] 세로 쌓기로 바꾼다 → (그림·세로).hwpx
import zipfile, re, os, shutil, sys
P = r'C:\Users\user\Desktop\vibecoding\sahoe-seonsul'
src = os.path.join(P, '문항', '시장경제 평가 문항 (그림).hwpx')
dst = os.path.join(P, '문항', '시장경제 평가 문항 (그림·세로).hwpx')
z = zipfile.ZipFile(src)
files = {n: z.read(n) for n in z.namelist()}
s = files['Contents/section0.xml'].decode('utf-8')
i = s.find('구분'); st = s.rfind('<hp:tbl ', 0, i); en = s.find('</hp:tbl>', i) + 9
t = s[st:en]
tcs = re.findall(r'<hp:tc .*?</hp:tc>', t, flags=re.S)
assert len(tcs) == 8
def paras(tc): return re.findall(r'<hp:p .*?</hp:p>', re.search(r'<hp:subList.*?</hp:subList>', tc, re.S).group(0), re.S)
W = 45877; INNER = W - 1020
def cell(row, body, h=1000, valign='CENTER'):
    return ('<hp:tr><hp:tc name="" header="0" hasMargin="0" protect="0" editable="0" dirty="0" borderFillIDRef="3">'
            f'<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="{valign}" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">'
            + body + '</hp:subList>'
            f'<hp:cellAddr colAddr="0" rowAddr="{row}"/><hp:cellSpan colSpan="1" rowSpan="1"/><hp:cellSz width="{W}" height="{h}"/>'
            '<hp:cellMargin left="510" right="510" top="283" bottom="283"/></hp:tc></hp:tr>')
def resize_pic(p, w, h):
    p = re.sub(r'<hp:orgSz width="\d+" height="\d+"/>', f'<hp:orgSz width="{w}" height="{h}"/>', p)
    p = re.sub(r'<hp:sz width="\d+" widthRelTo="ABSOLUTE" height="\d+"', f'<hp:sz width="{w}" widthRelTo="ABSOLUTE" height="{h}"', p)
    p = re.sub(r'centerX="\d+" centerY="\d+"', f'centerX="{w//2}" centerY="{h//2}"', p)
    p = re.sub(r'<hc:pt1 x="\d+" y="0"/><hc:pt2 x="\d+" y="\d+"/><hc:pt3 x="0" y="\d+"/>',
               f'<hc:pt1 x="{w}" y="0"/><hc:pt2 x="{w}" y="{h}"/><hc:pt3 x="0" y="{h}"/>', p)
    return p.replace('paraPrIDRef="28"', 'paraPrIDRef="20"', 1)
sizes = {1: (INNER, round(INNER * 1086 / 2926)), 2: (28000, 21000), 3: (28000, 21000)}
# 장마다 표를 따로 만든다 (한 덩어리면 쪽을 못 넘어가서 통째로 밀림)
tag0 = re.search(r'<hp:tbl [^>]*>', t).group(0)
pre = t[len(tag0): t.find('<hp:tr>')]
pst = s.rfind('<hp:p ', 0, st); pen = s.find('</hp:p>', en) + 7
para = s[pst:pen]
tid = int(re.search(r'id="(\d+)"', tag0).group(1))
blocks = []
for k in (1, 2, 3):
    head = ''.join(paras(tcs[k]))
    ps = paras(tcs[4 + k])
    pic, story = ps[0], ''.join(ps[1:])
    assert '<hp:pic ' in pic
    rows = cell(0, head) + cell(1, resize_pic(pic, *sizes[k])) + cell(2, story, valign='TOP')
    tag = re.sub(r'rowCnt="\d+" colCnt="\d+"', 'rowCnt="3" colCnt="1"', tag0)
    tag = tag.replace(f'id="{tid}"', f'id="{tid + k}"')
    tbl = tag + pre + rows + '</hp:tbl>'
    blocks.append(para[:st - pst] + tbl + para[en - pst:])
newp = ''.join(blocks)
newp = re.sub(r'<hp:linesegarray>.*?</hp:linesegarray>', '', newp, flags=re.S)
s = s[:pst] + newp + s[pen:]
# 장 → <자료 1>~<자료 3> (사용자 11/12)
L, R = '&lt;', '&gt;'
REPL = [
 ('※ 다음 '+L+'자료 1'+R+'을 읽고 물음에 답하시오.', '※ 다음 '+L+'자료 1'+R+'~'+L+'자료 3'+R+'을 읽고 물음에 답하시오.'),
 (L+'자료 1'+R+' 꼬꼬의 첫 출근', '꼬꼬의 첫 출근'),
 ('1장. 꼬꼬의 첫 월급', L+'자료 1'+R+' 꼬꼬의 첫 월급'),
 ('2장. 꼬꼬의 바쁜 공장', L+'자료 2'+R+' 꼬꼬의 바쁜 공장'),
 ('3장. 불꽃면 이야기', L+'자료 3'+R+' 불꽃면 이야기'),
 (L+'자료 1'+R+'의 1장에서', L+'자료 1'+R+'에서'),
 (L+'자료 1'+R+'의 2장에서', L+'자료 2'+R+'에서'),
 (L+'자료 1'+R+'의 3장을', L+'자료 3'+R+'을'),
 ('2장의 장면을 옮겨 쓰는', L+'자료 2'+R+'의 장면을 옮겨 쓰는'),
 ('3장에서 불꽃식품이 한 일', L+'자료 3'+R+'에서 불꽃식품이 한 일'),
]
for a, b in REPL:
    assert s.count(a) == 1, a
    s = s.replace(a, b)
files['Contents/section0.xml'] = s.encode('utf-8')
# 1장 그림을 가로로 합친 것으로 바꾼다 (image1)
files['BinData/image1.jpg'] = open(os.path.join(P, 'assets', '장면', '장면1-가로-대사.jpg'), 'rb').read()
tmp = dst + '.tmp.hwpx'
with zipfile.ZipFile(tmp, 'w') as o:
    for n in z.namelist():
        o.writestr(z.getinfo(n), files[n], compress_type=zipfile.ZIP_STORED if n == 'mimetype' else zipfile.ZIP_DEFLATED)
# 한글로 다시 저장 + PDF
import win32com.client as w
hwp = w.DispatchEx('HWPFrame.HwpObject')
try: hwp.RegisterModule('FilePathCheckDLL', 'FilePathCheckerModule')
except Exception: pass
hwp.Open(tmp, '', '')
hwp.SaveAs(dst, 'HWPX', ''); hwp.SaveAs(dst.replace('.hwpx', '.pdf'), 'PDF', '')
print('pages', hwp.PageCount); hwp.Clear(1); hwp.Quit(); os.remove(tmp)
