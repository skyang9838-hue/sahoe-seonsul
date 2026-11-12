# shots_art.js로 찍은 게임 장면을 게임 그림으로 줄이고 붙인다.
# PYTHONUTF8=1 python tools/compose_art.py <찍은 폴더>
#   scene1a·b     → assets/scenes/scene1.jpg (공장에서 일하기 | 마트에서 장보기 두 칸, 376×100 비율 3배)
#   scene2        → assets/scenes/scene2.jpg (376×76 비율 3배)
#   scene3a·b·c   → assets/scenes/scene3.jpg (회의실 | 광고판 | 강가 세 칸)
#   open1~3       → assets/comic/open1~3.jpg (1280×720)
import sys, os
from PIL import Image

src = sys.argv[1]
here = os.path.dirname(os.path.abspath(__file__))
scenes = os.path.join(here, '..', 'assets', 'scenes')
comic = os.path.join(here, '..', 'assets', 'comic')
W = 1128           # 376 × 3
GAP = 6            # 세 칸 사이 틈(그림 테두리 색)
GAP_COLOR = (230, 214, 192)   # #e6d6c0 (exam.css .scene img 테두리)


def load(name):
    return Image.open(os.path.join(src, name + '.png')).convert('RGB')


def save(im, path):
    im.save(path, 'JPEG', quality=86, optimize=True, progressive=True)
    print(os.path.relpath(path, os.path.join(here, '..')), im.size, round(os.path.getsize(path) / 1024), 'KB')


def strip(names, path):
    n = len(names)
    cw = (W - (n - 1) * GAP) // n
    im = Image.new('RGB', (W, 300), GAP_COLOR)
    x0 = (W - n * cw - (n - 1) * GAP) // 2
    for i, nm in enumerate(names):
        im.paste(load(nm).resize((cw, 300), Image.LANCZOS), (x0 + i * (cw + GAP), 0))
    save(im, path)


strip(['scene1a', 'scene1b'], os.path.join(scenes, 'scene1.jpg'))
save(load('scene2').resize((W, 228), Image.LANCZOS), os.path.join(scenes, 'scene2.jpg'))
strip(['scene3a', 'scene3b', 'scene3c'], os.path.join(scenes, 'scene3.jpg'))
for i in (1, 2, 3):
    save(load('open%d' % i).resize((1280, 720), Image.LANCZOS), os.path.join(comic, 'open%d.jpg' % i))
