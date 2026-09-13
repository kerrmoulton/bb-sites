#!/usr/bin/env python3
"""Install this fork's prebuilt X adapters without changing BB Browser or Chrome."""
import argparse
import datetime
import hashlib
import json
from pathlib import Path
import os
import shutil
import subprocess
import sys
import tempfile
import uuid

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent.parent


def digest(data):
    return hashlib.sha256(data).hexdigest()


def atomic_write(destination, data, executable=False):
    destination.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(prefix='.xread-', dir=destination.parent)
    try:
        with os.fdopen(fd, 'wb') as stream:
            stream.write(data)
        os.chmod(name, 0o755 if executable else 0o644)
        os.replace(name, destination)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bb-home', type=Path, default=Path.home() / '.bb-browser')
    parser.add_argument('--bin-dir', type=Path, default=Path.home() / '.local/bin')
    parser.add_argument('--check', action='store_true', help='Verify installed bytes without changing any files')
    args = parser.parse_args()
    bb_home = args.bb_home.expanduser().absolute()
    bin_dir = args.bin_dir.expanduser().absolute()
    manifest = json.loads((ROOT / 'manifest.json').read_text())
    definitions = json.loads((ROOT / 'commands.json').read_text())
    if len(definitions) != 20 or any(d['access'] != 'read' for d in definitions):
        parser.error('Expected the 20-command read-only suite')
    plan = []
    for definition in definitions:
        name = definition['name']
        if not name or any(c not in 'abcdefghijklmnopqrstuvwxyz-' for c in name):
            parser.error('Invalid command name')
        plan.append((REPO / 'twitter' / f'read-{name}.js', bb_home / 'sites/twitter' / f'read-{name}.js'))
    plan.append((REPO / 'twitter/_helper.js', bb_home / 'sites/twitter/_helper.js'))
    for name in ('xread.py', 'commands.json', 'OPENCLI-LICENSE.txt', 'NOTICE.md'):
        plan.append((ROOT / name, bb_home / 'x-read' / name))
    prepared = []
    # Validate every source before touching an existing installation.
    for source, target in plan:
        data = source.read_bytes()
        relative = source.relative_to(REPO).as_posix()
        if manifest['files'].get(relative) != digest(data):
            parser.error('Manifest mismatch: ' + relative + '; rebuild the suite before installing')
        if target.exists() and not target.is_file():
            parser.error('Destination is not a file: ' + str(target))
        prepared.append((target, data, False))
    runtime = bb_home / 'x-read/xread.py'
    launcher = ('#!/usr/bin/env python3\nimport runpy\n'
                "runpy.run_path(" + repr(str(runtime)) + ", run_name='__main__')\n").encode()
    prepared.append((bin_dir / 'bb-xread', launcher, True))
    changed = [(target, data, mode) for target, data, mode in prepared
               if target.is_symlink() or not target.exists() or target.read_bytes() != data
               or (mode and not os.access(target, os.X_OK))]
    if args.check:
        print(json.dumps({'ok': not changed, 'differences': [str(t) for t, _, _ in changed]}, indent=2))
        return int(bool(changed))
    stamp = datetime.datetime.now().strftime('%Y%m%d-%H%M%S') + '-' + uuid.uuid4().hex[:8]
    backup = bb_home / 'x-read-backups' / stamp
    previous = []
    for index, (target, _, _) in enumerate(changed):
        if target.exists() or target.is_symlink():
            backup.mkdir(parents=True, exist_ok=True)
            saved = backup / f'{index:02}-{target.name}'
            if target.is_symlink():
                # Preserve the link itself rather than reading an unrelated target.
                saved.symlink_to(os.readlink(target))
            else:
                shutil.copy2(target, saved)
            previous.append({'destination': str(target), 'backup': str(saved)})
    if previous:
        (backup / 'restore-map.json').write_text(json.dumps(previous, indent=2) + '\n')
    for target, data, executable in changed:
        atomic_write(target, data, executable)
    version = subprocess.run(['git', '-C', str(REPO), 'rev-parse', 'HEAD'], capture_output=True, text=True)
    receipt = {'installed_at': datetime.datetime.now().astimezone().isoformat(),
               'source': 'https://github.com/kerrmoulton/bb-sites',
               'commit': version.stdout.strip() if version.returncode == 0 else None,
               'manifest_sha256': digest((ROOT / 'manifest.json').read_bytes()),
               'adapter_count': 20, 'changed_files': len(changed),
               'backup': str(backup) if previous else None,
               'files': {str(t): digest(data) for t, data, _ in prepared}}
    atomic_write(bb_home / 'x-read/installation.json', (json.dumps(receipt, indent=2) + '\n').encode())
    print(json.dumps({'ok': True, 'adapter_count': 20, 'changed_files': len(changed),
                      'backup': receipt['backup'], 'command': str(bin_dir / 'bb-xread')}, indent=2))
    print('Try: ' + str(bin_dir / 'bb-xread') + ' tweets follow_clues --limit 20')
    return 0


if __name__ == '__main__':
    sys.exit(main())
