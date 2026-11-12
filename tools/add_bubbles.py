# 장면 그림에 말풍선 대사 넣기 → assets/장면/*-대사.png
from PIL import Image, ImageDraw, ImageFont
import os
D = os.path.join(os.path.dirname(__file__), '..', 'assets', '장면')
FONT = 'C:/Windows/Fonts/malgunbd.ttf'
LINE = (90, 62, 43); INK = (59, 42, 30)
NL = chr(10)

def bubble(d, cx, cy, w, h, tail, text, size):
    x0, y0, x1, y1 = cx-w//2, cy-h//2, cx+w//2, cy+h//2
    tx, ty = tail
    bx = max(x0+w*0.25, min(x1-w*0.25, tx))
    by = y1 if ty > cy else y0
    base = [(bx-26, by), (bx+26, by)]
    d.polygon(base + [(tx, ty)], fill='white', outline=LINE)
    d.line(base[0:1]+[(tx, ty)]+base[1:2], fill=LINE, width=5)
    d.rounded_rectangle((x0, y0, x1, y1), radius=min(h, w)//2, fill='white', outline=LINE, width=5)
    k = 4 if by == y1 else -4
    d.polygon([(bx-21, by-k), (bx+21, by-k), (tx, ty-(14 if ty > cy else -14))], fill='white')
    f = ImageFont.truetype(FONT, size)
    d.multiline_text((cx, cy), text, font=f, fill=INK, anchor='mm', align='center', spacing=10)

# 한글본 칸 너비(약 50mm)에서도 읽히게 글자 크게
jobs = {
 '장면1-공장': lambda d: (bubble(d, 1230, 140, 380, 190, (1290, 385), '이번 달'+NL+'월급이에요.', 62),
                        bubble(d, 1040, 320, 320, 110, (1010, 425), '감사합니다!', 54)),
 '장면1-마트': lambda d: (bubble(d, 345, 110, 480, 190, (505, 300), '가격과 품질을'+NL+'비교해 보자.', 60),
                        bubble(d, 1200, 185, 360, 180, (1180, 345), '어느 것이'+NL+'더 좋을까?', 60)),
 '장면2-공장장': lambda d: bubble(d, 955, 275, 450, 300, (1150, 440), '오늘부터'+NL+'밤 10시까지'+NL+'일하세요!', 58),
}
for name, fn in jobs.items():
    im = Image.open(os.path.join(D, name + '.png')).convert('RGB')
    fn(ImageDraw.Draw(im))
    im.save(os.path.join(D, name + '-대사.png'))
    print('saved', name)
