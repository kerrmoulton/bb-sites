const fs=require('fs'),path=require('path'),vm=require('vm'),test=require('node:test'),assert=require('node:assert/strict');
const root=path.join(__dirname,'../../../twitter');
const tw=(id,date='Fri Sep 11 18:08:14 +0000 2026')=>({rest_id:id,legacy:{full_text:'中文😀'+id,created_at:date},core:{user_results:{result:{core:{screen_name:'follow_clues',name:'Theclues'}}}}});
const pg=(ids,cursor)=>({data:{user:{result:{timeline:{timeline:{instructions:[{type:'TimelineAddEntries',entries:[...ids.map(t=>({content:{itemContent:{tweet_results:{result:t}}}})),...(cursor?[{content:{entryType:'TimelineTimelineCursor',cursorType:'Bottom',value:cursor}}]:[])]}]}}}}}});
function fixture(name,pages=[]){let calls=0;const ctx={URL,URLSearchParams,TextEncoder,TextDecoder,console,Set,Map,Date,JSON,Number,String,Array,Object,Promise,decodeURIComponent,encodeURIComponent,setTimeout:fn=>{fn();return 0},clearTimeout(){},PopStateEvent:function(){},location:{origin:'https://x.com',href:'https://x.com/home',pathname:'/home',search:''},history:{pushState(){}},dispatchEvent(){},document:{cookie:'ct0=offline-fixture-only',querySelector:()=>({getAttribute:()=>'/fixture_user'}),querySelectorAll:()=>[]},XMLHttpRequest:function(){},fetch:async url=>{calls++;const d=String(url).includes('UserByScreenName')?{data:{user:{result:{rest_id:'42'}}}}:String(url).includes('raw.githubusercontent.com')?{}:pages.shift();const status=d?.status||200;return {ok:status<400,status,headers:{get:k=>k==='x-rate-limit-reset'?'123':null},json:async()=>d,text:async()=>JSON.stringify(d),clone(){return this;}};}};ctx.XMLHttpRequest.prototype.open=function(){};ctx.XMLHttpRequest.prototype.send=function(){};ctx.window=ctx;ctx.window.webpackChunk_twitter_responsive_web={push(){throw new Error('no webpack fixture')}};vm.createContext(ctx);const original=ctx.fetch;const fn=vm.runInContext('('+fs.readFileSync(path.join(root,'read-'+name+'.js'),'utf8')+')',ctx);return {fn,ctx,original,calls:()=>calls};}
test('all20 private adapter files parse as functions',()=>{const files=fs.readdirSync(root).filter(n=>n.startsWith('read-'));assert.equal(files.length,20);for(const f of files)assert.equal(typeof vm.runInNewContext('('+fs.readFileSync(path.join(root,f),'utf8')+')'),'function');});
test('tweets reads multiple pages and restores interceptors',async()=>{const f=fixture('tweets',[pg([tw('1')],'next'),pg([tw('2')],null)]);const r=await f.fn({username:'follow_clues',limit:'2','page-delay':'0'});assert.equal(r.ok,true);assert.equal(r.data.length,2);assert.equal(r.data[1].text,'中文😀2');assert.equal(f.ctx.fetch,f.original);assert.ok(!JSON.stringify(r).includes('offline-fixture-only'));});
test('later-page HTTP429 cannot be silently reported as success',async()=>{const f=fixture('tweets',[pg([tw('1')],'next'),{status:429}]);const r=await f.fn({username:'follow_clues',limit:'2','page-delay':'0'});assert.equal(r.ok,false);assert.equal(r.failure.code,'HTTP_429');assert.equal(r.partial_data.length,1);assert.equal(r.failure.rate['x-rate-limit-reset'],'123');assert.equal(f.ctx.fetch,f.original);});
test('browser-only file flags reject before data requests',async()=>{const f=fixture('bookmarks');const r=await f.fn({'output-file':'/tmp/forbidden','resume-file':'/tmp/state',all:'true'});assert.equal(r.ok,false);assert.match(r.failure.message,/EXTERNAL_RUNNER/);assert.equal(f.calls(),0);assert.equal(f.ctx.fetch,f.original);});
test('missing required argument gives structured failure',async()=>{const f=fixture('collection');const r=await f.fn({});assert.equal(r.ok,false);assert.match(r.failure.message,/MISSING_ARGUMENT/);});
const timeline=(rows,cursor)=>({instructions:[{type:'TimelineAddEntries',entries:[...rows.map(t=>({content:{itemContent:{tweet_results:{result:t}}}})),...(cursor?[{content:{entryType:'TimelineTimelineCursor',cursorType:'Bottom',value:cursor}}]:[])]}]});
test('JSON request preserves limit and function arguments for following',async()=>{
 const user={__typename:'User',core:{screen_name:'someone',name:'Some One'},relationship_counts:{followers:12}};
 const data=pg([],null);data.data.user.result.timeline.timeline.instructions[0].entries=[{entryId:'user-7',content:{itemContent:{user_results:{result:user}}}}];
 const f=fixture('following',[data]);const r=await f.fn({request:JSON.stringify({user:'follow_clues',limit:1})});assert.equal(r.ok,true);assert.equal(r.data.length,1);assert.equal(r.data[0].followers,12);
});
test('search stops two advancing empty pages rather than burning quota',async()=>{
 const f=fixture('search',[{data:{search_by_raw_query:{search_timeline:{timeline:timeline([], 'a')}}}},{data:{search_by_raw_query:{search_timeline:{timeline:timeline([], 'b')}}}}]);
 const r=await f.fn({request:JSON.stringify({query:'empty-fixture',limit:5,filter:'live'})});assert.equal(r.ok,false);assert.match(r.failure.message,/SEARCH_NO_PROGRESS/);assert.equal(r.partial_data.length,0);assert.equal(r.trace.filter(x=>x.operation==='SearchTimeline').length,2);
});
test('bookmark folder list positive fixture on current envelope',async()=>{
 const f=fixture('bookmark-folders',[{data:{viewer:{bookmark_collections_slice:{items:[{id:'folder1',name:'Research',bookmarks_count:2}]}}}}]);const r=await f.fn({});assert.equal(r.ok,true);assert.equal(r.data[0].name,'Research');assert.equal(r.data[0].items,2);
});
test('bookmark folder content supports pagination and deduplication in fixture',async()=>{
 const f=fixture('bookmark-folder',[{data:{bookmark_collection_timeline:{timeline:timeline([tw('1')],'next')}}},{data:{bookmark_collection_timeline:{timeline:timeline([tw('1'),tw('2')],null)}}}]);const r=await f.fn({request:JSON.stringify({'folder-id':'folder1',limit:2})});assert.equal(r.ok,true);assert.equal(r.data.length,2);assert.equal(r.data[1].id,'2');
});
test('bookmarks positive fixture preserves long text and IDs',async()=>{
 const t=tw('77');t.note_tweet={note_tweet_results:{result:{text:'长文😀'}}};const f=fixture('bookmarks',[{data:{bookmark_timeline_v2:{timeline:timeline([t],null)}}}]);const r=await f.fn({request:JSON.stringify({limit:1})});assert.equal(r.ok,true);assert.equal(r.data[0].text,'长文😀');
});
test('generated read suite contains no account mutation endpoints',()=>{for(const name of fs.readdirSync(root).filter(n=>n.startsWith('read-'))){const s=fs.readFileSync(path.join(root,name),'utf8');assert.ok(!/\/(?:CreateTweet|DeleteTweet|FavoriteTweet|UnfavoriteTweet|CreateBookmark|DeleteBookmark|ListAddMember|ListRemoveMember)(?:\?|['"`])/.test(s),name);assert.ok(!/new Function\(/.test(s),name);}});

test('following home timeline stops after two empty cursor pages',async()=>{
 const f=fixture('timeline',[{data:{home:{home_timeline_urt:timeline([], 'a')}}},{data:{home:{home_timeline_urt:timeline([], 'b')}}}]);
 const r=await f.fn({request:JSON.stringify({type:'following',limit:5})});assert.equal(r.ok,false);assert.match(r.failure.message,/TIMELINE_NO_PROGRESS/);assert.equal(r.partial_data.length,0);assert.equal(r.trace.filter(x=>x.operation==='HomeLatestTimeline').length,2);
});
test('notifications parses the actual outer GraphQL data envelope',async()=>{
 const item={__typename:'TimelineNotification',id:'n1',rich_message:{text:'someone liked your post'},notification_icon:'heart',template:{from_users:[{user_results:{result:{core:{screen_name:'someone'}}}}]}};
 const f=fixture('notifications',[{data:{viewer:{timeline_response:{timeline:{instructions:[{type:'TimelineAddEntries',entries:[{entryId:'notification-n1',content:{itemContent:item}}]}]}}}}}]);
 f.ctx.history.pushState=(_,__,url)=>{f.ctx.location.pathname=url;};
 f.ctx.dispatchEvent=()=>{if(f.ctx.location.pathname==='/notifications')f.ctx.fetch('/i/api/graphql/fixture/NotificationsTimeline');};
 f.ctx.document.scrollingElement={scrollTop:0};f.ctx.innerHeight=800;
 const r=await f.fn({request:JSON.stringify({limit:1})});assert.equal(r.ok,true);assert.equal(r.data.length,1);assert.equal(r.data[0].author,'someone');
});
test('single media discovery uses only the target TweetDetail media',async()=>{
 const t=tw('123');t.legacy.extended_entities={media:[{type:'photo',media_url_https:'https://pbs.twimg.com/media/fixture.jpg'}]};
 const f=fixture('download',[{data:{threaded_conversation_with_injections_v2:timeline([t],null)}}]);
 const r=await f.fn({request:JSON.stringify({'tweet-url':'https://x.com/follow_clues/status/123'})});assert.equal(r.ok,true);assert.equal(r.data[0].tweet_id,'123');assert.equal(r.data[0].status,'discovered');
});
test('notifications rejects unknown envelopes instead of returning empty success',async()=>{
 const f=fixture('notifications',[{data:{unknown:{}}}]);const r=await f.fn({request:'{"limit":1}'});assert.equal(r.ok,false);assert.match(r.failure.message,/NOTIFICATIONS_PROTOCOL_ERROR/);
});
test('likes positive fixture keeps actual saved tweet data',async()=>{
 const f=fixture('likes',[pg([tw('99')],null)]);const r=await f.fn({request:'{"limit":1}'});assert.equal(r.ok,true);assert.equal(r.data[0].id,'99');
});
test('owned lists fixture excludes recommended lists',async()=>{
 const entry=(prefix,id)=>({entryId:prefix+'1',content:{itemContent:{list:{id_str:id,name:'Fixture',mode:'Private',member_count:2,subscriber_count:1}}}});
 const f=fixture('lists',[{data:{viewer:{list_management_timeline:{timeline:{instructions:[{type:'TimelineAddEntries',entries:[entry('owned-subscribed-list-module-','1'),entry('list-to-follow-module-','2')]}]}}}}}]);
 const r=await f.fn({});assert.equal(r.ok,true);assert.equal(r.data.length,1);assert.equal(r.data[0].id,'1');assert.equal(r.data[0].mode,'private');
});
