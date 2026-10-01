const http = require("http");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");

const PORT = process.env.PORT || 3000;
const rooms = new Map();

function code(){
  const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s="";
  do { for(let i=0;i<6;i++) s+=chars[Math.floor(Math.random()*chars.length)]; } while(rooms.has(s));
  return s;
}
function send(ws,msg){ if(ws.readyState===WebSocket.OPEN) ws.send(JSON.stringify(msg)); }
function players(room){
  return {
    white:room.players.host?.nickname||null,
    black:room.players.guest?.nickname||null
  };
}
function broadcastPlayers(room){ for(const p of Object.values(room.players)) send(p.ws,{type:"players",players:players(room)}); }

const server=http.createServer((req,res)=>{
  let u=new URL(req.url,`http://${req.headers.host}`);
  let file=u.pathname==="/" ? "/index.html" : u.pathname;
  const safe=path.normalize(file).replace(/^(\.\.[\/\\])+/, "");
  const fp=path.join(__dirname,safe);
  if(!fs.existsSync(fp)){res.writeHead(404);return res.end("Not found");}
  const ext=path.extname(fp);
  const type={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8"}[ext]||"application/octet-stream";
  res.writeHead(200,{"Content-Type":type});fs.createReadStream(fp).pipe(res);
});
const wss=new WebSocket.Server({server});

wss.on("connection",ws=>{
  let room=null, role=null, nickname=null;
  ws.on("message",raw=>{
    let m; try{m=JSON.parse(raw)}catch{return}
    if(m.type==="create"){
      const id=code(); room={players:{},started:false,state:null}; rooms.set(id,room);
      role="host"; nickname=m.nickname; room.players.host={ws,nickname,role:"host"};
      send(ws,{type:"room",room:id,players:players(room)});
      send(ws,{type:"role",role:"host"});
      return;
    }
    if(m.type==="join"){
      const r=rooms.get(String(m.room||"").toUpperCase());
      if(!r)return send(ws,{type:"error",message:"존재하지 않는 방입니다."});
      if(r.players.guest)return send(ws,{type:"error",message:"이미 두 명이 참가한 방입니다."});
      room=r; role="guest"; nickname=m.nickname;
      room.players.guest={ws,nickname,role:"guest"};
      send(ws,{type:"room",room:String(m.room).toUpperCase(),players:players(room)});
      send(ws,{type:"role",role:"guest"});
      broadcastPlayers(room);
      return;
    }
    if(!room)return;
    if(m.type==="start"){
      if(role!=="host" || !room.players.guest)return;
      room.started=true;
      for(const p of Object.values(room.players)) send(p.ws,{type:"start"});
      return;
    }
    if(m.type==="state"){
      if(role!=="host")return;
      room.state=m.state;
      const g=room.players.guest; if(g)send(g.ws,{type:"state",state:room.state});
      return;
    }
    if(m.type==="command"){
      // 서버에서도 참가자는 흑이며 흑 차례에만 명령을 전달합니다.
      if(role!=="guest" || !room.started || !room.state || room.state.currentPlayer!=="b") return;
      const allowed=["square","draw","end","promotion","revival","cancelRevival"];
      if(!allowed.includes(m.action)) return;
      const h=room.players.host;
      if(h)send(h.ws,{type:"command",action:m.action,r:m.r,c:m.c,piece:m.piece});
      return;
    }
    if(m.type==="leave"){
      if(room.players.host?.ws===ws) { for(const p of Object.values(room.players)) if(p.ws!==ws) send(p.ws,{type:"error",message:"호스트가 방을 나갔습니다."}); rooms.delete([...rooms.entries()].find(([k,v])=>v===room)?.[0]); }
      else if(room.players.guest?.ws===ws) { delete room.players.guest; broadcastPlayers(room); }
    }
  });
  ws.on("close",()=>{
    if(!room)return;
    if(room.players.host?.ws===ws){
      for(const p of Object.values(room.players)) if(p.ws!==ws) send(p.ws,{type:"error",message:"호스트 연결이 끊어졌습니다."});
      for(const [k,v] of rooms)if(v===room)rooms.delete(k);
    } else if(room.players.guest?.ws===ws){delete room.players.guest;broadcastPlayers(room);}
  });
});
server.listen(PORT, "0.0.0.0", ()=>console.log(`UNO Chess Online: http://localhost:${PORT}`));
