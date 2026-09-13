#!/usr/bin/env python3
"""Install only the one-page history adapter. No archive CLI or storage runtime."""
import argparse,datetime,hashlib,json,os,pathlib,shutil,tempfile,uuid
ROOT=pathlib.Path(__file__).resolve().parent;REPO=ROOT.parent.parent

def install():
 p=argparse.ArgumentParser();p.add_argument('--check',action='store_true');p.add_argument('--bb-home',type=pathlib.Path,default=pathlib.Path.home()/'.bb-browser');p.add_argument('--bin-dir',type=pathlib.Path,default=pathlib.Path.home()/'.local/bin');a=p.parse_args()
 pairs=[(REPO/'twitter/history-page.js',a.bb_home/'sites/twitter/history-page.js')]
 manifest=json.loads((ROOT/'manifest.json').read_text());plan=[]
 for src,dst in pairs:
  data=src.read_bytes();assert hashlib.sha256(data).hexdigest()==manifest['files'][src.relative_to(REPO).as_posix()],'Manifest mismatch; rebuild history tools'
  plan.append((dst,data,False))
 changed=[(dst,data,exe) for dst,data,exe in plan if dst.is_symlink() or not dst.exists() or dst.read_bytes()!=data or exe and not os.access(dst,os.X_OK)]
 if a.check:print(json.dumps({'history_ok':not changed,'differences':[str(x[0]) for x in changed]}));return int(bool(changed))
 backup=a.bb_home/'x-history-backups'/(datetime.datetime.now().strftime('%Y%m%d-%H%M%S')+'-'+uuid.uuid4().hex[:8]);mapping=[]
 for dst,data,exe in changed:
  dst.parent.mkdir(parents=True,exist_ok=True)
  if dst.exists() or dst.is_symlink():
   backup.mkdir(parents=True,exist_ok=True);target=backup/(str(len(mapping))+'-'+dst.name);shutil.copy2(dst,target,follow_symlinks=False);mapping.append({'destination':str(dst),'backup':str(target)})
  fd,tmp=tempfile.mkstemp(dir=dst.parent,prefix='.history-')
  with os.fdopen(fd,'wb') as f:f.write(data)
  os.chmod(tmp,0o755 if exe else 0o644);os.replace(tmp,dst)
 if mapping:(backup/'restore.json').write_text(json.dumps(mapping,indent=2))
 print(json.dumps({'history_installed':True,'changed_files':len(changed),'backup':str(backup) if mapping else None}))
 return 0
if __name__=='__main__':raise SystemExit(install())
