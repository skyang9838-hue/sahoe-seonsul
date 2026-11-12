"""assets/의 배경·스프라이트를 data URL로 바꿔 src/theme.html(window.KK_ART)에 심는다.
배경: assets/bg/zone0~2.jpg (960x540 JPEG)  스프라이트: assets/sprites/<이름>/*.png 또는 assets/sprites/cast/<이름>.png"""
import base64, io, json, pathlib
from PIL import Image
root = pathlib.Path(__file__).resolve().parent.parent
A = root.parent / 'assets'
def url(path, fmt=None, h=None):
    im = Image.open(path)
    if h and im.height > h:
        im = im.resize((round(im.width * h / im.height), h), Image.LANCZOS)
    buf = io.BytesIO()
    if fmt == 'jpg':
        im.convert('RGB').save(buf, 'JPEG', quality=84, optimize=True, progressive=True); mime = 'image/jpeg'
    else:
        im.save(buf, 'PNG', optimize=True); mime = 'image/png'
    return f'data:{mime};base64,' + base64.b64encode(buf.getvalue()).decode()
art = {'zones': [url(A / 'bg' / f'zone{i}.jpg', 'jpg') for i in range(3)], 'chars': {}}
kk = A / 'sprites' / 'kkokko'
art['chars']['kkokko'] = {p.stem: url(p, h=160) for p in kk.glob('*.png')}
CAST = {'boss': 'boss', 'mom': 'mom', 'baby': 'baby', 'bear': 'bear', 'bunny': 'bunny', 'fox': 'fox'}
for key, name in CAST.items():
    f = A / 'sprites' / 'cast' / f'{name}.png'
    if not f.exists(): f = A / 'sprites' / 'cast' / f'{name}_old.png'
    if f.exists(): art['chars'][key] = {'front': url(f, h=160)}
sc = [A / 'scenes' / f'scene{i}.jpg' for i in (1, 2, 3)]
if all(f.exists() for f in sc):
    art['scenes'] = [url(f, 'jpg', h=600) for f in sc]
out = root / 'src' / 'theme.html'
out.write_text('<script>window.KK_ART = ' + json.dumps(art) + ';</script>\n', encoding='utf-8')
print('wrote', out, out.stat().st_size // 1024, 'KB')
