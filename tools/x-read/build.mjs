import {fileURLToPath} from 'node:url';import fs from 'node:fs';import path from 'node:path';import {build} from 'esbuild';
const root=path.dirname(fileURLToPath(import.meta.url));const defs=JSON.parse(fs.readFileSync(root+'/commands.json')).filter(x=>x.access==='read'&&x.name!=='whoami');
const aliases={'@jackwener/opencli/errors':'errors.js','@jackwener/opencli/registry':'registry.js','@jackwener/opencli/utils':'utils.js','@jackwener/opencli/download':'download.js','@jackwener/opencli/download/media-download':'download.js','node:fs':'fs.js','node:path':'path.js','node:os':'os.js'};
const plugin={name:'private-browser-port',setup(b){b.onResolve({filter:/.*/},a=>aliases[a.path]?{path:root+'/src/shims/'+aliases[a.path]}:null);}};
for(const d of defs){
 const result=await build({stdin:{contents:`import './src/upstream/${d.name}.js';export {runRead} from './src/runtime.js';`,resolveDir:root},bundle:true,format:'iife',globalName:'XRead',platform:'browser',write:false,plugins:[plugin],minify:false,treeShaking:true});
 const meta={name:'twitter/read-'+d.name,description:d.name==='download'?'Discover X media URLs only; filesystem download is separate':'Private BB read adapter: '+d.description,domain:'x.com',readOnly:true,args:{request:{required:false,description:'JSON object containing original OpenCLI argument names and values; avoids BB global flag collisions'}},example:'bb-browser site twitter/read-'+d.name+' --json'};
 const text='/* @meta\n'+JSON.stringify(meta,null,2)+'\n*/\n// Private browser port of OpenCLI X read adapter (Apache-2.0). See tools/x-read/OPENCLI-LICENSE.txt and tools/x-read/NOTICE.md.\nasync function(args){\nif(args.request){try{args=JSON.parse(args.request);}catch(e){return {ok:false,failure:{code:"INVALID_REQUEST_JSON",message:e.message}};}}\n'+result.outputFiles[0].text+'\nreturn XRead.runRead('+JSON.stringify(d.name)+',args);\n}\n';
 fs.writeFileSync(root+'/../../twitter/read-'+d.name+'.js',text);console.log(d.name,text.length);
}

fs.copyFileSync(root+'/src/whoami-adapter.js',root+'/../../twitter/read-whoami.js');

await import('./write-manifest.mjs');
