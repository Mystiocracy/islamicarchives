import json,pickle,re,collections
from util import norm
rows=pickle.load(open('rows.pkl','rb'))
K=json.load(open('hadith.json'))
print(collections.Counter(k['source'].strip() for k in K))
MAP={'Sahih Bukhari':'صحيح البخاري','Sahih Muslim':'صحيح مسلم',"Sunan Abi Da'ud":'سنن أبي داود',"Jami' al-Tirmidhi":'جامع الترمذي',"Sunan an-Nasa'i":'سنن النسائى الصغرى','Sunan Ibn Majah':'سنن ابن ماجه'}
def sh(t):
    w=t.split(); return {' '.join(w[i:i+3]) for i in range(max(1,len(w)-2))}
truth=[]
pairs=collections.Counter()   # (normname, id)
ctx=collections.Counter()     # (normname, normnext, id)
stats={}
for src,ar in MAP.items():
    ks=[k for k in K if k['source'].strip()==src]
    ss=[r for r in rows if r[0]==ar]
    kt=[sh(norm(k['text_ar'])) for k in ks]
    # inverted index on shingles
    inv=collections.defaultdict(list)
    for i,s in enumerate(kt):
        for g in s: inv[g].append(i)
    ok=0; tried=0
    for r in ss:
        if not r[2] or len(r[3])<20: continue
        tried+=1
        q=sh(r[3]); c=collections.Counter()
        for g in q:
            l=inv.get(g)
            if l and len(l)<40:
                for i in l: c[i]+=1
        if not c: continue
        i,sc=c.most_common(1)[0]
        if sc/len(q)<0.6: continue
        ids=[int(x) for x in str(ks[i]['chain_indx']).split(',') if x.strip()]
        names=[norm(x) for x in r[2]]
        if len(ids)!=len(names): continue
        ok+=1
        truth.append((src,names,ids))
        for j,(n,pid) in enumerate(zip(names,ids)):
            pairs[(n,pid)]+=1
            if j+1<len(names): ctx[(n,'>'+names[j+1],pid)]+=1
            if j>0: ctx[(n,'<'+names[j-1],pid)]+=1
    stats[src]=(len(ks),len(ss),tried,ok); print(src,stats[src],flush=True)
pickle.dump((pairs,ctx),open('align.pkl','wb'))
pickle.dump(truth,open('truth.pkl','wb'))
