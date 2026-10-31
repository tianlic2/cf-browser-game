export class MultiplayerClient extends EventTarget {
  constructor(){
    super();this.ws=null;this.id=null;this.room='';this.team='a';this.host=false;
    this.status='offline';this.players=[];this.seq=0;this.lastStateAt=0;
  }
  static defaultUrl(){
    const saved=localStorage.getItem('crossfire.multiplayer.url');
    if(saved)return saved;
    if(location.hostname==='127.0.0.1'||location.hostname==='localhost')return 'ws://127.0.0.1:8787/ws';
    return `${location.protocol==='https:'?'wss':'ws'}://${location.host}/ws`;
  }
  emit(type,detail={}){this.dispatchEvent(new CustomEvent(type,{detail}))}
  connect({url,name,action,room=''}){
    this.disconnect(false);this.status='connecting';this.emit('status',{status:this.status});
    localStorage.setItem('crossfire.multiplayer.url',url);
    return new Promise((resolve,reject)=>{
      let settled=false;const ws=new WebSocket(url);this.ws=ws;
      const fail=(message)=>{if(!settled){settled=true;reject(new Error(message))}this.status='error';this.emit('status',{status:this.status,message})};
      ws.addEventListener('open',()=>ws.send(JSON.stringify({type:'hello',version:1,name,action,room:room.toUpperCase()})));
      ws.addEventListener('message',event=>{
        let msg;try{msg=JSON.parse(event.data)}catch{return}
        if(msg.type==='welcome'){
          this.id=msg.id;this.room=msg.room;this.team=msg.team;this.host=msg.host;this.players=msg.players||[];this.status='waiting';
          if(!settled){settled=true;resolve(msg)}this.emit('welcome',msg);this.emit('status',{status:this.status});return;
        }
        if(msg.type==='error'){fail(msg.message||'连接失败');return}
        if(msg.players)this.players=msg.players;
        if(msg.type==='match-start')this.status='playing';
        if(msg.type==='waiting')this.status='waiting';
        this.emit(msg.type,msg);this.emit('status',{status:this.status});
      });
      ws.addEventListener('close',()=>{const was=this.status;this.ws=null;this.status='offline';this.emit('status',{status:this.status,previous:was});if(!settled)fail('无法连接房间服务器')});
      ws.addEventListener('error',()=>fail('房间服务器连接失败'));
    });
  }
  send(data){if(this.ws?.readyState===WebSocket.OPEN)this.ws.send(JSON.stringify(data))}
  sendState(state,now=performance.now()){
    if(this.status!=='playing'||now-this.lastStateAt<50)return;
    this.lastStateAt=now;this.send({type:'state',seq:++this.seq,...state});
  }
  shoot(origin,dir,weapon,maxDistance=300){if(this.status==='playing')this.send({type:'shot',origin,dir,weapon,maxDistance,seq:++this.seq})}
  disconnect(sendLeave=true){if(this.ws){if(sendLeave)this.send({type:'leave'});this.ws.close()}this.ws=null;this.id=null;this.room='';this.status='offline'}
  active(){return !!this.id&&['waiting','playing'].includes(this.status)}
}
