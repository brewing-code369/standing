# STANDING web UI, review round 3 (fresh critic)

Captured 2026-10-12 09:50 to 09:54 IST against https://preview.standing-tempo.pages.dev with `shot` at 1440x900, 390x844 and tall 1440x3500 / 1440x2600 captures, plus DOM reads in the deepsurge profile. I clicked the cheat button once.

## Gate zero

- Verb the brief names: host ask, "If you want to build recurring or scoped billing flows using stablecoins, Tempo makes it easy using access keys and periodic spending limits" (x.com/tempo/status/2080073778693063123); rules: "products that integrate with the Tempo blockchain".
- Code path that performs it: `src/core/calls.ts:26-29` builds three `authorizeKey` calls signed once by the fan; `src/core/ledger.ts:23` reads the resulting `TransferWithMemo` pulls. On the live site the ledger shows 408 complete renewals and 1,224 pulls with explorer hashes, and the cheat button returned `SpendingLimitExceeded` from the chain.
- What won last time: not verified in this review. No prior Tempo-track winner list was checked.
- VERDICT: ELIGIBLE. The product executes transfers. It is not read-only.

## Scores

| Axis | Score | Evidence |
|---|---|---|
| Visual hierarchy | 6 | The largest thing on `/` is the slogan "three lines. one signature" (`--text-display`, 124px at 1440). The proof number "408" is `.live__n`, capped at 40px, so words outrank data by about 3:1. Below the fold, the three "line" rows (bar, cap, ONLY TO, refusal codes) are the strongest composition on the site. |
| Typography | 7 | The scale is disciplined (12/14/16/20/28/40/display), hashes and amounts are set in mono with tabular numerals, and refusal names are in red mono. Every section heading uses the same lowercase-with-full-stop mannerism: "latest renewals.", "try to cheat a live member.", "you run a platform.", "sell memberships.", "active.". The checkout h1 "demo membership, renews every 5 minutes" takes three display lines of filler at 1440. |
| Color and semantic use | 7 | Red means refusal, green means "3 OF 3 SETTLED", and yellow is the share bar. Yellow also serves as the brand mark and the full-bleed CTA band, so it carries three meanings. Share bars are yellow on `/` and `/new` but black on `/m/...`, with no legend saying black means "spent this period". |
| Spacing and layout | 6 | On `/`, the "FAN ACCOUNT" row has a label and nothing beside it, and the whole left half under it is empty. On `/m/...` desktop, about 350px of empty grid sits between "active." and the stats column, and the member's best facts ("136.00 pathUSD pulled", "136 renewals") are 14px rows pushed to the bottom right. Decorative vertical grid lines run through the body copy on every page. |
| Component quality | 7 | The ledger table (period, member, three amounts with hash links, settled chip), the line rows with KEY ACTIVE / BOUND TO / LEFT THIS PERIOD / PERIOD RESETS, and the 3-step checkout stepper are all real product components. The cheat result is one line of red mono text with no tx hash, block or link. The cheat button stays disabled until stats load, which took more than 8 s on desktop (both 1440 captures still show "…"). |
| Responsive at 390 | 6 | Home holds: proof panel loads, CTAs stack. The nav wraps to three rows, with "MODERATO" alone on the third. On `/p/c42ee655` the h1 takes three lines and the first actionable button sits at y about 580. `/new` at 390 is a long form, and the live split preview that sells it is below every field. |
| Copy and argument | 8 | Concrete and verb-led: "Take double the cut", "a pull over the cap SpendingLimitExceeded", "1% of the price, out of the platform cut". The hero subline states the job plainly. The headline "three lines." is opaque until the reader scrolls and learns that a "line" is a capped key. |
| AI-slop (10 = none) | 6 | Tells: a full-bleed yellow CTA band with a four-item square-bullet list; a 2x2 grid of bordered cheat buttons; a closing "you run a platform." CTA section before the footer (standard landing tail); decorative column gridlines; the same lowercase-full-stop heading on every section; the hero CTA "Join the demo membership" repeated three times on one page. |

Average 6.6, minimum 6.

## Questions

1. Designed product or styled document? Mostly a designed product. The line rows, ledger and checkout stepper are product components. The home page's lower half reverts to a styled landing template (band, bullets, button grid, closing CTA).
2. Primary job obvious in 3 s? Half. The subline gets there ("platform takes its cut without ever holding the creator's money"). The headline does not, and the live proof panel shows "…" for the first 8 s or more on desktop, so the 3-second read is slogan plus empty placeholders.
3. Would a competent practitioner produce exactly this without the content? The line rows with refusal codes under each cap, and "Take double the cut", come from the content and would not appear by default. The yellow band, 2x2 buttons, closing CTA and gridlines would.

## Three highest-leverage fixes

1. Make the hero the proof, not the slogan. Put one rendered line (creator 0.80 / platform 0.19 / fee 0.01 bars with ONLY TO and caps) in the hero beside a 72px+ "408 renewals, 0 over-cuts". Cut the display slogan to title size and rename it so "line" is defined in the same breath ("three capped keys. one signature."). Server-render or cache the four stats so the panel never shows "…" and the cheat button is never disabled on arrival (RPC returned 429 in the browser console, with an Uncaught exception).
2. Give the cheat result evidence. Show the refused call as a receipt: key id, attempted amount 0.38 versus cap 0.19 with the bar overshooting in red, the block it was simulated at, and an explorer or raw-revert link. Do the same in the 2x2 cheat grid, and replace the grid with the line rows themselves (a "try" affordance on each refusal code).
3. Delete the landing tail and fix the member page layout. Remove the yellow band with bullets and the "you run a platform." block (the nav already carries it). On `/m/...`, set "136 renewals, 136.00 pathUSD pulled" as the hero numbers next to "active.", make the bar colour consistent with a legend (used versus cap), and show the cancel affordance to visitors as a visible, explained state ("only this member's key can cancel: one signature revokes all three") instead of rendering nothing.

## Numbers and claims that look invented or unsourced

- Cheat result "platform key pulls 0.38, twice its cut": no hash, block or link on screen, so a viewer cannot tell a chain revert from a hardcoded string.
- "Account pathUSD 999863.00" on the member page: real faucet balance, but a fan holding nearly a million dollars reads as fake and undercuts the cap story. Label it "test balance (faucet)" or show only what was pulled.
- "MODERATO" in the nav carries no block or freshness. The footer's "Renewal runner ticked 18s ago" is the right pattern; move it to the header.
- Home "FAN ACCOUNT" label with no account beside it reads as a missing value.
- `/new` with price 10.00 and cut 20% shows platform 1.90, not 2.00. Correct (the fee is 1% out of the platform cut), but the form field says 20% and the preview disagrees until the reader finds the STANDING line.
- Everything else checked out: 1,224 pulls = 408 x 3, the member's 136 renewals match 136.00 pulled at 1.00 each, and the countdown matched the stated period reset.

Blind spot: the cancel flow and the passkey checkout were not exercised, because both need a funded member key in this browser.
