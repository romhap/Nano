# Products

Lead magnets and downloadable assets. Not linked from the site navigation.

## final-20-days.html -> IMAT-Final-20-Days.pdf

A 22-page day-by-day IMAT sprint plan, built as a lead magnet for new
Instagram followers. Written for the 29 September 2026 exam, but the plan
itself is numbered by days remaining rather than calendar date, so the
structure still works for a later cycle once the dates are updated.

Fonts (Space Grotesk, Inter) are embedded as base64 inside the HTML, so the
PDF renders identically with no network access and no font substitution.

### Regenerating the PDF after editing the HTML

    /opt/pw-browsers/chromium-1194/chrome-linux/chrome \
      --headless --disable-gpu --no-sandbox \
      --virtual-time-budget=30000 --no-pdf-header-footer \
      --print-to-pdf="IMAT-Final-20-Days.pdf" final-20-days.html

Each `.page` div is a fixed A4 box with `overflow:hidden`, which means content
that does not fit is silently clipped rather than flowing onto a new page.
After any content edit, check that no page overflows before shipping. The
quickest way is to load the file in a browser and run:

    document.querySelectorAll('.page').forEach((p,i)=>{
      let pr=p.getBoundingClientRect(), c=0;
      p.querySelectorAll(':scope > *').forEach(el=>{
        if(!el.classList.contains('foot'))
          c=Math.max(c, el.getBoundingClientRect().bottom-pr.top);
      });
      if(c > p.clientHeight-53) console.log('OVERFLOW on page', i+1);
    });

### Updating for a future cycle

- Exam date appears on the cover, page 3 endnote, the day-by-day dates,
  the test-day page and the back cover.
- Results dates are on the "What happens next" page.
- The discount code and its cutoff are on the CTA page.
