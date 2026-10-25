const $=id=>document.getElementById(id)
let image='',generation=0,edited=false
const session=fetch('/session').then(r=>r.json()).then(d=>{$('pair').value=d.token;return d.token})
const toURL=blob=>new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.readAsDataURL(blob)})
async function load(blob){const ticket=++generation;const value=await toURL(blob);if(ticket!==generation)return;image=value;$('preview').src=image;$('status').textContent=$('result').value?'新截图尚未识别；右侧保留的是上一次原文':'截图已载入，尚未识别';$('recognize').disabled=false}
async function sample(){await load(await (await fetch('/sample/'+$('sample').value+'.png')).blob())}
$('sample').onchange=sample
$('upload').onchange=()=>{if($('upload').files[0])load($('upload').files[0])}
$('result').oninput=()=>{edited=true;generation++;$('status').textContent='已手动修改，不会被旧识别结果覆盖';$('recognize').disabled=false}
$('clear').onclick=()=>{generation++;edited=false;$('result').value='';$('status').textContent='已清空';$('recognize').disabled=false}
$('show').onclick=()=>{$('pair').type=$('pair').type==='password'?'text':'password'}
$('recognize').onclick=async()=>{
 if(edited&&!confirm('重新识别会替换你修改的原文，是否继续？'))return
 const ticket=++generation;edited=false;$('recognize').disabled=true;$('status').textContent='正在本机识别…'
 try{const response=await fetch('/recognize',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+await session},body:JSON.stringify({image}),signal:AbortSignal.timeout(40000)});const d=await response.json();if(!response.ok)throw Error(d.error||'识别失败');if(ticket!==generation)return;$('result').value=d.text;$('status').textContent=d.text?'识别完成，请校对；不是完整性保证':'未找到可读取的蓝色高亮，没有返回整页文字';$('warning').textContent=d.warnings.join(' ')}catch(e){if(ticket===generation)$('status').textContent=e.message}finally{if(ticket===generation)$('recognize').disabled=false}
}
sample()
