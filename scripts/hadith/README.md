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

`build-muslim-data.py` writes `content/hadith/muslim.json` from the hadith-api editions `ara-muslim` and `eng-muslim` (English by Abdul Hamid Siddiqui). Text only: there is no chain data for Muslim yet.
