import {build} from '../x-read/node_modules/esbuild/lib/main.js';
import fs from 'node:fs';import {fileURLToPath} from 'node:url';import path from 'node:path';
const root=path.dirname(fileURLToPath(import.meta.url));
const aliases={'@jackwener/opencli/errors':'errors.js','@jackwener/opencli/registry':'registry.js','@jackwener/opencli/utils':'utils.js','@jackwener/opencli/download':'download.js','node:fs':'fs.js','node:path':'path.js','node:os':'os.js'};
const plugin={name:'aliases',setup(b){b.onResolve({filter:/.*/},a=>aliases[a.path]?{path:path.resolve(root,'../x-read/src/shims',aliases[a.path])}:null);}};
const r=await build({entryPoints:[root+'/page.js'],bundle:true,format:'iife',globalName:'HistoryPage',platform:'browser',write:false,plugins:[plugin]});
const meta={name:'twitter/history-page',description:'One read-only X history page with cursor and rate metadata',domain:'x.com',readOnly:true,args:{request:{required:true,description:'JSON request'}}};
fs.writeFileSync(root+'/../../twitter/history-page.js','/* @meta\n'+JSON.stringify(meta,null,2)+'\n*/\nasync function(args){\n'+r.outputFiles[0].text+'\ntry{return await HistoryPage.run(JSON.parse(args.request));}catch(e){return {ok:false,failure:{code:"ADAPTER_EXCEPTION",message:e.message}};}\n}\n');

const crypto=await import("node:crypto");
const files=["twitter/history-page.js"];
fs.writeFileSync(root+"/manifest.json",JSON.stringify({version:1,files:Object.fromEntries(files.map(n=>[n,crypto.createHash("sha256").update(fs.readFileSync(path.resolve(root,"../..",n))).digest("hex")]))},null,2)+"\n");
