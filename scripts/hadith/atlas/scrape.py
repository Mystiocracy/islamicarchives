import json,time,urllib.request,os
for i in json.load(open('miss.json')):
    f=f'ms/{i}.html'
    if os.path.exists(f): continue
    for a in range(4):
        try:
            h=urllib.request.urlopen(urllib.request.Request(f'https://muslimscholars.info/manage.php?submit=scholar&ID={i}',headers={'User-Agent':'Mozilla/5.0 (islamicarchives.org cataloguer)'}),timeout=40).read()
            open(f,'wb').write(h); break
        except Exception as e: time.sleep(10)
    time.sleep(1.2)
print('done')
