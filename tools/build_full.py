import copy, re, zipfile, shutil, sys, os
from lxml import etree
NS='http://www.hancom.co.kr/hwpml/2011/paragraph'; ns={'hp':NS}; HP='{%s}'%NS
ANS_ROWS3=int(sys.argv[1]) if len(sys.argv)>1 else 4
ANS_ROWS4=int(sys.argv[2]) if len(sys.argv)>2 else 5
tree=etree.parse('orig/Contents/section0.xml'); root=tree.getroot()
ps=root.findall('hp:p',ns)

def runs_text(p): return ''.join(x.text or '' for x in p.findall('hp:run/hp:t',ns))
def make_p(tpl, line, normal, bold):
    p=copy.deepcopy(tpl)
    for c in list(p): p.remove(c)
    parts=re.split(r'(\*\*.+?\*\*)', line)
    for part in parts:
        if not part: continue
        b=part.startswith('**')
        r=etree.SubElement(p,HP+'run'); r.set('charPrIDRef', bold if (b and bold) else normal)
        t=etree.SubElement(r,HP+'t'); t.text=part.strip('*') if b else part
    if not len(p):
        r=etree.SubElement(p,HP+'run'); r.set('charPrIDRef',normal)
    return p
def first_charpr(el):
    for r in el.iter(HP+'run'):
        if r.find('hp:t',ns) is not None and (r.find('hp:t',ns).text or '').strip(): return r.get('charPrIDRef')
    r=el.find('.//hp:run',ns); return r.get('charPrIDRef') if r is not None else '0'
def set_cell(tc, lines, bold=None):
    sub=tc.find('hp:subList',ns); pl=sub.findall('hp:p',ns); tpl=pl[0]; normal=first_charpr(tc)
    for p in pl: sub.remove(p)
    for ln in lines: sub.append(make_p(tpl, ln, normal, bold))
def rows(tbl): return tbl.findall('hp:tr',ns)
def set_rows(tbl,n):
    rs=rows(tbl)
    while len(rs)>n: tbl.remove(rs[-1]); rs=rows(tbl)
    while len(rs)<n:
        nr=copy.deepcopy(rs[-1]); 
        for a in nr.iter(HP+'cellAddr'): a.set('rowAddr',str(len(rs)))
        tbl.append(nr); rs=rows(tbl)
    tbl.set('rowCnt',str(n))
def cells(tr): return tr.findall('hp:tc',ns)
def set_text_p(p, text):
    ts=p.findall('hp:run/hp:t',ns); ts[0].text=text
    for t in ts[1:]: t.text=''

# ---- STEP4 outer cell
outer=ps[18].find('.//hp:tbl',ns)
sub=rows(outer)[1].find('hp:tc',ns).find('hp:subList',ns)
sp=sub.findall('hp:p',ns)
set_text_p(sp[1],'※ 다음 <자료 1>을 읽고 물음에 답하시오.')
set_text_p(sp[3],'<자료 1> 꼬꼬의 첫 출근')
# 자료 table
jt=sp[4].find('hp:run/hp:tbl',ns)
set_rows(jt,2)
r0,r1=rows(jt)
titles=['구분','1장. 꼬꼬의 첫 월급','2장. 꼬꼬의 바쁜 공장','3장. 불꽃면 이야기']
story=[['이야기'],
 ["꼬꼬는 라면을 만드는 '불꽃식품'에 취업했습니다.","꼬꼬는 공장에서 라면을 만들고 월급을 받았습니다. 월급날에는 가족과 함께 마트에 가서 가격과 품질을 비교하며 필요한 물건을 샀습니다.","한편, 불꽃식품은 근로자를 고용하여 라면을 만들고, 완성된 라면을 마트에 판매했습니다."],
 ["어느 날, 불꽃식품의 라면이 인기를 끌면서 공장이 무척 바빠졌습니다. 공장장은 근로자들에게 다음과 같이 말했습니다.","\"오늘부터 밤 10시까지 일하세요. 추가로 일해도 돈은 더 주지 않습니다.\"","\"주문이 밀렸으니 점심시간에도 쉬지 말고 일하세요.\"","\"일하다 다친 건 본인 잘못입니다. 회사는 책임지지 않겠습니다.\"","꼬꼬는 공장장의 말을 듣고 걱정이 되었습니다."],
 ["불꽃식품은 새로운 라면을 개발하기로 했습니다. 회의 끝에 아주 매운 라면인 '불꽃면'을 만들고, 한 개에 1,200원에 판매하기로 결정했습니다.","불꽃면 광고에는 '채소가 가득한 건강한 라면!'이라고 쓰여 있었지만, 실제로는 채소가 거의 들어 있지 않았습니다.","또 라면을 만드는 과정에서 생긴 더러운 물이 근처 강으로 흘러갔습니다."]]
