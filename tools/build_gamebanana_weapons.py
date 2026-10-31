"""Rebuild the locally isolated GameBanana gun candidates."""
import hashlib
import json
from pathlib import Path
from import_gamebanana_weapon import convert
from inspect_goldsrc_weapons import inspect

ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'assets/preview/gamebanana-weapons'
VOL=BASE/'sources/vol3'
GUNS=[
    ('an94','AN94','v_ak47.mdl','ak47-1.WAV','rifle',None),
    ('scar-heavy','SCAR Heavy','v_sg552.mdl','sg552-1.WAV','rifle',None),
    ('mp7','H&K MP7','v_mac10.mdl','mac10-1.WAV','smg',None),
    ('tar21','TAR-21','v_aug.mdl','aug-1.WAV','rifle',None),
    ('colt1911','Colt M1911','v_deagle.mdl','deagle-1.WAV','pistol',None),
    ('dsr1','DSR-1','v_awp.mdl','awp-1.WAV','bolt-action',None),
    ('remington870','Remington 870','v_m3.mdl','m3-1.WAV','pump-action',['reload_0','reload_1','reload_1','reload_1','reload_2']),
    ('striker','Armsel Striker','v_xm1014.mdl','xm1014-1.WAV','shotgun',['reload_0','reload_1','reload_1','reload_1','reload_2']),
]


def build():
    for name,digest in [('crossfire-pack-vol3.rar','bfa8287f11abb976b87ee25e4f2dd026'),
                        ('scarlight-baihu.rar','79c126ce900f639f72034c10f226064e'),
                        ('new-imports/cheytac_m200_dominator_gaming_glory.7z','b8586c6bf4ab6693667570734467a227'),
                        ('new-imports/ak47ironbeastgold.zip','dde8c5ffb70b3adcb9930edb59c85c4f')]:
        assert hashlib.md5((BASE/'sources'/name).read_bytes()).hexdigest()==digest, f'Archive checksum mismatch: {name}'
    entries=[]
    for key,name,model,fire,kind,segments in GUNS:
        aliases={'fire':'postfire' if key=='dsr1' else 'prefire'}
        convert(VOL/'GR-Hands'/model,BASE/key,VOL/'sound',aliases,[fire],segments)
        entries.append({'id':key,'name':name,'kind':kind,'source':'https://gamebanana.com/mods/475372',
                        'authors':'HLXX50 / Smilegate','fileId':1075994})
    convert(BASE/'sources/scar/GR-Hands/v_galil.mdl',BASE/'scar-light',BASE/'sources/scar/sound',{'fire':'prefire'},['galil-1.wav','galil-2.wav'])
    entries.append({'id':'scar-light','name':'SCAR Light 白虎','kind':'rifle',
                    'source':'https://gamebanana.com/mods/468236','authors':'HLXX50 / Smilegate','fileId':1054440})
    m200=BASE/'sources/cheytac-m200'
    convert(m200/'models/v_awp.mdl',BASE/'cheytac-m200',m200/'sound',{},['awp1.wav'])
    entries.append({'id':'cheytac-m200','name':'CheyTac M200 Dominator Gaming Glory','kind':'bolt-action',
                    'source':'https://gamebanana.com/mods/620567',
                    'authors':'TenTails / Compete-King / Smilegate / Valve','fileId':1519268})
    imperial=BASE/'sources/ak47-imperial-gold'
    convert(imperial/'models/v_ak47.mdl',BASE/'ak47-imperial-gold',imperial,
            {'idle_0':'idle1','select':'draw','fire':'shoot1'},
            ['AK47-Beast_Shoot_1.WAV','AK47-Beast_Shoot_2.WAV'])
    entries.append({'id':'ak47-imperial-gold','name':'AK47-Knife Transformers Imperial Gold','kind':'rifle',
                    'source':'https://gamebanana.com/mods/223752',
                    'authors':'Lycanth / Smilegate','fileId':393580})
    for entry in entries:
        view=json.loads((BASE/entry['id']/'view.json').read_text())
        checks=view['candidate']['checks']
        if entry['kind'] in ('pump-action','bolt-action'):
            checks['mechanicalCycle']=bool(view['events']['fire'])
        entry.update(checks=checks,status='awaiting-user-review' if all(checks.values()) else 'incomplete',
                     triangles=sum(p['count']//3 for p in view['parts']),bones=len(view['bones']),
                     bytes=sum(p.stat().st_size for p in (BASE/entry['id']).rglob('*') if p.is_file()),
                     clips={k:round(v['times'][-1],4) for k,v in view['clips'].items()},
                     missingSounds=view['candidate']['missingSounds'],
                     reloadShells=3 if view['candidate']['reloadSegments'] else None)
    catalog={'version':3,'assetVersion':'native-uv-3','scope':'local-isolated-preview-only',
             'license':'Sources are restricted mod ports (CC BY-NC-ND / original game rights). No public redistribution or commercial clearance.',
             'entries':entries,
             'rejected':[{'name':'Crossfire JNG-90','source':'https://gamebanana.com/mods/222996',
                          'reasons':['sequence names replaced by control characters','21 bones, no finger joints',
                                     'JNG90 sound events refer to files absent from archive (AWP filenames instead)']}],
             'remainingSourceViews':23-len(GUNS)}
    (BASE/'catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2))
    audits=[inspect(p) for p in sorted((VOL/'GR-Hands').glob('v_*.mdl'))]
    (BASE/'source-audit.json').write_text(json.dumps(audits,ensure_ascii=False,indent=2))
    print(json.dumps({'candidates':len(entries),'structurallyComplete':sum(all(e['checks'].values()) for e in entries),
                      'publiclyRedistributable':False}))


if __name__=='__main__':build()
