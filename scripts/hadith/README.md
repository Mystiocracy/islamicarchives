# Ṣaḥīḥ al-Bukhārī data

These scripts made the files the Hadith Hub reads. They are kept for the record and are not part of the site build.

1. `parse-narrators.py` reads each narrator's page from muslimscholars.info and the chains from the Hadith Narrators
   dataset (Hugging Face: Almoooo/dataset_hadith), and writes `public/hadith/bukhari-narrators.json`.
2. `match-bukhari.py` matches each chain in that dataset to the sunnah.com numbering by comparing Arabic text with the
   hadith-api editions (github.com/fawazahmed0/hadith-api, `ara-bukhari` and `eng-bukhari`).
3. `build-bukhari-data.py` writes `content/hadith/bukhari.json` (Arabic, English, book, chains), the per-link ḥadīth
   lists in `public/hadith/bukhari-narrators.json`, and `public/hadith/bukhari-snips.json` (short lines for the tree's lists).

The paths at the top of each script point to the folder where the downloads were kept; change them before running.


## Ṣaḥīḥ Muslim

`build-muslim-data.py` writes `content/hadith/muslim.json` from the hadith-api editions `ara-muslim` and `eng-muslim` (English by Abdul Hamid Siddiqui). Then `match-muslim.py` matches the dataset's Muslim rows to those numbers by Arabic text, and `build-muslim-chains.py` adds the chains (several isnads in one row are split where a name comes back) and writes `public/hadith/muslim-narrators.json` and `muslim-snips.json`.

## Narrators of the Ḥadīth (all books)

`atlas/` made `public/hadith/narrators/` from Sanadset 650K (Mendeley Data 10.17632/5xth87zwb5.5, CC BY 4.0, saved as `sanadset.csv`)
and the numbered Six-Books chains (`hadith.json` from Almoooo/dataset_hadith). Run in order:
`load.py` (parse chains) → `align.py` (pair written names with numbered narrators in the Six Books) → `evalr.py` (hold-out accuracy) →
`resolve.py` (match names in all books, three rounds) → `scrape.py` (muslimscholars.info pages for new numbers) → `disp.py` (display forms)
→ `build.py out` (index.json and the 100-narrator shards in `n/`). Copy `out/*` to `public/hadith/narrators/`.