for i,tc in enumerate(cells(r0)):
    set_cell(tc,[titles[i]]); tc.find('hp:cellSz',ns).set('height','1500')
exP=ps[20].find('.//hp:tbl',ns).findall('hp:tr',ns)[1].findall('hp:tc',ns)[1].find('.//hp:p',ns).get('paraPrIDRef')
for i,tc in enumerate(cells(r1)):
    set_cell(tc,story[i]); tc.find('hp:cellSz',ns).set('height','1000')
    if i>0:
        for p in tc.iter(HP+'p'): p.set('paraPrIDRef',exP)
# story cells: left-align use paraPr of a left-aligned cell? keep.
# widen story columns
tot=sum(int(tc.find('hp:cellSz',ns).get('width')) for tc in cells(r0))
w0=3400; wr=(tot-w0)//3
for tr in rows(jt):
    for i,tc in enumerate(cells(tr)):
        tc.find('hp:cellSz',ns).set('width',str(w0 if i==0 else wr))
# Q1
set_text_p(sp[7],'1. <자료 1>의 1장에서 가계와 기업이 하는 경제활동을 각각 하나씩 찾아 쓰시오.')
q1=sp[8].find('hp:run/hp:tbl',ns); set_rows(q1,2)
set_cell(cells(rows(q1)[0])[0],['가계(꼬꼬네 가족):']); set_cell(cells(rows(q1)[1])[0],['기업(불꽃식품):'])
# Q2
set_text_p(sp[12],'2. 가계와 기업의 경제적 관계를 생각하며 빈칸에 알맞은 말을 쓰시오.')
box_p=sp[13]; boxtpl=copy.deepcopy(box_p)
set_cell(cells(rows(box_p.find('hp:run/hp:tbl',ns))[0])[0],['① 가계는 기업에 노동력을 제공하고, 그 대가로 (　　　　　　)을/를 받습니다.','② 기업은 가계에 (　　　　　　)을/를 판매하고, 그 대가로 돈을 받습니다.'])
ans4_tpl=copy.deepcopy(sp[14])
# Q3
q3_q=sp[18]; q3_ans=sp[19]
set_text_p(q3_q,'3. <자료 1>의 2장에서 근로자의 권리가 지켜지지 않은 장면을 하나 골라 글을 쓰시오.')
c3=copy.deepcopy(boxtpl)
set_cell(cells(rows(c3.find('hp:run/hp:tbl',ns))[0])[0],['<조건>','가) 어떤 장면에서 근로자의 어떤 권리가 지켜지지 않았는지 쓸 것.','나) 이 문제를 해결하기 위한 방법을 한 가지 제안할 것.'])
set_rows(q3_ans.find('hp:run/hp:tbl',ns),ANS_ROWS3)
# Q4 = clones
blank=copy.deepcopy(sp[9])
q4_q=copy.deepcopy(q3_q); set_text_p(q4_q,'4. <자료 1>의 3장을 읽고 불꽃식품의 경제활동에 대해 쓰시오.')
c4=copy.deepcopy(boxtpl)
set_cell(cells(rows(c4.find('hp:run/hp:tbl',ns))[0])[0],['<조건>','가) 불꽃식품이 기업의 자유에 따라 스스로 결정한 일을 한 가지 찾아 쓸 것.','나) 불꽃식품이 사회적 책임을 다하지 못한 일을 한 가지 찾고, 이를 개선할 방법을 제안할 것.'])
q4_ans=copy.deepcopy(q3_ans); set_rows(q4_ans.find('hp:run/hp:tbl',ns),ANS_ROWS4)
for P in (q3_ans,q4_ans,sp[8]):
    for cz in P.iter(HP+'cellSz'):
        print('h',cz.get('height')); cz.set('height',str(int(int(cz.get('height'))*0.68)))
oc=rows(outer)[1].find('hp:tc',ns).find('hp:cellSz',ns); print('outer h',oc.get('height')); oc.set('height','1000')
# rebuild sub order
new=[sp[1],sp[3],sp[4],sp[7],sp[8],sp[12],sp[13],q3_q,c3,q3_ans,q4_q,c4,q4_ans]
for p in sp: sub.remove(p)
for p in new: sub.append(p)

# ---- 예시 답안 table (ps[20])
ex=ps[20].find('.//hp:tbl',ns)
# bold charPr: find run with bold text in example
bold=None
for r in ex.iter(HP+'run'):
    t=r.find('hp:t',ns)
    if t is not None and t.text and '일 년 내내 기온이 높고' in t.text: bold=r.get('charPrIDRef')
