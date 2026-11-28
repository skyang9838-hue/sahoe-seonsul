// 배포 설정. API_URL이 비어 있으면 저장은 이 컴퓨터(localStorage) 스텁으로 돈다.
// GAS 웹앱을 배포한 뒤 그 /exec 주소를 넣는다.
// 주소 끝에 ?stub 이 있으면 실서버 대신 스텁(자동 검사 play3d가 실시트에 쓰지 않게)
// 다른 학교: 주소 끝 ?s=<배포 ID> → 그 학교가 사본 시트로 배포한 서버에 저장 (11/28 우리 학교용 설치. 학생용 주소는 그 서버 주소를 열면 나온다)
const Q = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
const STUB = Q.has('stub');
const SID = /^[A-Za-z0-9_-]{20,120}$/.test(Q.get('s') || '') ? Q.get('s') : '';
const OURS = 'https://script.google.com/macros/s/AKfycbyPTSEPP92HiQ8H3nYmSs_TcR6Mpoq3aM62YCpjy020pMSxm5dsq6xGvXshDwuvgG3s1Q/exec';   // 효성남초
export const API_URL = STUB ? '' : SID ? 'https://script.google.com/macros/s/' + SID + '/exec' : OURS;
// 게임 ↔ 교사 화면 ↔ 답안집 링크에 이어 붙일 주소 꼬리 ('stub' | 's=…' | '')
export const KEEP_Q = STUB ? 'stub' : SID ? 's=' + SID : '';
// 평가 패널 왼쪽 장면 그림(장마다)
export const SCENES = ['assets/scenes/scene1.jpg?v=u1', 'assets/scenes/scene2.jpg?v=u2', 'assets/scenes/scene3.jpg?v=u1'];
