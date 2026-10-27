# CFI-G scan QA report

- Source: `C:\Users\ronwa\OneDrive\Documents\2026_10_13\IMG_0001.pdf`
- Questions parsed from OCR: **424**
- Answer-key entries parsed: **651**
- Complete importable (question + A/B/C + answer key A/B/C): **380**

## Gaps / issues

- Incomplete A/B/C choices: **24** → [49, 50, 51, 52, 56, 115, 120, 122, 181, 184, 185, 187, 194, 390, 408, 425, 432, 433, 468, 508, 630, 661, 678, 681]
- Questions missing answer key: **18** → [11, 21, 72, 73, 174, 175, 314, 321, 451, 471, 515, 517, 531, 571, 587, 591, 615, 641]
- Parsed questions with answer key X (not on FAA CFI glider test): **2**
- Still missing stems that appear to be in the OCR text: **0** → []
- Answer-key A/B/C with no stem evidence (likely key OCR collision or non-consecutive skip): **42**
- Answer-key X with no stem (intentional non-consecutive / not on test): **204**

### Note on numbering
The bank is **not always consecutive**. Many gaps are intentional (`X` in the answer key = not currently on the FAA CFI-G test).
Other “missing” numbers are often answer-key OCR misreads (e.g. `2) X` colliding with `2)B`), not absent pages.

## Outputs

- Excel workbook: `C:\Users\ronwa\Documents\Codex\2026-05-15\flf-glider-training\content\cfi-g-import\cfi-g-question-bank.xlsx` (also copied next to the PDF)
- Full CSV (with QA Status): `C:\Users\ronwa\Documents\Codex\2026-05-15\flf-glider-training\content\cfi-g-import\cfi-g-question-bank.csv`
- Importable CSV: `C:\Users\ronwa\Documents\Codex\2026-05-15\flf-glider-training\content\cfi-g-import\cfi-g-question-bank-importable.csv`
- JSON cards: `C:\Users\ronwa\Documents\Codex\2026-05-15\flf-glider-training\content\cfi-g-import\cfi-g-import.json`

### Note on OCR
Scanner OCR has character errors (e.g. tum→turn, ainpeed→airspeed). Importable rows are structurally complete;
spot-check wording against the PDF before relying on them for checkride prep.

## Answer key A/B/C with no stem in scan (probably false key OCR / non-consecutive)

#13=B, #77=A, #91=B, #92=B, #111=A, #136=B, #137=B, #141=B, #144=A, #146=B, #147=A, #148=A, #149=B, #150=A, #159=B, #171=C, #179=B, #186=A, #211=C, #214=A, #217=A, #231=A, #311=C, #312=B, #315=C, #316=B, #332=B, #357=C, #381=B, #382=A, #388=B, #444=A, #481=C, #551=A, #561=C, #566=B, #567=B, #568=C, #611=A, #633=A, #635=C, #659=B

## Incomplete choice sets

- #49: found 1/3 — '(Refer to Figure 21.) Which aircraft has the highest aspect ratio?'
- #50: found 1/3 — '(Refer to Figure 21.) Which aircraft has the lowest aspect ratio?'
- #51: found 2/3 — '(Refer to Pigure 21.) Consider only aspect ratio (other factorc remain constant)'
- #52: found 2/3 — '(Refer to Figure 21.) Consider only aspect ratio (other factors remain constant)'
- #56: found 2/3 — 'At what bank angle will the resultant of gravity and centrifugal force equal twi'
- #115: found 1/3 — ''
- #120: found 2/3 — '9 is required.'
- #122: found 2/3 — '9 MHz.'
- #181: found 0/3 — 'What is a typical characteristic ofa stable air mass?'
- #184: found 0/3 — 'Cool air moving over a warm surface is generally'
- #185: found 0/3 — 'rra wave were ro form on a stationary riont runnins'
- #187: found 0/3 — 'Consider the following statements about mountain waYes:'
- #194: found 2/3 — 'What are the minimum requirements for the formation'
- #390: found 1/3 — 'A written statement from an authorized instructor certirying that an applicant h'
- #408: found 1/3 — 'The holder of a pilot or instructor certificate who fails to notify the FAA Airm'
- #425: found 2/3 — 'What is the minimum age required to be eligible for a Commercial Pilot Certifica'
- #432: found 1/3 — 'A flight inshuctor who applies for an additional rating on that certificate must'
- #433: found 1/3 — 'During any 24 consecutive hours, an instructor is limited to how many hours of f'
- #468: found 2/3 — 'What minimum flight visibility is required when flying a glider above I 0,000 fe'
- #508: found 1/3 — 'The operator ofan aircraft that has been involved in an accident is required to '
- #630: found 2/3 — '(Refer to Figure 42.) Which OMNI indication would you receive for aircraft 8?'
- #661: found 0/3 — 'Tho pitot system provides impact pressure for which'
- #678: found 1/3 — '(Refer to Figue 3.) What is the reported duration of the rain at the time of the'
- #681: found 1/3 — '(Refer to Figure 2l.) Of airoaft l, 2, or 3, which has the lowest aspect ratio?'
