// QG binary codec v2. Keep this codec unchanged once URLs are published.
// This file is also embedded in index.html so the editor works offline.
const Q2_BUILTINS=['canvas','clear','rect','blit','text','len','push','pop','rand','floor','abs','min','max','sin','cos','sqrt'];
const Q2_PROPS=['push','pop','length'];
// Prefix-free, short codes for the most common AST operations.
const Q2_CODES={
  assign:'000',bin:'001',var:'010',lit:'011',if:'1000',let:'1001',call:'1010',index:'10110',for:'10111',expr:'11000',fn:'11001',return:'11010',array:'11011',prop:'111000',lambda:'111001',sprite:'111010',palette:'111011',touch:'111100',frame:'111101',while:'111110',un:'1111110'
};
const Q2_OPS=['+','==','*','<','-','/','%','&&','||','>','<=','>=','!='];
const Q2_UN=['-','!'];
const Q2_ID={
  global:0,local:1,fn:2,builtin:3,palette:4,sprite:5
};
const Q2_REVERSE=Object.fromEntries(Object.entries(Q2_CODES).map(([k,v])=>[v,k]));
function q2Tag(w,t){
  if(!Q2_CODES[t])throw Error('Unsupported v2 node: '+t);
  w.s+=Q2_CODES[t]
}
function q2ReadTag(r){
  let p='';
  for(let i=0;i<9;i++){
    p+=r.bit();
    if(Q2_REVERSE[p])return Q2_REVERSE[p]
  }
  throw Error('Invalid QG v2 opcode')
}
function q2Small(w,n){
  if(Number.isInteger(n)&&n>=0&&n<=4){
    w.bit(0);
    w.uint(n,3)
  }else if(Number.isInteger(n)&&n>=-16&&n<=15){
    w.s+='10';
    w.uint(n+16,5)
  }else if(Number.isSafeInteger(n)&&Math.abs(n)<2**50){
    w.s+='110';
    w.v(n>=0?n*2:-n*2-1)
  }else{
    w.s+='111';
    let dv=new DataView(new ArrayBuffer(8));
    dv.setFloat64(0,n);
    for(let i=0;i<8;i++)w.uint(dv.getUint8(i),8)
  }
}
function q2ReadSmall(r){
  if(!r.bit()){
    let n=r.uint(3);
    if(n>4)throw Error('Invalid small literal');
    return n
  }
  if(!r.bit())return r.uint(5)-16;
  if(!r.bit()){
    let z=r.v();
    return z%2===0?z/2:-(z+1)/2
  }
  let d=new DataView(new ArrayBuffer(8));
  for(let i=0;i<8;i++)d.setUint8(i,r.uint(8));
  return d.getFloat64(0)
}
function q2RGB(s){
  if(s===null)return 0;
  if(typeof s!=='string'||!/^#[0-9a-fA-F]{6}$/.test(s))throw Error('Palette colors must be null or #RRGGBB');
  let r=parseInt(s.slice(1,3),16)>>3,g=parseInt(s.slice(3,5),16)>>3,b=parseInt(s.slice(5,7),16)>>3;
  return(r<<10)|(g<<5)|b
}
function q2Hex(n){
  let f=v=>(v<<3|v>>2).toString(16).padStart(2,'0');
  return'#'+f((n>>10)&31)+f((n>>5)&31)+f(n&31)
}
function q2Pack5(rows){
  let digits=rows.join(''),n=0n;
  for(let ch of digits)n=n*5n+BigInt(ch);
  let bits=Math.ceil(digits.length*Math.log2(5));
  return n.toString(2).padStart(bits,'0')
}
function q2Unpack5(bits,count,width){
  let n=BigInt('0b'+(bits||'0')),s='';
  for(let i=0;i<count;i++){
    s=String(n%5n)+s;
    n/=5n
  }
  if(n!==0n)throw Error('Invalid base-5 sprite');
  let rows=[];
  for(let i=0;i<count;i+=width)rows.push(s.slice(i,i+width));
  return rows
}
function q2Sprites(w,rows){
  let digits=rows.join(''),packed=q2Pack5(rows),runs=[];
  for(let i=0;i<digits.length;){
    let j=i+1;
    while(j<digits.length&&digits[j]===digits[i])j++;
    runs.push([Number(digits[i]),j-i]);
    i=j
  }
  let rw=new BW();
  rw.v(runs.length);
  for(let[p,len]of runs){
    rw.uint(p,3);
    rw.v(len)
  }
  let rle=rw.s.length<packed.length;
  w.bit(rle?1:0);
  if(rle)w.s+=rw.s;
  else w.s+=packed
}
function q2ReadSprites(r,h,width){
  let count=h*width;
  if(count>1000000||!count)throw Error('Invalid sprite dimensions');
  if(r.bit()){
    let runs=r.v(),s='';
    if(runs>count)throw Error('Invalid sprite runs');
    for(let i=0;i<runs;i++){
      let p=r.uint(3),len=r.v();
      if(p>4||len<1||s.length+len>count)throw Error('Invalid sprite RLE');
      s+=String(p).repeat(len)
    }
    if(s.length!==count)throw Error('Sprite RLE length mismatch');
    let rows=[];
    for(let i=0;i<count;i+=width)rows.push(s.slice(i,i+width));
    return rows
  }
  let bits=Math.ceil(count*Math.log2(5));
  return q2Unpack5(r.s.slice(r.i,r.i+=bits),count,width)
}
function q2Symbols(ast){
  let globals=new Map(),fns=new Map(),pals=new Map(),sprites=new Map();
  const add=(map,name)=>{
    if(!map.has(name)){
      if(map.size>=64)throw Error('More than 64 '+(map===globals?'global variables':'symbols'));
      map.set(name,map.size)
    }
  };
  // Collect declarations before encoding to allow forward references.
  function walk(stmts,top){
    for(let n of stmts){
      if(n[0]==='let'&&top)add(globals,n[1]);
      if(n[0]==='fn')add(fns,n[1]);
      if(n[0]==='palette')add(pals,n[1]);
      if(n[0]==='sprite')add(sprites,n[1]);
      if(n[0]==='for'){
        walk([n[1]],top);
        walk(n[4],top)
      }
      if(n[0]==='if'){
        walk(n[2],top);
        walk(n[3],top)
      }
      if(n[0]==='while')walk(n[2],top)
    }
  }
  walk(ast,true);
  return{
    globals,fns,pals,sprites
  }
}
function q2Encode(ast){
  let w=new BW(),sy=q2Symbols(ast);
  w.uint(2,4);
  w.uint(0,4);
  let ctx={
    sy,locals:null
  };
  const names={
    global:sy.globals,fn:sy.fns,palette:sy.pals,sprite:sy.sprites
  };
  function localContext(params,body){
    let map=new Map();
    const add=n=>{
      if(!map.has(n)){
        if(map.size>=64)throw Error('More than 64 local variables');
        map.set(n,map.size)
      }
    };
    params.forEach(add);
    function scan(stmts){
      for(let n of stmts){
        if(n[0]==='let')add(n[1]);
        if(n[0]==='for'){
          scan([n[1]]);
          scan(n[4])
        }
        if(n[0]==='if'){
          scan(n[2]);
          scan(n[3])
        }
        if(n[0]==='while')scan(n[2])
      }
    }
    scan(body);
    return map
  }
  function id(w,name,c){
    let kind,num;
    if(c.locals?.has(name)){
      kind=1;
      num=c.locals.get(name)
    }else if(sy.globals.has(name)){
      kind=0;
      num=sy.globals.get(name)
    }else if(sy.fns.has(name)){
      kind=2;
      num=sy.fns.get(name)
    }else if(Q2_BUILTINS.includes(name)){
      kind=3;
      num=Q2_BUILTINS.indexOf(name)
    }else if(sy.pals.has(name)){
      kind=4;
      num=sy.pals.get(name)
    }else if(sy.sprites.has(name)){
      kind=5;
      num=sy.sprites.get(name)
    }else throw Error('Undefined symbol: '+name);
    w.uint(kind,3);
    w.uint(num,6)
  }
  function many(w,items,c){
    w.v(items.length);
    items.forEach(n=>write(w,n,c))
  }
  function write(w,n,c){
    let t=n[0];
    q2Tag(w,t);
    switch(t){
      case'lit':{
        let v=n[1];
        if(v===null)w.s+='00';
        else if(v===false)w.s+='010';
        else if(v===true)w.s+='011';
        else if(typeof v==='number'){
          w.s+='10';
          q2Small(w,v)
        }else{
          w.s+='11';
          w.str(v)
        }
        break
      }
      case'var':id(w,n[1],c);
      break;
      case'array':many(w,n[1],c);
      break;
      case'un':w.bit(Q2_UN.indexOf(n[1]));
      write(w,n[2],c);
      break;
      case'bin':{
        let op=Q2_OPS.indexOf(n[1]);
        if(op<0)throw Error('Unsupported operator '+n[1]);
        w.uint(op,4);
        write(w,n[2],c);
        write(w,n[3],c);
        break
      }
      case'call':write(w,n[1],c);
      many(w,n[2],c);
      break;
      case'index':write(w,n[1],c);
      write(w,n[2],c);
      break;
      case'prop':write(w,n[1],c);
      {
        let k=Q2_PROPS.indexOf(n[2]);
        if(k>=0){
          w.bit(0);
          w.uint(k,2)
        }else{
          w.bit(1);
          w.str(n[2])
        }
      }
      break;
      case'lambda':{
        let lc=localContext(n[1],n[2]);
        w.v(n[1].length);
        n[1].forEach(p=>w.uint(lc.get(p),6));
        many(w,n[2],{
          ...c,locals:lc
        });
        break
      }
      case'let':case'assign':{
        if(t==='let')id(w,n[1],c);
        else write(w,n[1],c);
        write(w,n[2],c);
        break
      }
      case'expr':case'return':case'touch':case'frame':write(w,n[1],c);
      break;
      case'if':write(w,n[1],c);
      many(w,n[2],c);
      many(w,n[3],c);
      break;
      case'for':write(w,n[1],c);
      write(w,n[2],c);
      write(w,n[3],c);
      many(w,n[4],c);
      break;
      case'while':write(w,n[1],c);
      many(w,n[2],c);
      break;
      case'fn':{
        w.uint(sy.fns.get(n[1]),6);
        let lc=localContext(n[2],n[3]);
        w.v(n[2].length);
        n[2].forEach(p=>w.uint(lc.get(p),6));
        many(w,n[3],{
          ...c,locals:lc
        });
        break
      }
      case'palette':{
        w.uint(sy.pals.get(n[1]),6);
        w.v(n[2].length);
        for(let col of n[2]){
          if(col[0]!=='lit')throw Error('Palette must contain literal colors');
          w.bit(col[1]===null?0:1);
          if(col[1]!==null)w.uint(q2RGB(col[1]),15)
        }
        break
      }
      case'sprite':{
        w.uint(sy.sprites.get(n[1]),6);
        w.uint(sy.pals.get(n[2]),6);
        w.v(n[3].length);
        w.v(n[3][0].length);
        q2Sprites(w,n[3]);
        break
      }
      default:throw Error('Unsupported node '+t)
    }
  }
  many(w,ast,ctx);
  return w.s
}
function q2Decode(bits){
  let r=new BR(bits);
  if(r.uint(4)!==2)throw Error('Not QG v2 binary');
  if(r.uint(4)!==0)throw Error('Unsupported v2 flags');
  let context={
    locals:null
  };
  function id(r,c){
    let kind=r.uint(3),n=r.uint(6);
    if(kind===0)return'v'+n;
    if(kind===1){
      if(!c.locals)throw Error('Local variable outside function');
      return'l'+n
    }
    if(kind===2)return'f'+n;
    if(kind===3){
      if(n>=Q2_BUILTINS.length)throw Error('Unknown builtin');
      return Q2_BUILTINS[n]
    }
    if(kind===4)return'p'+n;
    if(kind===5)return's'+n;
    throw Error('Invalid symbol category')
  }
  function many(r,c){
    let n=r.v();
    if(n>100000)throw Error('Too many nodes');
    return Array.from({
      length:n
    },()=>read(r,c))
  }
  function params(r){
    let n=r.v();
    if(n>64)throw Error('Too many params');
    let p=[];
    for(let i=0;i<n;i++)p.push('l'+r.uint(6));
    if(new Set(p).size!==p.length)throw Error('Duplicate param slot');
    return p
  }
  function read(r,c){
    let t=q2ReadTag(r);
    switch(t){
      case'lit':{
        let a=r.bit();
        if(!a){
          let b=r.bit();
          if(!b)return['lit',null];
          return['lit',!!r.bit()]
        }
        return['lit',r.bit()?r.str():q2ReadSmall(r)]
      }
      case'var':return[t,id(r,c)];
      case'array':return[t,many(r,c)];
      case'un':return[t,Q2_UN[r.bit()],read(r,c)];
      case'bin':{
        let op=Q2_OPS[r.uint(4)];
        if(!op)throw Error('Bad binary op');
        return[t,op,read(r,c),read(r,c)]
      }
      case'call':return[t,read(r,c),many(r,c)];
      case'index':return[t,read(r,c),read(r,c)];
      case'prop':{
        let obj=read(r,c),name;
        if(r.bit())name=r.str();
        else{
          name=Q2_PROPS[r.uint(2)];
          if(!name)throw Error('Bad property ID')
        }
        return[t,obj,name]
      }
      case'lambda':{
        let p=params(r);
        return[t,p,many(r,{
          locals:true
        })]
      }
      case'let':return[t,id(r,c),read(r,c)];
      case'assign':return[t,read(r,c),read(r,c)];
      case'expr':case'return':case'touch':case'frame':return[t,read(r,c)];
      case'if':return[t,read(r,c),many(r,c),many(r,c)];
      case'for':return[t,read(r,c),read(r,c),read(r,c),many(r,c)];
      case'while':return[t,read(r,c),many(r,c)];
      case'fn':{
        let name='f'+r.uint(6),p=params(r);
        return[t,name,p,many(r,{
          locals:true
        })]
      }
      case'palette':{
        let name='p'+r.uint(6),n=r.v();
        if(n>256)throw Error('Palette too long');
        let a=[];
        for(let i=0;i<n;i++){
          let present=r.bit();
          a.push(['lit',present?q2Hex(r.uint(15)):null])
        }
        return[t,name,a]
      }
      case'sprite':{
        let name='s'+r.uint(6),pal='p'+r.uint(6),h=r.v(),width=r.v();
        return[t,name,pal,q2ReadSprites(r,h,width)]
      }
      default:throw Error('Unknown v2 node '+t)
    }
  }
  let ast=many(r,context);
  if(r.i!==r.s.length)throw Error('Trailing bits in v2 payload');
  return ast
}
