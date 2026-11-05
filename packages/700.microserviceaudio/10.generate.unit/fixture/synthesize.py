import os
import struct
import sys
import time

SAMPLE_COUNT = 100000
HOT_SAMPLES = 4903
PEAK_AMPLITUDE = 0.7586

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
    int_val = int(PEAK_AMPLITUDE * 32767)
    data = bytearray(SAMPLE_COUNT * 2)
    for s in range(HOT_SAMPLES):
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
        time.sleep(0.3)
        f.write(data[half:])

print('>> [PYTHON] demo synthesis ok')
sys.exit(0)
