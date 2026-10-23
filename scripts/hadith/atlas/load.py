import csv,ast,pickle,re
csv.field_size_limit(10**9)
DIAC=re.compile(r'[ؐ-ًؚ-ٰٟۖ-ۭـ]')
def norm(s):
    s=DIAC.sub('',s); s=re.sub('[إأآٱ]','ا',s); s=s.replace('ى','ي').replace('ة','ه')
    s=re.sub(r'[^ء-ي ]',' ',s); return re.sub(r'\s+',' ',s).strip()
rows=[]
for r in csv.DictReader(open('sanadset.csv',encoding='utf8')):
    try: ch=ast.literal_eval(r['Sanad']) if r['Sanad'].startswith('[') else []
    except Exception: ch=[]
    rows.append((r['Book'],r['Num_hadith'],[c.strip() for c in ch],norm(r['Matn'])[:400]))
pickle.dump(rows,open('rows.pkl','wb'))
print(len(rows), sum(1 for r in rows if r[2]))
