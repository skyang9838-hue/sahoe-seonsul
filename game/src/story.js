// 대사·퀘스트 문구. 원문 인용 줄은 src:'원문'(한글본과 글자 그대로). 나머지는 안내 문구 — 답을 암시하는 낱말 금지(tools/check_hints.py).
// cam: 그 줄에서 카메라를 옮길 자리(main.js CAMS), fade: 검게 바꾼 뒤 옮김, cut: 컷인(초상화 띠), heroMood: 꼬꼬 표정
// 같은 장의 원문 줄은 연출 세기를 똑같이 맞춘다(cut·fade 같게, cam은 모두 있거나 모두 없게) — 특정 줄만 세게 하면 답이 될 줄을 골라 주는 셈(tools/verify_text.py가 검사)
export const WHO = {
  kkokko: { name: '꼬꼬' }, mom: { name: '엄마 닭' }, baby: { name: '아기 병아리' }, boss: { name: '공장장' },
  bear: { name: '동료 곰' }, bunny: { name: '동료 토끼' }, fox: { name: '회의실 직원' }, note: { name: '안내' },
  clerk: { name: '마트 점원' }, staff1: { name: '직원' }, staff2: { name: '직원' },
};

// 3장 세 곳의 대사 묶음 이름(main.js SPOTS3의 dlg와 같게)
export const SPOTS3 = ['meeting', 'adboard', 'riverside'];

