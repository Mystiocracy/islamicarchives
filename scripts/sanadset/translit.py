"""Arabic name -> simple English spelling (machine transliteration).

Names in Sanadset are mostly written without vowel marks, so each word is spelled from its most common *vowelled*
form found anywhere in the dataset; words that never appear vowelled get a rough guess. Reading is by rule only
(no outside data). Output uses a simple scheme: ʿ for ʿayn, sh kh gh th dh digraphs, no macrons or dots.
"""
import re

A, U, I = 'َ', 'ُ', 'ِ'
TAN = 'ًٌٍ'
SHD, SUK, DAG = 'ّ', 'ْ', 'ٰ'
MARK = re.compile('[ً-ْٰ]')
DIA = re.compile('[ؐ-ًؚ-ٰٟۖ-ۭـ]')
LET = {'ب': 'b', 'ت': 't', 'ث': 'th', 'ج': 'j', 'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'dh', 'ر': 'r', 'ز': 'z', 'س': 's',
       'ش': 'sh', 'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z', 'ع': 'ʿ', 'غ': 'gh', 'ف': 'f', 'ق': 'q', 'ك': 'k', 'ل': 'l',
       'م': 'm', 'ن': 'n', 'ه': 'h', 'پ': 'p', 'چ': 'ch', 'گ': 'g', 'ڤ': 'v'}
VOW = {A: 'a', U: 'u', I: 'i'}


def norm(s):
    s = DIA.sub('', s)
    s = re.sub('[إأآٱ]', 'ا', s)
    return ' '.join(s.split())


def units(tok):
    out = []
    for ch in tok:
        if MARK.match(ch) and out:
            out[-1][1].append(ch)
        elif not MARK.match(ch) and ch not in 'ـ':
            out.append([ch, []])
    return out


def vowelled(tok):
    """Spell one vowelled word."""
    u = units(tok)
    if not u:
        return ''
    # article
    pre = ''
    if len(u) > 2 and u[0][0] in 'اٱ' and u[1][0] == 'ل' and not any(m in u[0][1] for m in (I, U)) and u[2][0] not in 'اٱ':
        pre = 'al-'
        u = u[2:]
        u[0][1] = [m for m in u[0][1] if m != SHD]  # sun letter: the doubling is not written
    # case ending: drop a final short vowel / tanwin
    if len(u) > 1:
        last = u[-1]
        if last[0] == 'ة':
            last[1] = []
        else:
            last[1] = [m for m in last[1] if m not in (A, U, I) and m not in TAN] if (SHD not in last[1]) else last[1]
            if last[0] == 'ي' and SHD in last[1]:
                last[1] = [SHD]
    r = []
    for k, (ch, ms) in enumerate(u):
        v = next((VOW[m] for m in ms if m in VOW), '')
        shd = SHD in ms
        suk = SUK in ms
        prev = r[-1] if r else ''
        prev_vow = u[k - 1][1] if k else []
        first = k == 0
        if ch in 'اٱ':
            if first:
                r.append(v or 'a')
            elif A in prev_vow or DAG in prev_vow or not prev_vow:
                pass  # long a: the short a is already written
            else:
                r.append('a')
        elif ch in 'أإآ':
            r.append('a' if ch == 'آ' else (v or ('i' if ch == 'إ' else 'a')))
        elif ch in 'ؤئء':
            r.append(v)
        elif ch == 'ة':
            if not (r and r[-1].endswith('a')):
                r.append('a')
            elif not (A in prev_vow):
                r.append('a')
        elif ch == 'ى':
            if not (A in prev_vow):
                r.append('a')
        elif ch == 'و':
            if (suk or not ms) and U in prev_vow and not first:
                pass  # long u
            elif (suk or not ms) and A in prev_vow and not first:
                r.append('w')  # aw
            else:
                r.append('w' + v if not first else 'w' + v)
        elif ch == 'ي':
            if shd and k == len(u) - 1:
                if I not in prev_vow:
                    r.append('i')
            elif (suk or not ms) and I in prev_vow and not first:
                pass  # long i
            elif (suk or not ms) and A in prev_vow and not first:
                r.append('y')  # ay
            else:
                r.append('y' + v + ('y' if shd else ''))
        elif ch in LET:
            c = LET[ch]
            r.append(c + (c if shd and len(c) == 1 else '') + v)
        else:
            pass
        if DAG in ms:
            r.append('a')
    s = ''.join(r)
    return pre + s


