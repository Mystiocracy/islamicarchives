import pickle,collections,json,os,re,statistics,sys
DISP=pickle.load(open('disp.pkl','rb'))
from util import norm
from bookname import EN,SIX
sys.path.insert(0,'/home/claude/mystiocracy/islamicarchives/scripts/hadith')
OUT=sys.argv[1] if len(sys.argv)>1 else 'out'
rows=pickle.load(open('rows.pkl','rb'))
chains,res=pickle.load(open('resolved.pkl','rb'))
marfu=[]
for b,num,ch,matn in rows:
    if ch: marfu.append(('النبي' in matn[:250]) or ('رسول الله' in matn[:250]))
assert len(marfu)==len(chains)
FATHER={'ابيه','ابي','عن ابيه','والده'}; GRAND={'جده','جدي'}
ANON={'رجل','رجلا','امراه','شيخ','بعض اصحابنا','من سمع','رجل من اهل','رجلين','اناس','ناس','بعض اهل العلم','غير واحد','من لا اتهم','الثقه','عمن','رجل من الانصار','بعض اصحابه','اشياخنا','مشيخه','بعضهم','اصحابنا','عده'}
# pass A: keys
allkeys=[]; cnt=collections.Counter()
for (b,ns),ids in zip(chains,res):
    ks=[]
    for j,(n,i) in enumerate(zip(ns,ids)):
        if i is not None: k=('i',i)
        elif n in ANON: k=None
        elif n in FATHER: k=('f',ks[j-1]) if j>0 and ks[j-1] else None
        elif n in GRAND: k=('g',ks[j-1]) if j>0 and ks[j-1] else None
        else: k=('s',n)
        ks.append(k)
        if k: cnt[k]+=1
    allkeys.append(ks)
keep={k for k,c in cnt.items() if c>=5}
PROPHET=('p',0)
# details for ID nodes
B=json.load(open('/home/claude/mystiocracy/islamicarchives/public/hadith/bukhari-narrators.json'))['p']
import importlib.util
spec=importlib.util.spec_from_file_location('pn','/home/claude/mystiocracy/islamicarchives/scripts/hadith/parse-narrators.py'); pn=importlib.util.module_from_spec(spec); spec.loader.exec_module(pn)
pn.MS=os.path.abspath('ms')+'/'
def bio(i):
    if str(i) in B: return {k:v for k,v in B[str(i)].items() if k!='h'}
    try: return pn.parse(i)
    except Exception: return None
# arabic display name for ID nodes: most common raw form (longest among top forms)
form=collections.defaultdict(collections.Counter)
for (b,ns),ids in zip(chains,res):
    for n,i in zip(ns,ids):
        if i is not None: form[i][n]+=1
# stats
H=collections.Counter(); H6=collections.Counter(); T=collections.defaultdict(collections.Counter); T6=collections.defaultdict(collections.Counter)
BK=collections.defaultdict(collections.Counter); POS=collections.defaultdict(list)
for (b,ns),ks,mf in zip(chains,allkeys,marfu):
    ks=[k if k in keep else None for k in ks]
    six=b in SIX
    if mf and ks and ks[-1] is not None: ks=ks+[PROPHET]
    L=len(ks)
    for j,k in enumerate(ks):
        if k is None: continue
        H[k]+=1; BK[k][b]+=1
        if six: H6[k]+=1
        if mf and k!=PROPHET: POS[k].append(L-1-j)
        if j+1<L and ks[j+1] is not None and ks[j+1]!=k:
            T[k][ks[j+1]]+=1
            if six: T6[k][ks[j+1]]+=1
nodes=[PROPHET]+[k for k,_ in H.most_common() if k!=PROPHET]
idx={k:i for i,k in enumerate(nodes)}
S=collections.defaultdict(collections.Counter); S6=collections.defaultdict(collections.Counter)
for k,tc in T.items():
    for t,c in tc.items(): S[t][k]+=c
for k,tc in T6.items():
    for t,c in tc.items(): S6[t][k]+=c
books=[b for b,_ in collections.Counter({b:1 for b in []}).most_common()]
bc=collections.Counter(b for b,_ in chains); books=[b for b,_ in bc.most_common()]; bidx={b:i for i,b in enumerate(books)}
def light(n):
    d=DISP.get(n); return d[0][0] if d else n
