#!/usr/bin/env python3
"""Run the fork's X read adapters with JSON validation and retained raw output."""
import argparse
import datetime
import json
import os
from pathlib import Path
import subprocess
import sys
import uuid

ROOT = Path(__file__).resolve().parent
DEFS = {d['name']: d for d in json.loads((ROOT / 'commands.json').read_text())}


def command_args(name, request):
    if name not in DEFS or DEFS[name]['access'] != 'read':
        raise ValueError('Not a supported read command')
    return ['bb-browser', 'site', 'twitter/read-' + name,
            json.dumps(request, ensure_ascii=False, separators=(',', ':')), '--json']


def classify(obj, exit_code):
    if exit_code:
        return exit_code, 'BB_CLI_EXIT'
    if not isinstance(obj, dict):
        return 1, 'INVALID_ENVELOPE'
    result = obj.get('result', obj)
    if not isinstance(result, dict):
        return 1, 'INVALID_ENVELOPE'
    if result.get('ok') is not True:
        failure = result.get('failure') or {}
        code = failure.get('code', 'INVALID_ENVELOPE') if isinstance(failure, dict) else 'INVALID_ENVELOPE'
        if code == 'HTTP_429' or any(t.get('status') == 429 for t in result.get('trace', []) if isinstance(t, dict)):
            return 75, code
        if code == 'EmptyResultError':
            return 66, code
        if code in ('AuthRequiredError', 'AUTH_OR_PROFILE_LINK_MISSING'):
            return 77, code
        return 1, code
    data = result.get('data')
    if not isinstance(data, (list, dict)):
        return 1, 'INVALID_DATA'
    rows = data if isinstance(data, list) else data.get('posts', [])
    if not isinstance(rows, list) or any(not isinstance(r, dict) for r in rows):
        return 1, 'INVALID_ROWS'
    keys = [str(r.get('id') or r.get('screen_name') or '') for r in rows]
    keys = [k for k in keys if k]
    if len(keys) != len(set(keys)):
        return 1, 'DUPLICATE_IDS'
    return 0, None


def make_parser():
    parser = argparse.ArgumentParser(description=__doc__)
    subs = parser.add_subparsers(dest='command', required=True)
    for name, definition in DEFS.items():
        description = ('Discover media URLs only; does not download files.'
                       if name == 'download' else definition['description'])
        sub = subs.add_parser(name, help=description, description=description)
        sub.add_argument('--save-raw', type=Path, help='New raw result path (existing output is never overwritten)')
        sub.add_argument('--timeout-seconds', type=int, default=180)
        for spec in definition['args']:
            key = spec['name']
            options = {'help': spec.get('help') or key, 'default': None}
            if spec.get('choices'):
                options['choices'] = spec['choices']
            if spec.get('type') == 'int':
                options['type'] = int
            if spec.get('positional'):
                if not spec.get('required'):
                    options['nargs'] = '?'
                sub.add_argument(key, **options)
            else:
                options['dest'] = key
                if spec.get('required'):
                    options['required'] = True
                if spec.get('type') == 'bool' or isinstance(spec.get('default'), bool):
                    options.update(nargs='?', const='true')
                sub.add_argument('--' + key, **options)
    return parser


def main():
    parser = make_parser()
    values = vars(parser.parse_args())
    name = values.pop('command')
    destination = values.pop('save_raw')
    timeout = values.pop('timeout_seconds')
    if timeout < 1:
        parser.error('--timeout-seconds must be positive')
    request = {k: v for k, v in values.items() if v is not None}
    if destination is None:
        output_root = Path(os.environ.get('BB_XREAD_OUTPUT_DIR', str(Path.home() / '.bb-browser/x-read/outputs')))
        stamp = datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
        destination = output_root / f'{stamp}-{name}-{uuid.uuid4().hex[:8]}.json'
    destination = destination.expanduser().absolute()
    stderr = destination.with_name(destination.name + '.stderr.txt')
    summary = destination.with_name(destination.name + '.summary.json')
    if any(f.exists() or f.is_symlink() for f in (destination, stderr, summary)):
        parser.error('Refusing to overwrite existing output')
    destination.parent.mkdir(parents=True, exist_ok=True)
    started = datetime.datetime.now().astimezone().isoformat()
    # A regular stdout file avoids BB CLI's observed large-pipe truncation.
    with destination.open('x') as out, stderr.open('x') as err:
        try:
            code = subprocess.run(command_args(name, request), stdout=out, stderr=err, timeout=timeout).returncode
        except subprocess.TimeoutExpired:
            code = 124
        except OSError as exc:
            code = 127
            err.write(str(exc))
    obj = {}
    try:
        obj = json.loads(destination.read_text())
        status, reason = classify(obj, code)
    except (ValueError, TypeError, AttributeError) as exc:
        status, reason = code or 1, 'INVALID_JSON: ' + str(exc)
    with summary.open('x') as stream:
        json.dump({'success': status == 0, 'exit_code': status, 'reason': reason,
                   'started_at': started, 'raw_file': str(destination), 'request': request,
                   'retry_count': 0}, stream, ensure_ascii=False, indent=2)
        stream.write('\n')
    print(json.dumps(obj.get('result', obj) if isinstance(obj, dict) else obj, ensure_ascii=False))
    return status


if __name__ == '__main__':
    sys.exit(main())
