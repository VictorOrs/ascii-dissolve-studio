'use strict';
const $=id=>document.getElementById(id), canvas=$('result'), ctx=canvas.getContext('2d'), source=document.createElement('canvas'), sx=source.getContext('2d',{willReadFrequently:true}), sample=document.createElement('canvas'), sp=sample.getContext('2d',{willReadFrequently:true});
const defaults={start:22,end:92,curve:110,intensity:100,size:9,noise:55,cuts:35,angle:0,posX:50,posY:50,radius:100,flatten:0,amplitude:15,frequency:2};
const shade=document.createElement('canvas'),sh=shade.getContext('2d');
let mode='original',originalView=false,frame=0,timer=null,queued=false,rowsText='',baseName='demo-landscape',background='#111111',exportingVideo=false,cancelVideo=false;
const characterDefaults={white:'#ffffff',matrix:'#8aff5c'};
const characterColors={...characterDefaults};
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const hash=(x,y,s=0)=>{let n=Math.sin(x*127.1+y*311.7+s*74.7)*43758.5453;return n-Math.floor(n)};
function settings(){return {...Object.fromEntries(Object.keys(defaults).map(k=>[k,Number($(k).value)])),shape:$('shape').value,invert:$('invert').checked,background}}
function normalizeHex(value){let hex=value.trim().replace(/^#/,'');if(/^[0-9a-f]{3}$/i.test(hex))hex=hex.split('').map(c=>c+c).join('');return /^[0-9a-f]{6}$/i.test(hex)?'#'+hex.toLowerCase():null}
function setBackground(value,normalizeField=false){const hex=normalizeHex(value);if(!hex)return false;background=hex;$('backgroundPicker').value=hex;if(normalizeField)$('backgroundHex').value=hex;$('backgroundHex').removeAttribute('aria-invalid');$('backgroundHelp').textContent='Hex color · e.g. #111111';$('backgroundCode').textContent=hex;schedule();return true}
$('backgroundPicker').addEventListener('input',e=>setBackground(e.target.value,true));
$('backgroundHex').addEventListener('input',e=>setBackground(e.target.value));
$('backgroundHex').addEventListener('blur',e=>{if(!setBackground(e.target.value,true)){$('backgroundHex').setAttribute('aria-invalid','true');$('backgroundHelp').textContent='Enter 3 or 6 hexadecimal characters, for example #111111.'}});
function updateCharacterControls(){const enabled=mode==='white'||mode==='matrix';$('characterColorControl').hidden=!enabled;if(!enabled)return;$('characterPicker').value=characterColors[mode];$('characterHex').value=characterColors[mode];$('characterHex').removeAttribute('aria-invalid');$('characterHelp').textContent=`${mode==='matrix'?'Matrix':'White'} mode color · saved for this mode.`}
function setCharacterColor(value,normalizeField=false){if(mode!=='white'&&mode!=='matrix')return false;const hex=normalizeHex(value);if(!hex)return false;characterColors[mode]=hex;$('characterPicker').value=hex;if(normalizeField)$('characterHex').value=hex;$('characterHex').removeAttribute('aria-invalid');$('characterHelp').textContent=`${mode==='matrix'?'Matrix':'White'} mode color · saved for this mode.`;schedule();return true}
function characterOpacity(base,intensity){return clamp(base*intensity/100)}
function asciiColor(r,g,b){return mode==='original'?`rgb(${r},${g},${b})`:characterColors[mode]}
$('characterPicker').addEventListener('input',e=>setCharacterColor(e.target.value,true));$('characterHex').addEventListener('input',e=>setCharacterColor(e.target.value));$('characterHex').addEventListener('blur',e=>{if(!setCharacterColor(e.target.value,true)){$('characterHex').setAttribute('aria-invalid','true');$('characterHelp').textContent='Enter 3 or 6 hexadecimal characters, for example #ff8800.'}});
function smooth(t){t=clamp(t);return t*t*t*(t*(t*6-15)+10)}
function threshold(y,p){return smooth(Math.pow(clamp((y-p.start/100)/((p.end-p.start)/100)),p.curve/100))}
// Noise stays correlated along each column so the image dissolves into vertical ribbons.
function columnLimits(x,p){const strength=p.noise/100;const start=p.start/100;const spread=(hash(x,17)-.5)*strength*.18;return {start:clamp(start+spread*.35,0,.88),end:clamp(p.end/100+spread,start+.12,.99)}}
function gradientDistance(x,y,p,w,h){const dx=x-p.posX/100,dy=y-p.posY/100,angle=p.angle*Math.PI/180,ax=Math.sin(angle),ay=Math.cos(angle);let d;
if(p.shape==='radial'){const maxX=Math.max(p.posX/100,1-p.posX/100)*w,maxY=Math.max(p.posY/100,1-p.posY/100)*h,flatten=clamp((p.flatten??0)/100,-.8,.8),scaleX=flatten<0?1+flatten:1,scaleY=flatten>0?1-flatten:1;d=Math.hypot(dx*w/scaleX,dy*h/scaleY)/(Math.hypot(maxX,maxY)*p.radius/100)}
else{d=.5+(dx*ax+dy*ay)/(Math.abs(ax)+Math.abs(ay));if(p.shape==='wave'){const across=dx*ay-dy*ax;d-=Math.sin(across*p.frequency*Math.PI*2)*p.amplitude/100}}
return p.invert?1-d:d}
function columnThreshold(y,x,p,normalizedX,w,h){const limits=columnLimits(x,p),distance=gradientDistance(normalizedX,y,p,w,h);return smooth(Math.pow(clamp((distance-limits.start)/Math.max(.12,limits.end-limits.start)),p.curve/100))}
function verticalNoise(x,y,length){const segment=y/length,part=segment-Math.floor(segment);return hash(x,Math.floor(segment))* (1-smooth(part))+hash(x,Math.floor(segment)+1)*smooth(part)}
function notify(message){$('toast').textContent=message;$('toast').style.display='block';clearTimeout(timer);timer=setTimeout(()=>$('toast').style.display='none',3500)}
function update(){const p=settings();for(const k of Object.keys(defaults)){$(k+'Out').value=k==='flatten'?(p[k]===0?'Cercle':Math.abs(p[k])+' % '+(p[k]>0?'horizontal':'vertical')):k==='size'?p[k]+' px':k==='curve'?(p[k]/100).toFixed(2)+'×':k==='angle'?p[k]+'°':k==='frequency'?String(p[k]):p[k]+' %'}updateShapeControls(p);drawGraph(p);schedule()}
function updateShapeControls(p){$('angleControl').hidden=p.shape==='radial';$('radiusControl').hidden=p.shape!=='radial';$('flattenControl').hidden=p.shape!=='radial';$('waveControls').hidden=p.shape!=='wave'}
function drawGraph(p){const g=$('graph').getContext('2d');g.clearRect(0,0,280,60);g.strokeStyle='#293322';g.lineWidth=1;for(let i=0;i<5;i++){g.beginPath();g.moveTo(i*70,0);g.lineTo(i*70,60);g.stroke()}g.strokeStyle='#d5f681';g.lineWidth=2;g.beginPath();for(let i=0;i<=280;i++){const y=56-threshold(i/280,p)*49;i?g.lineTo(i,y):g.moveTo(i,y)}g.stroke()}
function schedule(){if(exportingVideo)return;if(!queued){queued=true;requestAnimationFrame(()=>{queued=false;if(!exportingVideo)render()})}}
function loopPhase(seconds,duration){return ((seconds%duration)+duration)%duration/duration}
function render(exportPhase=null,forceAnimation=false){const animated=forceAnimation||$('animate').checked,duration=Number($('loopDuration').value),phase=exportPhase===null?loopPhase(performance.now()/1000,duration):loopPhase(exportPhase,1),animationTick=Math.floor(phase*duration*6);const p=settings(),w=source.width,h=source.height;canvas.width=w;canvas.height=h;ctx.fillStyle=p.background;ctx.fillRect(0,0,w,h);ctx.drawImage(source,0,0);if(originalView)return;
const cw=p.size,ch=Math.round(cw*1.65),cols=Math.ceil(w/cw),rows=Math.ceil(h/ch);sample.width=cols;sample.height=rows;sp.fillStyle=p.background;sp.fillRect(0,0,cols,rows);sp.drawImage(source,0,0,cols,rows);const data=sp.getImageData(0,0,cols,rows).data;
const palettes={classic:' .,:;i+*oO#%@',code:' .01:/<>[]{}#@$',dense:' .░▒▓█',katakana:' ･:ｨｩｪｫｬｭｮｯｲﾘﾉﾊﾍﾚｿﾝﾂｼﾃﾄﾁﾆﾇﾌﾗｸｹｺﾏﾑﾒﾓﾔﾕﾖﾙﾛﾜｦｱｳｴｵｶｷｻｽｾﾀﾅﾈﾋﾎﾐ'};
const chars=palettes[$('palette').value]||palettes.classic;ctx.font=`${ch}px monospace`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';const strokeWidth=ch*.035*Math.max(0,p.intensity/100-1);ctx.lineWidth=Math.max(.01,strokeWidth);rowsText='';
// A continuous, interpolated mask removes hard rectangular cell backgrounds.
// Column-specific endpoints keep the trails from stopping on one horizontal line.
shade.width=cols;shade.height=Math.max(64,Math.min(256,h));const mask=sh.createImageData(shade.width,shade.height),bgRgb=[1,3,5].map(i=>parseInt(p.background.slice(i,i+2),16));
for(let y=0;y<shade.height;y++)for(let x=0;x<cols;x++){const i=(y*cols+x)*4,t=columnThreshold(y/(shade.height-1),x,p,(x+.5)/cols,w,h);mask.data[i]=bgRgb[0];mask.data[i+1]=bgRgb[1];mask.data[i+2]=bgRgb[2];mask.data[i+3]=Math.round(smooth(clamp(t*1.25))*255)}
sh.putImageData(mask,0,0);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(shade,0,0,w,h);
for(let y=0;y<rows;y++){let line='';for(let x=0;x<cols;x++){const i=(y*cols+x)*4,r=data[i],g=data[i+1],b=data[i+2],lum=(r*.2126+g*.7152+b*.0722)/255;
const progress=columnThreshold((y*ch+ch/2)/h,x,p,(x*cw+cw/2)/w,w,h);
// Long coherent streams with shorter interruptions, all fading into the selected background.
const stream=verticalNoise(x,y,6+hash(x,29)*12),gate=smooth(clamp((progress-stream*.27)/.65));
const breakNoise=hash(x,Math.floor(y/(2+Math.floor(hash(x,45)*4)))+61);
const cutDepth=smooth(clamp((p.cuts/100*.75-breakNoise)/.2));
const envelope=smooth(clamp(progress/.35))*(1-smooth(clamp((progress-.5)/.5)));
const shimmer=animated?.85+.15*Math.sin(phase*Math.PI*2+hash(x,29)*Math.PI*2+y*.28):1;
const opacity=characterOpacity(envelope*gate*(1-cutDepth*.94)*(.65+lum*.35)*shimmer,p.intensity);
let char=chars[Math.round(clamp(lum)*(chars.length-1))];if(animated&&hash(x,Math.floor(y/3),animationTick)>.88&&opacity>.1){char=chars[1+Math.floor(hash(x+9,y,animationTick)*(chars.length-1))]}
line+=char;if(opacity<=0)continue;ctx.globalAlpha=opacity;ctx.fillStyle=asciiColor(r,g,b);ctx.fillText(char,x*cw+cw/2,y*ch+ch/2,cw);if(strokeWidth>0){ctx.strokeStyle=ctx.fillStyle;ctx.strokeText(char,x*cw+cw/2,y*ch+ch/2,cw)}ctx.globalAlpha=1}rowsText+=line+'\n'}$('dimensions').textContent=`${w} × ${h} PX`;$('cellCount').textContent=`${cols.toLocaleString('en-US')} × ${rows} CHARACTERS`}
function makeDemo(){source.width=1000;source.height=900;const w=1000,h=900;let g=sx.createLinearGradient(0,0,0,h);g.addColorStop(0,'#adb7b0');g.addColorStop(.4,'#d7d3b6');g.addColorStop(.6,'#9caa9a');g.addColorStop(1,'#384e45');sx.fillStyle=g;sx.fillRect(0,0,w,h);sx.fillStyle='#e1dfbe';sx.beginPath();sx.arc(690,185,64,0,Math.PI*2);sx.fill();
function mountain(points,color){sx.fillStyle=color;sx.beginPath();sx.moveTo(0,h);for(const [x,y]of points)sx.lineTo(x,y);sx.lineTo(w,h);sx.closePath();sx.fill()}
mountain([[0,390],[90,370],[240,160],[285,225],[345,183],[510,400],[625,265],[700,330],[780,223],[1000,430]],'#798d89');mountain([[0,490],[175,370],[250,420],[390,289],[490,410],[585,386],[700,491],[845,348],[1000,476]],'#506e65');mountain([[0,557],[140,490],[260,580],[380,520],[530,620],[660,543],[800,597],[940,483],[1000,520]],'#35574a');
g=sx.createLinearGradient(0,570,0,900);g.addColorStop(0,'#a1b6a6');g.addColorStop(1,'#526f60');sx.fillStyle=g;sx.beginPath();sx.moveTo(390,565);sx.lineTo(660,565);sx.lineTo(890,900);sx.lineTo(170,900);sx.fill();
for(let i=0;i<350;i++){const y=600+hash(i,1)*300,x=300+hash(i,2)*430;sx.fillStyle=`rgba(198,212,180,${hash(i,4)*.19})`;sx.fillRect(x,y,10+hash(i,3)*100,1)}
function tree(x,y,size){sx.fillStyle='#173c2b';sx.fillRect(x-size*.04,y-size*.15,size*.08,size*.2);for(let j=0;j<4;j++){sx.beginPath();sx.moveTo(x,y-size+j*size*.18);sx.lineTo(x-size*(.2+j*.06),y-size*.42+j*size*.17);sx.lineTo(x+size*(.2+j*.06),y-size*.42+j*size*.17);sx.closePath();sx.fill()}}
for(let i=0;i<100;i++){const left=i<50,x=left?hash(i,11)*290:760+hash(i,11)*240,y=575+hash(i,12)*325;tree(x,y,35+(y-575)*.45+hash(i,13)*50)}
const pixels=sx.getImageData(0,0,w,h);for(let i=0;i<pixels.data.length;i+=4){let n=(hash(i,3)-.5)*10;for(let j=0;j<3;j++)pixels.data[i+j]+=n}sx.putImageData(pixels,0,0);baseName='demo-landscape';$('filename').textContent='demo-landscape';update()}
async function load(file){if(exportingVideo||!file)return;if(!file.type.startsWith('image/')){notify('Choose an image file.');return}if(file.size>40*1024*1024){notify('Image too large: maximum 40 MB.');return}const url=URL.createObjectURL(file);try{const img=new Image();img.src=url;await img.decode();const scale=Math.min(1,1800/Math.max(img.naturalWidth,img.naturalHeight));source.width=Math.max(1,Math.round(img.naturalWidth*scale));source.height=Math.max(1,Math.round(img.naturalHeight*scale));sx.clearRect(0,0,source.width,source.height);sx.drawImage(img,0,0,source.width,source.height);baseName=file.name.replace(/\.[^.]+$/,'');$('filename').textContent=file.name;originalView=false;setView(false);update();notify('Image uploaded. Adjust your gradient.')}catch{notify('Could not read this image. Try PNG, JPG or WebP.')}finally{URL.revokeObjectURL(url);$('file').value=''}}
for(const k of Object.keys(defaults))$(k).addEventListener('input',()=>{if(k==='start'&&+ $('start').value>=+ $('end').value)$('end').value=+ $('start').value+1;if(k==='end'&&+ $('end').value<=+ $('start').value)$('start').value=+ $('end').value-1;update()});
$('shape').addEventListener('change',()=>{if($('shape').value==='diagonal')$('angle').value=45;else if($('shape').value==='linear')$('angle').value=0;update()});$('invert').addEventListener('change',update);
canvas.addEventListener('click',e=>{if(originalView||exportingVideo)return;const rect=canvas.getBoundingClientRect();$('posX').value=Math.round(clamp((e.clientX-rect.left)/rect.width)*100);$('posY').value=Math.round(clamp((e.clientY-rect.top)/rect.height)*100);update()});
$('palette').addEventListener('change',schedule);document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.mode;updateCharacterControls();document.querySelectorAll('[data-mode]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b))});schedule()}));
function setView(v){originalView=v;$('sourceView').classList.toggle('active',v);$('effectView').classList.toggle('active',!v);$('sourceView').setAttribute('aria-pressed',String(v));$('effectView').setAttribute('aria-pressed',String(!v));schedule()}
$('sourceView').onclick=()=>setView(true);$('effectView').onclick=()=>setView(false);$('file').onchange=e=>load(e.target.files[0]);$('demo').onclick=makeDemo;$('drop').addEventListener('dragover',e=>{e.preventDefault();$('drop').classList.add('drag')});$('drop').addEventListener('dragleave',()=>$('drop').classList.remove('drag'));$('drop').addEventListener('drop',e=>{e.preventDefault();$('drop').classList.remove('drag');load(e.dataTransfer.files[0])});
$('reset').onclick=()=>{$('loopDuration').value=4;$('loopDurationOut').value='4 s';Object.assign(characterColors,characterDefaults);setBackground('#111111',true);for(const [k,v]of Object.entries(defaults))$(k).value=v;$('shape').value='linear';$('invert').checked=false;$('palette').value='classic';$('animate').checked=false;document.querySelector('[data-mode="original"]').click();setView(false);update();notify('Settings reset.')};
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
$('export').onclick=()=>{if(mode!=='original'&&!setCharacterColor($('characterHex').value,true)){notify('Fix the character color before exporting.');$('characterHex').focus();return}if(!setBackground($('backgroundHex').value,true)){notify('Fix the background color before exporting.');$('backgroundHex').focus();return}originalView=false;setView(false);render();canvas.toBlob(b=>{if(b){download(b,baseName+'-ascii.png');notify('PNG exported.')}else notify('Export failed. Please try again.')},'image/png')};$('textExport').onclick=()=>{const v=originalView;originalView=false;render();download(new Blob([rowsText],{type:'text/plain;charset=utf-8'}),baseName+'-ascii.txt');originalView=v;schedule();notify('ASCII text exported (full image, without gradient).')};
setInterval(()=>{if(!exportingVideo&&$('animate').checked&&!originalView&&!document.hidden)schedule()},80);$('animate').onchange=schedule;makeDemo();

$('loopDuration').addEventListener('input',()=>{$('loopDurationOut').value=$('loopDuration').value+' s';schedule()});
$('cancelVideo').onclick=()=>{cancelVideo=true;$('videoStatus').textContent='Cancelling…'};
const exportPause=()=>new Promise(resolve=>setTimeout(resolve,0));
async function exportLoopMp4(){
 if(exportingVideo)return;
 if(mode!=='original'&&!setCharacterColor($('characterHex').value,true)){notify('Fix the character color before exporting.');$('characterHex').focus();return}
 if(!setBackground($('backgroundHex').value,true)){notify('Fix the background color before exporting.');$('backgroundHex').focus();return}
 const previousView=originalView,controlStates=[];let encoder=null,encodingError=null;
 exportingVideo=true;cancelVideo=false;originalView=false;
 document.querySelectorAll('aside input,aside select,aside button,.view-toggle button').forEach(el=>{if(el.id!=='cancelVideo'){controlStates.push([el,el.disabled]);el.disabled=true}});
 $('drop').inert=true;$('cancelVideo').hidden=false;$('videoProgress').hidden=false;$('videoProgressBar').value=0;$('videoStatus').textContent='Preparing MP4…';document.querySelector('aside').setAttribute('aria-busy','true');
 try{
  if(typeof VideoEncoder==='undefined'||typeof VideoFrame==='undefined')throw new Error('MP4 export requires a recent compatible browser (Chrome, Edge or Safari).');
  const fps=24,seconds=Number($('loopDuration').value),total=fps*seconds,scale=Math.min(1,1280/Math.max(source.width,source.height));
  const width=Math.max(2,Math.round(source.width*scale/2)*2),height=Math.max(2,Math.round(source.height*scale/2)*2);
  let config=null;
  for(const codec of ['avc1.420028','avc1.4d0028','avc1.640028']){const candidate={codec,width,height,bitrate:4000000,framerate:fps};try{if((await VideoEncoder.isConfigSupported(candidate)).supported){config=candidate;break}}catch{}}
  if(!config)throw new Error('MP4 encoding is unavailable here. Try a recent Chrome, Edge or Safari browser.');
  if(cancelVideo)throw new Error('cancelled');
  const target=new Mp4Muxer.ArrayBufferTarget(),muxer=new Mp4Muxer.Muxer({target,video:{codec:'avc',width,height,frameRate:fps},fastStart:'in-memory'});
  encoder=new VideoEncoder({output:(chunk,meta)=>{try{muxer.addVideoChunk(chunk,meta)}catch(e){encodingError=e}},error:e=>{encodingError=e}});encoder.configure(config);
  const output=document.createElement('canvas');output.width=width;output.height=height;const out=output.getContext('2d');
  await document.fonts.ready;
  for(let i=0;i<total;i++){
   if(cancelVideo)throw new Error('cancelled');if(encodingError)throw encodingError;
   render(i/total,true);out.drawImage(canvas,0,0,width,height);
   const timestamp=Math.round(i*1000000/fps),videoFrame=new VideoFrame(output,{timestamp,duration:Math.round((i+1)*1000000/fps)-timestamp});
   try{encoder.encode(videoFrame,{keyFrame:i%48===0})}finally{videoFrame.close()}
   $('videoProgressBar').value=Math.round((i+1)/total*95);$('videoStatus').textContent=`Creating MP4 · ${Math.round((i+1)/total*100)} % · ${seconds} s`;
   do{await exportPause();if(cancelVideo)throw new Error('cancelled');if(encodingError)throw encodingError}while(encoder.encodeQueueSize>4);
  }
  $('videoStatus').textContent='Finalizing MP4…';await encoder.flush();if(encodingError)throw encodingError;if(cancelVideo)throw new Error('cancelled');muxer.finalize();
  download(new Blob([target.buffer],{type:'video/mp4'}),baseName+'-ascii-loop-'+seconds+'s.mp4');$('videoProgressBar').value=100;$('videoStatus').textContent=`MP4 exported · ${seconds} s · ${width} × ${height} · seamless loop.`;notify('MP4 loop exported.');
 }catch(error){$('videoStatus').textContent=error.message==='cancelled'?'Export cancelled.':error.message||'MP4 export failed. Please try again.';notify($('videoStatus').textContent)}
 finally{if(encoder&&encoder.state!=='closed')encoder.close();controlStates.forEach(([el,disabled])=>el.disabled=disabled);$('drop').inert=false;document.querySelector('aside').removeAttribute('aria-busy');exportingVideo=false;cancelVideo=false;$('cancelVideo').hidden=true;originalView=previousView;setView(previousView);}
}
$('exportVideo').onclick=exportLoopMp4;
