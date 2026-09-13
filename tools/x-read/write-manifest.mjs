import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(root,'../..');
const defs=JSON.parse(fs.readFileSync(path.join(root,'commands.json'),'utf8'));
const names=[...defs.map(d=>'twitter/read-'+d.name+'.js'),'twitter/_helper.js',
  ...['xread.py','commands.json','OPENCLI-LICENSE.txt','NOTICE.md'].map(n=>'tools/x-read/'+n)];
const files=Object.fromEntries(names.sort().map(n=>[n,crypto.createHash('sha256').update(fs.readFileSync(path.join(repo,n))).digest('hex')]));
fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify({version:1,files},null,2)+'\n');
