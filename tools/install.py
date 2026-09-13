#!/usr/bin/env python3
"""Install the develop branch's X read suite and YouTube transcript adapter."""
from pathlib import Path
import runpy

runpy.run_path(str(Path(__file__).resolve().parent / 'x-read/install.py'), run_name='__main__')
