set -e
cd "C:/Users/user/AppData/Local/Temp/claude/17ec2d17f39aaf16/4d0b26dd-42a6-485c-a56e-bf5c4b3329fc/scratchpad"
: 
: 
rm -rf orig2 && cp -r orig orig2
PYTHONUTF8=1 python build_full.py "${1:-4}" "${2:-5}"
rm -f out.hwpx
PYTHONUTF8=1 python zipit.py
cat > tohwp.py <<'PY'
import win32com.client as w, os
h=w.DispatchEx("HWPFrame.HwpObject")
try: h.RegisterModule("FilePathCheckDLL","FilePathCheckerModule")
except Exception as e: print('reg',e)
h.XHwpWindows.Item(0).Visible=False
print(h.Open(os.path.abspath('out.hwpx'),"HWPX",""))
print(h.SaveAs(os.path.abspath('final.hwpx'),"HWPX",""))
print(h.SaveAs(os.path.abspath('final.pdf'),"PDF",""))
h.Quit()
PY
PYTHONUTF8=1 timeout 120 python tohwp.py
PYTHONUTF8=1 python -c "
import pymupdf as f
d=f.open('final.pdf'); print('pages',len(d))
for i,p in enumerate(d): p.get_pixmap(dpi=70).save(f'fin{i}.png')
"
