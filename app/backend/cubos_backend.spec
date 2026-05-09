# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec for CubOS backend (onedir mode for fast startup)
# Build: pyinstaller cubos_backend.spec --distpath ../../dist-backend
#
# Output: dist-backend/cubos_backend/cubos_backend.exe
# This folder is copied into the Electron package as extraResources/cubos_backend/

from PyInstaller.utils.hooks import collect_submodules, collect_data_files, collect_dynamic_libs
import sys

block_cipher = None

# Collect all hidden imports
hiddenimports = (
    collect_submodules('fastapi') +
    collect_submodules('uvicorn') +
    collect_submodules('uvicorn.logging') +
    collect_submodules('uvicorn.loops') +
    collect_submodules('uvicorn.protocols') +
    collect_submodules('starlette') +
    collect_submodules('pydantic') +
    collect_submodules('pydantic_core') +
    collect_submodules('httpx') +
    collect_submodules('anyio') +
    collect_submodules('groq') +
    collect_submodules('winpty') +
    [m for m in collect_submodules('pandas') if not m.startswith('pandas.tests')] +
    [m for m in collect_submodules('numpy') if not m.startswith('numpy.tests') and not m.startswith('numpy.lib.tests') and not m.startswith('numpy.random.tests')] +
    collect_submodules('PIL') +
    collect_submodules('pypdf') +
    collect_submodules('docx') +
    collect_submodules('pptx') +
    collect_submodules('pytesseract') +
    ['email.mime.text', 'email.mime.multipart', 'email.mime.base',
     'email', 'email.utils', 'email.header',
     '_decimal', 'multipart', 'python_multipart',
     'winpty', 'winpty.ptyprocess', 'winpty.enums',
     'pandas.core.arrays.integer', 'pandas.core.arrays.floating',
     'pandas._libs.tslibs.np_datetime', 'pandas._libs.tslibs.nattype',
     'pandas._libs.tslibs.timedeltas', 'pandas._libs.tslibs.timestamps',
     'numpy.core._multiarray_umath', 'numpy.core._multiarray_tests']
)

datas = (
    collect_data_files('pandas') +
    collect_data_files('PIL') +
    collect_data_files('pypdf') +
    collect_data_files('pptx') +
    collect_data_files('docx') +
    collect_data_files('pytesseract') +
    collect_data_files('winpty', include_py_files=False)
)

# winpty needs its native DLLs (winpty.dll, conpty.dll) and helper EXEs
# (winpty-agent.exe, OpenConsole.exe) bundled or the terminal silently fails.
binaries = collect_dynamic_libs('winpty')

# collect_dynamic_libs only grabs *.dll/*.pyd; the helper exes that winpty
# spawns at runtime must be added explicitly.
import os as _os
try:
    import winpty as _winpty_mod
    _winpty_dir = _os.path.dirname(_winpty_mod.__file__)
    for _exe in ('winpty-agent.exe', 'OpenConsole.exe'):
        _path = _os.path.join(_winpty_dir, _exe)
        if _os.path.exists(_path):
            binaries.append((_path, 'winpty'))
except Exception:
    pass

a = Analysis(
    ['server.py', 'main.py'],
    pathex=['.'],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['tkinter', 'matplotlib', 'cv2',
              'scipy', 'sklearn', 'torch', 'tensorflow',
              'numba', 'llvmlite', 'whisper'],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='cubos_backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name='cubos_backend',
)
