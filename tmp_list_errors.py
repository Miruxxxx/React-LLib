from pathlib import Path
lines = Path('backend/server.js').read_text(encoding='utf-8').splitlines()
for idx, line in enumerate(lines):
    if "throw new Error(" in line:
        print(idx, line)
