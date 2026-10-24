"""Polite resumable downloader for muslimscholars.info. usage: dl.py main|extras  (stops after MAXSEC)"""
import sys,os,time,gzip,urllib.request,urllib.parse,re
MODE=sys.argv[1]; MAXSEC=float(sys.argv[2]) if len(sys.argv)>2 else 6600
UA={'User-Agent':'Mozilla/5.0 (islamicarchives.org cataloguer; contact emailurooj@gmail.com)'}
B='https://muslimscholars.info/'
t0=time.time()
def get(url):
    for a in range(5):
        try:
            r=urllib.request.urlopen(urllib.request.Request(url,headers=UA),timeout=90).read()
            return r
        except Exception as e:
            time.sleep(15*(a+1))
    return None
def save(path,data): 
    tmp=path+'.part'; open(tmp,'wb').write(gzip.compress(data,9)); os.replace(tmp,path)
ids=[l.strip() for l in open('ids.txt') if l.strip()]
jobs=[]
if MODE=='main':
    for i in ids: jobs.append((f'main/{i}.html.gz',B+f'manage.php?submit=scholar&ID={i}'))
else:
    for i in ids:
        p=f'main/{i}.html.gz'
        if not os.path.exists(p): continue
        t=gzip.open(p).read().decode('utf8','ignore')
        tr=re.search(r'Narrated From:</td><td colspan=2>(.*?)</td>',t,re.S); st=re.search(r'Narrated By:</td><td colspan=2>(.*?)</td>',t,re.S)
        if tr and tr.group(1).strip(' ,'):
            jobs.append((f'teachers/{i}.html.gz',B+f'manage.php?manage=35&ID={i}'))
        if st and st.group(1).strip(' ,'):
            jobs.append((f'students/{i}.html.gz',B+f'manage.php?manage=36&ID={i}'))
        if any(k in t for k in ('Parents:','Siblings:','Spouse(s):','Children :')):
            jobs.append((f'tree/{i}.html.gz',B+f'manage.php?submit=scholarTree&ID={i}&sName='))
todo=[j for j in jobs if not os.path.exists(j[0])]
todo.sort(key=lambda j:0 if j[0].startswith('tree/') else 1)
print(MODE,'jobs',len(jobs),'todo',len(todo),flush=True)
n=0
for path,url in todo:
    if time.time()-t0>MAXSEC: break
    d=get(url)
    if d: save(path,d); n+=1
    else: open('failed.txt','a').write(url+'\n')
    if n%200==0: print(time.strftime('%H:%M'),n,flush=True)
    time.sleep(0.7)
left=len(todo)-n
print('DONE' if left==0 else 'PAUSED','fetched',n,'left',left,flush=True)