set_rows(ex,5)
exa=[['문항','예시 답안'],
 ['1',['가계(꼬꼬네 가족): 공장에서 일하고 월급을 받는다. / 월급으로 마트에서 필요한 물건을 산다. / 가격과 품질을 비교하며 물건을 고른다. (이 가운데 하나)','기업(불꽃식품): 근로자를 고용한다. / 라면을 만든다. / 라면을 마트에 판매한다. (이 가운데 하나)']],
 ['2',['① **월급**(소득, 돈)','② **라면**(물건, 상품)']],
 ['3',['공장장이 밤 10시까지 일을 시키면서 돈을 더 주지 않은 장면에서, 근로자가 **일한 만큼 정당한 대가를 받을 권리**가 지켜지지 않았다.','회사는 근로자의 권리를 보호하는 **법에 따라** 더 일한 시간만큼 돈을 주어야 한다.','(다친 장면을 고른 경우: 일하다 다쳤을 때 보상받을 권리가 지켜지지 않았다. **산재보험**으로 치료비를 보상받을 수 있게 해야 한다.)']],
 ['4',['불꽃식품은 불꽃면을 한 개에 1,200원에 팔기로 **스스로 결정했다**. 이것은 기업의 자유이다.','하지만 채소가 거의 없는데도 \'채소가 가득한 건강한 라면!\'이라고 광고해서 소비자가 잘못된 정보를 믿고 라면을 사게 했다.','광고에 실제로 들어 있는 재료를 **정확하게** 써야 한다. 그래야 소비자가 바른 정보를 보고 물건을 고를 수 있다.']]]
for i,tr in enumerate(rows(ex)):
    if i==0: continue
    a,b=cells(tr); set_cell(a,[exa[i][0]]); set_cell(b,exa[i][1],bold)
# ---- 채점기준 (ps[21])
sc=ps[21].find('.//hp:tbl',ns); rs=rows(sc)
elems=['가계와 기업의 역할 이해하기|(1, 2번 문항)','근로자의 권리 탐색하기|(3번 문항)','기업의 자유와|사회적 책임 탐색하기|(4번 문항)']
desc=[['가계와 기업의 경제활동을 각각 바르게 찾고, 두 빈칸을 모두 바르게 써서 가계와 기업이 주고받는 관계를 나타낸다.','가계와 기업의 경제활동을 찾고, 가계와 기업이 주고받는 관계를 일부 바르게 나타낸다.','가계 또는 기업의 경제활동 모습을 일부 찾아 쓴다.'],
 ['장면을 골라 지켜지지 않은 근로자의 권리를 바르게 쓰고, 그 장면에 맞는 해결 방법을 법이나 제도와 관련지어 구체적으로 제안한다.','장면과 지켜지지 않은 근로자의 권리를 쓰고 해결 방법을 제안하지만, 해결 방법이 장면과 맞지 않거나 막연하다.','2장의 장면을 옮겨 쓰는 데 그치거나, 권리와 해결 방법 가운데 하나만 쓴다.'],
 ['기업의 자유에 따라 스스로 결정한 일을 바르게 찾고, 사회적 책임을 다하지 못한 일과 그 일에 맞는 실현 가능한 개선 방법을 까닭과 함께 제안한다.','기업의 자유와 사회적 책임을 다하지 못한 일을 찾아 개선 방법을 제안하지만, 개선 방법이 막연하거나 까닭이 드러나지 않는다.','3장에서 불꽃식품이 한 일을 찾아 옮겨 쓰는 데 그친다.']]
for k in range(3):
    for j in range(3):
        tr=rs[3+k*3+j]; cs=cells(tr)
        if j==0:
            set_cell(cs[0],elems[k].split('|')); set_cell(cs[2],[desc[k][j]])
        else:
            set_cell(cs[-1],[desc[k][j]])
for tb in (ex,sc):
    for cz in tb.iter(HP+'cellSz'): cz.set('height','800')
# ---- top-level paragraphs
secrun=ps[0].find('hp:run',ns)
ps[17].insert(0,copy.deepcopy(secrun)); ps[17].set('pageBreak','0')
ps[20].set('pageBreak','1')
keep={17,18,20,21}
for i,p in enumerate(ps):
    if i not in keep: root.remove(p)
for la in list(root.iter(HP+'linesegarray')): la.getparent().remove(la)
tree.write('orig2/Contents/section0.xml',xml_declaration=True,encoding='UTF-8',standalone=True)
