import json
import hashlib
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parent.parent
catalogue_path = root / 'catalogue.json'
catalogue = json.loads(catalogue_path.read_text())
entry = next(x for x in catalogue['modules'] if x['file'] == 'modules/Synthetiq-Flux-1.0.0.zip')
old = root / entry['file']
new = root / 'modules/Synthetiq-Flux-1.0.1.zip'
assert not new.exists()
with ZipFile(old) as src, ZipFile(new, 'w', ZIP_DEFLATED) as dst:
    for item in src.infolist():
        data = src.read(item.filename)
        if item.filename == 'module.json':
            manifest = json.loads(data)
            manifest['moduleVersion'] = '1.0.1'
            manifest['presentation']['recommended'] = True
            manifest['config']['presentation']['recommended'] = True
            data = (json.dumps(manifest, indent=2) + '\n').encode()
        dst.writestr(item, data)
with ZipFile(old) as src, ZipFile(new) as dst:
    assert src.namelist() == dst.namelist()
    for name in src.namelist():
        if name != 'module.json':
            assert src.read(name) == dst.read(name), name
    print('Unchanged playback SHA256:', hashlib.sha256(dst.read('index.js')).hexdigest())
entry['file'] = 'modules/' + new.name
entry['presentation']['recommended'] = True
entry['changelog'].insert(0, '1.0.1: Metadata-only Recommended visibility fix for ZIP and repository installs. Playback JavaScript unchanged from 1.0.0.')
flux_index = catalogue['modules'].index(entry)
anime_index = next(i for i,x in enumerate(catalogue['modules']) if 'Synthetiq-Anime-1.0.2.zip' in x['file'])
assert flux_index == anime_index + 1
catalogue['bundleVersion'] += 1
catalogue['bundleFile'] = f"bundles/Synthetiq-Module-Bundle-{catalogue['bundleVersion']}.zip"
with ZipFile(root / catalogue['bundleFile'], 'w', ZIP_DEFLATED) as bundle:
    for module in catalogue['modules']:
        package = root / module['file']
        bundle.write(package, package.name)
catalogue_path.write_text(json.dumps(catalogue, indent=2) + '\n')
print('Metadata and bundle validated:', new.name, catalogue['bundleVersion'])