def clean(n):
    w=n.split()
    if w and w[0].startswith('و') and len(w[0])>2 and w[0][1:] in ('ابن','عائشه','ابي','ابو','عبد','سفيان') : w[0]=w[0][1:]
    elif w and w[0].startswith('و') and len(w)==1 and len(w[0])>4: w[0]=w[0][1:]
    if w and w[0] in ('ابي','ابا'): w[0]='ابو'
    if len(w)==1 and w[0].endswith('ا') and len(w[0])>3 and not w[0].endswith('يا'): w[0]=w[0][:-1]
    return ' '.join(w)
def pretty(c):
    agg=collections.Counter()
    for n,k in c.items():
        if n in FATHER or n in GRAND or n in ANON or n in ('ابيه','ابي','ابوه','جده'): continue
        agg[clean(n)]+=k
    if not agg: return ''
    best=agg.most_common(1)[0][0]
    # prefer a longer form that is at least a third as common and contains the best form
    for n,k in agg.most_common(6):
        if len(n)>len(best) and best in n and k>=agg[best]/8: best=n
    return light(best)
def isamb(n):
    w=n.split()
    if 'بن' in w or 'ابن' in w: return False
    if len(w)==1 and n.startswith('ال') and n.endswith('ي'): return False
    return len(w)<=2
def names(k):
    t=k[0]
    if t=='p': return 'النبي ﷺ','The Prophet ﷺ',0
    if t=='i':
        ar=pretty(form[k[1]])
        b=bio(k[1]); return ar,(b or {}).get('n') or '',0
    if t=='s': return light(k[1]),'',1 if isamb(k[1]) else 0
    base=k[1]; ar,en,_=names(base)
    if t=='f': return 'والد '+ar,('Father of '+en) if en else '',0
    return 'جد '+ar,('Grandfather of '+en) if en else '',1
os.makedirs(OUT+'/n',exist_ok=True)
index=[]
for i,k in enumerate(nodes):
    ar,en,amb=names(k)
    tier=round(statistics.median(POS[k])) if POS.get(k) else 0
    index.append([ar,en,H[k],H6[k],tier,amb,1 if (k[0]=='i' and bio(k[1])) else 0])
SH=100
def route(k):
    out=[]; seen={k}; cur=k
    for _ in range(14):
        tc=T.get(cur)
        if not tc: break
        nxt=next((t for t,_ in tc.most_common() if t not in seen),None)
        if nxt is None: break
        out.append(idx[nxt]); seen.add(nxt); cur=nxt
        if nxt==PROPHET: break
    return out
shard={}
for i,k in enumerate(nodes):
    d={'t':[[idx[t],c,T6[k][t]] for t,c in T[k].most_common(60)],'s':[[idx[s],c,S6[k][s]] for s,c in S[k].most_common(60)],
       'nt':len(T[k]),'ns':len(S[k]),'nt2':sum(1 for c in T[k].values() if c>=2),'ns2':sum(1 for c in S[k].values() if c>=2),'b':[[bidx[b],c] for b,c in BK[k].most_common(8)],'nb':len(BK[k]),'r':route(k)}
    if k[0]=='i':
        bb=bio(k[1])
        if bb: d['bio']=bb; d['ms']=k[1]
        tot=sum(form[k[1]].values()); seen=[]
        for n,c in form[k[1]].most_common(12):
            if c>=max(3,tot*0.02):
                v=light(n)
                if v not in seen: seen.append(v)
        d['f']=seen[:8]
    if k[0] in 'fg': d['rel']=idx.get(k[1])
    shard.setdefault(i//SH,{})[i]=d
for s,v in shard.items(): json.dump(v,open(f'{OUT}/n/{s}.json','w'),ensure_ascii=False,separators=(',',':'))
meta=dict(books=[[b,EN.get(b,''),bc[b],1 if b in SIX else 0] for b in books],chains=len(chains),rec=len(rows),six=sorted(bidx[b] for b in SIX),sh=SH)
json.dump(dict(meta=meta,n=index),open(f'{OUT}/index.json','w'),ensure_ascii=False,separators=(',',':'))
ids=sum(1 for k in nodes if k[0]=='i'); print('nodes',len(nodes),'id nodes',ids,'shards',len(shard))
