const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const text=fs.readFileSync(path.join(__dirname,'../../twitter/history-page.js'),'utf8'),ctx={};vm.runInNewContext(text.slice(text.indexOf('var HistoryPage'),text.lastIndexOf('try{return')),ctx);
const tweet=id=>({rest_id:id,legacy:{full_text:'中文🧪'},core:{user_results:{result:{rest_id:'123',core:{screen_name:'a'}}}}});
const t=tweet('1');t.quoted_status_result={result:tweet('2')};
const instructions=[{type:'TimelinePinEntry',entry:{entryId:'pin',content:{itemContent:{tweet_results:{result:t}}}}},{type:'TimelineAddEntries',entries:[{entryId:'tweet-1',content:{itemContent:{tweet_results:{result:t}}}},{entryId:'cursor-bottom',content:{cursorType:'Bottom',value:'NEXT'}}]}];
const raw={data:{user:{result:{timeline:{timeline:{instructions}}}}}};
const p=ctx.HistoryPage.parsePage(raw,'tweets');assert(p.ok);assert.equal(p.posts.length,1);assert.equal(p.related_posts.length,1);assert(p.posts[0].is_pinned);assert.equal(p.next_cursor,'NEXT');assert.equal(p.posts[0].text,'中文🧪');
assert.equal(ctx.HistoryPage.parsePage({},'tweets').code,'SCHEMA_CHANGED');
const empty={data:{search_by_raw_query:{search_timeline:{timeline:{instructions:[{type:'TimelineAddEntries',entries:[{content:{cursorType:'Bottom',value:'next'}}]}]}}}}};const e=ctx.HistoryPage.parsePage(empty,'search');assert(e.ok);assert.equal(e.posts.length,0);assert(e.has_next);console.log('history parser: pin/dedupe, quote isolation, unicode, cursor, schema, empty-page PASS');
(async()=>{
 ctx.URL=URL;ctx.URLSearchParams=URLSearchParams;ctx.location={hostname:'x.com',origin:'https://x.com'};ctx.document={cookie:'ct0=fixture-only'};ctx.window={__bbHistoryMetadata:{UserTweetsAndReplies:{op:{queryId:'fixture',features:{},fieldToggles:{}},at:Date.now()}}};
 let method;ctx.fetch=async(url,init)=>{method=init.method;return {status:404,ok:false,headers:{get:k=>k==='x-rate-limit-remaining'?'10':null},text:async()=>''};};
 let r=await ctx.HistoryPage.run({username:'test',user_id:'123',mode:'replies'});assert.equal(method,'POST');assert.equal(r.failure.code,'HTTP_404');assert.equal(r.rate_limit['x-rate-limit-remaining'],'10');
 ctx.window.__bbHistoryMetadata.UserTweetsAndReplies={op:{queryId:'fixture',features:{},fieldToggles:{}},at:Date.now()};
 ctx.fetch=async()=>({status:200,ok:true,headers:{get:()=>null},text:async()=>JSON.stringify({errors:[{code:88,message:'rate limit'}]})});
 r=await ctx.HistoryPage.run({username:'test',user_id:'123',mode:'replies'});assert.equal(r.failure.code,'GRAPHQL_ERROR');console.log('history transport: POST replies, empty404, quota preservation, 200GraphQLerror PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
