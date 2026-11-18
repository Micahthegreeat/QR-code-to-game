// ---------------------------------------------------------------
// VERSION REGISTRY: keep old codecs here when you add new ones.
// Path /0/ is legacy Huffman, /1/ is AST prototype, /2/ is optimized QG.
// WARNING: the old Huffman /0/ decoder is not included.
// Old /0/ URLs need their original decoder restored.
// ---------------------------------------------------------------
const CODECS={
  '0':{
    label:'Optimized QG',decodePayload(payload){
      return q2Decode(from39(payload));
    },encodePayload(ast){
      return to39(q2Encode(ast));
    }
  },'1':{
    label:'AST prototype v1',decodePayload(payload){
      return decode(from39(payload));
    },encodePayload(ast){
      return to39(encode(ast));
    }
  }
};
const ACTIVE_CODEC='0';
function makeGameURL(encoded,version=ACTIVE_CODEC){
  return location.origin+'/'+encodeURIComponent(version)+'/'+encoded;
}
function parseGameRoute(){
  const match=location.pathname.match(/^\/(\d+)\/([0-9A-Z*+\-]+)\/?$/);
  if(match)return{
    version:match[1],payload:match[2]
  };
  // Hash URLs work on static hosting even without SPA rewrites.
  const hash=location.hash.match(/^#\/(\d+)\/([0-9A-Z*+\-]+)$/);
  return hash?{
    version:hash[1],payload:hash[2]
  }
  :null;
}
function openGameRoute(route){
  document.body.classList.add('play-mode');
  const error=$('player-error'),frame=$('player-frame');
  try{
    const codec=CODECS[route.version];
    if(!codec)throw Error('Unknown QG format version '+route.version+'. This deployment has no decoder for that version.');
    if(route.payload.length>250000)throw Error('Game payload is too long');
    const ast=codec.decodePayload(route.payload);
    frame.srcdoc=htmlFromAST(ast);
    error.style.display='none';
  }catch(e){
    frame.style.display='none';
    error.style.display='block';
    error.textContent='Cannot open this game.\n\n'+e.message+'\n\nIf this is an older /0/ Huffman game, its original decoder must be added to the version registry.';
  }
}
function updateGameLink(){
  const value=$('base39').value.trim();
  const url=value?makeGameURL(value):'';
  const a=$('gameURL');
  a.textContent=url||'Compile to generate a link';
  a.href=url||'#';
}
$('copylink').onclick=async()=>{
  const url=$('gameURL').href;
  if(!lastBase39Available())return alert('Compile a game first');
  try{
    await navigator.clipboard.writeText(url);
    $('status').textContent='Game link copied'
  }catch(e){
    $('status').textContent='Copy this URL: '+url
  }
};
function lastBase39Available(){
  return!!$('base39').value.trim()
}
$('base39').addEventListener('input',updateGameLink);
