function qgExpr(n){
  let t=n[0];
  switch(t){
    case'lit':return JSON.stringify(n[1]);
    case'var':return n[1];
    case'array':return'['+n[1].map(qgExpr).join(',')+']';
    case'un':return'('+n[1]+qgExpr(n[2])+')';
    case'bin':return'('+qgExpr(n[2])+n[1]+qgExpr(n[3])+')';
    case'call':return qgExpr(n[1])+'('+n[2].map(qgExpr).join(',')+')';
    case'index':return qgExpr(n[1])+'['+qgExpr(n[2])+']';
    case'prop':return qgExpr(n[1])+'.'+n[2];
    case'lambda':return'fn('+n[1].join(',')+'){'+n[2].map(qgStmt).join('')+'}'
  }
  throw Error('Unknown expression '+t)
}
function qgStmt(n){
  let t=n[0];
  switch(t){
    case'let':return'let '+n[1]+'='+qgExpr(n[2])+';';
    case'assign':return qgExpr(n[1])+'='+qgExpr(n[2])+';';
    case'expr':return qgExpr(n[1])+';';
    case'if':return'if('+qgExpr(n[1])+'){'+n[2].map(qgStmt).join('')+'}'+(n[3].length?'else{'+n[3].map(qgStmt).join('')+'}':'');
    case'for':return'for('+qgStmt(n[1]).slice(0,-1)+';'+qgExpr(n[2])+';'+qgStmt(n[3]).slice(0,-1)+'){'+n[4].map(qgStmt).join('')+'}';
    case'while':return'while('+qgExpr(n[1])+'){'+n[2].map(qgStmt).join('')+'}';
    case'return':return'return '+qgExpr(n[1])+';';
    case'fn':return'fn '+n[1]+'('+n[2].join(',')+'){'+n[3].map(qgStmt).join('')+'}';
    case'palette':return'palette '+n[1]+'=['+n[2].map(qgExpr).join(',')+'];';
    case'sprite':return'sprite '+n[1]+'('+n[2]+'){'+'\n'+n[3].join('\n')+'\n}';
    case'touch':case'frame':return t+'('+qgExpr(n[1])+');'
  }
  throw Error('Unknown statement '+t)
}
// JS emitted from decoded AST. Names are validated by the parser and the string literals are JSON escaped.
function jsExpr(n){
  let t=n[0];
  switch(t){
    case'lit':return JSON.stringify(n[1]);
    case'var':return n[1];
    case'array':return'['+n[1].map(jsExpr).join(',')+']';
    case'un':return'('+n[1]+jsExpr(n[2])+')';
    case'bin':return'('+jsExpr(n[2])+n[1]+jsExpr(n[3])+')';
    case'call':{
      if(n[1][0]==='prop'&&n[1][2]==='push')return jsExpr(n[1][1])+'.push('+n[2].map(jsExpr).join(',')+')';
      return jsExpr(n[1])+'('+n[2].map(jsExpr).join(',')+')'
    }
    case'index':return jsExpr(n[1])+'['+jsExpr(n[2])+']';
    case'prop':return jsExpr(n[1])+'.'+n[2];
    case'lambda':return'function('+n[1].join(',')+'){'+n[2].map(jsStmt).join('\n')+'}'
  }
  throw Error('Bad JS expression '+t)
}
function jsStmt(n){
  let t=n[0];
  switch(t){
    case'let':return'let '+n[1]+'='+jsExpr(n[2])+';';
    case'assign':return jsExpr(n[1])+'='+jsExpr(n[2])+';';
    case'expr':return jsExpr(n[1])+';';
    case'if':return'if('+jsExpr(n[1])+'){'+n[2].map(jsStmt).join('\n')+'}'+(n[3].length?'else{'+n[3].map(jsStmt).join('\n')+'}':'');
    case'for':return'for('+jsStmt(n[1]).slice(0,-1)+';'+jsExpr(n[2])+';'+jsStmt(n[3]).slice(0,-1)+'){'+n[4].map(jsStmt).join('\n')+'}';
    case'while':return'while('+jsExpr(n[1])+'){'+n[2].map(jsStmt).join('\n')+'}';
    case'return':return'return '+jsExpr(n[1])+';';
    case'fn':return'function '+n[1]+'('+n[2].join(',')+'){'+n[3].map(jsStmt).join('\n')+'}';
    case'palette':return'const '+n[1]+'=['+n[2].map(jsExpr).join(',')+'];';
    case'sprite':return'const '+n[1]+'={palette:'+n[2]+',pixels:'+JSON.stringify(n[3])+'};';
    case'touch':case'frame':return t+'('+jsExpr(n[1])+');'
  }
  throw Error('Bad JS statement '+t)
}
function htmlFromAST(ast){
  let code=ast.map(jsStmt).join('\n');
  return`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;width:100%;height:100%;background:#111;display:grid;place-items:center;overflow:hidden}canvas{max-width:100vw;max-height:100vh;object-fit:contain;image-rendering:pixelated;touch-action:none}</style></head><body><canvas id="c"></canvas><script>
'use strict';
const c=document.getElementById('c'),ctx=c.getContext('2d');
const defaultColors=['#000','#fff','#f44','#4f4','#48f','#ff4','#f4f','#4ff'];
function canvas(w,h){c.width=w;c.height=h}
function color(n){return typeof n==='string'?n:defaultColors[((n%8)+8)%8]}
function clear(){ctx.clearRect(0,0,c.width,c.height)}
function rect(x,y,w,h,col){ctx.fillStyle=color(col);ctx.fillRect(x,y,w,h)}
function text(s,x,y,col){ctx.fillStyle=color(col);ctx.font='14px monospace';ctx.fillText(String(s),x,y)}
function blit(s,x,y,scale=1,palette=null){if(!s||!s.pixels)return;let rows=s.pixels,colors=palette||s.palette;for(let j=0;j<rows.length;j++)for(let i=0;i<rows[j].length;i++){let p=+rows[j][i];if(p){ctx.fillStyle=colors[p]||'#fff';ctx.fillRect(x+i*scale,y+j*scale,scale,scale)}}}
function len(a){return a.length}function push(a,v){return a.push(v)}function pop(a){return a.pop()}
function rand(n){return Math.floor(Math.random()*n)}function floor(x){return Math.floor(x)}function abs(x){return Math.abs(x)}function min(...x){return Math.min(...x)}function max(...x){return Math.max(...x)}function sin(x){return Math.sin(x)}function cos(x){return Math.cos(x)}function sqrt(x){return Math.sqrt(x)}
function touch(fn){c.addEventListener('pointerdown',e=>{let r=c.getBoundingClientRect();fn((e.clientX-r.left)*c.width/r.width,(e.clientY-r.top)*c.height/r.height)})}
function frame(fn){let last=performance.now();function step(now){let dt=Math.min(.1,(now-last)/1000);last=now;fn(dt);requestAnimationFrame(step)}requestAnimationFrame(step)}
${code}
<\/script></body></html>`
}
