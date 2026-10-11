# STANDING web UI, review round 13 (fresh critic)

Audit only. Evidence: the Playwright captures `docs/design/r13-1440.png`, `r13-390.png` and `docs/design/r13/critic/*.png`. Their mtimes run from 12:58:31 to 13:01:04 on 2026-10-12, after the r13 commit `3777b57` (12:57:58). I also did a read-only pass over `git show 3777b57`, `src/web/pages/Home.tsx`, `src/web/pages/Member.tsx`, `src/web/receipts.tsx` and `src/web/styles.css`. I did not drive a browser.

Capture caveats:

- The r13 code is live in the captures. "PERIOD ENDS" appears inside the 390 ledger rows on both routes (`home-cheat-390.png`, `home-390-full.png`, `member-390.png`). The 390 receipt stacks its rows (`home-cheat-390.png`). The gap after "174" is gone (`member-full-1440.png`).
- `plan-1440.png` (md5 `871ddc9c…`) and `plan-390.png` (md5 `f365505e…`) are byte-identical to r12, which reused the r8 files. This round the mtimes are fresh (13:00:24 and 13:00:32). Neither viewport shows anything live (no block, no "ticked Xs ago"), so a fresh capture could produce the same bytes. I cannot tell a re-capture from a copy. Either way, the checkout pixels have not changed since r8.
- `member-try-1440.png` is the **platform redirect** Try it (CallNotAllowed) for the fourth round running. The outsider Try it (KeyNotFound) and the member-page overcut have still never been captured.

## Did the round 12 fixes land?

| R12 fix | Status | Evidence |
|---|---|---|
| 1. Scope the stat pin to the countdown, no padded column at 390 | Landed, with a small residue | `styles.css` now has `.inline-stats b.countdown { min-width: 6.5ch }`, and only the countdown `<b>` carries the class (`Member.tsx:155`). At 1440, "174 renewals" now sits tight. The 65 px hole after the number is gone (`member-full-1440.png`; compare the r12 "170 … renewals"). Residue: at 390, "3m 39s" is still followed by about 28 px of air before "until the period ends", while "174renewals" and "174.00 pathUSD" sit at about 4 px (`member-390.png`). 6.5ch in the display face is wider than "3m 39s". It is a small ragged edge, not a column. |
| 2. Ledger meta: chip and date on one line at 1440, period end shown in the row at 390 | Half landed | Landed at 390: every row now reads "PERIOD ENDS 12 Oct, 13:03:56 0xC18a…F7A6" (`receipts.tsx:30`, `.rcpt__lbl` shown at ≤880 px). A future time now reads as a period end, not a clock error. Examples: "13:04:10" in a 13:00:47 capture (`home-390-full.png`) and "13:03:56" in a 12:59:13 capture (`home-cheat-390.png`). Not landed at 1440: the "3 OF 3 SETTLED" chip still drops under "12 Oct, 13:03:56 0xC18a…F7A6", and the home rows are still about 85 px tall (`home-full-1440.png`). The member page, which has no wallet in the cell, fits date and chip on one line at about 61 px (`member-full-1440.png`). That shows the wallet is what overflows the cell. |
| 3. Cheat live at first paint from the plan or runner list; capture outsider, member overcut and fresh checkout; fix the 390 receipt orphan | One of three | Landed: under 480 px the receipt `dl` collapses to one column with values left-aligned under their labels. "platform key on member 0xC18a…F7A6" is now one line, with no orphaned address (`home-cheat-390.png`). Not landed: the target is still `data?.renewals[0]?.member`, and the button is still `disabled={!member \|\| cheat.busy}` (`Home.tsx:105,132`). Not landed: no outsider or member-overcut capture, and the checkout bytes are unchanged (see the caveats). |

## Scores

