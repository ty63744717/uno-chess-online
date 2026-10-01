# UNO Chess Online

업로드된 UNO Chess를 기반으로 만든 2인 온라인 공방 버전입니다.

## 실행
1. Node.js 18+ 설치
2. 이 폴더에서 `npm install`
3. `npm start`
4. 브라우저에서 `http://localhost:3000` 접속
5. 다른 기기에서 접속하려면 서버 PC의 같은 네트워크 IP와 3000 포트를 사용하세요.

## 온라인 배포
Render, Railway, Fly.io 같은 Node.js 호스팅에 올릴 수 있습니다.
실행 명령은 `npm start`입니다.

## 공방 흐름
방 만들기 → 6자리 방 코드 공유 → 상대가 참가 → 호스트가 게임 시작 → 호스트가 게임 상태를 판정하고 게스트에 실시간 전송.
