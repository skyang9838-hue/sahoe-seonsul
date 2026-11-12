"""캐릭터 시트를 칸으로 나눠 흰 배경을 지우고 투명 PNG로 저장한다.
쓰는 법: python cut_sprites.py <시트.png> <열> <행> <출력폴더> <이름1,이름2,...> [높이=192]
흰 배경은 가장자리에서 이어진 밝은 칸만 지운다(캐릭터 안쪽 흰 깃털은 남는다)."""
import sys, pathlib
from collections import deque
from PIL import Image

src, cols, rows, out, names = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), pathlib.Path(sys.argv[4]), sys.argv[5].split(',')
H = int(sys.argv[6]) if len(sys.argv) > 6 else 192
out.mkdir(parents=True, exist_ok=True)
im = Image.open(src).convert('RGBA')
W0, H0 = im.size
cw, ch = (W0 // cols if cols else 0), H0 // rows

def unbg(c):
    w, h = c.size
    px = c.load()
    seen = bytearray(w * h)
    q = deque()
    def light(p):
        r, g, b, a = p
        return r > 236 and g > 236 and b > 236 and max(r, g, b) - min(r, g, b) < 18
    for x in range(w):
        q.append((x, 0)); q.append((x, h - 1))
    for y in range(h):
        q.append((0, y)); q.append((w - 1, y))
    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h: continue
        i = y * w + x
        if seen[i]: continue
        seen[i] = 1
        if not light(px[x, y]): continue
        px[x, y] = (255, 255, 255, 0)
        q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    # 테두리 반투명 처리(흰 테 없애기): 투명 칸과 맞닿은 밝은 칸은 반쯤 투명하게
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            r, g, b, a = px[x, y]
            if a and r > 225 and g > 225 and b > 225:
                if any(px[x + dx, y + dy][3] == 0 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    px[x, y] = (r, g, b, 90)
    return c

def auto_cols(img, n):
    # 흰색이 아닌 칸이 있는 세로줄을 찾아 덩어리로 나눈다 (간격이 일정하지 않은 시트용)
    g = img.convert('L'); w, h = g.size; px = g.load()
    filled = [any(px[x, y] < 230 for y in range(0, h, 2)) for x in range(w)]
    runs, x = [], 0
    while x < w:
        if filled[x]:
            s0 = x
            while x < w and filled[x]: x += 1
            runs.append([s0, x])
        else: x += 1
    while len(runs) > n:  # 가장 좁은 틈부터 합친다
        gaps = [(runs[i+1][0] - runs[i][1], i) for i in range(len(runs) - 1)]
        _, i = min(gaps); runs[i][1] = runs[i+1][1]; del runs[i+1]
    return runs

if cols == 0:
    runs = auto_cols(im, len(names))
    for (x0, x1), name in zip(runs, names):
        if not name or name == '-': continue
        cell = unbg(im.crop((max(0, x0 - 6), 0, min(W0, x1 + 6), H0)))
        bbox = cell.getbbox(); cell = cell.crop(bbox) if bbox else cell
        r = H / cell.height
        cell = cell.resize((max(1, round(cell.width * r)), H), Image.LANCZOS)
        cell.save(out / f'{name}.png'); print('saved', name, cell.size)
    sys.exit(0)

CUT_BOTTOM = {}
for kv in (sys.argv[7].split(',') if len(sys.argv) > 7 else []):
    a, b = kv.split('='); CUT_BOTTOM[a] = float(b)

k = 0
for ry in range(rows):
    for cx in range(cols):
        if k >= len(names): break
        name = names[k]; k += 1
        if not name or name == '-': continue
        cell = im.crop((cx * cw, ry * ch, (cx + 1) * cw, ry * ch + int(ch * CUT_BOTTOM.get(name, 1.0))))
        cell = unbg(cell)
        bbox = cell.getbbox()
        if bbox: cell = cell.crop(bbox)
        r = H / cell.height
        cell = cell.resize((max(1, round(cell.width * r)), H), Image.LANCZOS)
        cell.save(out / f'{name}.png')
        print('saved', name, cell.size)
