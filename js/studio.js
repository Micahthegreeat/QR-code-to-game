function showDecoded(bits,encoded){
  let ast=q2Decode(bits);
  let qg=ast.map(qgStmt).join('\n');
  generatedHTML=htmlFromAST(ast);
  $('decodedQG').textContent=qg;
  $('html').textContent=generatedHTML;
  $('preview').srcdoc=generatedHTML;
  $('bits').textContent=(bits.match(/.{1,8}/g)||[]).join(' ');
  $('bitN').textContent=bits.length.toLocaleString();
  $('baseN').textContent=encoded.length.toLocaleString();
  $('qrN').textContent=(encoded.length/4296*100).toFixed(2)+'%';
  $('status').textContent='Success: decoded Base39 into QG and generated playable HTML';
  $('status').className=''
}
function compile(){
  try{
    let src=$('source').value,ast=new Parser(lex(src)).program(),bits=q2Encode(ast),b39=to39(bits);
    $('base39').value=b39;
    $('srcN').textContent=src.length.toLocaleString();
    if(from39(b39)!==bits)throw Error('Base39 round-trip mismatch');
    showDecoded(from39(b39),b39)
  }catch(e){
    $('status').textContent=e.stack||e.message;
    $('status').className='err';
    console.error(e)
  }
}
$('compile').onclick=compile;
$('decode').onclick=()=>{
  try{
    let b39=$('base39').value.trim();
    showDecoded(from39(b39),b39)
  }catch(e){
    $('status').textContent=e.message;
    $('status').className='err'
  }
};
$('download').onclick=()=>{
  if(!generatedHTML)return alert('Compile or decompile first');
  let url=URL.createObjectURL(new Blob([generatedHTML],{
    type:'text/html'
  })),a=document.createElement('a');
  a.href=url;
  a.download='qg-decoded-game.html';
  a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000)
};
$('copy').onclick=async()=>{
  try{
    await navigator.clipboard.writeText($('base39').value);
    $('status').textContent='Base39 copied'
  }catch(e){
    $('base39').select();
    $('status').textContent='Select and copy the Base39 text manually'
  }
};