def skeleton(tok):
    """Rough spelling for a word that never appears vowelled: add 'a' between consonants."""
    tok = norm(tok)
    pre = ''
    if len(tok) > 3 and tok.startswith('ال'):
        pre, tok = 'al-', tok[2:]
    r = []
    for k, ch in enumerate(tok):
        nxt = tok[k + 1] if k + 1 < len(tok) else ''
        if ch == 'ا':
            r.append('a' if k else 'a')
        elif ch in 'ءأإؤئ':
            r.append('a' if not r else '')
        elif ch == 'و':
            r.append('w' if (not k or tok[k - 1] == 'ا') else 'u')
        elif ch == 'ي' or ch == 'ى':
            r.append('y' if (not k or nxt in 'ان') else 'i') if ch == 'ي' else r.append('a')
        elif ch == 'ة':
            r.append('a')
        elif ch in LET:
            r.append(LET[ch])
            if nxt and nxt in LET and nxt not in 'وي' and not (r[-1] in ('a', 'i', 'u')):
                r.append('a')
        else:
            pass
    s = ''.join(r)
    s = re.sub('a{2,}', 'a', s)
    return pre + s


SPECIAL = {'ابن': 'ibn', 'ابنه': 'ibn', 'بن': 'bin', 'ابو': 'Abu', 'ابي': 'Abi', 'ابا': 'Aba', 'الله': 'Allah', 'اللهم': 'Allahumma',
           'عبد': 'ʿAbd', 'عبدالله': 'ʿAbd Allah', 'ام': 'Umm', 'امي': 'Ummi', 'محمد': 'Muhammad', 'احمد': 'Ahmad', 'علي': 'ʿAli',
           'عمر': 'ʿUmar', 'عمرو': 'ʿAmr', 'عثمان': 'ʿUthman', 'عائشه': 'ʿAisha', 'عائشة': 'ʿAisha', 'مالك': 'Malik',
           'انس': 'Anas', 'نافع': 'Nafiʿ', 'شعبه': 'Shuʿba', 'شعبة': 'Shuʿba', 'سفيان': 'Sufyan', 'الزهري': 'al-Zuhri',
           'قتاده': 'Qatada', 'قتادة': 'Qatada', 'الاعمش': 'al-Aʿmash', 'ابيه': 'his father', 'جده': 'his grandfather',
           'ابراهيم': 'Ibrahim', 'اسماعيل': 'Ismaʿil', 'موسي': 'Musa', 'موسى': 'Musa', 'عيسي': 'ʿIsa', 'عيسى': 'ʿIsa',
           'يحيي': 'Yahya', 'يحيى': 'Yahya', 'سليمان': 'Sulayman', 'ايوب': 'Ayyub', 'يوسف': 'Yusuf', 'داود': 'Dawud',
           'هريره': 'Hurayra', 'هريرة': 'Hurayra', 'عباس': 'ʿAbbas', 'الخطاب': 'al-Khattab', 'مسعود': 'Masʿud', 'حنبل': 'Hanbal'}


def cap(s):
    if s.startswith('al-') and len(s) > 3:
        return 'al-' + cap(s[3:])
    i = 1 if s.startswith('ʿ') else 0
    return s[:i] + s[i:i + 1].upper() + s[i + 1:] if s else s


def spell(token, vform):
    """English for one normalised word; vform is its most common vowelled spelling, or ''."""
    if token in SPECIAL:
        return SPECIAL[token]
    s = vowelled(vform) if vform else skeleton(token)
    return cap(s)


def name_en(tokens, tok_en):
    out = []
    for t in tokens:
        e = tok_en.get(t) or spell(t, '')
        out.append(e)
    s = ' '.join(x for x in out if x)
    return cap(s)
