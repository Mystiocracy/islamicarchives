import re
DIAC=re.compile(r'[ؐ-ًؚ-ٰٟۖ-ۭـ]')
def norm(s):
    s=DIAC.sub('',s); s=re.sub('[إأآٱ]','ا',s); s=s.replace('ى','ي').replace('ة','ه')
    s=re.sub(r'[^ء-ي ]',' ',s); return re.sub(r'\s+',' ',s).strip()