export const DIALOGUE = {
  // 꼬꼬네 집(꼬꼬 방): 출근 날 아침 이야기 단서 — 평가와 상관없는 살펴보기
  lookClock:  [{ who: 'note', text: '알람시계가 아침 7시를 가리키고 있어요.' },
               { who: 'kkokko', text: '좋아, 늦지 않게 일어났어!', face: 'happy' }],
  lookPhoto:  [{ who: 'note', text: '엄마 닭, 아기 병아리와 함께 찍은 가족사진이에요.' },
               { who: 'kkokko', text: '다들 밖에서 기다리고 있겠지?' }],
  lookMirror: [{ who: 'note', text: '옷장 거울에 초록 작업모가 비쳐요. 노란 별이 반짝반짝!' },
               { who: 'kkokko', text: '모자를 반듯하게 고쳐 쓰고, 출발!', face: 'happy' }],
  // 마을
  mom:    [{ who: 'mom', text: '꼬꼬야, 오늘 월급날이지? 마트에 같이 가자!' }],
  baby:   [{ who: 'baby', text: '삐약! 마트 가요, 마트!' }],
  // 마트 안
  mom2:   [{ who: 'mom', text: '라면 칸은 저쪽이야.' }],
  baby2:  [{ who: 'baby', text: '삐약!' }],
  clerk:  [{ who: 'clerk', text: '어서 오세요!' }],
  ramen:  [{ who: 'note', text: '꼬꼬는 공장에서 라면을 만들고 월급을 받았습니다. 월급날에는 가족과 함께 마트에 가서 가격과 품질을 비교하며 필요한 물건을 샀습니다.', src: '원문', cam: 'ramen' },
           { who: 'note', text: '한편, 불꽃식품은 근로자를 고용하여 라면을 만들고, 완성된 라면을 마트에 판매했습니다.', src: '원문', cam: 'ramen' }],
  after1: [{ who: 'kkokko', text: '이제 회사로 가 볼까?', face: 'happy' }],
  // 공장 안
  bear:     [{ who: 'bear', text: '점호 시간이야. 빈자리에 서.' }],
  bunny:    [{ who: 'bunny', text: '공장장님이 곧 오셔.' }],
  bossIdle: [{ who: 'boss', text: '점호를 할 테니 빈자리에 서세요.' }],
  rollcall: [{ who: 'note', text: '어느 날, 불꽃식품의 라면이 인기를 끌면서 공장이 무척 바빠졌습니다. 공장장은 근로자들에게 다음과 같이 말했습니다.', src: '원문', cam: 'rollWide' },
             { who: 'boss', text: '"오늘부터 밤 10시까지 일하세요. 추가로 일해도 돈은 더 주지 않습니다."', src: '원문', cam: 'boss' },
             { who: 'boss', text: '"주문이 밀렸으니 점심시간에도 쉬지 말고 일하세요."', src: '원문', cam: 'boss' },
             { who: 'boss', text: '"일하다 다친 건 본인 잘못입니다. 회사는 책임지지 않겠습니다."', src: '원문', cam: 'boss' },
             { who: 'note', text: '꼬꼬는 공장장의 말을 듣고 걱정이 되었습니다.', src: '원문', cam: 'heroFace', heroMood: 'worry' }],
  after2: [{ who: 'kkokko', text: '이제 회의실, 광고판, 강가를 둘러보자.' }],
  // 회의실 안
  staff1:  [{ who: 'staff1', text: '회의를 시작할 거예요. 빈자리에 앉으세요.' }],
  staff2:  [{ who: 'staff2', text: '회의를 시작할 거예요. 빈자리에 앉으세요.' }],
  foxIdle: [{ who: 'fox', text: '회의를 시작할게요. 빈자리에 앉으세요.' }],
  // 3장: 세 곳(회의실 빈 의자·광고판·강가)을 각각 가서 본다. 순서는 자유, 세 곳을 다 보면 3장 패널.
  //   세 묶음은 모양이 똑같아야 한다(원문 한 줄, 말하는 이 note, fade·cam 같음) — tools/verify_text.py가 SPOTS3로 검사
  meeting:   [{ who: 'note', text: "불꽃식품은 새로운 라면을 개발하기로 했습니다. 회의 끝에 아주 매운 라면인 '불꽃면'을 만들고, 한 개에 1,200원에 판매하기로 결정했습니다.", src: '원문', cam: 'fox', fade: true }],
  adboard:   [{ who: 'note', text: "불꽃면 광고에는 '채소가 가득한 건강한 라면!'이라고 쓰여 있었지만, 실제로는 채소가 거의 들어 있지 않았습니다.", src: '원문', cam: 'ad', fade: true }],
  riverside: [{ who: 'note', text: '또 라면을 만드는 과정에서 생긴 더러운 물이 근처 강으로 흘러갔습니다.', src: '원문', cam: 'river', fade: true }],
  after3: [{ who: 'kkokko', text: '꼬꼬의 수첩을 열어 다시 읽어 보고 제출해요.', face: 'happy' }],
  // 잠긴 곳
  lockedMartDoor: [{ who: 'note', text: '먼저 엄마 닭에게 말을 걸어 봐요.' }],
  lockedMeetDoor: [{ who: 'note', text: '먼저 공장에 들러요.' }],
  lockedGate1:    [{ who: 'note', text: '먼저 마트에 들러요.' }],
  // 제출 뒤 돌아다닐 때 대사(main.js: S.roam이면 '이름+Roam'을 먼저 찾는다).
  //   평가가 끝난 뒤라도 같은 반 친구가 아직 쓰는 중일 수 있으니 답을 암시하는 낱말(인정 단어)은 쓰지 않는다 — tools/check_hints.py가 검사
  lookClockRoam:  [{ who: 'note', text: '알람시계가 똑딱똑딱 가고 있어요.' }],
  lookPhotoRoam:  [{ who: 'note', text: '엄마 닭, 아기 병아리와 함께 찍은 가족사진이에요.' },
                   { who: 'kkokko', text: '오늘 있었던 일을 들려줘야지!', face: 'happy' }],
  lookMirrorRoam: [{ who: 'note', text: '옷장 거울에 초록 작업모가 비쳐요.' },
                   { who: 'kkokko', text: '오늘 하루, 수고했어!', face: 'happy' }],
  momRoam:      [{ who: 'mom', text: '꼬꼬야, 오늘 하루 수고 많았어! 천천히 둘러보고 오렴.' }],
  babyRoam:     [{ who: 'baby', text: '삐약! 같이 놀아요!' }],
  mom2Roam:     [{ who: 'mom', text: '장보기는 다 끝났어. 더 구경하고 갈래?' }],
  baby2Roam:    [{ who: 'baby', text: '삐약! 여기 재밌어요!' }],
  clerkRoam:    [{ who: 'clerk', text: '또 오세요!' }],
  bearRoam:     [{ who: 'bear', text: '꼬꼬, 오늘 하루 수고했어!' }],
  bunnyRoam:    [{ who: 'bunny', text: '내일 또 보자, 꼬꼬!' }],
  bossIdleRoam: [{ who: 'boss', text: '꼬꼬 씨, 첫날 수고했어요.' }],
  staff1Roam:   [{ who: 'staff1', text: '오늘 일정은 모두 끝났어요.' }],
  staff2Roam:   [{ who: 'staff2', text: '오늘 일정은 모두 끝났어요.' }],
  foxIdleRoam:  [{ who: 'fox', text: '꼬꼬 씨, 오늘 수고 많았어요.' }],
};

// 오프닝 컷: 그림(assets/comic/open1~3.jpg) + 대사
export const OPENING = [
  { img: 'assets/comic/open1.jpg?v=2d', who: 'note', text: '꼬꼬는 일할 곳을 찾고 있었어요.' },
  { img: 'assets/comic/open2.jpg?v=2d', who: 'note', text: "꼬꼬는 라면을 만드는 '불꽃식품'에 취업했습니다.", src: '원문' },
  { img: 'assets/comic/open3.jpg?v=2d', who: 'note', text: '그리고 오늘은 꼬꼬의 첫 월급날이에요!' },
];

// 퀘스트 문구(화면 위)
export const QUEST_TEXT = {
  homeDoor: '방을 둘러보고, 문으로 나가 보세요',
  mom: '엄마 닭에게 말을 걸어 보세요',
  martDoor: '동네 마트에 들어가세요',
  ramen: '라면 칸을 살펴보세요',
  gate1: '오른쪽 길을 따라 회사로 가세요',
  factoryDoor: '불꽃식품 공장에 들어가세요',
  rollcall: '줄의 반짝이는 빈자리에 서 보세요',
  ch3: '회의실·광고판·강가를 모두 살펴보세요',
  notebook: 'Esc를 눌러 꼬꼬의 수첩을 열고 제출하세요',
};
