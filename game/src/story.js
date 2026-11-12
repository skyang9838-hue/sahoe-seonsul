// 대사·퀘스트 문구. 원문 인용 줄은 src:'원문'(한글본과 글자 그대로). 나머지는 안내 문구 — 답을 암시하는 낱말 금지(tools/check_hints.py).
export const WHO = {
  kkokko: { name: '꼬꼬' }, mom: { name: '엄마 닭' }, baby: { name: '아기 병아리' }, boss: { name: '공장장' },
  bear: { name: '동료 곰' }, bunny: { name: '동료 토끼' }, fox: { name: '회의실 직원' }, note: { name: '안내' },
};

export const DIALOGUE = {
  mom:    [{ who: 'mom', text: '꼬꼬야, 오늘 월급날이지? 마트에 같이 가자!' }],
  baby:   [{ who: 'baby', text: '삐약! 마트 가요, 마트!' }],
  after1: [{ who: 'kkokko', text: '이제 회사로 가 볼까?', face: 'happy' }],
  bear:   [{ who: 'bear', text: '어느 날, 불꽃식품의 라면이 인기를 끌면서 공장이 무척 바빠졌습니다.', src: '원문일부' }],
  bunny:  [{ who: 'bunny', text: '공장장님이 할 말이 있대. 문 앞에 계셔.' }],
  boss:   [{ who: 'boss', text: '"오늘부터 밤 10시까지 일하세요. 추가로 일해도 돈은 더 주지 않습니다."', src: '원문' },
           { who: 'boss', text: '"주문이 밀렸으니 점심시간에도 쉬지 말고 일하세요."', src: '원문' },
           { who: 'boss', text: '"일하다 다친 건 본인 잘못입니다. 회사는 책임지지 않겠습니다."', src: '원문' },
           { who: 'kkokko', text: '……', face: 'worry' }],
  after2: [{ who: 'kkokko', text: '회사 뒤편 회의실로 가 보자.' }],
  fox:    [{ who: 'fox', text: "불꽃식품은 새로운 라면을 개발하기로 했습니다. 회의 끝에 아주 매운 라면인 '불꽃면'을 만들고, 한 개에 1,200원에 판매하기로 결정했습니다.", src: '원문' }],
  ad:     [{ who: 'note', text: "불꽃면 광고에는 '채소가 가득한 건강한 라면!'이라고 쓰여 있었지만, 실제로는 채소가 거의 들어 있지 않았습니다.", src: '원문' }],
  river:  [{ who: 'note', text: '또 라면을 만드는 과정에서 생긴 더러운 물이 근처 강으로 흘러갔습니다.', src: '원문' }],
  after3: [{ who: 'kkokko', text: '꼬꼬의 수첩을 열어 다시 읽어 보고 제출해요.', face: 'happy' }],
  lockedMartDoor:    [{ who: 'note', text: '먼저 엄마 닭에게 말을 걸어 봐요.' }],
  lockedFactoryDoor: [{ who: 'note', text: '먼저 공장장에게 말을 걸어 봐요.' }],
  lockedMeetDoor:    [{ who: 'note', text: '먼저 회의실 직원, 광고판, 강가를 차례로 살펴봐요.' }],
  lockedGate1:       [{ who: 'note', text: '먼저 마트에 들러요.' }],
  lockedGate2:       [{ who: 'note', text: '먼저 회사에 들러요.' }],
};

// 오프닝 컷: 그림(assets/comic/open1~3.jpg) + 대사
export const OPENING = [
  { img: 'assets/comic/open1.jpg', who: 'note', text: '꼬꼬는 일할 곳을 찾고 있었어요.' },
  { img: 'assets/comic/open2.jpg', who: 'note', text: "꼬꼬는 라면을 만드는 '불꽃식품'에 취업했습니다.", src: '원문' },
  { img: 'assets/comic/open3.jpg', who: 'note', text: '그리고 오늘은 꼬꼬의 첫 월급날이에요!' },
];

// 퀘스트 문구(화면 위)
export const QUEST_TEXT = {
  mom: '엄마 닭에게 말을 걸어 보세요',
  martDoor: '동네 마트에 들어가세요',
  gate1: '오른쪽 길을 따라 회사로 가세요',
  boss: '공장장에게 말을 걸어 보세요',
  factoryDoor: '불꽃식품 공장에 들어가세요',
  gate2: '회사 뒤편 회의실 쪽으로 가세요',
  fox: '회의실 직원에게 말을 걸어 보세요',
  ad: '광고판을 살펴보세요',
  river: '강가를 살펴보세요',
  meetDoor: '회의실에 들어가세요',
  notebook: 'Esc를 눌러 꼬꼬의 수첩을 열고 제출하세요',
};
