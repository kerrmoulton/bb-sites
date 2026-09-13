// Browser adapter returns media discovery; filesystem downloading is separate.
export const formatCookieHeader=()=>'';
export async function downloadMedia(items){return items.map((item,i)=>({...item,index:i+1,status:'discovered',size:null}));}
