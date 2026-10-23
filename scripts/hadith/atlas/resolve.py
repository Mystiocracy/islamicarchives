import pickle,collections
from util import norm
rows=pickle.load(open('rows.pkl','rb'))
pairs,ctx=pickle.load(open('align.pkl','rb'))
def dom(c,mn,share):
    if not c: return None
    i,k=c.most_common(1)[0]; t=sum(c.values())
    return i if k>=mn and k/t>=share else None
byname=collections.defaultdict(collections.Counter)
for (n,i),c in pairs.items(): byname[n][i]+=c
byctx=collections.defaultdict(collections.Counter)
for (n,x,i),c in ctx.items(): byctx[(n,x)][i]+=c
NAME={n:dom(c,2,.9) for n,c in byname.items()}
CTX={k:dom(c,1,.8) for k,c in byctx.items()}
chains=[]
for b,num,ch,_ in rows:
    if ch: chains.append((b,[norm(x) for x in ch if norm(x)]))
def pass_(nbr):
    out=[]; hit=collections.Counter()
    for b,ns in chains:
        ids=[]
        for j,n in enumerate(ns):
            t=ns[j+1] if j+1<len(ns) else None; p=ns[j-1] if j>0 else None
            r=None
            if t: r=CTX.get((n,'>'+t))
            if r is None and p: r=CTX.get((n,'<'+p))
            if r is None: r=NAME.get(n)
            ids.append(r)
        # neighbour-id pass
        if nbr:
            for j,n in enumerate(ns):
                if ids[j] is None:
                    t=ids[j+1] if j+1<len(ns) else None; p=ids[j-1] if j>0 else None
                    r=None
                    if t is not None: r=nbr.get((n,'>',t))
                    if r is None and p is not None: r=nbr.get((n,'<',p))
                    ids[j]=r
        for x in ids: hit['res' if x is not None else 'unres']+=1
        out.append(ids)
    return out,hit
r1,h1=pass_(None); print('pass1',h1,flush=True)
# learn (name, neighbour id) -> id
L=collections.defaultdict(collections.Counter)
for (b,ns),ids in zip(chains,r1):
    for j,n in enumerate(ns):
        if ids[j] is None: continue
        if j+1<len(ns) and ids[j+1] is not None: L[(n,'>',ids[j+1])][ids[j]]+=1
        if j>0 and ids[j-1] is not None: L[(n,'<',ids[j-1])][ids[j]]+=1
NB={k:dom(c,1,.85) for k,c in L.items()}
r2,h2=pass_(NB); print('pass2',h2,flush=True)
# third: relearn from pass2
for (b,ns),ids in zip(chains,r2):
    for j,n in enumerate(ns):
        if ids[j] is None: continue
        if j+1<len(ns) and ids[j+1] is not None: L[(n,'>',ids[j+1])][ids[j]]+=1
        if j>0 and ids[j-1] is not None: L[(n,'<',ids[j-1])][ids[j]]+=1
NB={k:dom(c,1,.85) for k,c in L.items()}
r3,h3=pass_(NB); print('pass3',h3,flush=True)
pickle.dump((chains,r3),open('resolved.pkl','wb'))
print('distinct ids',len({x for ids in r3 for x in ids if x is not None}))
