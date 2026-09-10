# Products

Lead magnets and downloadable assets. Not linked from the site navigation --
each one gets its own gate page for a dedicated Instagram bio link.

## The pattern (repeat this for every new file)

1. Drop the file in here: `products/<Name>.pdf`.
2. Copy `guide-answer-sheet.html` (site root) to `guide-<slug>.html` and
   update: the `<title>`/meta tags, `FILE_URL`, and `SOURCE` (a unique string
   like `guide_<slug>` -- this is what shows up in the Signups sheet's "Last
   Source" column, so each product's leads stay distinguishable from every
   other one, including guide-answer-sheet.html's own `guide_answer_sheet`).
   Everything else (the standard site nav, the form, the checkbox, the
   single-click download logic) is meant to stay identical across every
   guide page.
3. Add a `Disallow: /products/<Name>.pdf` line to `robots.txt`, alongside the
   existing entries -- keeps the raw file out of search results so
   `guide-<slug>.html` stays the only public entry point. Soft gate only;
   anyone with the direct URL can still fetch the file.
4. Add `guide-<slug>.html` (not the PDF) to `sitemap.xml`.

No page collects a name, only email + the Instagram-follow checkbox, and
there's no marketing copy on the gate by design -- just the form and, on
submit, the file.

## IMAT-Answer-Sheet.pdf / guide-answer-sheet.html

The official Cambridge Assessment / Ministero dell'Istruzione IMAT answer
sheet specimen (public specimen material, watermarked SAMPLE by Cambridge
Assessment).

Note: this specimen's section layout (a merged "General Knowledge and
Logical Reasoning" block, roughly 22/18/12/8 questions across sections)
does not match the current verified exam format used everywhere else on
the site (Reading 4 + Logic 5 + Biology 23 + Chemistry 15 + Physics & Maths
13 = 60, per `api/chat.js`'s `KEY_DATES`/`SYSTEM_PROMPT`). It's offered here
purely as a specimen of the answer-sheet *layout* (how the bubbles, barcode
area, and sections are physically arranged on the page), not as a source of
truth on current section weighting. Don't reuse the question-count
breakdown from this file elsewhere on the site without flagging that
caveat.

## IMAT-Test-Day-Briefing.pdf / guide-test-day-briefing.html

An 8-page branded briefing covering what to bring, what's strictly banned in
the exam room, how the paper is marked and submitted, what automatically
voids a paper, and a 6-item pre-exam checklist. Content is sourced from the
user-supplied `IMAT_Test_Day_Briefing.docx` (itself citing the Decreto
Ministeriale (MUR), Allegato 1) and rebuilt as a fresh branded PDF using the
same design system, embedded fonts, and brand icon as the site's other
lead-magnet PDFs -- carries the same "confirm current details annually"
hedge used elsewhere on the site for regulation-derived content.
