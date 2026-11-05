import os
import struct
import sys
import time

SAMPLE_COUNT = 48000
HOT_AMPLITUDE = 0.95

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
    int_val = int(HOT_AMPLITUDE * 32767)
    data = bytearray(SAMPLE_COUNT * 2)
    for s in range(SAMPLE_COUNT):
        struct.pack_into('<h', data, s * 2, int_val)
    header = struct.pack(
        '<4sI4s4sIHHIIHH4sI',
        b'RIFF',
        36 + SAMPLE_COUNT * 2,
        b'WAVE',
        b'fmt ',
        16,
        1,
        1,
        48000,
        48000 * 2,
        2,
        16,
        b'data',
        SAMPLE_COUNT * 2,
    )
    with open(out, 'wb') as f:
        f.write(header)
        half = len(data) // 2
        f.write(data[:half])
        f.flush()
        time.sleep(0.2)
        f.write(data[half:])

print('>> [PYTHON] demo loud synthesis ok')
sys.exit(0)
