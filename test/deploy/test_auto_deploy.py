"""Exercise the actual release dispatch shell step without contacting GitHub."""
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import textwrap
import unittest

ROOT = Path(__file__).resolve().parents[2]


class AutoDeployTest(unittest.TestCase):
    def run_dispatch(self, enabled, gh_exit=0):
        workflow = (ROOT / '.github/workflows/identity-release.yml').read_text()
        job = workflow.split('\n  auto-deploy:\n', 1)[1]
        self.assertIn('needs: publish', job)
        self.assertIn('environment: prod', job)
        self.assertIn('ENABLE_DEPLOY: ${{ vars.ENABLE_IDENTITY_DEPLOY }}', job)
        script = textwrap.dedent(re.search(r'        run: \|\n((?:          .*\n|\n)+)', job)[1])
        with tempfile.TemporaryDirectory() as directory:
            directory = Path(directory)
            gh = directory / 'gh'
            gh.write_text('#!/usr/bin/env python3\nimport json,os,sys\n'
                          'from pathlib import Path\n'
                          'Path(os.environ["CALLS"]).write_text(json.dumps(sys.argv[1:]))\n'
                          'sys.exit(int(os.environ["GH_EXIT"]))\n')
            gh.chmod(0o700)
            calls = directory / 'calls.json'
            summary = directory / 'summary'
            result = subprocess.run(['bash', '-c', script], env={**os.environ,
                'PATH': str(directory) + os.pathsep + os.environ['PATH'],
                'ENABLE_DEPLOY': enabled, 'RELEASE_TAG': 'identity-v1.2.3',
                'GITHUB_REPOSITORY': 'hemia-labs/identity', 'CALLS': str(calls),
                'GITHUB_STEP_SUMMARY': str(summary), 'GH_EXIT': str(gh_exit)},
                text=True, capture_output=True)
            return result, json.loads(calls.read_text()) if calls.exists() else None, (
                summary.read_text() if summary.exists() else '')

    def test_dispatches_only_deploy_on_main_for_published_tag(self):
        result, calls, summary = self.run_dispatch('true')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(calls, ['workflow', 'run', 'deploy.yml', '--repo',
            'hemia-labs/identity', '--ref', 'main', '-f', 'operation=deploy',
            '-f', 'release_tag=identity-v1.2.3'])
        self.assertIn('Check the Identity deployment run', summary)

    def test_disabled_or_missing_flag_does_not_dispatch(self):
        for enabled in ['', 'false', 'TRUE']:
            with self.subTest(enabled=enabled):
                result, calls, summary = self.run_dispatch(enabled)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertIsNone(calls)
                self.assertIn('disabled in prod', summary)

    def test_dispatch_failure_is_not_reported_as_success(self):
        result, calls, summary = self.run_dispatch('true', gh_exit=1)
        self.assertNotEqual(result.returncode, 0)
        self.assertIsNotNone(calls)
        self.assertNotIn('Automatic deployment requested', summary)


if __name__ == '__main__':
    unittest.main()
