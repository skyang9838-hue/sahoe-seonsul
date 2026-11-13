# 한글본 그림만 바꿔 끼우기: 원본 hwpx의 BinData/image1~3을 assets/통일/문항용/ 것으로 교체 → 한글로 다시 저장 + PDF
# 실행: PYTHONUTF8=1 python tools/swap_pics.py <원본.hwpx> <새.hwpx> [--nocom]
#  --nocom: 한글 COM 없이 zip만 (한컴 보안 모듈이 등록 안 된 컴에서는 COM이 숨은 확인 창에서 멈춤)
import sys, os, zipfile, tempfile
src, dst = os.path.abspath(sys.argv[1]), os.path.abspath(sys.argv[2])
P = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', '통일', '문항용')
z = zipfile.ZipFile(src); tmp = os.path.join(tempfile.gettempdir(), 'kk_swap.hwpx')
with zipfile.ZipFile(tmp, 'w') as o:
    for n in z.namelist():
        b = os.path.basename(n)
        data = open(os.path.join(P, b), 'rb').read() if n.startswith('BinData/') and os.path.exists(os.path.join(P, b)) else z.read(n)
        o.writestr(z.getinfo(n), data, compress_type=zipfile.ZIP_STORED if n == 'mimetype' else zipfile.ZIP_DEFLATED)
if '--nocom' in sys.argv:
    import shutil; shutil.move(tmp, dst); print('saved (한글 거치지 않음)'); sys.exit()
import win32com.client as w
hwp = w.DispatchEx('HWPFrame.HwpObject')
try: hwp.RegisterModule('FilePathCheckDLL', 'FilePathCheckerModule')
except Exception: pass
hwp.Open(tmp, '', '')
hwp.SaveAs(dst, 'HWPX', ''); hwp.SaveAs(dst[:-5] + '.pdf', 'PDF', '')
print('pages', hwp.PageCount); hwp.Clear(1); hwp.Quit(); os.remove(tmp)
