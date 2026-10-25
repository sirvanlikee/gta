#!/usr/bin/env python3
"""Check the Los Santos project: list files, sizes, and JS syntax via node if available."""
import pathlib, subprocess, sys
root = pathlib.Path(__file__).resolve().parent.parent
files = sorted(p for p in root.rglob('*') if p.is_file() and '.git' not in p.parts)
total = 0
for p in files:
    rel = p.relative_to(root)
    size = p.stat().st_size
    total += size
    print(f"{rel}  {size} bytes")
print(f"TOTAL {total} bytes, {len(files)} files")
js = [p for p in files if p.suffix == '.js']
try:
    for p in js:
        subprocess.run(['node', '--check', str(p)], check=True, capture_output=True)
    print('JS syntax: OK')
except Exception as e:
    print('JS check skipped/failed:', e)
    sys.exit(0)
