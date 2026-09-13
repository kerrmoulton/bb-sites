#!/usr/bin/env python3
"""Install this fork's selected X and YouTube adapters."""
from pathlib import Path
import runpy
for relative in ('x-read/install.py', 'history-adapter/install.py'):
    try:
        runpy.run_path(str(Path(__file__).resolve().parent / relative), run_name='__main__')
    except SystemExit as exc:
        if exc.code:
            raise
