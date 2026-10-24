import json,os,collections,re,glob
OUT='site'; os.makedirs(OUT+'/p',exist_ok=True)
for f in glob.glob(OUT+'/p/*.json'): os.remove(f)
rows=[json.loads(l) for l in open('scholars.jsonl')]
rows=[d for d in rows if d.get('rank')]
rows.sort(key=lambda d:d['id'])
AN=json.load(open('/home/claude/mystiocracy/islamicarchives/public/hadith/narrators/index.json'))['n']
amap={}
for f in glob.glob('/home/claude/mystiocracy/islamicarchives/public/hadith/narrators/n/*.json'):
    for k,v in json.load(open(f)).items():
        if 'ms' in v: amap[v['ms']]=int(k)
RANKS=[]; ri={}
def rc(r):
    if r not in ri: ri[r]=len(RANKS); RANKS.append(r)
    return ri[r]
CITY=[('Madina',r'madni|medin|madin|medina|madina'),('Makka',r'makk|makki|mecca'),('Kufa',r'kuf'),('Basra',r'basr'),
      ('Sham',r'sham|damas|dimash|hims|syria|palest|filas|ramla|jerusalem'),('Egypt',r'egypt|masri|misr'),('Baghdad',r'baghdad'),
      ('Yemen',r'yemen|yaman|sana'),('Wasit',r'wasit|wasti'),('Khurasan',r'khurasan|khurasni|merv|marw|balkh|bulki|nishapur|naysabur'),('Rayy',r'\bray\b|al-ray|rayy|razi'),('Jazira',r'jazir|raqq|harran|mosul|mawsil')]
def city(d):
    tx=' '.join(d['tags']).lower()+' | '+(d.get('places') or '').lower()
    for i,(n,rx) in enumerate(CITY):
        if re.search(rx,tx): return i
    return -1
THEMES=[('Fought at Badr',['Badr']),('Fought at Uhud',['Uhud']),('The Trench (Khandaq)',['Khandaq']),('Khaybar',['Khaybar']),('Pledge of Ridwan',['Ridwan']),
 ('Pledges of Aqaba',['Aqaba 1','Aqaba 2','Aqaba Chief']),('Emigrants to Abyssinia',['Abyssinia','Abyssinia 1','Abyssinia 2']),('Early Muslims',['Early Muslim']),
 ('Promised Paradise',['Promised Paradise']),('Mothers of the Believers',['Mother of the Believers']),("The Prophet's scribes",['Scribe']),("The Prophet's messengers",['Messenger']),
 ('Women',['Female']),('Mukhaḍramūn',['Makhdaram']),('Judges',['Judge']),('Ḥuffāẓ',['Hafiz']),('Banū Hāshim',['B.Hashim']),('Quraysh',['Quraish']),('The Anṣār',['Ansar'])]
tagset=lambda d:set(t.strip() for t in d['tags'])
idx=[]; SH=250; shards=collections.defaultdict(dict); themeIds=[[] for _ in THEMES]
def clean_bio(b):
    if not b or len(b)<60 or '* *' in b: return None
    return b
for n,d in enumerate(rows):
    ts=tagset(d)
    for ti,(_,tags) in enumerate(THEMES):
        if ts & set(tags): themeIds[ti].append(n)
    a=amap.get(d['id'],-1)
    h=AN[a][2] if a>=0 else 0
    idx.append([d['id'],d['name'],d.get('arabicName') or '',rc(d['rank']),d.get('generation') or 0,d.get('deathAH'),
                (re.search(r'\(([^)]+)\)',d.get('death') or '') or [None,''])[1].strip(),d.get('grade') or '',a,city(d),h])
    p={k:d.get(k) for k in ['kunya','fullName','parents','siblings','spouses','children','birth','death','places','interests','grade','taqribSigla','taqribVerdict','tags','nameForms','kamalFrom','kamalTo','lastUpdated']}
    p['bio']=clean_bio(d.get('bio'))
    for k in ('birth','death'):
        if p[k]:
            v=re.sub(r'\[\s*Natural\s*\]','',p[k]).strip()
            v=re.sub(r'^\(\s*\)$','',v).strip(); v=re.sub(r'^\((.*)\)$',r'\1',v)
            p[k]=v or None
    p['teachers']=[[t['id'],t['name']] for t in d['teachers']]; p['students']=[[t['id'],t['name']] for t in d['students']]
    p['refs']=[[r['source'],r['page']] for r in d['references']]; p['narr']=d.get('narrations')
    p={k:v for k,v in p.items() if v not in (None,[],{},'')}
    shards[n//SH][d['id']]=p
for s,v in shards.items(): json.dump(v,open(f'{OUT}/p/{s}.json','w'),ensure_ascii=False,separators=(',',':'))
json.dump({'ranks':RANKS,'sh':SH,'cities':[c for c,_ in CITY],'themes':[[t,ids] for (t,_),ids in zip(THEMES,themeIds)],'n':idx},open(f'{OUT}/index.json','w'),ensure_ascii=False,separators=(',',':'))
print(len(idx),'themes',[(t,len(i)) for (t,_),i in zip(THEMES,themeIds)])
print('cities',collections.Counter(x[9] for x in idx))
print('generation',collections.Counter(x[4] for x in idx))