| Axis | Score | Evidence |
|---|---|---|
| Visual hierarchy | 8 | Unchanged and strong. The order is "521" plus "complete renewals, each pull inside its cap", then the h1, then the line card, then the ledger (`r13-1440.png`). The receipt reads as the result of the button above it (`home-cheat-1440.png`). Still open: "plan c42ee655" appears three times above the fold (hero label, card head, and the ledger copy below). The 56 px "Demo membership" title still outweighs the checkout panel, which is the actual job of `/p/...` (`plan-1440.png`). |
| Typography | 8 | The 390 receipt orphan is fixed (`home-cheat-390.png`). The h1 is balanced at both widths, and the gloss holds a 70ch measure. Remaining: the checkout lede at 1440 still breaks "0.80 / creator, 0.19 platform" across lines (`plan-1440.png`). The 390 countdown is followed by a padded gap, while its siblings are not (`member-390.png`). |
| Color and semantic use | 8 | One red value per receipt, its error code (`home-cheat-1440.png`, `member-try-1440.png`). Black means pulled, yellow means available, and the member legend says so. Every bar on the member card is fully black, and "0.00 of 0.80 / 0.19 / 0.01" agrees with that (`member-full-1440.png`). The green "3 OF 3 SETTLED" chips and runner tick are consistent. No decorative colour. |
| Spacing and layout | 7 | The stat hole is fixed. Three layout leftovers remain. (a) The home ledger rows at 1440 are about 85 px against about 61 px on member, because the chip wraps under the wallet (`home-full-1440.png`). (b) At 1440 the receipt `dl` puts labels at x≈111 and values flush right at x≈1329, so the eye crosses about 1,100 px between "Asked" and "0.38 pathUSD" (`home-cheat-1440.png`). The gloss was capped at 70ch in r12, but the rows were not. (c) `/new` still leaves about 350 px of empty left column under "Create the plan" (`new-1440.png`). |
| Component quality | 7 | No change to the r12 smells. The cheat targets whoever renewed last and stays disabled until the ledger read finishes (`Home.tsx:105,132`). `onResult` hands up a rendered `ReactNode` instead of data. `{ busy: boolean }` is still state that wraps one boolean. The r13 diff touched CSS, one `className` and one label span. It was clean and small, but it did not address these. |
| Responsive at 390 | 9 | All three r12 phone defects are fixed. The receipt rows stack, so there is no orphan (`home-cheat-390.png`). Ledger rows carry "PERIOD ENDS" (`home-390-full.png`, `member-390.png`). Stats are no longer a padded two-column table (`member-390.png`). The proof number, cheat button, h1 and CTA all fit in the first 844 px (`r13-390.png`). The outsider row holds one line. Residue: the countdown gap. |
| Copy and argument | 8 | The future-clock problem is fixed by the label, not by hiding the time. The overcut receipt argues one cause on both widths: "Platform key asks 0.38, twice its 0.19 cap" and "The request is more than this key may still pull this period." The redirect receipt is clean: "Platform key sends 0.19 to 0x0000…dEaD" with a matching CallNotAllowed gloss (`member-try-1440.png`). Still open: "1,563 capped pulls settled" is `complete * 3` (`Home.tsx:129`), a derivation worded as a count. "Four refusals on this card can be tried live" matches the four Try it buttons. |
| AI-slop (10 = none) | 8 | Nothing stock. The line card, refusal elbows, per-code Try it and the receipt only exist because of this content. The texture is unchanged and slightly denser. r13 adds "PERIOD ENDS" as a sixth repeated uppercase micro-label per screen at 390, on top of CREATOR LINE, ONLY TO, CAP PER 5 MINUTES, KEY, BOUND TO, LEFT THIS PERIOD, PERIOD RESETS, FAN ACCOUNT, ATTEMPT, OWNER ONLY, LIVE SPLIT and FOR PLATFORM OPERATORS. Each one is justified on its own; together they read as a template habit. |

Average 7.9, minimum 7.

Design Score: B
AI Slop Score: B

## Questions

