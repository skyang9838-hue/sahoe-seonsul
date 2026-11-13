# 말풍선 그리기 (add_bubbles.py·unify_art.py 공용)
from PIL import ImageFont
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

