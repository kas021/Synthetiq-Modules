"""Publish metadata-only photo recommendation fixes, preserving module code."""
import json
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parent.parent
path = root / 'catalogue.json'
catalogue = json.loads(path.read_text())
one = next(e for e in catalogue['modules'] if e['file'].startswith('modules/Synthetiq-One-'))
updates = {'WeebCentral-4.1.10': ('WeebCentral', '4.1.11'),
           'Synthetiq-Manga-1.0.2': ('Synthetiq-Manga', '1.0.3'),
           'Atsu-4.0.4': ('Atsu', '4.0.5')}
for stem, (name, version) in updates.items():
    entry = next(e for e in catalogue['modules'] if e['file'] == f'modules/{stem}.zip')
    presentation = dict(entry['presentation'], recommended=True)
    if name == 'Synthetiq-Manga':
        presentation['iconUrl'] = one['presentation']['iconUrl']
    old = root / entry['file']
    new = root / f'modules/{name}-{version}.zip'
    assert not new.exists(), new
    with ZipFile(old) as src, ZipFile(new, 'w', ZIP_DEFLATED) as dst:
        for item in src.infolist():
            data = src.read(item.filename)
            if item.filename == 'module.json':
                manifest = json.loads(data)
                manifest['moduleVersion'] = version
                manifest['presentation'] = presentation
                manifest.setdefault('config', {})['presentation'] = presentation
                data = (json.dumps(manifest, indent=2) + '\n').encode()
            dst.writestr(item, data)
    with ZipFile(old) as src, ZipFile(new) as dst:
        assert src.namelist() == dst.namelist()
        for filename in src.namelist():
            if filename != 'module.json':
                assert src.read(filename) == dst.read(filename), filename
        actual = json.loads(dst.read('module.json'))
        assert actual['config']['presentation']['recommended'] is True
        assert actual['presentation'] == presentation
    entry['file'] = f'modules/{new.name}'
    entry['presentation'] = presentation
    entry['changelog'].insert(0, f'{version}: Metadata-only Photo Recommended visibility and embedded logo fix. Content loading code unchanged.')
    print(f'{new.name}: metadata verified; all non-manifest files byte-identical')
catalogue['bundleVersion'] += 1
catalogue['bundleFile'] = f"bundles/Synthetiq-Module-Bundle-{catalogue['bundleVersion']}.zip"
assert not (root / catalogue['bundleFile']).exists()
with ZipFile(root / catalogue['bundleFile'], 'w', ZIP_DEFLATED) as bundle:
    for entry in catalogue['modules']:
        package = root / entry['file']
        bundle.write(package, package.name)
path.write_text(json.dumps(catalogue, indent=2) + '\n')
