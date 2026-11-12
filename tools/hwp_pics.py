import win32com.client as w, os, sys
P=r'C:\Users\user\Desktop\vibecoding\sahoe-seonsul'
src=os.path.join(P,'문항','시장경제 평가 문항.hwpx'); dst=os.path.join(P,'문항','시장경제 평가 문항 (그림).hwpx')
A=os.path.join(P,'assets','장면')
pics=[("꼬꼬는 라면을 만드는", '장면1-합침-대사.jpg',46,70),("어느 날, 불꽃식품의", '장면2-공장장-대사.jpg',46,34.5),("불꽃식품은 새로운 라면을", '장면3-불꽃면.jpg',46,34.5)]
hwp=w.gencache.EnsureDispatch('HWPFrame.HwpObject') if False else w.DispatchEx('HWPFrame.HwpObject')
try: hwp.RegisterModule('FilePathCheckDLL','FilePathCheckerModule')
except Exception as e: print('reg',e)
hwp.Open(src,'','')
for key,img,W,H in pics:
    hwp.MovePos(2,0,0)  # 문서 처음
    act=hwp.CreateAction('RepeatFind'); ps=act.CreateSet(); act.GetDefault(ps)
    ps.SetItem('FindString',key); ps.SetItem('IgnoreMessage',1); ps.SetItem('Direction',0)
    ok=act.Execute(ps); print(key,ok)
    hwp.Run('Cancel'); hwp.Run('MoveParaBegin')
    hwp.Run('BreakPara'); hwp.Run('MoveUp')
    r=hwp.InsertPicture(os.path.join(A,img),True,1,False,False,0,W,H)
    print(' pic',bool(r))
hwp.SaveAs(dst,'HWPX','')
hwp.SaveAs(dst.replace('.hwpx','.pdf'),'PDF','')
print('pages',hwp.PageCount)
hwp.Clear(1); hwp.Quit()
