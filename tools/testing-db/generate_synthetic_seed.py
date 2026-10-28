# Compatibility entry point for the centralized Testing fixture generator.
from pathlib import Path
import runpy
runpy.run_path(str(Path(__file__).resolve().parents[1] / 'testing' / 'db' / 'generate_synthetic_seed.py'), run_name='__main__')
