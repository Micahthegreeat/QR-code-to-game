const$=id=>document.getElementById(id),ALPH='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ*+-';
let generatedHTML='';
const KEYWORDS=new Set(['let','fn','if','else','for','while','return','true','false','null','palette','sprite']);
function lex(src){
  let i=0,out=[];
  const pat=/\s+|\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|(?:\d+(?:\.\d+)?)|[A-Za-z_$][\w$]*|==|!=|<=|>=|&&|\|\||\+\+|--|\+=|-=|[{}()\[\],;.+*\/%<>=!:-]/y;
  while(i<src.length){
    pat.lastIndex=i;
    let m=pat.exec(src);
    if(!m)throw Error('Unexpected character at '+i+': '+src.slice(i,i+20));
    i=pat.lastIndex;
    if(!/^\s|^\/\//.test(m[0])&&!m[0].startsWith('/*'))out.push(m[0]);
  }
  out.push('<EOF>');
  return out;
}
class Parser{
  constructor(t){
    this.t=t;
    this.i=0
  }
  peek(n=0){
    return this.t[this.i+n]
  }
  next(){
    return this.t[this.i++]
  }
  eat(s){
    if(this.peek()===s){
      this.i++;
      return true
    }
    return false
  }
  need(s){
    let t=this.next();
    if(t!==s)throw Error('Expected '+s+', got '+t)
  }
  name(){
    let n=this.next();
    if(!/^[A-Za-z_$][\w$]*$/.test(n)||KEYWORDS.has(n))throw Error('Expected name, got '+n);
    return n
  }
  expr(min=0){
    let t=this.next(),a;
    if(t==='('){
      a=this.expr();
      this.need(')')
    }else if(t==='-'||t==='!'){
      a=['un',t,this.expr(8)]
    }else if(t==='true'||t==='false'||t==='null'){
      a=['lit',t==='null'?null:t==='true']
    }else if(/^\d/.test(t)){
      a=['lit',Number(t)]
    }else if(t[0]==='"'||t[0]==="'"){
      a=['lit',t[0]==='"'?JSON.parse(t):t.slice(1,-1).replace(/\\'/g,"'").replace(/\\n/g,'\n')]
    }else if(t==='['){
      let xs=[];
      if(!this.eat(']')){
        do{
          xs.push(this.expr())
        }
        while(this.eat(','));
        this.need(']')
      }
      a=['array',xs]
    }else if(/^[A-Za-z_$]/.test(t)){
      a=['var',t]
    }else throw Error('Invalid expression '+t);
    while(true){
      if(this.peek()==='('&&9>=min){
        this.next();
        let args=[];
        if(!this.eat(')')){
          do{
            args.push(this.expr())
          }
          while(this.eat(','));
          this.need(')')
        }
        a=['call',a,args];
        continue
      }
      if(this.peek()==='['&&9>=min){
        this.next();
        let idx=this.expr();
        this.need(']');
        a=['index',a,idx];
        continue
      }
      if(this.peek()==='.'&&9>=min){
        this.next();
        a=['prop',a,this.name()];
        continue
      }
      const prec={
        '||':1,'&&':2,'==':3,'!=':3,'<':4,'>':4,'<=':4,'>=':4,'+':5,'-':5,'*':6,'/':6,'%':6
      };
      let op=this.peek(),p=prec[op];
      if(p===undefined||p<min)break;
      this.next();
      a=['bin',op,a,this.expr(p+1)];
    }
    return a
  }
  block(){
    this.need('{');
    let b=[];
    while(this.peek()!=='}'){
      if(this.peek()==='<EOF>')throw Error('Unclosed block');
      b.push(this.stmt())
    }
    this.next();
    return b
  }
  fnExpr(){
    this.need('fn');
    this.need('(');
    let args=[];
    if(!this.eat(')')){
      do{
        args.push(this.name())
      }
      while(this.eat(','));
      this.need(')')
    }
    return['lambda',args,this.block()]
  }
  stmt(){
    let t=this.peek();
    if(t==='canvas'||t==='clear'||t==='rect'||t==='blit'||t==='text'){
      /* ordinary expression statement */
    }
    if(this.eat('palette')){
      let n=this.name();
      this.need('=');
      let a=this.expr();
      this.need(';');
      if(a[0]!=='array')throw Error('Palette must be an array');
      return['palette',n,a[1]]
    }
    if(this.eat('sprite')){
      let n=this.name();
      this.need('(');
      let pal=this.name();
      this.need(')');
      this.need('{');
      let rows=[];
      while(this.peek()!=='}'){
        let row=this.next();
        if(!/^[0-4]+$/.test(row))throw Error('Sprite row must contain only 0–4: '+row);
        rows.push(row)
      }
      this.need('}');
      if(!rows.length||rows.some(x=>x.length!==rows[0].length))throw Error('Sprite rows must be equal width');
      return['sprite',n,pal,rows]
    }
    if(this.eat('fn')){
      let n=this.name();
      this.need('(');
      let args=[];
      if(!this.eat(')')){
        do{
          args.push(this.name())
        }
        while(this.eat(','));
        this.need(')')
      }
      return['fn',n,args,this.block()]
    }
    if(this.eat('touch')||this.eat('frame')){
      let type=t;
      this.need('(');
      let fn=this.fnExpr();
      this.need(')');
      this.need(';');
      return[type,fn]
    }
    if(this.eat('let')){
      let n=this.name();
      this.need('=');
      let e=this.expr();
      this.need(';');
      return['let',n,e]
    }
    if(this.eat('if')){
      this.need('(');
      let test=this.expr();
      this.need(')');
      let yes=this.block(),no=this.eat('else')?this.block():[];
      return['if',test,yes,no]
    }
    if(this.eat('while')){
      this.need('(');
      let test=this.expr();
      this.need(')');
      return['while',test,this.block()]
    }
    if(this.eat('for')){
      this.need('(');
      let init=this.simple();
      this.need(';');
      let test=this.expr();
      this.need(';');
      let update=this.simple();
      this.need(')');
      return['for',init,test,update,this.block()]
    }
    if(this.eat('return')){
      let e=this.peek()===';'?['lit',null]:this.expr();
      this.need(';');
      return['return',e]
    }
    let s=this.simple();
    this.need(';');
    return s
  }
  simple(){
    let declaration=this.eat('let');
    if(declaration){
      let n=this.name();
      this.need('=');
      return['let',n,this.expr()]
    }
    let a=this.expr();
    if(['=','+=','-=','++','--'].includes(this.peek())){
      let op=this.next();
      if(!['var','index','prop'].includes(a[0]))throw Error('Invalid assignment target');
      if(op==='++'||op==='--')return['assign',a,['bin',op==='++'?'+':'-',a,['lit',1]]];
      let e=this.expr();
      if(op==='+=')e=['bin','+',a,e];
      if(op==='-=')e=['bin','-',a,e];
      return['assign',a,e]
    }
    return['expr',a]
  }
  program(){
    let b=[];
    while(this.peek()!=='<EOF>')b.push(this.stmt());
    return b
  }
}
