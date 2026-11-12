import zipfile, os
z = zipfile.ZipFile('out.hwpx', 'w')
z.write('orig2/mimetype', 'mimetype', compress_type=zipfile.ZIP_STORED)
for d, _, fs in os.walk('orig2'):
    for f in fs:
        p = os.path.join(d, f)
        a = os.path.relpath(p, 'orig2').replace(os.sep, '/')
        if a != 'mimetype':
            z.write(p, a, compress_type=zipfile.ZIP_DEFLATED)
z.close()
