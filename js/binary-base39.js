const UN=['-','!'],BIN=['+','-','*','/','%','<','>','<=','>=','==','!=','&&','||'];
class BW{
  constructor(){
    this.s=''
  }
  bit(n){
    this.s+=n?'1':'0'
  }
  uint(n,k){
    if(!Number.isSafeInteger(n)||n<0||n>=2**k)throw Error('uint overflow');
    this.s+=n.toString(2).padStart(k,'0')
  }
  v(n){
    if(!Number.isSafeInteger(n)||n<0)throw Error('Invalid varint '+n);
    do{
      let x=n%128;
      n=Math.floor(n/128);
      this.uint(x+(n?128:0),8)
    }
    while(n)
  }
  str(s){
    let bytes=new TextEncoder().encode(s);
    this.v(bytes.length);
    for(let x of bytes)this.uint(x,8)
  }
  num(n){
    if(Number.isSafeInteger(n)&&Math.abs(n)<2**50){
      this.bit(0);
      this.v(n>=0?n*2:-n*2-1)
    }else{
      this.bit(1);
      let dv=new DataView(new ArrayBuffer(8));
      dv.setFloat64(0,n);
      for(let i=0;i<8;i++)this.uint(dv.getUint8(i),8)
    }
  }
}
class BR{
  constructor(s){
    this.s=s;
    this.i=0
  }
  uint(k){
    if(this.i+k>this.s.length)throw Error('Truncated binary');
    let v=parseInt(this.s.slice(this.i,this.i+k)||'0',2);
    this.i+=k;
    return v
  }
  bit(){
    return this.uint(1)
  }
  v(){
    let n=0,m=1;
    for(let i=0;i<9;i++){
      let b=this.uint(8);
      n+=(b%128)*m;
      if(b<128){
        if(!Number.isSafeInteger(n))throw Error('Varint too large');
        return n
      }
      m*=128
    }
    throw Error('Varint too long')
  }
  str(){
    let n=this.v();
    if(n>1000000)throw Error('String too long');
    let b=new Uint8Array(n);
    for(let i=0;i<n;i++)b[i]=this.uint(8);
    return new TextDecoder('utf-8',{
      fatal:true
    }).decode(b)
  }
  num(){
    if(this.bit()){
      let d=new DataView(new ArrayBuffer(8));
      for(let i=0;i<8;i++)d.setUint8(i,this.uint(8));
      return d.getFloat64(0)
    }
    let z=this.v();
    return z%2===0?z/2:-(z+1)/2
  }
}
function writeNode(w,n){
  let tag=TAG[n[0]];
  if(tag===undefined)throw Error('Unknown node '+n[0]);
  w.uint(tag,5);
  let t=n[0];
  const one=x=>writeNode(w,x),many=a=>{
    w.v(a.length);
    a.forEach(one)
  },block=a=>many(a);
  switch(t){
    case'lit':{
      let v=n[1];
      if(v===null)w.uint(0,2);
      else if(v===false)w.uint(1,2);
      else if(v===true)w.uint(2,2);
      else{
        w.uint(3,2);
        if(typeof v==='number'){
          w.bit(0);
          w.num(v)
        }else{
          w.bit(1);
          w.str(v)
        }
      }
      break
    }
    case'var':w.str(n[1]);
    break;
    case'array':many(n[1]);
    break;
    case'un':w.uint(UN.indexOf(n[1]),1);
    one(n[2]);
    break;
    case'bin':w.uint(BIN.indexOf(n[1]),4);
    one(n[2]);
    one(n[3]);
    break;
    case'call':one(n[1]);
    many(n[2]);
    break;
    case'index':one(n[1]);
    one(n[2]);
    break;
    case'prop':one(n[1]);
    w.str(n[2]);
    break;
    case'lambda':w.v(n[1].length);
    n[1].forEach(x=>w.str(x));
    block(n[2]);
    break;
    case'let':w.str(n[1]);
    one(n[2]);
    break;
    case'assign':one(n[1]);
    one(n[2]);
    break;
    case'expr':one(n[1]);
    break;
    case'if':one(n[1]);
    block(n[2]);
    block(n[3]);
    break;
    case'for':one(n[1]);
    one(n[2]);
    one(n[3]);
    block(n[4]);
    break;
    case'while':one(n[1]);
    block(n[2]);
    break;
    case'return':one(n[1]);
    break;
    case'fn':w.str(n[1]);
    w.v(n[2].length);
    n[2].forEach(x=>w.str(x));
    block(n[3]);
    break;
    case'palette':w.str(n[1]);
    many(n[2]);
    break;
    case'sprite':w.str(n[1]);
    w.str(n[2]);
    w.v(n[3].length);
    w.v(n[3][0].length);
    for(let row of n[3])for(let ch of row)w.uint(Number(ch),3);
    break;
    case'touch':case'frame':one(n[1]);
    break
  }
}
function readNode(r){
  let id=r.uint(5),t=Object.keys(TAG).find(x=>TAG[x]===id);
  if(!t)throw Error('Invalid node '+id);
  const one=()=>readNode(r),many=()=>{
    let n=r.v();
    if(n>100000)throw Error('Too many nodes');
    return Array.from({
      length:n
    },one)
  },names=()=>{
    let n=r.v();
    if(n>1000)throw Error('Too many parameters');
    return Array.from({
      length:n
    },()=>r.str())
  };
  switch(t){
    case'lit':{
      let k=r.uint(2);
      return['lit',k===0?null:k===1?false:k===2?true:r.bit()?r.str():r.num()]
    }
    case'var':return[t,r.str()];
    case'array':return[t,many()];
    case'un':return[t,UN[r.uint(1)],one()];
    case'bin':{
      let op=BIN[r.uint(4)];
      if(op===undefined)throw Error('Bad operator');
      return[t,op,one(),one()]
    }
    case'call':return[t,one(),many()];
    case'index':return[t,one(),one()];
    case'prop':return[t,one(),r.str()];
    case'lambda':return[t,names(),many()];
    case'let':return[t,r.str(),one()];
    case'assign':return[t,one(),one()];
    case'expr':return[t,one()];
    case'if':return[t,one(),many(),many()];
    case'for':return[t,one(),one(),one(),many()];
    case'while':return[t,one(),many()];
    case'return':return[t,one()];
    case'fn':return[t,r.str(),names(),many()];
    case'palette':return[t,r.str(),many()];
    case'sprite':{
      let name=r.str(),pal=r.str(),h=r.v(),w=r.v();
      if(w*h>1000000||w<1||h<1)throw Error('Invalid sprite dimensions');
      let rows=[];
      for(let y=0;y<h;y++){
        let row='';
        for(let x=0;x<w;x++){
          let p=r.uint(3);
          if(p>4)throw Error('Invalid sprite pixel');
          row+=p
        }
        rows.push(row)
      }
      return[t,name,pal,rows]
    }
    case'touch':case'frame':return[t,one()]
  }
}
function encode(ast){
  let w=new BW();
  w.uint(1,4);
  w.v(ast.length);
  ast.forEach(n=>writeNode(w,n));
  return w.s
}
function decode(bits){
  let r=new BR(bits);
  if(r.uint(4)!==1)throw Error('Unsupported QG binary version');
  let n=r.v();
  if(n>100000)throw Error('Too many statements');
  let a=Array.from({
    length:n
  },()=>readNode(r));
  if(r.i!==bits.length)throw Error('Unexpected trailing bits');
  return a
}
function to39(bits){
  let n=BigInt('0b1'+bits),s='';
  while(n){
    s=ALPH[Number(n%39n)]+s;
    n/=39n
  }
  return s
}
function from39(s){
  s=s.trim();
  if(!s||/[^0-9A-Z*+-]/.test(s))throw Error('Invalid Base39 input');
  let n=0n;
  for(let c of s)n=n*39n+BigInt(ALPH.indexOf(c));
  let b=n.toString(2);
  if(b[0]!=='1')throw Error('Invalid Base39 sentinel');
  return b.slice(1)
}
