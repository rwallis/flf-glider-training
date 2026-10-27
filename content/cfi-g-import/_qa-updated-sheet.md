CFI-G updated spreadsheet QA vs original scan
Source OCR: content/cfi-g-raw/full.txt (from IMG_0001.pdf)
Spreadsheet: C:\Users\ronwa\Downloads\cfi-g-question-bank.xlsx

## Counts
- OCR stems parsed: 424 (complete A/B/C parse: 400, incomplete parse: 24)
- Sheet Full with QA: 424
- Sheet Importable unique: 418
- Sheet union: 430
- Importable complete (A/B/C + key A/B/C): 413

## PRIMARY: in original scan OCR but MISSING from updated spreadsheet
Count: 0
[]
NONE — every OCR-parsed stem number appears in Full and/or Importable.

## OCR-complete stems not on Importable sheet (may still be on Full/QA Issues)
Count: 3
[53, 166, 219]
  #53 on Full=True sheet_complete=True ocr_key=C status=ok
  #166 on Full=True sheet_complete=False ocr_key=X status=not_on_test_X
  #219 on Full=True sheet_complete=False ocr_key=X status=not_on_test_X

## In spreadsheet but not in OCR parser output
Count: 6
[311, 315, 316, 388, 431, 481]
Stem-evident in OCR haystack (parser miss, user recovered): []
Not evident in OCR (likely added from key/elsewhere): [311, 315, 316, 388, 431, 481]
  #311 complete=True key= evident=False stem=While in Class G airspace under day VFR conditions, what in-
  #315 complete=False key= evident=False stem=
  #316 complete=False key= evident=False stem=
  #388 complete=True key=B evident=False stem=What action may be taken against a person whom the Administr
  #431 complete=False key=C. evident=False stem=The type and date of each student pilot endorsement given sh
  #481 complete=False key= evident=False stem=

## Full sheet rows dropped from Importable
[53, 115, 120, 122, 166, 181, 184, 185, 187, 194, 219, 508]
## Importable rows not on Full sheet
[311, 315, 316, 388, 431, 481]

## Prior incomplete-list recovery
Fixed now complete: [49, 50, 51, 52, 56, 390, 408, 425, 432, 433, 468, 630, 661, 681]
Still incomplete/missing: [(115, 1, 'X', ''), (120, 2, 'X', '9 is required.'), (122, 2, 'X', '9 MHz.'), (181, 0, 'C', 'What is a typical characteristic ofa stable air ma'), (184, 0, 'A', 'Cool air moving over a warm surface is generally'), (185, 0, 'B', 'rra wave were ro form on a stationary riont runnin'), (187, 0, 'A', 'Consider the following statements about mountain w'), (194, 2, 'B', 'What are the minimum requirements for the formatio'), (508, 1, 'C', 'The operator ofan aircraft that has been involved '), (678, 3, 'A.', '(Refer to Figure 3.) What is the reported duration')]
OCR-incomplete but sheet now complete: [49, 50, 51, 52, 56, 390, 408, 425, 432, 433, 468, 630, 661, 681]

## Prior missing-answer-key recovery
Fixed: [(11, 'B', 'complete'), (21, 'B', 'complete'), (72, 'C', 'complete'), (73, 'B', 'complete'), (174, 'A', 'complete'), (175, 'C', 'complete'), (314, 'C', 'complete'), (321, 'C', 'complete'), (451, 'C', 'complete'), (471, 'C', 'complete'), (515, 'A', 'complete'), (517, 'B', 'complete'), (531, 'B', 'complete'), (571, 'C', 'complete'), (587, 'B', 'complete'), (591, 'B', 'complete'), (615, 'A', 'complete'), (641, 'C', 'complete')]
Still missing key: []

## All sheet rows still incomplete: 16
  (115, 1, 'X', '')
  (120, 2, 'X', '9 is required.')
  (122, 2, 'X', '9 MHz.')
  (166, 3, 'X', 'Shearners ofprecipitation trailing beneath clouds but e')
  (181, 0, 'C', 'What is a typical characteristic ofa stable air mass?')
  (184, 0, 'A', 'Cool air moving over a warm surface is generally')
  (185, 0, 'B', 'rra wave were ro form on a stationary riont runnins')
  (187, 0, 'A', 'Consider the following statements about mountain waYes:')
  (194, 2, 'B', 'What are the minimum requirements for the formation')
  (219, 3, 'X', 'Convective circulation pattems associated with sea bree')
  (315, 0, '-', '')
  (316, 0, '-', '')
  (431, 3, 'C.', 'The type and date of each student pilot endorsement giv')
  (481, 0, '-', '')
  (508, 1, 'C', 'The operator ofan aircraft that has been involved in an')
  (678, 3, 'A.', '(Refer to Figure 3.) What is the reported duration of t')

Importable duplicate Nos: [55, 481]
