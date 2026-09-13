/* @meta
{"name":"twitter/read-whoami","description":"Identify the active X account from its own browser profile link; no credential export","domain":"x.com","readOnly":true,"args":{},"example":"bb-browser site twitter/read-whoami --json"}
*/
async function(args){
 const hasSession=document.cookie.split(';').some(v=>v.trim().startsWith('ct0='));
 const link=document.querySelector('a[data-testid="AppTabBar_Profile_Link"]');const handle=link?.getAttribute('href')?.split('/').filter(Boolean)[0];
 if(!hasSession||!handle)return {ok:false,failure:{code:'AUTH_OR_PROFILE_LINK_MISSING',message:'Check X login and profile navigation link'}};
 return {ok:true,data:{logged_in:true,site:'twitter',username:handle,screen_name:handle,url:'https://x.com/'+handle},implementation:'private_bb_browser_adapter'};
}
