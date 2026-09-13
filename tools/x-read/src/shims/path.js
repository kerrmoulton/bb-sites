export const resolve=(...parts)=>parts.join('/');export const join=resolve;
export const extname=s=>s.match(/\.[^/.]+$/)?.[0]||'';
export const dirname=s=>s.split('/').slice(0,-1).join('/');export const basename=s=>s.split('/').at(-1);
export default {resolve,join,extname,dirname,basename};
