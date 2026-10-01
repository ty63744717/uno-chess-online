# UNO Chess Online

구성 파일 4개만 Render에 올립니다.

- index.html
- server.js
- package.json
- README.md

Render 시작 명령은 `npm start`입니다.

방장(백)만 게임 상태를 확정하고, 참가자(흑)는 명령을 보내며 서버에서 받은 상태를 표시합니다.
프로모션, WILD, WILD +4, 부활, REVERSE 등의 선택창은 현재 차례의 플레이어에게만 표시됩니다.
