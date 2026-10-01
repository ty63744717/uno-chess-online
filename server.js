const http = require("http");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");

const PORT = Number(process.env.PORT || 3000);
const rooms = new Map();
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function makeRoomCode(){
  let code;
  do{
    code="";
    for(let i=0;i<6;i++) code += CODE_CHARS[Math.floor(Math.random()*CODE_CHARS.length)];
  }while(rooms.has(code));
  return code;
}
function send(ws,message){
  if(ws && ws.readyState===WebSocket.OPEN) ws.send(JSON.stringify(message));
}
function roomPlayers(room){
  return {white:room.host?.nickname||null,black:room.guest?.nickname||null};
}
function broadcast(room,message){
  send(room.host?.ws,message); send(room.guest?.ws,message);
}
function removeRoom(room){
  for(const [code,value] of rooms){if(value===room){rooms.delete(code);break;}}
}
function validCoord(v){return Number.isInteger(v)&&v>=0&&v<8;}
function validGuestCommand(room,m){
  if(!room.started || !room.state || room.state.gameOver || room.state.currentPlayer!=="b") return false;
  const s=room.state, a=m.action;
  if(!["square","draw","end","promotion","revival","cancelRevival","wild4"].includes(a)) return false;
  if(a==="square"){
    if(!validCoord(m.r)||!validCoord(m.c)) return false;
    if(["promotion","revival","wild4Choice"].includes(s.pendingChoice?.type)) return false;
    return !!s.cardDrawn || s.pendingChoice?.type==="wildPawn" || !!s.revivalState;
  }
  if(a==="draw") return !s.cardDrawn && !s.revivalState && !s.pendingChoice;
  if(a==="end") return !s.pendingChoice && !s.revivalState;
  if(a==="promotion") return s.pendingChoice?.type==="promotion" && validCoord(m.r)&&validCoord(m.c)&&["Q","R","B","N"].includes(m.piece);
  if(a==="revival") return s.pendingChoice?.type==="revival" && !!s.revivalState && ["P","N","B","R","Q"].includes(m.piece);
  if(a==="cancelRevival") return s.pendingChoice?.type==="revival" && !!s.revivalState;
  if(a==="wild4") return s.pendingChoice?.type==="wild4Choice" && (m.choice==="revival"||m.choice==="wild");
  return false;
}

const server=http.createServer((req,res)=>{
  const url=new URL(req.url,`http://${req.headers.host||"localhost"}`);
  const requested=url.pathname==="/"?"/index.html":url.pathname;
  const safe=path.normalize(requested).replace(/^([.][.][/\\])+/,"");
  const file=path.join(__dirname,safe);
  if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end("Not found");}
  const types={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8"};
  res.writeHead(200,{"Content-Type":types[path.extname(file)]||"application/octet-stream","Cache-Control":"no-cache"});
  fs.createReadStream(file).pipe(res);
});

const wss=new WebSocket.Server({server});
wss.on("connection",ws=>{
  let room=null,role=null,nickname="";

  ws.on("message",raw=>{
    let m;try{m=JSON.parse(raw.toString())}catch{return}
    if(m.type==="create"){
      if(room)return;
      const code=makeRoomCode();
      room={code,host:null,guest:null,started:false,state:null};
      room.host={ws,nickname:String(m.nickname||"플레이어").slice(0,12)};
      rooms.set(code,room);role="host";nickname=room.host.nickname;
      send(ws,{type:"role",role});send(ws,{type:"room",room:code,players:roomPlayers(room)});return;
    }
    if(m.type==="join"){
      if(room)return;
      const code=String(m.room||"").toUpperCase();const found=rooms.get(code);
      if(!found)return send(ws,{type:"error",message:"존재하지 않는 방입니다."});
      if(found.guest)return send(ws,{type:"error",message:"이미 두 명이 참가한 방입니다."});
      room=found;role="guest";nickname=String(m.nickname||"플레이어").slice(0,12);room.guest={ws,nickname};
      send(ws,{type:"role",role});send(ws,{type:"room",room:code,players:roomPlayers(room)});broadcast(room,{type:"players",players:roomPlayers(room)});return;
    }
    if(!room)return;
    if(m.type==="start"){
      if(role!=="host"||!room.guest||room.started)return;
      room.started=true;broadcast(room,{type:"start"});return;
    }
    if(m.type==="state"){
      if(role!=="host"||!room.started||!m.state)return;
      room.state=m.state;send(room.guest?.ws,{type:"state",state:room.state});return;
    }
    if(m.type==="command"){
      if(role!=="guest"||!validGuestCommand(room,m))return;
      send(room.host?.ws,{type:"command",action:m.action,r:m.r,c:m.c,piece:m.piece,choice:m.choice});return;
    }
    if(m.type==="leave"){
      if(role==="host"){
        send(room.guest?.ws,{type:"error",message:"호스트가 방을 나갔습니다."});removeRoom(room);
      }else if(role==="guest"){
        room.guest=null;room.state=null;room.started=false;send(room.host?.ws,{type:"players",players:roomPlayers(room)});
      }
      room=null;role=null;return;
    }
  });

  ws.on("close",()=>{
    if(!room)return;
    if(role==="host"){
      send(room.guest?.ws,{type:"error",message:"호스트 연결이 끊어졌습니다."});removeRoom(room);
    }else if(role==="guest"){
      room.guest=null;room.state=null;room.started=false;send(room.host?.ws,{type:"players",players:roomPlayers(room)});
    }
    room=null;role=null;
  });
});
server.listen(PORT,"0.0.0.0",()=>console.log(`UNO Chess Online listening on ${PORT}`));
