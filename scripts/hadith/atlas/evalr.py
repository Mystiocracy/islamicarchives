import pickle,collections,sys
truth=pickle.load(open('truth.pkl','rb'))
def dom(c,mn,share):
    if not c: return None
    i,k=c.most_common(1)[0]; t=sum(c.values())
    return i if k>=mn and k/t>=share else None
for hold in ['Sunan Ibn Majah',"Jami' al-Tirmidhi",'Sahih Muslim']:
    byname=collections.defaultdict(collections.Counter); byctx=collections.defaultdict(collections.Counter)
    for src,ns,ids in truth:
        if src==hold: continue
        for j,(n,i) in enumerate(zip(ns,ids)):
            byname[n][i]+=1
            if j+1<len(ns): byctx[(n,'>'+ns[j+1])][i]+=1
            if j>0: byctx[(n,'<'+ns[j-1])][i]+=1
    NAME={n:dom(c,2,.9) for n,c in byname.items()}; CTX={k:dom(c,1,.8) for k,c in byctx.items()}
    st=collections.Counter()
    for src,ns,ids in truth:
        if src!=hold: continue
        for j,(n,i) in enumerate(zip(ns,ids)):
            r=None
            if j+1<len(ns): r=CTX.get((n,'>'+ns[j+1]))
            if r is None and j>0: r=CTX.get((n,'<'+ns[j-1]))
            if r is None: r=NAME.get(n)
            st['none' if r is None else ('ok' if r==i else 'wrong')]+=1
    t=st['ok']+st['wrong']; print(hold,dict(st),'precision %.3f'%(st['ok']/t),'coverage %.3f'%(t/sum(st.values())))
