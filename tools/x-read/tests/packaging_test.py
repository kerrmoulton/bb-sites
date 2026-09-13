import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
import xread


class DriverTests(unittest.TestCase):
    def test_arguments_are_one_json_value(self):
        request = {'query': '#AI 中文', 'limit': 3, 'product': 'live'}
        command = xread.command_args('search', request)
        self.assertEqual(json.loads(command[3]), request)
        self.assertNotIn('--limit', command)

    def test_write_commands_rejected(self):
        with self.assertRaises(ValueError):
            xread.command_args('post', {'text': 'not allowed'})

    def test_failure_even_when_bb_exit_zero(self):
        self.assertEqual(xread.classify({'result': {'ok': False, 'failure': {'code': 'HTTP_429'}}}, 0)[0], 75)
        self.assertEqual(xread.classify({'result': {'ok': False, 'failure': {'code': 'EmptyResultError'}}}, 0)[0], 66)
        self.assertEqual(xread.classify({'result': {'ok': False, 'failure': {'code': 'AuthRequiredError'}}}, 0)[0], 77)

    def test_invalid_or_duplicate_data(self):
        for obj in ([], {'result': []}, {'ok': True}, {'ok': True, 'data': {'posts': 'bad'}},
                    {'ok': True, 'data': [{'id': '1'}, {'id': '1'}]}):
            self.assertNotEqual(xread.classify(obj, 0)[0], 0)

    def fake_bb(self, directory, result):
        binary = directory / 'bb-browser'
        payload = directory / 'payload.json'
        payload.write_text(json.dumps(result))
        binary.write_text('#!' + sys.executable + '\n'
                          'import json, os, stat, sys\n'
                          'assert stat.S_ISREG(os.fstat(1).st_mode), "BB stdout must be a regular file"\n'
                          'assert sys.argv[1:3] == ["site", "twitter/read-tweets"]\n'
                          'assert json.loads(sys.argv[3])["username"] == "fixture_user"\n'
                          'print(open(' + repr(str(payload)) + ').read())\n')
        binary.chmod(0o755)
        return dict(os.environ, PATH=str(directory) + os.pathsep + os.environ.get('PATH', ''))

    def test_large_json_preserved_and_no_overwrite(self):
        with tempfile.TemporaryDirectory(prefix='xread test ') as directory:
            base = Path(directory)
            result = {'result': {'ok': True, 'data': [{'id': '1', 'text': '中文😀' * 30000}]}}
            env = self.fake_bb(base, result)
            raw = base / 'result.json'
            command = [sys.executable, str(ROOT / 'xread.py'), 'tweets', 'fixture_user', '--save-raw', str(raw)]
            r = subprocess.run(command, capture_output=True, text=True, env=env)
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertGreater(raw.stat().st_size, 65536)
            self.assertEqual(json.loads(raw.read_text()), result)
            self.assertEqual(json.loads(r.stdout), result['result'])
            original = raw.read_bytes()
            again = subprocess.run(command, capture_output=True, text=True, env=env)
            self.assertEqual(again.returncode, 2)
            self.assertEqual(raw.read_bytes(), original)

    def test_failed_envelope_preserves_partial_results(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            result = {'result': {'ok': False, 'failure': {'code': 'HTTP_429'}, 'partial_data': [{'id': '1'}]}}
            env = self.fake_bb(base, result)
            raw = base / 'failed.json'
            r = subprocess.run([sys.executable, str(ROOT / 'xread.py'), 'tweets', 'fixture_user',
                                '--save-raw', str(raw)], env=env, capture_output=True, text=True)
            self.assertEqual(r.returncode, 75)
            self.assertEqual(json.loads(raw.read_text()), result)
            self.assertFalse(json.loads(raw.with_name(raw.name + '.summary.json').read_text())['success'])


class InstallTests(unittest.TestCase):
    def test_install_backup_repeat_check_and_independent_launcher(self):
        with tempfile.TemporaryDirectory(prefix='bb install ') as directory:
            base = Path(directory)
            bb_home, bin_dir = base / 'bb', base / 'bin'
            old = bb_home / 'sites/twitter/read-tweets.js'
            old.parent.mkdir(parents=True)
            old.write_text('previous-adapter')
            unrelated = bb_home / 'sites/twitter/custom.js'
            unrelated.write_text('leave alone')
            profile = bb_home / 'browser/user-data/existing-profile-marker'
            profile.parent.mkdir(parents=True)
            profile.write_text('leave profile alone')
            args = [sys.executable, str(ROOT / 'install.py'), '--bb-home', str(bb_home), '--bin-dir', str(bin_dir)]
            r = subprocess.run(args, capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertEqual(len(list((bb_home / 'sites/twitter').glob('read-*.js'))), 20)
            receipt = json.loads((bb_home / 'x-read/installation.json').read_text())
            restore = json.loads((Path(receipt['backup']) / 'restore-map.json').read_text())
            self.assertEqual(Path(restore[0]['backup']).read_text(), 'previous-adapter')
            self.assertEqual(unrelated.read_text(), 'leave alone')
            self.assertEqual(profile.read_text(), 'leave profile alone')
            self.assertEqual(subprocess.run(args + ['--check'], capture_output=True).returncode, 0)
            r = subprocess.run(args, capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertEqual(json.loads((bb_home / 'x-read/installation.json').read_text())['changed_files'], 0)
            # Run from outside the checkout: installed launcher uses only installed resources.
            r = subprocess.run([str(bin_dir / 'bb-xread'), '--help'], cwd=base, capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertIn('bookmark-folders', r.stdout)
            old.write_text('unexpected local edit')
            check = subprocess.run(args + ['--check'], capture_output=True, text=True)
            self.assertEqual(check.returncode, 1)
            self.assertEqual(old.read_text(), 'unexpected local edit')


if __name__ == '__main__':
    unittest.main()
