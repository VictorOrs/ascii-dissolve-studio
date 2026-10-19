'use strict';
const $=id=>document.getElementById(id),canvas=$('preview'),ctx=canvas.getContext('2d');
const defaults={width:75,roughness:55,scatter:65,size:14,density:85,intensity:100,duration:6};
const colorDefaults={from:'#f4f1ec',to:'#f4f1ec',wave:'#202020',glyph:'#f4f1ec'},colors={...colorDefaults};
const formats={landscape:[1280,800],square:[1080,1080],portrait:[900,1200]};
const originalText=$('text').value,clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const hash=(x,y,s=0)=>{const n=Math.sin(x*127.1+y*311.7+s*74.7)*43758.5453;return n-Math.floor(n)};
const smooth=x=>{x=clamp(x);return x*x*(3-2*x)};
let phase=.58,playing=false,busy=false,cancelled=false,epoch=0,lastPaint=0,toastTimer;
function normalizeHex(value){let s=value.trim().replace(/^#/,'');if(/^[a-f0-9]{3}$/i.test(s))s=s.split('').map(c=>c+c).join('');return /^[a-f0-9]{6}$/i.test(s)?'#'+s.toLowerCase():null}
function setColor(key,value,normalize=false){const hex=normalizeHex(value);if(!hex)return false;colors[key]=hex;$(key+'Picker').value=hex;if(normalize)$(key+'Hex').value=hex.toUpperCase();$(key+'Hex').removeAttribute('aria-invalid');$('colorHelp').textContent='Use the same start and end color for a seamless loop.';paint();return true}
for(const key of Object.keys(colors)){
 $(key+'Picker').addEventListener('input',e=>setColor(key,e.target.value,true));
 $(key+'Hex').addEventListener('input',e=>setColor(key,e.target.value));
 $(key+'Hex').addEventListener('blur',e=>{if(!setColor(key,e.target.value,true)){$(key+'Hex').setAttribute('aria-invalid','true');$('colorHelp').textContent='Invalid color: use 3 or 6 hexadecimal digits.'}});
}
function validateColors(){for(const key of Object.keys(colors))if(!setColor(key,$(key+'Hex').value,true)){$(key+'Hex').focus();notify('Fix the color before exporting.');return false}return true}
function settings(){return {...Object.fromEntries(Object.keys(defaults).map(k=>[k,Number($(k).value)])),direction:$('direction').value,shape:$('shape').value,palette:$('palette').value,text:$('text').value.toUpperCase()||originalText,format:$('format').value}}
function coordinates(x,y,w,h,direction){const nx=x/w,ny=y/h;return direction==='up'?[1-ny,nx]:direction==='right'?[nx,ny]:direction==='left'?[1-nx,ny]:[ny,nx]}
function frontPosition(t,width){const margin=.55,band=width/100;return t*(1+band+2*margin)-band-margin}
function boundaryOffset(v,p){const rough=p.roughness/100;const col=v*38,index=Math.floor(col),mix=smooth(col-index);const coherent=hash(index,7)*(1-mix)+hash(index+1,7)*mix;const shape=p.shape==='wave'?Math.sin(v*Math.PI*4)*.11:p.shape==='arch'?(Math.pow((v-.5)*2,2)-.5)*.23:0;return (coherent-.5)*rough*.22+shape}
function edgeOpacity(distance,band){return Math.pow(1-smooth(distance/Math.min(.12,band*.3)),2)}
function glyphAt(x,y,p,tick){if(p.palette==='text'){const chars=p.text;return chars[(y*137+x+Math.floor(hash(3,y)*chars.length))%chars.length]}const chars=p.palette==='katakana'?'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜｦﾝ':p.palette==='code'?'01/<>[]{}*+':' .,:;+*#@';return chars[Math.floor(hash(x,y,tick)*chars.length)]}
function render(t,p=settings()){
 const [w,h]=formats[p.format];if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}
 ctx.globalAlpha=1;ctx.fillStyle=colors.from;ctx.fillRect(0,0,w,h);
 if(t<=0){$('formatLabel').textContent=w+' × '+h;return}
 if(t>=1){ctx.fillStyle=colors.to;ctx.fillRect(0,0,w,h);return}
 const cw=Math.max(5,Math.round(p.size*.68)),ch=Math.round(p.size*1.4),cols=Math.ceil(w/cw),rows=Math.ceil(h/ch),front=frontPosition(t,p.width),band=p.width/100,tick=Math.floor(t*p.duration*8);
 ctx.font=p.size+'px monospace';ctx.textBaseline='middle';ctx.textAlign='center';ctx.lineJoin='round';ctx.lineWidth=Math.max(.01,(p.intensity/100-1)*.3);
 for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
  const [u,v]=coordinates((x+.5)*cw,(y+.5)*ch,w,h,p.direction),teeth=(hash(x,Math.floor(y/2))-.5)*p.roughness/100*.035;
  const d=u-front-boundaryOffset(v,p)-teeth,inside=d>=0&&d<band;
  ctx.globalAlpha=1;ctx.fillStyle=inside?colors.wave:d<0?colors.to:colors.from;ctx.fillRect(x*cw,y*ch,cw,ch);
  const char=glyphAt(x,y,p,tick);if(char===' ')continue;
  if(inside){
   const distance=Math.min(d,band-d),edge=edgeOpacity(distance,band),dense=hash(x,y,11)<p.density/100;
   if(!dense||edge<=0)continue;const flicker=.8+.2*Math.sin(t*Math.PI*2+hash(x,y)*Math.PI*2);
   ctx.globalAlpha=clamp(.8*edge*p.intensity/100*flicker);ctx.fillStyle=colors.glyph;
  }else{
   const distance=d<0?-d:d-band,spread=.04+p.scatter/100*.22;
   if(distance>spread||hash(x,y,37)>(p.scatter/100)*.2*Math.pow(1-distance/spread,1.6))continue;
   ctx.globalAlpha=clamp((.18+.62*(1-distance/spread))*p.intensity/100);ctx.fillStyle=colors.wave;
  }
  ctx.fillText(char,x*cw+cw/2,y*ch+ch/2,cw);if(p.intensity>150){ctx.strokeStyle=ctx.fillStyle;ctx.strokeText(char,x*cw+cw/2,y*ch+ch/2,cw)}
 }
 ctx.globalAlpha=1;$('formatLabel').textContent=w+' × '+h;
}
function paint(){if(!busy)render(phase)}
function update(){for(const key of Object.keys(defaults))$(key+'Out').value=$(key).value+(key==='size'?' px':key==='duration'?' s':' %');$('textControl').hidden=$('palette').value!=='text';paint()}
function syncPhase(){ $('phase').value=Math.round(phase*1000);$('phaseOut').value=Math.round(phase*100)+' %' }
function setPlaying(value){playing=value;$('play').textContent=playing?'Ⅱ Pause':'▶ Play';$('play').setAttribute('aria-label',playing?'Pause transition':'Play transition');epoch=performance.now()-phase*Number($('duration').value)*1000}
function animate(time){if(playing&&!busy&&time-lastPaint>1000/24){phase=((time-epoch)/(Number($('duration').value)*1000))%1;lastPaint=time;syncPhase();render(phase)}requestAnimationFrame(animate)}
for(const key of Object.keys(defaults))$(key).addEventListener('input',()=>{if(key==='duration')epoch=performance.now()-phase*Number($('duration').value)*1000;update()});
for(const key of ['direction','shape','palette','format','text'])$(key).addEventListener(key==='text'?'input':'change',update);
$('phase').addEventListener('input',()=>{setPlaying(false);phase=Number($('phase').value)/1000;syncPhase();paint()});$('play').onclick=()=>{if(phase>=1)phase=0;setPlaying(!playing)};
$('reset').onclick=()=>{setPlaying(false);for(const [key,value]of Object.entries(defaults))$(key).value=value;for(const [key,value]of Object.entries(colorDefaults))setColor(key,value,true);$('direction').value='down';$('shape').value='linear';$('palette').value='text';$('format').value='landscape';$('text').value=originalText;phase=.58;syncPhase();update();notify('Settings reset.')};
function notify(text){$('toast').textContent=text;$('toast').style.display='block';clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').style.display='none',4000)}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000)}
$('exportPng').onclick=()=>{if(!validateColors())return;render(phase);canvas.toBlob(blob=>{if(blob){download(blob,'ascii-transition.png');notify('PNG exported.')}else notify('PNG export failed.')},'image/png')};
$('cancelExport').onclick=()=>{cancelled=true;$('exportStatus').textContent='Cancelling…'};
const yieldFrame=()=>new Promise(resolve=>setTimeout(resolve,0));
async function exportMp4(){
 if(busy||!validateColors())return;const previousPlaying=playing,previousPhase=phase,p=settings(),states=[];let encoder=null,encoderError=null;
 setPlaying(false);busy=true;cancelled=false;
 document.querySelectorAll('aside input,aside select,aside textarea,aside button,.timeline button,.timeline input').forEach(el=>{if(el.id!=='cancelExport'){states.push([el,el.disabled]);el.disabled=true}});
 $('controls').setAttribute('aria-busy','true');$('exportProgress').hidden=false;$('cancelExport').hidden=false;$('progress').value=0;$('exportStatus').textContent='Preparing MP4…';
 try{
  if(typeof VideoEncoder==='undefined')throw new Error('Try a recent Chrome, Edge or Safari browser to export MP4.');
  const [width,height]=formats[p.format],fps=24,total=p.duration*fps;let config=null;
  for(const codec of ['avc1.420028','avc1.4d0028','avc1.640028']){const candidate={codec,width,height,framerate:fps,bitrate:5000000};try{if((await VideoEncoder.isConfigSupported(candidate)).supported){config=candidate;break}}catch{}}
  if(!config)throw new Error('MP4 encoding is unavailable in this browser.');
  const target=new Mp4Muxer.ArrayBufferTarget(),muxer=new Mp4Muxer.Muxer({target,video:{codec:'avc',width,height,frameRate:fps},fastStart:'in-memory'});
  encoder=new VideoEncoder({output:(chunk,meta)=>{try{muxer.addVideoChunk(chunk,meta)}catch(e){encoderError=e}},error:e=>{encoderError=e}});encoder.configure(config);await document.fonts.ready;
  for(let i=0;i<total;i++){
   if(cancelled)throw new Error('cancelled');if(encoderError)throw encoderError;render(i/(total-1),p);
   const timestamp=Math.round(i*1000000/fps),frame=new VideoFrame(canvas,{timestamp,duration:Math.round((i+1)*1000000/fps)-timestamp});
   try{encoder.encode(frame,{keyFrame:i%48===0})}finally{frame.close()}
   $('progress').value=Math.round((i+1)/total*95);$('exportStatus').textContent='Creating MP4 · '+Math.round((i+1)/total*100)+' %';
   do{await yieldFrame();if(cancelled)throw new Error('cancelled');if(encoderError)throw encoderError}while(encoder.encodeQueueSize>4);
  }
  $('exportStatus').textContent='Finalizing…';await encoder.flush();if(encoderError)throw encoderError;if(cancelled)throw new Error('cancelled');muxer.finalize();download(new Blob([target.buffer],{type:'video/mp4'}),'ascii-transition-'+p.duration+'s.mp4');$('progress').value=100;$('exportStatus').textContent='MP4 exported · '+p.duration+' s · '+width+' × '+height;notify('MP4 transition exported.');
 }catch(e){$('exportStatus').textContent=e.message==='cancelled'?'Export cancelled.':e.message||'Export failed.';notify($('exportStatus').textContent)}
 finally{if(encoder&&encoder.state!=='closed')encoder.close();states.forEach(([el,disabled])=>el.disabled=disabled);$('controls').removeAttribute('aria-busy');$('cancelExport').hidden=true;busy=false;cancelled=false;phase=previousPhase;syncPhase();setPlaying(previousPlaying);paint()}
}
$('exportMp4').onclick=exportMp4;syncPhase();update();requestAnimationFrame(animate);
