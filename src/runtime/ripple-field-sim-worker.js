// Obsidian Prism — Off-Main-Thread Wave Simulation & WebGL2 Worker (Channel 17)
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.__agPrismRippleSim = api;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function (G) {
  'use strict';
  const M = Math;
  const clamp01 = (v, fb = 1) => { const n = Number(v); return Number.isFinite(n) ? M.max(0, M.min(1, n)) : fb; };
  const n255 = (c) => [c[0] / 255, c[1] / 255, c[2] / 255];

  const WORKER_SIM_SRC = [
    "'use strict';var M=Math,TAU=M.PI*2,CW=7,CH=15,FSZ=10,DIG_R=.3,WS=1/600,MAX_A=.05,REST_H=.003;",
    "var CP={subtle:[.6,.4,.45,.55,32,340,72,196,.62,.28,.72],medium:[.85,.75,.75,.82,22,270,54,215,.85,.34,.88],full:[1,1,1,1,16,220,42,230,1,.4,1]};",
    "var NP=[.35,2.45,4.55],NA=[2.85,.52,4.62],NH=[.04,.54,.8],LIC=[74,90,118],LWC=[37,99,235];",
    "var cv,gl,P,u={},cT,aT,aC,aX,aK='',cols=0,rows=0,cells=0,dpr=1,pw=0,ph=0,glyphs='',sp0=[.26,.52,.96],sp1=[.61,.45,.8],sp2=[.92,.26,.21],sp3=[.98,.74,.02];",
    "var mode='home',lv='off',dk=1,ink=[146,148,156],wvC=[214,218,228],font='monospace',amb=1,sc=0,still=0,mg=0;",
    "var data,glow,patch,gCh,edge,mask,bSin,bCos,wLit,cClds,cMap=new Map(),zones=[],zK='',lTk=-1,lDf=-1,lId=-1e12,lDk=-1,lAS=-1,glw=0,pB=0,stale=1;",
    "var hA,vA,spSq,spF,damp,srcs=[],mv=0,beh=0,ld=0,wLd=0,prm=0,aC0=0,aC1=-1,aR0=0,aR1=-1,seed=M.random()*1e3;",
    "var rd=0,paused=0,rel=0,drawn=0,slp=1,slpSent=0,gen=0,raf=0,tm=0,dd=0,mAt=0,tideAt=0,aTm=null,prev=0,lDrw=0,lTs=0,wSlp=1;",
    "var as={x:0,y:0,a:0,f:1,lsa:0,wk:0},lx=null,ly=null,carry=0,lPt=0,rExp=new Float64Array(32),cExp=new Float64Array(64);",
    "var now=()=>typeof performance!=='undefined'?performance.now():Date.now(),pm=o=>{try{self.postMessage(o)}catch{}};",
    "var cl=(v,a,b)=>M.max(a,M.min(b,v)),sm=v=>{var c=cl(v,0,1);return c*c*(3-2*c)};",
    "var hs=(a,b)=>{var h=(a*374761393+b*668265263)|0;h=M.imul(h^(h>>>13),1274126177)|0;return((h^(h>>>16))>>>0)/4294967296};",
    "var vN=(x,y)=>{var x0=M.floor(x),y0=M.floor(y),fx=x-x0,fy=y-y0,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy),t=hs(x0,y0)+(hs(x0+1,y0)-hs(x0,y0))*sx,b=hs(x0,y0+1)+(hs(x0+1,y0+1)-hs(x0,y0+1))*sx;return t+(b-t)*sy};",
    "var fN=(x,y)=>(vN(x,y)*4+vN(x*2.1+7,y*2.1+3)*2+vN(x*4.3+13,y*4.3+11))/7;",
    "var gIdx=(c,r,k)=>{var d=hs(c*7+k*13,r*11+k*3)<DIG_R,p=hs(c*131+k,r*197+k*7);return d?M.floor(p*10):10+M.floor(p*52)};",
    "var cCol=a=>{var col=cMap.get(a);if(!col){col=new Float32Array(rows);for(var r=0;r<rows;r++)col[r]=.22+.78*sm((fN((a*CW+CW/2)/100,(r*CH+CH/2)/100)-.595)/.2);cMap.set(a,col)}return col};",
    "var stopL=()=>{if(raf&&typeof self.cancelAnimationFrame==='function')try{self.cancelAnimationFrame(raf)}catch{}raf=0;if(tm){clearTimeout(tm);tm=0}};",
    "var sched=()=>{if(dd||paused||rel||pw<=0||ph<=0||raf||tm)return;if(typeof self.requestAnimationFrame==='function')raf=self.requestAnimationFrame(stepFr);else tm=setTimeout(()=>{tm=0;stepFr(now())},16)};",
    "var goSlp=()=>{stopL();wSlp=1;slp=1;if(!slpSent){slpSent=1;pm({type:'slept',gen:gen})}};",
    "var wakeW=()=>{if(dd||paused||rel||pw<=0||ph<=0)return;slp=0;slpSent=0;sched()};",
    "var frG=()=>{if(gl)try{P&&gl.deleteProgram(P);cT&&gl.deleteTexture(cT);aT&&gl.deleteTexture(aT)}catch{}P=cT=aT=null;u={};aK=''};",
    "var mT=(i,f)=>{var t=gl.createTexture();gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,f);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,f);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t};",
    "var aC2=()=>{cT&&gl.deleteTexture(cT);cT=mT(0,gl.NEAREST);if(cols>0&&rows>0)gl.texStorage2D(gl.TEXTURE_2D,1,gl.RGBA8,cols,rows)};",
    "var bld=(vs,fs)=>{frG();var cp=(t,s)=>{var h=gl.createShader(t);gl.shaderSource(h,s);gl.compileShader(h);if(!gl.getShaderParameter(h,gl.COMPILE_STATUS)){var l=gl.getShaderInfoLog(h)||'sh';gl.deleteShader(h);throw new Error(l)}return h},v=cp(gl.VERTEX_SHADER,vs),f=cp(gl.FRAGMENT_SHADER,fs);P=gl.createProgram();gl.attachShader(P,v);gl.attachShader(P,f);gl.linkProgram(P);gl.deleteShader(v);gl.deleteShader(f);if(!gl.getProgramParameter(P,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(P)||'link');gl.useProgram(P);for(var n of 'cells,atlas,size,grid,cellPixels,atlasCell,glyphCount,ink,wave,aura,optics,auraLift,auraPhase,lightMode,neb0,neb1,neb2,nebOpt,nebulaLift,uSpec0,uSpec1,uSpec2,uSpec3,uIdleParams,uIdleMetrics'.split(','))u[n]=gl.getUniformLocation(P,n)};",
    "var bAtl=(fn,d)=>{var k=fn+'|'+d;if(k===aK)return;if(!aC){aC=new OffscreenCanvas(1,1);aX=aC.getContext('2d');if(!aX)throw new Error('no-2d')}var w=M.ceil(CW*d),h=M.ceil(CH*d);aC.width=w*glyphs.length;aC.height=h;aX.setTransform(w/CW,0,0,h/CH,0,0);aX.clearRect(0,0,CW*glyphs.length,CH);aX.font=FSZ+'px '+fn;aX.textBaseline='middle';aX.textAlign='center';aX.fillStyle='#fff';for(var i=0;i<glyphs.length;i++)aX.fillText(glyphs[i],i*CW+CW/2,CH/2);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,aT);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,aC);gl.uniform2f(u.atlasCell,w,h);gl.uniform1f(u.glyphCount,glyphs.length);aK=k};",
    "var initG=(nc,nr)=>{cols=nc>0?nc|0:0;rows=nr>0?nr|0:0;cells=cols*rows;data=new Uint8Array(cells*4);glow=new Float32Array(cells);patch=new Float32Array(cells);gCh=new Uint8Array(cells);edge=new Float32Array(cells);mask=new Float32Array(cells);bSin=new Float32Array(cells);bCos=new Float32Array(cells);wLit=new Uint8Array(cells);cClds=new Array(cols);cMap.clear();zK='';lTk=-1;lDf=-1;lId=-1e12;glw=0;pB=0;stale=1;var fC=M.max(1,cols*.05),fR=M.max(1,rows*.05);for(var r=0;r<rows;r++){var y=r*CH+CH/2,ey=sm((M.min(r,rows-1-r)+.5)/fR),rb=r*cols;for(var c=0;c<cols;c++){var i=rb+c,x=c*CW+CW/2;patch[i]=.3+.7*sm((fN(x/60+31,y/60+17)-.35)/.3);edge[i]=mask[i]=sm((M.min(c,cols-1-c)+.5)/fC)*ey;var ph=fN(x/280+53,y/280+71)*TAU*1.7;bSin[i]=M.sin(ph);bCos[i]=M.cos(ph)}}};",
    "var initW=()=>{hA=new Float32Array(cells);vA=new Float32Array(cells);spSq=new Float32Array(cells);spF=new Float32Array(cells);damp=new Float32Array(cells);srcs=[];mv=0;beh=0;ld=0;wLd=0;prm=0;aC0=cols;aC1=-1;aR0=rows;aR1=-1;var setC=(i,c,r,nz)=>{spF[i]=M.min(1.4,M.max(.3,1+.45*(nz-.5)*3.2));var ed=M.min(c,r,cols-1-c,rows-1-r),br=M.max(0,1-ed/6);damp[i]=1+br*br*12};if(cols>=32&&rows>=16){var gC=M.ceil(cols/2)+1,gR=M.ceil(rows/2)+1,cr=new Float32Array(gC*gR);for(var gr=0;gr<gR;gr++){var rr=M.min(rows-1,gr*2),ny=(rr*CH)/180+seed;for(var gc=0;gc<gC;gc++)cr[gr*gC+gc]=fN((M.min(cols-1,gc*2)*CW)/180+seed,ny)}for(var r=0;r<rows;r++){var gr=r>>1,ty=(r&1)*.5,o0=gr*gC,o1=M.min(gR-1,gr+1)*gC;for(var c=0;c<cols;c++){var gc=c>>1,g1=M.min(gC-1,gc+1),tx=(c&1)*.5,n0=cr[o0+gc]+(cr[o0+g1]-cr[o0+gc])*tx,n1=cr[o1+gc]+(cr[o1+g1]-cr[o1+gc])*tx;setC(r*cols+c,c,r,n0+(n1-n0)*ty)}}}else{for(var r=0;r<rows;r++)for(var c=0;c<cols;c++)setC(r*cols+c,c,r,fN((c*CW)/180+seed,(r*CH)/180+seed))}};",
    "var clrW=()=>{if(hA){hA.fill(0);vA.fill(0);spSq.fill(0);glow.fill(0)}srcs.length=0;mv=beh=glw=pB=ld=wLd=prm=0;aC0=cols;aC1=-1;aR0=rows;aR1=-1};",
    "var bSpd=(col,row,rch,bst,fl)=>{if(!prm){for(var i=0;i<cells;i++){var s=80*spF[i],q=s*s;if(q>spSq[i])spSq[i]=q}prm=1}var mq=rch*rch,rC=M.ceil(rch/CW),rR=M.ceil(rch/CH),r0=M.max(0,row-rR),r1=M.min(rows-1,row+rR),c0=M.max(0,col-rC),c1=M.min(cols-1,col+rC);for(var r=r0;r<=r1;r++){var dy=(r-row)*CH,d2y=dy*dy,rb=r*cols;for(var c=c0;c<=c1;c++){var dx=(c-col)*CW,d2=dx*dx+d2y;if(d2>mq)continue;var cell=rb+c,sp=(80+bst*M.exp(-M.sqrt(d2)/fl))*spF[cell],sq=sp*sp;if(sq>spSq[cell])spSq[cell]=sq}}};",
    "var sGain=(k,l)=>{var n=1+l;return M.tanh(k*n)/(M.tanh(k)*n)};",
    "var dstb=(col,row,o)=>{if(cols<=0||rows<=0)return;var c=cl(col|0,0,cols-1),r=cl(row|0,0,rows-1);if(o&&o.wake)bSpd(c,r,156,1020*(.14+.14*cl(o.speedNorm??.5,0,1)),132);else bSpd(c,r,1104,1020,240);var dur=(o&&o.duration>0)?o.duration:(2+M.floor(M.random()*2))/6,rs=(o&&o.radiusScale>0)?o.radiusScale:.78+M.random()*.92,ba=(o&&o.amplitudeScale>=0)?o.amplitudeScale:.78+M.random()*.72,fq=(o&&o.frequency>0)?o.frequency:6,lw=(o&&o.loadWeight>=0)?o.loadWeight:1,dl=(o&&o.delay>0)?o.delay:0;srcs.push({c,r,t:0,dl,dur,rs,a:ba*sGain(.8,ld),fq,sk:0});ld+=lw;mv=1};",
    "var skm=(col,row,sn)=>{if(cols<=0||rows<=0)return;var c=cl(col|0,0,cols-1),r=cl(row|0,0,rows-1),s=cl(sn??.5,0,1);bSpd(c,r,156,1020*(.14+.14*s),132);var amp=(.048+.088*s)*sGain(.85,wLd),ls=srcs.length?srcs[srcs.length-1]:null;if(ls&&ls.sk&&M.abs(ls.c-c)<=2&&M.abs(ls.r-r)<=2&&ls.t<.036){ls.c=c;ls.r=r;ls.a=M.min(.145,M.max(ls.a,amp));mv=1;return}if(srcs.length>=24){var di=srcs.findIndex(x=>x.sk);if(di>=0)srcs.splice(di,1)}var dur=.105;srcs.push({c,r,t:0,dl:0,dur,rs:.52,a:amp,fq:1.5/dur,sk:1});wLd=M.min(2.4,wLd+.28);mv=1};",
    "var drvW=()=>{var keep=0,kn=.9,sp=.7;for(var s=0;s<srcs.length;s++){var sr=srcs[s];if(sr.dl>0){sr.dl-=WS;srcs[keep++]=sr;continue}var env=M.sin((M.PI*sr.t)/sr.dur),rt=M.cos(TAU*sr.fq*sr.t)*TAU*6,rad=36*sr.rs,i2=1/(2*rad*rad),gn=1.4*sr.a*env*rt*WS,rC=M.ceil(rad*3/CW),rR=M.ceil(rad*3/CH),r0=M.max(0,sr.r-rR),r1=M.min(rows-1,sr.r+rR),c0=M.max(0,sr.c-rC),c1=M.min(cols-1,sr.c+rC);if(r0<aR0)aR0=r0;if(r1>aR1)aR1=r1;if(c0<aC0)aC0=c0;if(c1>aC1)aC1=c1;var rL=r1-r0+1,cL=c1-c0+1;if(rL>rExp.length)rExp=new Float64Array(rL);if(cL>cExp.length)cExp=new Float64Array(cL);for(var r=r0;r<=r1;r++){var dy=(r-sr.r)*CH;rExp[r-r0]=M.exp(-(dy*dy)*i2)}for(var c=c0;c<=c1;c++){var dx=(c-sr.c)*CW;cExp[c-c0]=M.exp(-(dx*dx)*i2)}for(var r=r0;r<=r1;r++){var rg=gn*rExp[r-r0],rb=r*cols;for(var c=c0;c<=c1;c++){var i=rb+c,v=hA[i]+rg*cExp[c-c0],av=v<0?-v:v;if(av>kn)v=(v<0?-1:1)*(kn+sp*M.tanh((av-kn)/sp));hA[i]=v}}sr.t+=WS;if(sr.t<sr.dur)srcs[keep++]=sr}srcs.length=keep};",
    "var lDec=M.exp(-WS/.9),wlDec=M.exp(-WS/.2),iW2=1/(CW*CW),iH2=1/(CH*CH);",
    "var stpW=()=>{var pk=0;if(aC0<=aC1&&aR0<=aR1){var r0=M.max(0,aR0-1),r1=M.min(rows-1,aR1+1),c0=M.max(0,aC0-1),c1=M.min(cols-1,aC1+1),dm=1-.35*WS;for(var r=r0;r<=r1;r++){var rb=r*cols,ha=r>0,hb=r<rows-1;for(var c=c0;c<=c1;c++){var i=rb+c,hr=hA[i],lf=c>0?hA[i-1]:hr,rg=c<cols-1?hA[i+1]:hr,ab=ha?hA[i-cols]:hr,bl=hb?hA[i+cols]:hr;vA[i]+=(spSq[i]*((lf+rg-2*hr)*iW2+(ab+bl-2*hr)*iH2)-damp[i]*vA[i])*WS}}var nc0=cols,nc1=-1,nr0=rows,nr1=-1;for(var r=r0;r<=r1;r++){var rb=r*cols;for(var c=c0;c<=c1;c++){var i=rb+c,vl=vA[i],h=(hA[i]+vl*WS)*dm,a=h<0?-h:h,av=vl<0?-vl:vl;if(a>pk)pk=a;if(a>1e-5||av>5e-5){hA[i]=h;if(c<nc0)nc0=c;if(c>nc1)nc1=c;if(r<nr0)nr0=r;if(r>nr1)nr1=r}else if(h!==0||vl!==0){hA[i]=0;vA[i]=0}}}aC0=nc0;aC1=nc1;aR0=nr0;aR1=nr1}drvW();if(pk===0&&aC0<=aC1){for(var r=aR0;r<=aR1;r++){var rb=r*cols;for(var c=aC0;c<=aC1;c++){var a=M.abs(hA[rb+c]);if(a>pk)pk=a}}}ld*=lDec;wLd*=wlDec;mv=srcs.length>0||pk>REST_H;if(!mv){if(aC0<=aC1&&aR0<=aR1){for(var r=aR0;r<=aR1;r++){var s=r*cols+aC0,e=r*cols+aC1+1;hA.fill(0,s,e);vA.fill(0,s,e)}}else{hA.fill(0);vA.fill(0)}spSq.fill(0);ld=wLd=prm=0;aC0=cols;aC1=-1;aR0=rows;aR1=-1}};",
    "var advW=(s,m)=>{if(!mv){beh=0;return}var d=M.min(s,MAX_A);beh=m>0?M.min(beh+d,MAX_A*2):beh+d;var n=0;while(mv&&beh>=WS&&(!(m>0)||n<m)){stpW();beh-=WS;n++}if(!mv)beh=0};",
    "var appZ=()=>{var k='';for(var z of zones)k+=M.round(z.x)+','+M.round(z.y)+','+M.round(z.w)+','+M.round(z.h)+','+z.alpha+','+z.feather+';';if(k===zK)return;zK=k;for(var r=0;r<rows;r++){var y=r*CH+CH/2;for(var c=0;c<cols;c++){var i=r*cols+c,x=c*CW+CW/2,cm=1;for(var j=0;j<zones.length;j++){var z=zones[j],dx=M.max(z.x-x,0,x-(z.x+z.w)),dy=M.max(z.y-y,0,y-(z.y+z.h)),sg=dx>0||dy>0?M.sqrt(dx*dx+dy*dy):-M.min(x-z.x,z.x+z.w-x,y-z.y,z.y+z.h-y);if(sg>=z.feather)continue;var ins=z.feather*.35,f=z.alpha+(1-z.alpha)*sm((sg+ins)/(z.feather+ins));if(f<cm)cm=f}mask[i]=edge[i]*cm}}stale=1};",
    "var drwGl=(nw,tMs,up)=>{if(!rd||!P||!cv||cv.width<=0||cv.height<=0||cols<=0||rows<=0||gl.isContextLost?.())return;gl.useProgram(P);bAtl(font,dpr);gl.viewport(0,0,cv.width,cv.height);gl.uniform2f(u.size,cv.width,cv.height);gl.uniform2f(u.grid,cols,rows);gl.uniform2f(u.cellPixels,CW*dpr,CH*dpr);",
    "var isC=mode==='conv',cp=isC?(CP[lv]||CP.medium):null,mx=!dk&&(sc===0||sc===2)?.68:0,ik=[],wv=[];for(var i=0;i<3;i++){ik[i]=M.round(ink[i]+(LIC[i]-ink[i])*mx)/255;wv[i]=M.round(wvC[i]+(LWC[i]-wvC[i])*mx*.65)/255}",
    "gl.uniform3f(u.ink,ik[0],ik[1],ik[2]);gl.uniform3f(u.wave,wv[0],wv[1],wv[2]);gl.uniform1f(u.lightMode,dk?0:1);",
    "var rad=cp?cp[7]:230,auOn=as.a&&as.f>.005&&!still&&amb>.001,auS=auOn?amb*(cp?cp[3]:1)*as.f:0;",
    "gl.uniform4f(u.aura,(auOn?as.x:0)*dpr,(auOn?as.y:0)*dpr,rad*dpr,auS*amb);",
    "var bs=pB,prS=amb*amb*(sc===5?.45:1)*(cp?cp[8]:1);if(bs>0)prS=M.min(1.35,M.max(prS,.96)+.34*bs);",
    "gl.uniform4f(u.optics,.48*(sc===5?.55:1),.68*(sc===5?.45:1),.74,prS);",
    "gl.uniform1f(u.auraLift,.78*amb*(cp?cp[2]:1));var ap=tMs*(cp?.00045+.00015*cp[3]:.0006);ap-=M.floor(ap);gl.uniform1f(u.auraPhase,ap);",
    "gl.uniform3f(u.uSpec0,sp0[0],sp0[1],sp0[2]);gl.uniform3f(u.uSpec1,sp1[0],sp1[1],sp1[2]);gl.uniform3f(u.uSpec2,sp2[0],sp2[1],sp2[2]);gl.uniform3f(u.uSpec3,sp3[0],sp3[1],sp3[2]);",
    "var sec=still?0:tMs/1e3,om=(TAU/10.5)*sec;gl.uniform4f(u.uIdleParams,sec*8,M.sin(om),M.cos(om),1);",
    "var nbOn=amb>.001,nL=cp?cp[1]:1,nt=still?2.4:sec,nwP=M.max(1,cols*CW),nhP=M.max(1,rows*CH),diag=M.sqrt(nwP*nwP+nhP*nhP);",
    "var nb=[0,0,0];for(var i=0;i<3;i++){if(!nbOn){gl.uniform4f(u['neb'+i],0,0,1,0);continue}var rS=.5+.5*M.sin((TAU*nt)/[8.4,10.8,12.8][i]+NP[i]),ev=rS*rS*(3-2*rS),st=still?.28:.04+.96*M.pow(ev,1.3),dr=i===1?-1:1,ag=NA[i]+.52*M.sin(nt*(.13+i*.023)+i*1.7)+dr*nt*(.045+i*.006),rR=.34+.045*M.cos(nt*(.11+i*.019)+i*1.1),hx=NH[i]+.14*M.sin(nt*.09+i*2.1);nb[i]=hx-M.floor(hx);gl.uniform4f(u['neb'+i],(.5+rR*1.06*M.cos(ag))*nwP*dpr,(.5+rR*.92*M.sin(ag))*nhP*dpr,diag*(.29+.06*st)*dpr,st*amb)}",
    "gl.uniform4f(u.nebOpt,nb[0],nb[1],nb[2],.58*amb*(sc===5?.45:1)*(.35+.65*nL));gl.uniform1f(u.nebulaLift,1.08*amb*nL);",
    "gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,cT);if(up)gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,cols,rows,gl.RGBA,gl.UNSIGNED_BYTE,data);",
    "gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArrays(gl.TRIANGLES,0,3)};",
    "var drawF=(nw,tMs)=>{if(cols<=0||rows<=0||rel)return;appZ();var rDt=lDrw>0?M.max(0,(nw-lDrw)/1e3):0,sec=still?0:tMs/1e3,tk=still?0:M.floor(sec*2),cp=mode==='conv'?(CP[lv]||CP.medium):null,aSc=cp?(amb<=.001?0:cp[0]):1;",
    "var nId=stale||tk!==lTk||dk!==lDk||aSc!==lAS||M.abs(nw-lId)>=500;",
    "if(!nId&&!mv&&!glw&&pB<=0){drwGl(nw,tMs,0);lDrw=nw;return}",
    "if(tk!==lTk)for(var r=0;r<rows;r++)for(var c=0;c<cols;c++)gCh[r*cols+c]=gIdx(c,r,tk);",
    "var nCld=mv||glw||pB>0,dft=nCld?M.floor((sec*8)/CW):0;",
    "if(nId){if(nCld)for(var k of cMap.keys())if(k<dft)cMap.delete(k);lId=nw;lDk=dk;lAS=aSc}",
    "var dec=still?0:(rDt>0?M.exp(-rDt/1.2):(mv?1:.88)),idA=dk?.13:.172,thS=(dk?1:.72)*aSc,cap=.7,pTh=M.min(.95,M.max(0,.2*(1-.38*pB))),crS=.78+.34*pB,bSc=3/TAU,iC=1/cap,i2W=1/(2*CW),i2H=1/(2*CH),iPS=1/M.max(1e-4,1-pTh),iTS=idA*thS;",
    "var om=(TAU/10.5)*sec,bs=M.sin(om),bc=M.cos(om),br=0,qA=(a,t)=>(a<t?0:a>=1?255:(a*255+.5)|0);",
    "if(nCld&&dft!==lDf){cClds.fill(null);lDf=dft}",
    "for(var r=0;r<rows;r++){var rb=r*cols,hAb=r>0,hBl=r<rows-1;for(var c=0;c<cols;c++){var i=rb+c,hr=hA[i],pG=glow[i];if(hr===0&&pG===0){if(!nId&&wLit[i]===0)continue;wLit[i]=0;var at=i<<2;data[at]=gCh[i];data[at+1]=qA(iTS*mask[i],.001);data[at+2]=0;data[at+3]=0;continue}",
    "var bth=1-.12*(1+bs*bCos[i]+bc*bSin[i]),str=M.tanh(3.5*(hr<0?-hr:hr)),dcd=pG*dec,shw=dcd>str?dcd:str,lt=shw<.01?0:shw;glow[i]=lt;wLit[i]=lt>0?1:0;",
    "var al=lt===0?idA:idA*(cClds[c]||(cClds[c]=cCol(c+dft)))[r]*bth,pkd=0,wMx=str;",
    "if(lt>0){if(lt>br)br=lt;al+=cap*M.tanh((patch[i]*(lt*.3+str*.85))*iC);var sB=str*1.15,lB=lt*.42,mR=sB>lB?sB:lB;wMx=mR>1?1:mR;var lf=c>0?hA[i-1]:hr,rg=c<cols-1?hA[i+1]:hr,ab=hAb?hA[i-cols]:hr,bl=hBl?hA[i+cols]:hr,gx=(rg-lf)*i2W,gy=(bl-ab)*i2H,slG=M.sqrt(gx*gx+gy*gy)*60,cg=str*crS,g=slG>cg?slG:cg;if(g>pTh){var lv2=M.round(sm((g-pTh)*iPS)*7);if(lv2>0){var hu=M.atan2(gy,gx+1e-6)*bSc+M.tanh(hr*2.4)*.3;hu-=M.floor(hu);pkd=(lv2<<5)|(M.floor(hu*32)&31)}}}al*=mask[i]*thS;var at=i<<2;data[at]=gCh[i];data[at+1]=qA(al,lt===0?.001:.01);data[at+2]=lt>0?M.max(1,(wMx*255+.5)|0):0;data[at+3]=pkd}}",
    "drwGl(nw,tMs,1);if(pB>0){pB=still?0:pB*M.exp(-M.max(.016,rDt)/.38);if(pB<.015)pB=0}glw=br>0;if(!glw&&!mv){glow.fill(0);pB=0}lTk=tk;lDrw=nw;stale=0};",
    "function stepFr(tIn){raf=0;if(dd||paused||rel)return;var nw=tIn>0?tIn:now(),vsDt=lTs>0&&nw>lTs?nw-lTs:nw-lDrw;lTs=nw;",
    "var inT=mode==='home'&&!still&&tideAt>0&&nw-tideAt<480;if(tideAt>0&&!inT){tideAt=0;stale=1}",
    "var gap=(mode==='home'||lv==='full')&&(mv||(as.a&&as.lsa>0&&nw-as.lsa<650)||inT)?mg:M.max(33,mg);",
    "if(!still&&drawn&&!stale&&gap>0&&lDrw>0&&nw-lDrw<gap){var rem=gap-(nw-lDrw);if(rem>M.max(8,vsDt+2)){tm=setTimeout(function(){tm=0;wakeW()},M.max(4,M.ceil(rem)))}else sched();return}",
    "var dt=still?0:wSlp?M.min(16,M.max(0,nw-prev)):cl(nw-prev,0,50);aTm=aTm===null?nw:aTm+dt;wSlp=0;prev=nw;advW(still?0:cl(dt/1e3,0,.05),12);",
    "if(amb<=.001&&as.a)as.a=0;var aSet=0;",
    "if(!still&&amb>.001&&as.a&&as.lsa>0){var age=M.max(0,nw-as.lsa);if(age>=1200){as.a=0;as.f=0;aSet=1}else{var u2=age<=750?1:(1200-age)/450;as.f=u2*u2*(3-2*u2)*(as.wk&&nw-as.wk<180?cl((nw-as.wk)/180,.12,1):1)}}",
    "var aRec=!still&&amb>.001&&as.a&&as.lsa>0&&nw-as.lsa<1200,inI=mode==='home'&&!still&&amb>.001&&nw-mAt<1600,busy=!still&&(mv||glw||pB>0);",
    "var need=stale||!drawn||aSet||inT||inI||aRec||busy||M.floor(((still?0:aTm)/1e3)*2)!==lTk;",
    "if(rd&&!rel&&pw>0&&ph>0&&need){drawF(nw,still?0:aTm);drawn=1}",
    "if(dd||paused||still||rel||pw<=0||ph<=0||!(inT||busy||inI||aRec))goSlp();else sched()}",
    "self.onmessage=ev=>{var m=ev?.data;if(!m||dd)return;var tp=m.type;if(m.g>gen)gen=m.g;",
    "if(tp==='init'){try{cv=m.canvas;cv?.addEventListener?.('webglcontextlost',e=>{e?.preventDefault?.();rd=0;stopL();pm({type:'contextlost'})});gl=cv?.getContext?.('webgl2',{alpha:true,premultipliedAlpha:true,antialias:false,preserveDrawingBuffer:false})||null;if(!gl||gl.isContextLost?.())throw new Error('webgl2-unavailable');glyphs=m.glyphs||'';dpr=m.dpr||1;pw=M.max(0,m.pw|0);ph=M.max(0,m.ph|0);mode=m.mode||'home';lv=m.convLevel||'off';mg=m.minGapMs||0;bld(m.vs,m.fs);initG(m.cols,m.rows);initW();aC2();aT=mT(1,gl.LINEAR);gl.uniform1i(u.cells,0);gl.uniform1i(u.atlas,1);gl.uniform4f(u.uIdleMetrics,CW,CH,.01,1/280);if(pw>0&&ph>0){cv.width=pw;cv.height=ph}mAt=prev=aTm=now();wSlp=1;rd=1;pm({type:'ready'})}catch(er){frG();rd=0;pm({type:'error',reason:String(er?.message||er||'init-err')})}return}",
    "if(tp==='resize'){if(!cv)return;dpr=m.dpr||dpr||1;pw=M.max(0,m.pw|0);ph=M.max(0,m.ph|0);if(cv.width!==pw||cv.height!==ph){cv.width=pw;cv.height=ph}var nc=M.max(0,m.cols|0),nr=M.max(0,m.rows|0);if(nc!==cols||nr!==rows){initG(nc,nr);initW();if(rd)aC2()}else stale=1;var wasR=rel;rel=0;drawn=0;if(rd&&pw>0&&ph>0&&(!paused||wasR)){var nw=now(),os=still;if(paused)still=1;wSlp=1;prev=nw;drawF(nw,still?0:aTm??nw);drawn=1;still=os}return}",
    "if(tp==='disturb'){if(!paused&&!still&&!rel){if(slp){wSlp=1;prev=now()}dstb(m.col,m.row,m.opts);stale=1;wakeW()}return}",
    "if(tp==='skimmer'){if(!paused&&!still&&!rel){if(slp){wSlp=1;prev=now()}skm(m.col,m.row,m.speedNorm);stale=1;wakeW()}return}",
    "if(tp==='pointer'){if(paused||still||rel)return;var nr=now(),c=mode==='conv',cp=c?(CP[lv]||CP.medium):null,x=m.x,y=m.y;if(lx!==null&&ly!==null){var dx=x-lx,dy=y-ly,dist=M.hypot(dx,dy),dt=m.t>0&&lPt>0&&m.t>lPt?(m.t-lPt)/1e3:(nr-as.lsa)/1e3,spd=dist/M.max(.004,dt),ms=cp?cp[5]:220,cs=cp?cp[6]:42;if(spd>=ms){carry+=dist;if(carry>=cs){carry=M.min(20,carry-cs);skm(M.floor(x/CW),M.floor(y/CH),cl((spd-ms)/1800,.05,1)*(cp?cp[3]:1))}}else carry*=.85}lx=x;ly=y;lPt=m.t||nr;as.lsa=nr;if(amb>.001){if(!as.a||slp)as.wk=nr;as.x=x;as.y=y;as.a=1;if(slp){wSlp=1;prev=nr}wakeW()}else if(mv){if(slp){wSlp=1;prev=nr}stale=1;wakeW()}return}",
    "if(tp==='pointerLeave'){lx=ly=null;carry=0;lPt=0;if(as.a){as.a=0;stale=1;wakeW()}return}",
    "if(tp==='calmZones'){zones=Array.isArray(m.zones)?m.zones:[];stale=1;if(!paused&&!rel&&pw>0&&ph>0)wakeW();return}",
    "if(tp==='liftoff'){if(!paused&&!still&&!rel&&cols>0&&rows>0){if(slp){wSlp=1;prev=now()}var nx=cl(m.nx??.5,0,1),ny=cl(m.ny??.62,0,1),c=cl(M.round(nx*(cols-1)),0,cols-1),r=cl(M.round(ny*(rows-1)),0,rows-1);dstb(c,r,{amplitudeScale:1.55,radiusScale:1.45,duration:.42,frequency:6.4,loadWeight:.22});dstb(c,M.max(0,r-1),{amplitudeScale:1.28,radiusScale:2.35,duration:.56,frequency:4.5,delay:.035,loadWeight:.22});pB=1;stale=1;wakeW()}return}",
    "if(tp==='tide'){if(!paused&&!still&&!rel&&cols>0&&rows>0){var nr=now();if(slp){wSlp=1;prev=nr}tideAt=nr;var br=M.max(0,rows-1-M.min(2,M.floor(rows*.06)));for(var p of [[.5,0,.78,1.32,.62,3.2],[.22,.07,.66,1.18,.6,3.1],[.78,.14,.66,1.18,.6,3.1]])dstb(cl(M.round(p[0]*(cols-1)),0,cols-1),br,{amplitudeScale:p[2],radiusScale:p[3],duration:p[4],frequency:p[5],delay:p[1],loadWeight:.16});stale=1;wakeW()}return}",
    "if(tp==='state'){if((m.mode==='home'&&mode!=='home')||m.intro)mAt=now();mode=m.mode||mode;lv=m.convLevel??lv;dk=m.dark?1:0;ink=m.ink||ink;wvC=m.wave||wvC;font=m.font||font;amb=m.amb??amb;sc=m.sc??sc;mg=m.mg??mg;still=m.still?1:0;if(m.sp){sp0=m.sp[0];sp1=m.sp[1];sp2=m.sp[2];sp3=m.sp[3]}if(m.paused){paused=1;stopL();var had=as.a||mv||glw||pB>0;if(m.clearAura){as.a=0;lx=ly=null;carry=0;lPt=0;clrW()}if((!drawn||stale||(m.clearAura&&had))&&!rel&&rd&&pw>0&&ph>0){var os=still;still=1;stale=1;drawF(now(),0);drawn=1;still=os}goSlp()}else{paused=0;if(pw>0&&ph>0)rel=0;stale=1;wakeW()}return}",
    "if(tp==='sleep'){paused=1;stopL();var had=as.a||mv||glw||pB>0;if(m.clearAura){as.a=0;lx=ly=null;carry=0;lPt=0;clrW()}if((!drawn||stale||(m.clearAura&&had))&&!rel&&rd&&pw>0&&ph>0){var os=still;still=1;stale=1;drawF(now(),0);drawn=1;still=os}goSlp();return}",
    "if(tp==='resume'){paused=0;if(pw>0&&ph>0)rel=0;return}",
    "if(tp==='release'){paused=1;rel=1;pw=ph=0;drawn=0;stopL();if(cv)cv.width=cv.height=0;goSlp();return}",
    "if(tp==='dispose'){dd=1;paused=1;stopL();frG();if(gl)try{gl.getExtension('WEBGL_lose_context')?.loseContext()}catch{}gl=cv=aC=aX=null;try{self.close?.()}catch{}}};",
  ].join('');

  function mountSimField(cv, cols, rows, o = {}) {
    if (!cv || typeof cv.transferControlToOffscreen !== 'function' || cols <= 0 || rows <= 0 || o.prefer2D || o.force2D || G?.__agRippleForce2D === true) return null;
    const core = o.rippleCore || G?.__agCsRippleCore || null;
    const ws = core?.WORKER_SHADERS;
    const vs = ws?.fieldVs || core?.VERTEX_SHADER;
    const fs = ws?.fieldFs || core?.FRAGMENT_SHADER;
    if (!vs || !fs || !core?.RIPPLE || typeof o.mkChan !== 'function' || typeof o.checkProbe !== 'function' || !o.checkProbe(o)) return null;

    const R = core.RIPPLE;
    let cN = cols | 0, rN = rows | 0;
    let dpr = M.max(0.5, M.min(2, Number(o.dpr) || 1));
    let pw = M.round(cN * R.cellWidth * dpr), ph = M.round(rN * R.cellHeight * dpr);
    let slept = false, dirty = true, pFlag = false, introPend = false, gen = 0, lastPtrAt = -1e9, lastAmb = 1, lastZonesKey = '', lastStateKey = '';
    const queue = [];
    const SINGLETON_MSG = new Set(['resize', 'state', 'calmZones', 'pointer', 'pointerLeave', 'sleep', 'resume', 'release']);
    const ext = { mode: 'worker-webgl2', selfDriven: true, gpuIdleMod: true };
    const bump = () => ++gen;

    const send = (msg) => {
      const s = ch.state();
      if (s.disposed || s.failed) return false;
      if (!s.ready) {
        if (SINGLETON_MSG.has(msg?.type)) {
          for (let i = queue.length - 1; i >= 0; i -= 1) {
            if (queue[i]?.type === msg.type) queue.splice(i, 1);
          }
          queue.push(msg);
          return true;
        }
        if (queue.length < 32) queue.push(msg);
        return true;
      }
      return ch.post(msg);
    };
    const wakeSend = (g) => { if (pFlag) { pFlag = false; send({ type: 'resume', g }); } };

    const ch = o.mkChan(ext, o, {
      onSlept: (msg) => { if (msg && typeof msg.gen === 'number' && msg.gen !== gen) return; slept = true; try { o.onSlept?.(); } catch {} },
      onReady: () => {
        while (queue.length) {
          const msg = queue.shift();
          ch.post(msg);
        }
      },
    }, WORKER_SIM_SRC);

    if (!ch) return null;

    const wavesProxy = {
      active: () => !slept,
      advance() {},
      disturb(col, row, opts) {
        if (pw <= 0 || ph <= 0 || cN <= 0 || rN <= 0 || !Number.isFinite(col) || !Number.isFinite(row)) return;
        const g = bump(); slept = false; wakeSend(g);
        send({ type: 'disturb', col: col | 0, row: row | 0, opts: opts && typeof opts === 'object' ? { ...opts } : null, g });
      },
      skimmer(col, row, speedNorm = 0.5) {
        if (pw <= 0 || ph <= 0 || cN <= 0 || rN <= 0 || !Number.isFinite(col) || !Number.isFinite(row)) return;
        const g = bump(); slept = false; wakeSend(g);
        send({ type: 'skimmer', col: col | 0, row: row | 0, speedNorm, g });
      },
    };

    Object.assign(ext, {
      waves: wavesProxy,
      isContextLost: () => { const s = ch.state(); return s.contextLost || s.failed; },
      getBufferSize: () => ({ width: pw, height: ph, dpr }),
      invalidate(reIntro) { dirty = true; if (reIntro) introPend = true; },
      needsDraw: () => false,
      busy: () => !slept,
      isSettled: () => slept,
      releaseBackingStore() {
        const g = bump();
        pw = ph = 0; slept = true; dirty = true; pFlag = true; lastStateKey = ''; queue.length = 0;
        send({ type: 'release', g });
      },
      resize(nc, nr, _wOrD, ndArg) {
        const s = ch.state();
        if (s.disposed || s.failed || nc <= 0 || nr <= 0) return false;
        const nd = typeof _wOrD === 'number' ? _wOrD : ndArg;
        cN = nc | 0; rN = nr | 0;
        if (typeof nd === 'number' && nd > 0) dpr = M.max(0.5, M.min(2, nd));
        pw = M.round(cN * R.cellWidth * dpr); ph = M.round(rN * R.cellHeight * dpr);
        dirty = true; lastStateKey = '';
        send({ type: 'resize', cols: cN, rows: rN, pw, ph, dpr });
        return true;
      },
      setCalmZones(zones) {
        const list = Array.isArray(zones)
          ? zones.filter((z) => z && Number.isFinite(+z.x) && Number.isFinite(+z.y) && +z.w > 0 && +z.h > 0)
              .map((z) => ({ x: +z.x, y: +z.y, w: +z.w, h: +z.h, alpha: clamp01(z.alpha, R.calmAlpha ?? 0.45), feather: M.max(1, Number(z.feather ?? R.calmFeather ?? 36)) }))
          : [];
        const key = list.map((z) => `${M.round(z.x)},${M.round(z.y)},${M.round(z.w)},${M.round(z.h)},${z.alpha},${z.feather}`).join(';');
        if (key === lastZonesKey) return;
        lastZonesKey = key;
        send({ type: 'calmZones', zones: list });
      },
      triggerLiftoffBurst(nx = 0.5, ny = 0.62) {
        if (pw <= 0 || ph <= 0) return false;
        const g = bump(); slept = false; wakeSend(g);
        send({ type: 'liftoff', nx: clamp01(nx, 0.5), ny: clamp01(ny, 0.62), g });
        return true;
      },
      triggerTideSwell() {
        if (pw <= 0 || ph <= 0) return false;
        const g = bump(); slept = false; wakeSend(g);
        send({ type: 'tide', g });
        return true;
      },
      onPtr(x, y, active, nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now()) {
        if (!active) { send({ type: 'pointerLeave' }); return false; }
        if (pw <= 0 || ph <= 0 || (lastAmb <= 0.001 && slept)) return false;
        const gap = o.getMinGap ? Number(o.getMinGap() || 0) : 0, lim = gap > 0 ? M.max(4, gap * 0.85) : 4;
        if (nowMs - lastPtrAt < lim) return false;
        lastPtrAt = nowMs;
        let g = gen;
        if (lastAmb > 0.001) { g = bump(); slept = false; wakeSend(g); }
        send({ type: 'pointer', x, y, t: nowMs, g });
        return true;
      },
      setPaused(paused, clearAura = false) {
        if (paused) {
          const g = bump();
          pFlag = true; slept = true;
          lastStateKey = '';
          send({ type: 'sleep', clearAura: Boolean(clearAura), g });
        } else if (pFlag && pw > 0 && ph > 0) wakeSend(bump());
      },
      draw(_aT, pal = {}, still = false) {
        const amb = lastAmb = clamp01(pal.ambientIntensity, 1);
        if (pw <= 0 || ph <= 0) { dirty = true; return; }
        pFlag = false;
        const dark = pal.dark !== false ? 1 : 0;
        const ink = pal.ink || [146, 148, 156];
        const wave = pal.wave || [214, 218, 228];
        const font = pal.fontFamily || 'monospace';
        const rawSpec = pal.spectrum ?? pal.accentTone ?? pal.accent;
        const sc = rawSpec != null && core.resolveHorizonSpectrumCode ? core.resolveHorizonSpectrumCode(rawSpec) : (core.detectHostSpectrumCode ? core.detectHostSpectrumCode(cv, Boolean(dark)) : 0);
        const stops = core.getGlyphSpectrumStops ? core.getGlyphSpectrumStops(Boolean(dark), sc) : null;
        const sp = stops ? [n255(stops[0]), n255(stops[1]), n255(stops[2]), n255(stops[3])] : null;
        const mode = cv.parentNode?.getAttribute?.('data-ripple-mode') || (pal.conv ? 'conv' : 'home');
        const convLevel = cv.parentNode?.getAttribute?.('data-conv-level') || 'medium';
        const mg = o.getMinGap ? Number(o.getMinGap() || 0) : 0;
        const st = still ? 1 : 0;
        const intro = introPend; introPend = false;
        const key = `${mode}|${convLevel}|${dark}|${ink.join(',')}|${wave.join(',')}|${font}|${amb.toFixed(3)}|${sc}|${mg}|${st}`;
        if (!dirty && !intro && key === lastStateKey) return;
        const force = dirty;
        dirty = false;
        lastStateKey = key;
        const g = !st ? bump() : gen;
        if (!st) slept = false;
        send({ type: 'state', mode, convLevel, dark, ink, wave, font, amb, sc, sp, mg, still: st, paused: false, force, intro, g });
      },
      dispose() { queue.length = 0; ch.dispose(); },
    });

    const hp = cv.parentNode, mode0 = hp?.getAttribute?.('data-ripple-mode') || 'home', lv0 = hp?.getAttribute?.('data-conv-level') || 'off', mg0 = o.getMinGap ? Number(o.getMinGap() || 0) : 0;
    const ok = ch.start(cv, { type: 'init', mode: mode0, convLevel: lv0, minGapMs: mg0, vs, fs, cols: cN, rows: rN, pw, ph, dpr, glyphs: core.GLYPHS });
    if (!ok) return null;
    return ext;
  }

  return { WORKER_SIM_SRC, mountSimField };
});
