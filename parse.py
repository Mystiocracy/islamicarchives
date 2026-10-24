"""Parse muslimscholars.info scholar pages (main/*.html.gz) into structured JSON lines."""
import gzip,re,json,os,sys,html as H
def txt(s):
    s=re.sub(r'<br\s*/?>','\n',s or '',flags=re.I); s=re.sub(r'<[^>]+>','',s); s=H.unescape(s)
    return re.sub(r'[ \t\xa0]+',' ',re.sub(r'\n\s*\n+','\n',s)).strip()
def row(h,label):
    m=re.search(re.escape(label)+r'\s*</(?:td|th)>\s*<td[^>]*>(.*?)</td>',h,re.S|re.I)
    return m.group(1) if m else None
def links(seg):
    out=[]
    for m in re.finditer(r'(?:<A href=manage\.php\?submit=scholar&ID=(\d+)[^>]*>(.*?)</A>)|([^,<>]+?)(?=,)',seg or '',re.S|re.I):
        if m.group(1): out.append({'id':int(m.group(1)),'name':txt(m.group(2))})
        else:
            t=txt(m.group(3))
            if t and t not in ('Several Others',): out.append({'id':None,'name':t})
    return out
def year(s):
    if not s: return None
    m=re.search(r'(~)?(\d{1,4})\s*(AH|BH)',s)
    if not m: return None
    v=int(m.group(2)); return -v if m.group(3)=='BH' else v
def parse(i,h):
    h=re.sub(r'\r','',h)
    m=re.search(r'Scholar:</b></td><td><font[^>]*>(.*?)</font></td>\s*<td>(.*?)</td>',h,re.S)
    if not m: return None
    head=txt(m.group(1)); rk=m.group(2)
    mh=re.match(r'(\d+)\s*-\s*(.*?)(?:\s*\[(.*)\])?$',head)
    d={'id':int(i),'name':mh.group(2).strip() if mh else head,'kunya':(mh.group(3) if mh else None)}
    rt=txt(rk); d['rank']=re.split(r'\s*\[',rt)[0].strip() or None
    g=re.search(r'(\d+)(?:st|nd|rd|th) generation',rt,re.I); d['generation']=int(g.group(1)) if g else None
    extra=re.findall(r'\]\s*\[([^\]]+)\]',rt); d['school']=extra[-1] if extra else None
    for key,lab in [('fullName','Full Name:'),('parents','Parents:'),('siblings','Siblings:'),('spouses','Spouse(s):'),('children','Children :'),
                    ('birth','Birth Date/Place:'),('death','Death Date/Place:'),('places','Places of Stay:')]:
        v=row(h,lab); d[key]=txt(v) if v else None
    d['birthAH']=year(d['birth']); d['deathAH']=year(d['death'])
    ai=row(h,'Area of Interest:') or ''
    gr=re.search(r'\[Grade:\s*([^\]]+)\]',txt(ai)); d['grade']=gr.group(1).strip() if gr else None
    ar=re.search(r"fireMyPopup\(\"signDet\"\).*?<font[^>]*>(.*?)</font>.*?<font[^>]*>\s*-\s*(.*?)</font>",ai,re.S)
    d['taqribSigla']=txt(ar.group(1)) if ar else None; d['taqribVerdict']=txt(ar.group(2)) if ar else None
    d['interests']=[x.strip() for x in re.sub(r'\[.*','',txt(ai)).split(',') if x.strip()]
    d['teachers']=links(row(h,'Narrated From:')); d['students']=links(row(h,'Narrated By:'))
    tg=row(h,'Tags :'); d['tags']=[txt(x) for x in re.findall(r'<A[^>]*>(.*?)</A>',tg or '',re.S)]
    b=re.search(r"id='bio%s'>(.*?)</div>"%i,h,re.S); d['bio']=txt(b.group(1)) if b else None
    lu=re.search(r'Last Updated:</td><td[^>]*>([\d-]+)',h); d['lastUpdated']=lu.group(1) if lu else None
    rf=row(h,'References:') or ''
    d['references']=[{'source':txt(a),'resourceId':(int(r) if r else None),'vsource':int(v),'page':p} for v,r,a,p in re.findall(r"AsabahView&vsource=(\d+)&ID=(\d*)'[^>]*>(.*?)</A>\[([^\]]*)\]",rf,re.S)]
    nr=re.search(r'Narrations:.*?<td colspan=2>(.*?)</td>',h,re.S)
    d['narrations']={txt(k):int(v) for k,v in re.findall(r'([A-Za-z\' -]+):\s*<A[^>]*>(\d+)</A>',nr.group(1))} if nr else {}
    k=re.search(r"id='kamal%s'>(.*?)</div>"%i,h,re.S); d['tahdhibKamal']=txt(k.group(1)) if k else None
    rs=re.search(r"id='hideshow%s'>(.*?)</div>"%i,h,re.S)
    d['nameForms']=[];d['resources']=[]
    if rs:
        parts=re.split(r'<hr>',rs.group(1))
        nf=re.search(r'Names used in Hadith Literature:<br>(.*)',parts[0],re.S)
        if nf: d['nameForms']=[x.strip() for x in txt(nf.group(1)).split(',') if x.strip()]
        for p in (parts[1:] if nf else parts):
            mm=re.match(r'\s*(.*?)\[(.*?)\]<br>(.*)',p,re.S)
            if mm: d['resources'].append({'source':txt(mm.group(1)).rstrip(' -'),'info':txt(mm.group(2)),'text':txt(mm.group(3))})
    m=re.search(r'manage=3[56]&ID=%s&head=([^"]*)"'%i,h)
    ar=''
    if m:
        a=H.unescape(m.group(1)); k=re.search(r'[\u0600-\u06FF]',a)
        if k: ar=a[k.start():]
    ar=re.sub(r'[()\u200e]',' ',ar); ar=re.sub(r'\s*رضي الله عن\S*','',ar); d['arabicName']=re.sub(r'\s+',' ',ar).strip(' ,') or None
    d['kamalFrom']=[];d['kamalTo']=[];d['kamalVerdicts']=None
    if d['tahdhibKamal']:
        t=d['tahdhibKamal']
        a=re.search(r'روى عن\s*\n(.*?)(?:\n\s*روى عنه|$)',t,re.S); b=re.search(r'روى عنه\s*\n(.*?)(?:\n\s*علماء الجرح|$)',t,re.S)
        cl=lambda x:[re.sub(r'^\d+-\s*و?','',l).strip() for l in x.split('\n') if re.match(r'\s*\d+-',l)]
        if a: d['kamalFrom']=cl(a.group(1))
        if b: d['kamalTo']=cl(b.group(1))
        c=re.search(r'علماء الجرح والتعديل\s*\n(.*)',t,re.S)
        if c: d['kamalVerdicts']=c.group(1).strip()[:1500]
    return d
if __name__=='__main__':
    out=open(sys.argv[1] if len(sys.argv)>1 else 'scholars.jsonl','w'); n=0
    for f in sorted(os.listdir('main'),key=lambda x:int(x.split('.')[0])):
        i=f.split('.')[0]; d=parse(i,gzip.open('main/'+f).read().decode('utf8','ignore'))
        if d: out.write(json.dumps(d,ensure_ascii=False)+'\n'); n+=1
    print('parsed',n)
