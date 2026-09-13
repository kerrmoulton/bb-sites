// Read-only paged archive adapter. Shared extraction/metadata code is Apache-2.0;
// see tools/x-read/NOTICE.md. Credentials never leave browser memory.
import {resolveTwitterOperationMetadata,extractMedia,extractQuotedTweet,extractCard} from '../x-read/src/upstream/shared.js';
import {buildUserTweetsUrl,buildUserByScreenNameUrl} from '../x-read/src/upstream/user-timeline.js';
import {TWITTER_BEARER_TOKEN} from '../x-read/src/upstream/utils.js';
export const VERSION='history-page-3';
const unwrap=t=>t?.tweet||t;
export function row(result){
 const t=unwrap(result),l=t?.legacy,u=t?.core?.user_results?.result;if(!t?.rest_id||!l)return null;
 const author=u?.core?.screen_name||u?.legacy?.screen_name||'';
 const note=t.note_tweet?.note_tweet_results?.result?.text,plain=note||l.full_text||'',weighted=[...plain].reduce((n,c)=>n+(c.codePointAt(0)>0x1100?2:1),0);
 const article=t.article?.article_results?.result;const articleText=article?.plain_text||article?.content_state?.blocks?.map(b=>b.text||'').join('\n')||null;
 return {id:String(t.rest_id),author_id:String(u?.rest_id||l.user_id_str||''),author,text:plain,text_quality:note?'note':'timeline',needs_detail:(!note&&weighted>=240)||!!t.article,article_text:articleText,created_at:l.created_at||'',url:`https://x.com/${author||'i'}/status/${t.rest_id}`,type:l.retweeted_status_result?'repost':l.in_reply_to_status_id_str?'reply':l.is_quote_status?'quote':'post',reply_to_id:l.in_reply_to_status_id_str||null,quote_id:l.quoted_status_id_str||null,repost_id:unwrap(l.retweeted_status_result?.result)?.rest_id||null,likes:l.favorite_count||0,reposts:l.retweet_count||0,replies:l.reply_count||0,views:t.views?.count||null,...extractMedia(l),quoted_tweet:extractQuotedTweet(t),card:extractCard(t),article:t.article||null,urls:l.entities?.urls||[],edit_control:t.edit_control||null};
}
export function parsePage(raw,mode){
 const user=raw?.data?.user?.result;
 const instructions=mode==='search'?raw?.data?.search_by_raw_query?.search_timeline?.timeline?.instructions:user?.timeline_v2?.timeline?.instructions||user?.timeline?.timeline?.instructions;
 if(!Array.isArray(instructions))return {ok:false,code:'SCHEMA_CHANGED',user_type:user?.__typename};
 const rows=new Map(),related=new Map();let next=null,terminated=false;const skipped=[];
 function visit(v,pinned=false,entryId=null){
  if(!v||typeof v!=='object')return;
  if(v.type==='TimelineTerminateTimeline'&&v.direction==='Bottom')terminated=true;
  pinned=pinned||v.type==='TimelinePinEntry';entryId=v.entryId||entryId;
  if(v.promotedMetadata)return;
  if(['Bottom','ShowMore'].includes(v.cursorType)&&typeof v.value==='string')next=v.value;
  if(v.tweet_results){
   const t=unwrap(v.tweet_results.result),r=row(t);
   if(r){const prior=rows.get(r.id);rows.set(r.id,{...r,is_pinned:pinned||prior?.is_pinned||false,entry_id:entryId});
    for(const sub of [t.quoted_status_result?.result,t.legacy?.retweeted_status_result?.result]){const rel=row(sub);if(rel)related.set(rel.id,rel);}
   }else skipped.push({entry_id:entryId,type:t?.__typename||'unknown'});
   return; // Never recurse into quote/repost payload as top-level timeline events.
  }
  for(const c of Object.values(v))if(c&&typeof c==='object')visit(c,pinned,entryId);
 }
 visit(instructions);
 return {ok:true,posts:[...rows.values()],related_posts:[...related.values()],next_cursor:next,has_next:!!next,end_reason:next?null:terminated?'server_terminated':'no_cursor',skipped};
}
export async function run(args){
 const mode=args.mode||'tweets',name=String(args.username||'').replace(/^@/,'');
 if(!/^[A-Za-z0-9_]{1,15}$/.test(name)||!['profile','tweets','replies','search','detail'].includes(mode))return {ok:false,failure:{code:'INVALID_REQUEST'}};
 const count=Number(args.page_size??20);if(!Number.isInteger(count)||count<1||count>100)return {ok:false,failure:{code:'INVALID_PAGE_SIZE'}};
 if(mode!=='profile'&&!/^\d+$/.test(String(args.user_id||'')))return {ok:false,failure:{code:'USER_ID_REQUIRED'}};
 if(mode==='detail'&&!/^\d+$/.test(String(args.tweet_id||'')))return {ok:false,failure:{code:'TWEET_ID_REQUIRED'}};
 if(mode==='search'&&!args.query)return {ok:false,failure:{code:'QUERY_REQUIRED'}};
 if(location.hostname!=='x.com')return {ok:false,failure:{code:'WRONG_ORIGIN'}};
 const ct=document.cookie.split(';').map(x=>x.trim()).find(x=>x.startsWith('ct0='))?.slice(4);
 if(!ct)return {ok:false,failure:{code:'AUTH_REQUIRED'}};
 const operation={profile:'UserByScreenName',tweets:'UserTweets',replies:'UserTweetsAndReplies',search:'SearchTimeline',detail:'TweetResultByRestId'}[mode];
 const page={evaluate:async(fn,...a)=>fn(...a)};
 const cache=window.__bbHistoryMetadata||(window.__bbHistoryMetadata={});
 let op=cache[operation]?.op;
 if(!op||Date.now()-cache[operation].at>3600000){
  const fallback={queryId:{profile:'IGgvgiOx4QZndDHuD3x9TQ',tweets:'lrMzG9qPQHpqJdP3AbM-bQ',replies:'qUpkZU6eN8MbtQb7rC_pYg',search:'Yw6L66Pw54NHKuq4Dp7b4Q',detail:'7xflPyRiUxGVbJd4uWmbfg'}[mode]};
  op=await resolveTwitterOperationMetadata(page,operation,fallback);cache[operation]={op,at:Date.now()};
 }
 let url,init={headers:{Authorization:`Bearer ${decodeURIComponent(TWITTER_BEARER_TOKEN)}`,'X-Csrf-Token':ct,'X-Twitter-Auth-Type':'OAuth2Session','X-Twitter-Active-User':'yes','Content-Type':'application/json'},credentials:'include'};
 if(mode==='profile')url=buildUserByScreenNameUrl(op,name);
 else if(mode==='detail'){const params=new URLSearchParams({variables:JSON.stringify({tweetId:String(args.tweet_id),withCommunity:false,includePromotedContent:false,withVoice:false}),features:JSON.stringify({...op.features,longform_notetweets_consumption_enabled:true,responsive_web_twitter_article_tweet_consumption_enabled:true,longform_notetweets_rich_text_read_enabled:true,longform_notetweets_inline_media_enabled:true,articles_preview_enabled:true}),fieldToggles:JSON.stringify({...op.fieldToggles,withArticleRichContentState:true,withArticlePlainText:true})});url=`/i/api/graphql/${op.queryId}/TweetResultByRestId?${params}`;}
 else if(mode==='search'){url=`/i/api/graphql/${op.queryId}/SearchTimeline`;init.method='POST';init.body=JSON.stringify({variables:{rawQuery:args.query,count,product:'Latest',querySource:'typed_query',...(args.cursor?{cursor:args.cursor}:{})},features:op.features,fieldToggles:op.fieldToggles});}
 else{url=buildUserTweetsUrl(op,String(args.user_id),count,args.cursor).replace('/UserTweets?',`/${operation}?`);if(mode==='replies'){const u=new URL(url,location.origin),v=JSON.parse(u.searchParams.get('variables'));v.withCommunity=true;u.searchParams.set('variables',JSON.stringify(v));init.method='POST';init.body=JSON.stringify({variables:v,features:op.features,fieldToggles:op.fieldToggles});url=u.pathname;}}
 let response,raw,bodyLength=0;
 try{response=await fetch(url,init);}catch(e){return {ok:false,failure:{code:'NETWORK_ERROR',message:String(e)},operation,adapter_version:VERSION};}
 try{const body=await response.text();bodyLength=body.length;raw=JSON.parse(body);}catch{}
 const rate=Object.fromEntries(['x-rate-limit-remaining','x-rate-limit-reset','x-rate-limit-limit','retry-after'].map(k=>[k,response.headers.get(k)]).filter(([,v])=>v!==null));
 const meta={operation,request_method:init.method||'GET',http_status:response.status,rate_limit:rate,adapter_version:VERSION,raw_response:raw??null,response_bytes:bodyLength,content_type:response.headers.get('content-type'),fetched_at:new Date().toISOString()};
 if(raw==null){delete cache[operation];return {...meta,ok:false,failure:{code:response.ok?'INVALID_JSON':'HTTP_'+response.status}};}
 if(!response.ok||raw.errors?.length){delete cache[operation];return {...meta,ok:false,failure:{code:!response.ok?'HTTP_'+response.status:'GRAPHQL_ERROR',errors:raw.errors||[]}};}
 if(mode==='profile'){const u=raw?.data?.user?.result;if(!u?.rest_id)return {...meta,ok:false,failure:{code:'USER_UNAVAILABLE'}};return {...meta,ok:true,user:{id:String(u.rest_id),username:u.core?.screen_name||u.legacy?.screen_name||name,name:u.core?.name||u.legacy?.name,bio:u.profile_bio?.description||u.legacy?.description,created_at:u.core?.created_at||u.legacy?.created_at,posts_count:u.tweet_counts?.tweets??u.legacy?.statuses_count}};}
 if(mode==='detail'){const r=row(raw?.data?.tweetResult?.result);if(!r||r.id!==String(args.tweet_id))return {...meta,ok:false,failure:{code:'DETAIL_UNAVAILABLE'}};return {...meta,ok:true,user_id:String(args.user_id),cursor_in:null,next_cursor:null,posts:[{...r,text_quality:'detail',needs_detail:false}],related_posts:[]};}
 const parsed=parsePage(raw,mode);if(!parsed.ok)return {...meta,ok:false,failure:{code:parsed.code,user_type:parsed.user_type}};
 return {...meta,...parsed,user_id:String(args.user_id),cursor_in:args.cursor||null};
}
