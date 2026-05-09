import struct, zlib

def make_png(width, height, color_rgb):
    def mk_chunk(name, data):
        crc = zlib.crc32(name + data) & 0xffffffff
        return struct.pack('>I', len(data)) + name + data + struct.pack('>I', crc)

    r, g, b = color_rgb
    raw = b''.join(b'\x00' + bytes([r, g, b] * width) for _ in range(height))
    ihdr = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)
    idat = zlib.compress(raw)
    png = b'\x89PNG\r\n\x1a\n'
    png += mk_chunk(b'IHDR', ihdr)
    png += mk_chunk(b'IDAT', idat)
    png += mk_chunk(b'IEND', b'')
    return png

png_data = make_png(256, 256, (139, 92, 246))
with open(r'app\frontend\public\icon.png', 'wb') as f:
    f.write(png_data)
print('icon.png written', len(png_data), 'bytes')
