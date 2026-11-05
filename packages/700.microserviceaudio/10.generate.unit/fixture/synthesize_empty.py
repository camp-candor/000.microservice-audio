import os
import sys

out = ''
args = sys.argv[1:]
i = 0
while i < len(args):
    if args[i] == '--output' and i + 1 < len(args):
        out = args[i + 1]
        i += 2
    else:
        i += 1

if out:
    parent = os.path.dirname(out)
    if parent:
        os.makedirs(parent, exist_ok=True)
    with open(out, 'wb') as f:
        pass

print('>> [PYTHON] demo stall ok')
sys.exit(0)
