// Compact tagged AST format. All strings use UTF-8; numbers use zigzag varints or IEEE754.
const TAG={
  lit:0,var:1,array:2,un:3,bin:4,call:5,index:6,prop:7,lambda:8,let:9,assign:10,expr:11,if:12,for:13,while:14,return:15,fn:16,palette:17,sprite:18,touch:19,frame:20
};
const SPEC_PAYLOADS={
  lit:'2-bit literal kind; for kind 3: 1-bit number/string selector + numeric or UTF-8 string',var:'UTF-8 name',array:'varint count + expression nodes',un:'1-bit unary operator + expression',bin:'4-bit binary operator + left and right expressions',call:'callee expression + varint arg count + arguments',index:'array expression + index expression',prop:'object expression + UTF-8 property name',lambda:'varint parameter count + UTF-8 names + statement list',let:'UTF-8 name + initializer expression',assign:'target expression + value expression',expr:'expression',if:'condition + then statement list + else statement list',for:'initialization statement + condition + update statement + body list',while:'condition + body statement list',return:'expression',fn:'UTF-8 function name + parameters + body list',palette:'UTF-8 palette name + expression list',sprite:'UTF-8 sprite name + palette name + height + width + 3-bit pixels',touch:'callback expression',frame:'callback expression'
};
window.addEventListener('DOMContentLoaded',()=>{
  const target=document.getElementById('spec-tags');if(target)target.innerHTML=Object.entries(TAG).map(([name,id])=>'<tr><td>'+id+' ('+id.toString(2).padStart(5,'0')+')</td><td><code>'+name+'</code></td><td>'+SPEC_PAYLOADS[name]+'</td></tr>').join('')
});
