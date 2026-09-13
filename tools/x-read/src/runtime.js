import {commands} from './shims/registry.js';
export async function runRead(name,args){
 const def=commands[name];if(!def)return {ok:false,failure:{code:'UNKNOWN_READ_COMMAND'}};
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 const trace=[],captures=[];let filter=null,drain=0;
 const originalFetch=window.fetch,originalOpen=XMLHttpRequest.prototype.open,originalSend=XMLHttpRequest.prototype.send;
 const quota=resp=>Object.fromEntries(['x-rate-limit-reset','x-rate-limit-remaining','x-rate-limit-limit','retry-after'].map(k=>[k,resp.headers.get(k)]).filter(([,v])=>v!==null));
 const safeOperation=url=>{try{const p=new URL(url,location.href).pathname;return p.includes('/graphql/')?p.split('/').at(-1):p;}catch{return 'invalid_url';}};
 const matches=url=>filter&&(url.includes(filter)||url.includes(filter.replace(/^\//,'').replace(/\?$/,'')));
 const wrappedFetch=async function(input,init){
  const url=typeof input==='string'?input:input.url;const resp=await originalFetch.call(window,input,init);
  if(String(url).includes('/i/api/'))trace.push({operation:safeOperation(url),status:resp.status,rate:quota(resp)});
  if(matches(url))try{const data=await resp.clone().json();captures.push({url,data});}catch{}
  return resp;
 };
 // Interception is transient, captures response JSON only; never exports request headers/cookies.
 const install=pattern=>{
  filter=pattern;captures.length=0;drain=0;
  XMLHttpRequest.prototype.open=function(method,url,...rest){this.__bbReadUrl=String(url);return originalOpen.call(this,method,url,...rest);};
  XMLHttpRequest.prototype.send=function(...a){this.addEventListener('load',()=>{if(matches(this.__bbReadUrl))try{captures.push({url:this.__bbReadUrl,data:JSON.parse(this.responseText)});}catch{}});return originalSend.apply(this,a);};
 };
 const page={
  async evaluate(code,...values){if(typeof code!=='function')throw new Error('STATIC_COMPILATION_REQUIRED');return await code(...values);},
  async getCookies(){const s=document.cookie.split(';').map(x=>x.trim()).find(x=>x.startsWith('ct0='));return s?[{name:'ct0',value:s.slice(4)}]:[];},
  async goto(url){const u=new URL(url,location.href);if(u.origin!==location.origin)throw new Error('CROSS_ORIGIN_NAVIGATION_NOT_SUPPORTED');if(location.pathname+location.search!==u.pathname+u.search){history.pushState({},'',u.pathname+u.search);window.dispatchEvent(new PopStateEvent('popstate',{state:{}}));await sleep(1500);}},
  async wait(v){if(typeof v==='number')return sleep(v*1000);if(v?.selector){const end=Date.now()+12000;while(Date.now()<end){if(document.querySelector(v.selector))return;await sleep(100);}throw new Error('SELECTOR_TIMEOUT '+v.selector);}},
  async installInterceptor(pattern){install(pattern);},
  async waitForCapture(seconds){const end=Date.now()+seconds*1000;while(Date.now()<end){if(captures.length>drain)return;await sleep(100);}throw new Error('CAPTURE_TIMEOUT '+filter);},
  async getInterceptedRequests(){const result=captures.slice(drain);drain=captures.length;return result;},
  async autoScroll({times=1,delayMs=1000}={}){for(let i=0;i<times;i++){const el=document.scrollingElement||document.documentElement;el.scrollTop+=window.innerHeight*2;await sleep(delayMs);}}
 };
 window.fetch=wrappedFetch;
 try{
  const kwargs={};for(const spec of def.args||[]){let v=args[spec.name]??spec.default;if(v!==undefined&&v!==null){if(spec.type==='int')v=Number(v);else if(spec.type==='bool'||typeof spec.default==='boolean')v=v===true||v==='true';kwargs[spec.name]=v;}else if(spec.required)throw new Error('MISSING_ARGUMENT '+spec.name);}
  if(kwargs['output-file']||kwargs['resume-file'])throw new Error('LOCAL_ARCHIVE_FLAGS_REQUIRE_EXTERNAL_RUNNER');
  const data=await def.func(page,kwargs);
  const failed=trace.find(t=>t.status>=400);
  if(failed)return {ok:false,failure:{code:'HTTP_'+failed.status,operation:failed.operation,rate:failed.rate},partial_data:data,trace};
  return {ok:true,data,trace,implementation:'private_bb_browser_port',revision:'static-port05-json-args',operation:name};
 }catch(e){return {ok:false,failure:{code:e.name||'ERROR',message:e.message||String(e)},...(e.partial?{partial_data:e.partial}:{}),trace};}
 finally{window.fetch=originalFetch;XMLHttpRequest.prototype.open=originalOpen;XMLHttpRequest.prototype.send=originalSend;}
}