1. Designed product or styled document? A designed product, on all four routes.
2. Is the primary job obvious in 3 s? Home: yes at both widths. Member: yes, "Active" plus "4m 17s until the period ends". Checkout: yes, but the pixels have not changed since r8.
3. Would a competent practitioner produce exactly this without the content? No for the line card, the receipt and the refusal elbows. Yes for the uppercase-label texture.
4. Did the countdown pin fix the r12 gap without a new defect? Yes at 1440. At 390 it leaves a smaller gap after the countdown only, because 6.5ch is wider than "3m 39s" in the display face.
5. Does "PERIOD ENDS" in the row make the future times honest? Yes. "PERIOD ENDS 12 Oct, 13:04:10" at 13:00:47 is now a true statement, not an apparent clock error.

## Three highest-leverage fixes

1. Make the home ledger meta fit at 1440. Put the wallet on its own line under the date, or move the chip into the creator column header row, so date and chip share one line. Rows should drop from about 85 px to the member page's about 61 px. This is the only r12 layout item still open, and it is the densest table on the landing page.
2. Cap the receipt rows, not just the gloss. Give `.receipt__rows` a `max-width` of about 560 px, the same measure as the gloss, so "Asked" and "0.38 pathUSD" are about 400 px apart instead of about 1,100 px at 1440. While in there, size the countdown pin with `font-variant-numeric: tabular-nums` and `min-width: 6ch`, or measure "4m 59s", so the 390 gap closes.
3. Make the cheat live at first paint and capture the unseen states. Pick the overcut target from the plan or the runner's member list, not `renewals[0]`, so the button does not wait on the log read. Then capture the outsider Try it (KeyNotFound), the member-page overcut, and a checkout screen with a live value in frame, so the next round can prove the checkout was re-shot. Ideally fix the "0.80 / creator" lede break while doing it.

## Numbers that look invented

- "1,563 capped pulls settled" (and 1,554 / 1,557) is `complete × 3` (`Home.tsx:129`). It is still a derivation worded as a count. No capture contradicts it, because every visible row is 3 OF 3 SETTLED, but nobody counted the pulls.
- Nothing else. Verified and consistent:
  - Totals: 518 × 3 = 1,554, 519 × 3 = 1,557 and 521 × 3 = 1,563.
  - Count progression: 518 at 12:58:30. 519 at 12:59:13 and 12:59:24, after C18a's 12:58:56 pull (row "period ends 13:03:56"). 521 at 13:00:47, after 27DB's row (ends 13:04:04) and EaD1's row (ends 13:04:10) appear (`home-390-full.png`).
  - Member: 174 renewals = 174.00 pathUSD at 1.00. That is r12's 170 plus four rows ending 12:48:56, 12:53:56, 12:58:56 and 13:03:56. History rows are exactly 5 minutes apart. Hashes carry over from r12 (12:43:56 0x9b785e…d19534).
  - Countdowns: "4m 17s" at about 12:59:39 ends at 13:03:56, the top member row. "3m 50s" in the 13:00:05 try capture and "3m 39s" at about 13:00:17 end at the same time. "PERIOD RESETS in 4m 17s" matches the header.
  - Blocks: hero heads 39,241,642 → 710 → 731 → 867 → 882 → 896 across 12:58:30 to 13:01:04, about 1.6 to 1.75 blocks/s. Receipts at 39,241,653 (12:58:30) and 39,241,723 (12:59:13) land just after their heads. The member receipt at 39,241,809 (13:00:05) fits the same rate.
  - Overcut targets: 0xEaD1…8512 at 12:58:30 and 0xC18a…F7A6 at 12:59:13. Each was `renewals[0]` at the moment of its capture.
  - `/new`: 8.00 / 1.90 / 0.10 = 10.00 at a 20% cut, with the 1% fee taken from the platform side.

Blind spot: I judged static captures and source only. I cannot tell whether the checkout files were re-shot or copied, the outsider and member-overcut Try it have never been captured, and I did not read either overcut target's remaining platform limit at its receipt block myself.

AXES: avg=7.9 min=7
