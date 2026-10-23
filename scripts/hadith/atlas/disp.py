import pickle,collections,re
from util import norm,DIAC
rows=pickle.load(open('rows.pkl','rb'))
F=collections.defaultdict(collections.Counter)
for b,num,ch,_ in rows:
    for x in ch:
        n=norm(x)
        if n: F[n][re.sub(r'\s+',' ',DIAC.sub('',x)).strip()]+=1
pickle.dump({k:v.most_common(3) for k,v in F.items()},open('disp.pkl','wb'))
