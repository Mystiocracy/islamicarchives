# muslimscholars.info download (24 Oct 2026)

Raw pages from muslimscholars.info (Arees Institute), gzipped, saved here so they don't have to be downloaded again.
Not for publication without the Arees Institute's permission.

- `pages.tar.part-*`: join with `cat pages.tar.part-* > pages.tar`, then `tar xf pages.tar`.
  - `main/` all 25,234 scholar pages (complete)
  - `tree/` family trees, richer version (partial), `tree2/` simpler version (partial)
  - `teachers/`, `students/` full lists by town (partial)
  - `lists/` the 16 rank listings; `ids.txt` all IDs
- `scholars.jsonl.gz`: parsed records (`parse.py`)
- `dl.py extras` resumes the remaining downloads (skips files already present)
