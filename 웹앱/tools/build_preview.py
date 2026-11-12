"""src/index.html의 <?!= include('x'); ?>를 파일 내용으로 바꿔 한 파일 미리보기(preview.html)를 만든다.
GAS 밖에서 열면 app.html의 SRV가 로컬 스텁으로 돈다(저장은 localStorage)."""
import re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
src = root / 'src'
html = (src / 'index.html').read_text(encoding='utf-8')
html = re.sub(r"<\?!=\s*include\('(\w+)'\);\s*\?>", lambda m: (src / (m.group(1) + '.html')).read_text(encoding='utf-8'), html)
out = root / 'preview.html'
out.write_text(html, encoding='utf-8')
print('wrote', out, len(html), 'bytes')
