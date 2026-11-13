# 그림 통일(11/13): assets/통일/의 새 2D 그림 → 게임 장면·오프닝 + 문항 말풍선 그림
# 실행: PYTHONUTF8=1 python tools/unify_art.py   (결과: game/assets/scenes, game/assets/comic, assets/통일/문항용)
from PIL import Image, ImageDraw
import os
R = os.path.join(os.path.dirname(__file__), '..'); U = os.path.join(R, 'assets', '통일')
NL = chr(10)
def im(n): return Image.open(os.path.join(U, n + '.png')).convert('RGB')
def crop_w(i, ar, x0):            # 높이 그대로, 너비를 ar(가로/세로)에 맞춰 x0부터 자름
    w = round(i.height * ar); return i.crop((x0, 0, x0 + w, i.height))
def hcat(ims, h):
    ims = [i.resize((round(i.width * h / i.height), h), Image.LANCZOS) for i in ims]
    c = Image.new('RGB', (sum(i.width for i in ims) + 12 * (len(ims) - 1), h), 'white'); x = 0
    for i in ims: c.paste(i, (x, 0)); x += i.width + 12
    return c

from bubble import bubble   # tools/bubble.py (add_bubbles.py의 말풍선 함수)

fac = crop_w(im('1장-공장월급'), 1463 / 1086, 156)
mart = crop_w(im('1장-마트'), 1463 / 1086, 0)
night = crop_w(im('2장-밤10시'), 4 / 3, 171)
ramen = crop_w(im('3장-불꽃면(문항)'), 4 / 3, 85)

# 게임: 말풍선 없이
S = os.path.join(R, 'game', 'assets', 'scenes'); C = os.path.join(R, 'game', 'assets', 'comic')
hcat([fac, mart], 560).save(os.path.join(S, 'scene1.jpg'), quality=86)
# 2장 패널 칸은 글이 길어 가로 띠(376×76 ≈ 4.95:1) → 인물 얼굴 줄만 띠로
im('2장-밤10시').crop((0, 290, 1536, 600)).save(os.path.join(S, 'scene2.jpg'), quality=86)
hcat([im('3장-회의실'), im('3장-광고판'), im('3장-강가')], 420).save(os.path.join(S, 'scene3.jpg'), quality=86)
for k in (1, 2, 3):
    im(f'오프닝-{k}').crop((0, 80, 1536, 944)).resize((1280, 720), Image.LANCZOS).save(os.path.join(C, f'open{k}.jpg'), quality=86)

# 문항(한글본 BinData 크기와 같게): image1 = 1장 공장|마트(2926×1086), image2 = 2장(1448×1086), image3 = 3장(1448×1086)
f2, m2, n2 = fac.copy(), mart.copy(), night.copy()
d = ImageDraw.Draw(f2)
bubble(d, 1080, 125, 430, 200, (1150, 290), '이번 달' + NL + '월급이에요.', 66)
bubble(d, 520, 105, 370, 130, (650, 300), '감사합니다!', 60)
d = ImageDraw.Draw(m2)
bubble(d, 640, 100, 500, 190, (480, 250), '가격과 품질을' + NL + '비교해 보자.', 62)
bubble(d, 1150, 120, 380, 190, (950, 330), '어느 것이' + NL + '더 좋을까?', 62)
d = ImageDraw.Draw(n2)
bubble(d, 700, 200, 420, 300, (930, 420), '오늘부터' + NL + '밤 10시까지' + NL + '일하세요!', 60)
O = os.path.join(U, '문항용'); os.makedirs(O, exist_ok=True)
one = Image.new('RGB', (2926, 1086), 'white')
one.paste(f2.resize((1463, 1086), Image.LANCZOS), (0, 0)); one.paste(m2.resize((1463, 1086), Image.LANCZOS), (1463, 0))
one.save(os.path.join(O, 'image1.JPG'), quality=90)
n2.resize((1448, 1086), Image.LANCZOS).save(os.path.join(O, 'image2.JPG'), quality=90)
ramen.resize((1448, 1086), Image.LANCZOS).save(os.path.join(O, 'image3.JPG'), quality=90)
print('ok')
