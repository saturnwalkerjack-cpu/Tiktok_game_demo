import {viewportPoint} from './face-pose.js';
import {applySafeLayout} from './safe-layout.js';
const $=id=>document.getElementById(id);
const cards=[
 {name:'The Sun',en:'THE SUN',tag:'Confidence · Renewal',energy:'confidence',release:'the need for approval',action:'a brave, visible first step',headline:'Step into your light',color:'244,197,97',position:'0% 0%'},
 {name:'The Moon',en:'THE MOON',tag:'Intuition · Discovery',energy:'intuition',release:'the need for certainty',action:'a small step guided by your intuition',headline:'Trust the quiet voice',color:'151,173,243',position:'50% 0%'},
 {name:'The Star',en:'THE STAR',tag:'Hope · Healing',energy:'hope',release:'the pressure to heal overnight',action:'a gentle step toward what inspires you',headline:'Follow a little hope',color:'119,213,201',position:'100% 0%'},
 {name:'The Tower',en:'THE TOWER',tag:'Change · Breakthrough',energy:'the courage to change',release:'a pattern that no longer serves you',action:'one honest change to your routine',headline:'Make room for the new',color:'211,144,204',position:'0% 100%'},
 {name:'The Lovers',en:'THE LOVERS',tag:'Connection · Choice',energy:'connection',release:'the habit of choosing for others',action:'a choice that reflects what you value',headline:'Choose what feels true',color:'239,175,187',position:'50% 100%'},
 {name:'The Magician',en:'THE MAGICIAN',tag:'Creativity · Action',energy:'creativity',release:'waiting until everything is perfect',action:'one idea turned into action',headline:'Begin with what you have',color:'213,193,135',position:'100% 100%'}
];
const roles=['YOUR ENERGY','WHAT TO RELEASE','YOUR NEXT STEP'];
const state={mode:'idle',phase:'browse',offset:0,target:0,index:0,visited:new Set([0]),moves:0,startTime:0,muted:false,charge:0,hand:false,pool:[0,1,2,3,4,5],drawn:[],needsRelease:false};
let audio,worker,workerReady=false,frameBusy=false,videoTime=-1,lastFrame=0,lastHand=0,lastTip=null,pointing=false,pointSince=0,openSince=0,settledAt=0,lastIndex=0,stream,cameraPending=false,loopStarted=false;
let noticeTimer,revealTimer,resultTimer,guideTimer,guideStep='browse',smoothTip=null,lastGestureAt=0,lastOpenAt=0,lastPointAt=0,releaseSince=0,frameSentAt=0,lastSwipeAt=-Infinity,faceWorker=null,faceReady=false,faceBusy=false,lastFaceFrame=0,faceSentAt=0,ritualOpenSince=0;
const app=$('app'),video=$('camera'),deck=$('deck'),canvas=$('particles'),ctx=canvas.getContext('2d');
let ritual=null;
import('./ritual-scene.js?v=velvet-stage-6').then(async({RitualScene})=>{ritual=new RitualScene(app);const ok=await ritual.init();if(!ok)notify('3D effects are unavailable in this browser.',6000);}).catch(e=>{console.warn(e);notify('3D effects could not load. Please refresh.',6000);});
applySafeLayout(app);
const cardNodes=[];let particles=[],stars=[],w=0,h=0,dpr=1,lastAnim=0,swipeAccumulator=0;
for(let slot=-3;slot<=3;slot++){
 const el=document.createElement('div');el.className='tarot-card';el.innerHTML='<div class="back"><span class="card-index">✧</span><div class="seal">✧</div><span class="mini-star">✦</span><span class="mini-star">✦</span><span class="back-label">A R C A N A</span></div><div class="card-face"></div>';deck.append(el);cardNodes.push({el,slot,logical:slot});
}
function mod(x,n){return((x%n)+n)%n;}
function currentIndex(){return state.pool[mod(Math.round(state.target),state.pool.length)];}
function resize(){const r=app.getBoundingClientRect();w=r.width;h=r.height;dpr=Math.min(devicePixelRatio||1,2);canvas.width=w*dpr;canvas.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);ritual?.resize(w,h);stars=Array.from({length:60},()=>({x:Math.random()*w,y:Math.random()*h,r:Math.random()*1.2+.25,a:Math.random(),speed:Math.random()*.06+.025}));}
new ResizeObserver(resize).observe(app);
function initAudio(){if(!audio)audio=new(window.AudioContext||window.webkitAudioContext)();audio.resume().catch(()=>{});}
function tone(freq=520,duration=.3,volume=.065,delay=0){if(!audio||state.muted)return;const osc=audio.createOscillator(),gain=audio.createGain();osc.type='sine';osc.frequency.value=freq;gain.gain.setValueAtTime(0,audio.currentTime+delay);gain.gain.linearRampToValueAtTime(volume,audio.currentTime+delay+.012);gain.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+delay+duration);osc.connect(gain);gain.connect(audio.destination);osc.start(audio.currentTime+delay);osc.stop(audio.currentTime+delay+duration+.02);}
function chime(){tone([392,440,494,523,587,659][state.index],.45);tone([784,880,988,1046,1174,1318][state.index],.35,.025,.045);}
function notify(text,duration=4500){clearTimeout(noticeTimer);$('notice').textContent=text;$('notice').hidden=false;noticeTimer=setTimeout(()=>$('notice').hidden=true,duration);}
function move(amount){if(state.phase!=='browse'||state.mode!=='camera'||!workerReady)return;state.target+=amount;state.moves++;emit(w/2,h*.64,12,'199,122,255',.65);state.charge=0;openSince=0;settledAt=performance.now();if(guideStep==='browse'&&!guideTimer)guideTimer=setTimeout(()=>{guideTimer=null;if(state.phase==='browse'&&state.mode==='camera')setInstruction('confirm');},700);}
function updateDeck(){
 state.offset+=(state.target-state.offset)*.16;
 const spacing=Math.max(95,Math.min(135,w*.3));
 cardNodes.forEach(node=>{const {el}=node;while(node.logical-state.offset>3.5)node.logical-=7;while(node.logical-state.offset< -3.5)node.logical+=7;const logical=node.logical,index=state.pool[mod(logical,state.pool.length)],relative=logical-state.offset,abs=Math.abs(relative);el.dataset.index=index;el.style.transform=`translateX(calc(-50% + ${relative*spacing}px)) translateY(${abs*14}px) rotateY(${-relative*16}deg) rotateZ(${relative*3}deg) scale(${Math.max(.7,1-abs*.095)})`;el.style.opacity=Math.max(0,1-abs*.27);el.style.zIndex=10-Math.round(abs*2);el.style.filter=`brightness(${Math.max(.35,1-abs*.23)})`;el.classList.toggle('selected',abs<.48);el.querySelector('.card-face').style.setProperty('--position',cards[index].position);});
 state.index=currentIndex();if(lastIndex!==state.index){lastIndex=state.index;state.visited.add(state.index);if(state.mode!=='idle')chime();}
}
function emit(x,y,count=25,color=state.phase==='result'?cards[state.index].color:'232,206,152',force=1){for(let i=0;i<count;i++){const angle=Math.random()*Math.PI*2,speed=(Math.random()*3+.7)*force;particles.push({x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,life:1,decay:Math.random()*.012+.009,r:Math.random()*2+.5,color});}if(particles.length>550)particles.splice(0,particles.length-550);}
function animate(t){requestAnimationFrame(animate);try{ritual?.update(t);}catch(e){console.warn('3D render interrupted',e);if(ritual)ritual.ready=false;}const dt=Math.min((t-lastAnim)/16.67||1,2);lastAnim=t;ctx.clearRect(0,0,w,h);stars.forEach(s=>{s.y-=s.speed*dt;if(s.y<0)s.y=h;ctx.fillStyle=`rgba(232,206,152,${.12+.25*(.5+.5*Math.sin(t*.001+s.a*8))})`;ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill();});particles=particles.filter(p=>p.life>0);particles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.985;p.vy*=.985;p.life-=p.decay*dt;if(p.life<=0)return;ctx.fillStyle=`rgba(${p.color},${Math.max(0,p.life)})`;ctx.beginPath();ctx.arc(p.x,p.y,p.r*p.life,0,Math.PI*2);ctx.fill();});if(state.phase==='browse')updateDeck();if(state.mode==='camera'&&state.phase==='browse'&&t-lastHand>650){openSince=0;setCharge(0);lastTip=null;smoothTip=null;pointing=false;swipeAccumulator=0;setHandUI(false);if(state.needsRelease&&t-lastHand>750){state.needsRelease=false;releaseSince=0;setInstruction('browse');}}}
requestAnimationFrame(animate);
function setCharge(value){state.charge=value;ritual?.setCharge(value);app.style.setProperty('--ritual-charge',String(value));$('palm-ring').style.setProperty('--charge',`${Math.round(value*100)}%`);}
function setHandUI(seen){app.classList.toggle('hand-seen',seen);if(!seen){$('trail-cursor').hidden=true;$('palm-ring').hidden=true;}state.hand=seen;}
function setInstruction(step){
 const text={awaken:'Open your hand to awaken',loading:'Preparing your ritual…',browse:['Swipe for your energy','Swipe for what to release','Swipe for your next step'][state.drawn.length],confirm:'Open your hand to choose',release:'Lower your hand, then swipe',revealing:'Your card is awakening'}[step];
 if(guideStep===step&&$('instruction').textContent===text)return;
 guideStep=step;$('instruction').textContent=text;$('play-heading').classList.remove('guide-enter');void $('play-heading').offsetWidth;$('play-heading').classList.add('guide-enter');
}
function begin(){clearTimeout(revealTimer);clearTimeout(resultTimer);clearTimeout(guideTimer);guideTimer=null;state.pool=[0,1,2,3,4,5];state.drawn=[];state.needsRelease=false;$('drawn-cards').innerHTML='';$('drawn-cards').hidden=true;state.mode='camera';state.phase='browse';state.startTime=performance.now();smoothTip=null;lastGestureAt=0;lastSwipeAt=-Infinity;lastOpenAt=0;lastPointAt=0;releaseSince=0;state.moves=0;state.visited=new Set([currentIndex()]);openSince=0;pointing=false;lastTip=null;swipeAccumulator=0;setCharge(0);setHandUI(false);app.classList.add('playing');app.classList.remove('result-active','revealing');$('intro').hidden=true;$('result').hidden=true;$('play-heading').hidden=false;$('bottom').hidden=true;setInstruction(workerReady?'browse':'loading');cardNodes.forEach(node=>{node.logical=node.slot;node.el.classList.remove('face-visible');});document.documentElement.style.setProperty('--accent','232,206,152');}
function cameraFailed(error){
 releaseCamera();clearTimeout(guideTimer);guideTimer=null;state.mode='idle';state.phase='browse';app.classList.remove('playing','result-active','revealing');$('intro').hidden=false;$('play-heading').hidden=true;$('result').hidden=true;$('bottom').hidden=false;setHandUI(false);setCharge(0);
 const denied=['NotAllowedError','PermissionDeniedError'].includes(error?.name);
 notify(denied?'Allow camera access, then tap Begin your reading.':error?.name==='NotFoundError'?'No camera found. Please use a device with a camera.':'Hand tracking could not start. Tap Begin your reading to try again.',6500);
}
function releaseCamera(){if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;app.classList.remove('camera-active');worker?.terminate();worker=null;workerReady=false;frameBusy=false;loopStarted=false;faceWorker?.terminate();faceWorker=null;faceReady=false;faceBusy=false;}
async function startCamera(){if(cameraPending)return;cameraPending=true;initAudio();$('start').disabled=true;$('start').textContent='Opening your camera…';
 try{
  if(!navigator.mediaDevices?.getUserMedia)throw new Error('unsupported');
  stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:720},height:{ideal:1280}},audio:false});video.srcObject=stream;await video.play();app.classList.add('camera-active');begin();startFaceTracking();
  await new Promise((resolve,reject)=>{worker=new Worker(new URL('./hand-worker.js?v=ritual-face-4',import.meta.url));const timeout=setTimeout(()=>reject(new Error('model-timeout')),40000);worker.onerror=()=>{clearTimeout(timeout);reject(new Error('model'));if(workerReady)cameraFailed(new Error('model'));};worker.onmessage=({data})=>{if(data.type==='ready'){clearTimeout(timeout);workerReady=true;resolve();}else if(data.type==='result'){frameBusy=false;if(state.mode==='camera'&&['browse','ritual'].includes(state.phase))processHand(data);}else if(data.type==='error'){clearTimeout(timeout);frameBusy=false;reject(new Error('model'));if(workerReady)cameraFailed(new Error('model'));}};worker.postMessage({type:'init'});});
  if(state.mode==='camera'){state.phase='ritual';ritualOpenSince=0;setInstruction('awaken');}if(!loopStarted){loopStarted=true;cameraLoop();}
 }catch(e){cameraFailed(e);}
 finally{cameraPending=false;$('start').disabled=false;$('start').innerHTML='Begin your reading <span>✧</span>';}
}
async function cameraLoop(){if(!loopStarted)return;const now=performance.now();sendFaceFrame(now);if(frameBusy&&now-frameSentAt>5000){cameraFailed(new Error('tracking-timeout'));return;}if(state.mode==='camera'&&['browse','ritual'].includes(state.phase)&&workerReady&&!frameBusy&&video.readyState>=2&&now-lastFrame>85&&video.currentTime!==videoTime){frameBusy=true;frameSentAt=now;videoTime=video.currentTime;lastFrame=now;try{const bitmap=await createImageBitmap(video,{resizeWidth:480,resizeHeight:Math.round(480*video.videoHeight/video.videoWidth)});if(worker&&workerReady)worker.postMessage({type:'frame',bitmap,timestamp:now},[bitmap]);else{bitmap.close();frameBusy=false;}}catch{frameBusy=false;}}requestAnimationFrame(cameraLoop);}
function classifyHand(lm,gesture){
 const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),wrist=lm[0];
 const extended=[8,12,16,20].map(t=>{
  const a=lm[t-3],b=lm[t-2],c=lm[t],u={x:a.x-b.x,y:a.y-b.y},v={x:c.x-b.x,y:c.y-b.y};
  const cosine=(u.x*v.x+u.y*v.y)/(Math.hypot(u.x,u.y)*Math.hypot(v.x,v.y)||1);
  return cosine<-.45&&distance(lm[t],wrist)>distance(lm[t-2],wrist)*1.08;
 });
 const palmWidth=distance(lm[5],lm[17]);
 const thumbOpen=distance(lm[4],lm[9])>palmWidth*.7&&distance(lm[4],lm[17])>distance(lm[3],lm[17])*1.06;
 const count=extended.filter(Boolean).length;
 const open=(gesture?.categoryName==='Open_Palm'&&gesture.score>=.38)||(count===4&&thumbOpen);
 const point=!open&&((gesture?.categoryName==='Pointing_Up'&&gesture.score>=.35)||(extended[0]&&count<=2));
 return{open,point,count};
}
function processHand({landmarks:lm,gesture}){
 if(!['browse','ritual'].includes(state.phase)||state.mode!=='camera')return;
 const now=performance.now();
 if(!lm){if(state.phase==='ritual')ritualOpenSince=0;if(now-lastGestureAt>220){setHandUI(false);openSince=0;setCharge(0);lastTip=null;smoothTip=null;pointing=false;swipeAccumulator=0;}if(state.needsRelease&&now-lastHand>400){state.needsRelease=false;releaseSince=0;setInstruction('browse');}return;}
 lastHand=now;setHandUI(true);const {open:isOpen,point:isPoint,count}=classifyHand(lm,gesture);
 if(state.phase==='ritual'){if(isOpen){if(!ritualOpenSince)ritualOpenSince=now;if(now-ritualOpenSince>450){ritual?.awaken();begin();state.needsRelease=true;setInstruction('release');initAudio();tone(220,1.5,.045);tone(440,1,.03,.2);emit(w/2,h*.8,80);}}else ritualOpenSince=0;return;}
 if(state.needsRelease){
  setInstruction('release');setHandUI(false);
  if(isPoint||(!isOpen&&count<=2)){if(!releaseSince)releaseSince=now;if(now-releaseSince>=180){state.needsRelease=false;releaseSince=0;lastTip=null;smoothTip=null;setInstruction('browse');}}else releaseSince=0;
  return;
 }
 if(isPoint){
  lastGestureAt=now;lastPointAt=now;openSince=0;setCharge(0);$('palm-ring').hidden=true;$('trail-cursor').hidden=false;
  const px=1-lm[8].x,py=lm[8].y;smoothTip=smoothTip===null?px:smoothTip*.4+px*.6;
  const pos=toScreen(smoothTip,py);$('trail-cursor').style.left=pos.x+'px';$('trail-cursor').style.top=pos.y+'px';emit(pos.x,pos.y,3,'204,149,255',.25);
  // Match swipe distance to the visible cursor, not the uncropped camera frame.
  if(lastTip!==null){const delta=pos.x-lastTip,threshold=Math.max(14,w*.04);
   if(Math.abs(delta)<w*.65){
    if(swipeAccumulator*delta<0)swipeAccumulator=0;
    swipeAccumulator+=delta;
    if(Math.abs(swipeAccumulator)>=threshold&&now-lastSwipeAt>=140){move(-Math.sign(swipeAccumulator));lastSwipeAt=now;swipeAccumulator=0;}
   }else swipeAccumulator=0;
  }
  lastTip=pos.x;pointing=true;
 }else if(isOpen){
  lastGestureAt=now;lastOpenAt=now;clearTimeout(guideTimer);guideTimer=null;setInstruction('confirm');pointing=false;lastTip=null;smoothTip=null;swipeAccumulator=0;$('trail-cursor').hidden=true;
  const palm={x:1-(lm[0].x+lm[5].x+lm[9].x+lm[13].x+lm[17].x)/5,y:(lm[0].y+lm[5].y+lm[9].y+lm[13].y+lm[17].y)/5},pos=toScreen(palm.x,palm.y);
  $('palm-ring').hidden=false;$('palm-ring').style.left=pos.x+'px';$('palm-ring').style.top=pos.y+'px';
  if(now-settledAt<160){openSince=0;setCharge(0);return;}
  // Snap the chosen card when confirmation starts; don't depend on render-loop timing.
  if(!openSince){state.offset=state.target=Math.round(state.target);updateDeck();openSince=now;tone(330,.4,.035);}
  setCharge(Math.min(1,(now-openSince)/450));emit(pos.x,pos.y,6,'231,170,255',.85);if(state.charge>=1)reveal();
 }else if(now-lastGestureAt>220){pointing=false;lastTip=null;smoothTip=null;swipeAccumulator=0;openSince=0;setCharge(0);$('palm-ring').hidden=true;$('trail-cursor').hidden=true;}
}
function toScreen(x,y){return viewportPoint(x,y,w,h,video.videoWidth||640,video.videoHeight||480);}
function startFaceTracking(){
 if(faceWorker)return;faceWorker=new Worker(new URL('./face-worker.js?v=ritual-face-4',import.meta.url));
 faceWorker.onmessage=({data})=>{if(data.type==='ready')faceReady=true;else if(data.type==='result'){faceBusy=false;ritual?.setFace(data.landmarks,video.videoWidth,video.videoHeight);}else if(data.type==='error'){faceBusy=false;faceReady=false;console.warn('Face tracking unavailable',data.message);if(state.phase==='result')notify('Face tracking could not start. Please refresh.',6000);}};
 faceWorker.onerror=()=>{faceReady=false;faceBusy=false;};faceWorker.postMessage({type:'init'});
}
async function sendFaceFrame(now){
 if(faceBusy&&now-faceSentAt>5000)faceBusy=false;
 if(!faceReady||faceBusy||state.mode!=='camera'||video.readyState<2||now-lastFaceFrame<120)return;
 faceBusy=true;faceSentAt=lastFaceFrame=now;
 try{const bitmap=await createImageBitmap(video,{resizeWidth:360,resizeHeight:Math.round(360*video.videoHeight/video.videoWidth)});if(faceWorker)faceWorker.postMessage({type:'frame',bitmap,timestamp:now},[bitmap]);else{bitmap.close();faceBusy=false;}}catch{faceBusy=false;}
}
function readingFor(indices){
 if(indices.length!==3)throw new Error('Three cards are required');
 const [energy,release,direction]=indices.map(i=>cards[i]);
 return{title:direction.headline,tag:direction.tag,text:`Bring ${energy.energy} into this moment. Let go of ${release.release}. Move forward with ${direction.action}.`};
}
function collectedMarkup(indices){return indices.map((index,i)=>`<div class="collected-card" aria-label="${roles[i]}: ${cards[index].name}"><div class="mini-face" style="--position:${cards[index].position}"></div></div>`).join('');}
function nextRound(){
 state.pool=state.pool.filter(index=>!state.drawn.includes(index));state.target=state.offset=0;state.index=currentIndex();lastIndex=state.index;state.phase='browse';state.needsRelease=true;releaseSince=0;lastTip=null;smoothTip=null;pointing=false;swipeAccumulator=0;openSince=0;lastGestureAt=0;setCharge(0);setHandUI(false);settledAt=performance.now();
 cardNodes.forEach(node=>{node.logical=node.slot;node.el.style.transition='';node.el.classList.remove('face-visible');});app.classList.remove('revealing');setInstruction('release');updateDeck();
}
function showReading(){
 state.phase='result';app.classList.add('result-active');app.classList.remove('revealing');$('result').hidden=false;$('drawn-cards').hidden=true;
 const identity=ritual?.transform(state.drawn);$('result-spread').innerHTML=state.drawn.map((index,i)=>`<div class="spread-item"><div class="spread-card"><div class="mini-face" style="--position:${cards[index].position}"></div></div></div>`).join('');
 $('result-tag').textContent='YOUR ARCANA AVATAR';$('result-name').textContent=identity?.name||'YOUR ARCANA';$('result-reading').textContent=identity?.label||'Your magic is awakening.';emit(w/2,h*.32,90,cards[state.index].color,1.3);
 if(!faceReady)notify('Your face effect is loading…',5000);
}
function reveal(){if(state.phase!=='browse'||state.mode!=='camera'||!workerReady||state.charge<1)return;clearTimeout(guideTimer);guideTimer=null;state.index=currentIndex();state.offset=state.target=Math.round(state.target);updateDeck();state.phase='revealing';app.classList.add('revealing');setInstruction('revealing');$('trail-cursor').hidden=true;$('palm-ring').hidden=true;$('notice').hidden=true;const card=cards[state.index];document.documentElement.style.setProperty('--accent',card.color);tone(261.63,1.5,.07);tone(329.63,1.6,.055,.12);tone(392,1.8,.05,.24);tone(783.99,1.4,.035,.4);navigator.vibrate?.([35,35,70]);emit(w/2,h*.54,180,card.color,2.5);$('flash').classList.remove('fire');void $('flash').offsetWidth;$('flash').classList.add('fire');
 const center=cardNodes.find(({el})=>el.classList.contains('selected'));
 cardNodes.forEach(({el})=>{el.style.transition='transform .7s ease, opacity .6s ease';if(el!==center?.el){el.style.opacity=0;el.style.transform+=' translateY(-70px) scale(.6)';}});
 if(center){center.el.style.transform='translateX(-50%) scale(1.14) rotateY(90deg)';revealTimer=setTimeout(()=>{center.el.classList.add('face-visible');center.el.style.transform='translateX(-50%) scale(1.14) rotateY(0deg)';},340);}
 resultTimer=setTimeout(()=>{
  state.drawn.push(state.index);$('drawn-cards').innerHTML=collectedMarkup(state.drawn);$('drawn-cards').hidden=false;
  if(state.drawn.length===3)showReading();else nextRound();
 },1200);
}
$('start').onclick=startCamera;
app.addEventListener('pointerdown',()=>initAudio(),{once:true});
startCamera();
window.addEventListener('pagehide',()=>{releaseCamera();ritual?.dispose();});
const mc=document.modelContext;if(mc?.registerTool){const lifecycle=new AbortController();try{Promise.resolve(mc.registerTool({name:'read_tarot_game_state',description:'Read current camera tarot phase and sequential gesture guidance. Does not select or reveal cards.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:async()=>({phase:state.phase,mode:state.mode,guidance:guideStep,moves:state.moves,drawn:state.drawn.map(i=>cards[i].name),remaining:state.pool.length,scrollTarget:state.target,scrollPosition:state.offset,swipes:state.moves,card:state.phase==='result'?cards[state.index].name:null})},{signal:lifecycle.signal})).catch(()=>{});}catch{}window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});}
