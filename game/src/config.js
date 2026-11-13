// 배포 설정. API_URL이 비어 있으면 저장은 이 컴퓨터(localStorage) 스텁으로 돈다.
// GAS 웹앱을 배포한 뒤 그 /exec 주소를 넣는다.
// 주소 끝에 ?stub 이 있으면 실서버 대신 스텁(자동 검사 play3d가 실시트에 쓰지 않게)
const STUB = typeof location !== 'undefined' && new URLSearchParams(location.search).has('stub');
export const API_URL = STUB ? '' : 'https://script.google.com/macros/s/AKfycbyPTSEPP92HiQ8H3nYmSs_TcR6Mpoq3aM62YCpjy020pMSxm5dsq6xGvXshDwuvgG3s1Q/exec';
// 평가 패널 왼쪽 장면 그림(장마다)
export const SCENES = ['assets/scenes/scene1.jpg?v=u1', 'assets/scenes/scene2.jpg?v=u2', 'assets/scenes/scene3.jpg?v=u1'];
