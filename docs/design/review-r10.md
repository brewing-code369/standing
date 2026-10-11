# STANDING web UI, review round 10 (fresh critic)

Audit only. Evidence: the Playwright captures `docs/design/r10-1440.png`, `r10-390.png` and `docs/design/r10/critic/*.png`, taken against https://preview.standing-tempo.pages.dev between 12:06 and 12:07 on 2026-10-12, which is after the r10 commit `7838e12` (12:03:20). I also did a read-only pass over `src/web/pages/*.tsx`, `src/web/refusal.tsx`, `src/web/wires.tsx`, `src/web/App.tsx`, `src/web/lib/format.ts` and `src/web/styles.css`, plus `git show HEAD`. I did not drive a browser.

Capture caveats:

- `plan-1440.png` is byte-identical to the r8 and r9 files (md5 `871ddc9c…`). That makes sense, because the r10 checkout change is `.co-split { display: none }` under 880 px only. `plan-390.png` is new (md5 `f365505e…`).
- `member-try-1440.png` shows the **platform redirect** Try it (CallNotAllowed). It does not show the outsider Try it, so the outsider code taken from the response has still never been seen in a capture.
- The home cheat receipt is rendered without the `left` prop (`Home.tsx:115`). Only the member page passes it (`Member.tsx:78`). So the two routes now show different receipts for the same component.

## Did the round 9 fixes land?

| R9 fix | Status | Evidence |
|---|---|---|
| 1. Make "Left this period" a read, branch title and footer on it, put red on the true cause, cheat live at first paint | Partly landed, with one new regression | Landed: the literal "0.00" is gone. The member page now passes `leftBefore`, computed from `mem.roles[role].remaining` (`Member.tsx:73-74`), and the title branches on it (`refusal.tsx:23`). Not landed: home passes no `left`, so the home receipt has no "Left this period" row and always uses the "asks 0.38, twice its 0.19 cap" title. Its footer still says "This key already pulled its cap for the period" (`format.ts:28`, `home-cheat-1440.png`). The title argues size and the footer argues exhaustion: two causes again. Not landed: the cheat member still comes from `renewals[0]` (`Home.tsx:105`) and is gated on the ledger (`Home.tsx:129`). **Regression:** the red goes on `left < asked` whatever the attempt kind (`refusal.tsx:34`). On the redirect Try it the chain answered CallNotAllowed, yet "0.00 pathUSD" on the Left row is the only red value in the table (`member-try-1440.png`). That red points the reader at the cap, which was not the cause. |
| 2. Do not paint one failed poll red; capture the outsider Try it and render `tryRes.reason` | Code landed, capture missing | `App.tsx:21` now only goes `'down'` after 3 failures. Every r10 footer reads a green "Renewal runner ticked Ns ago" (`member-full-1440.png`, `member-390.png`, `home-full-1440.png`, `new-1440.png`). The outsider code now renders `tryRes.reason` after a try (`Member.tsx:195`), but before any try it falls back to the constant 'KeyNotFound', and no outsider try was captured. |
| 3. 390 work: checkout first action, compact home ledger rows, outsider row on the line component, label future period end | Mostly landed | Checkout: "Use a browser key" moved from y ≈ 494 to y ≈ 438 (`plan-390.png`). It still sits under the r9 target of 400, but it is well inside an 844 px viewport. Home ledger at 390: each renewal is now a header line plus three one-line pulls, about 130 px each, and the cheat page dropped from 4,536 px to 3,692 px (`home-cheat-390.png`). Not landed: the outsider row is still a bespoke flex row, and at 390 "KeyNotFound Try it" still drops under a two-line sentence (`member-390.png`). Not landed: the top ledger row still carries a future time ("12:09:10" at 12:06) with only the "PERIOD ENDING" header to explain it. |

## Scores

| Axis | Score | Evidence |
|---|---|---|
| Visual hierarchy | 8 | Unchanged and strong. Home: "488 complete renewals, each pull inside its cap" beside "Three capped keys. One fan signature.", then the line card, then "Latest renewals" (`r10-1440.png`, `home-full-1440.png`). Member: "Active", then 163 / 163.00 / 2m 12s, then the keys, history and Cancel. Still open: "plan c42ee655" appears three times above the ledger at 1440. On `/p/...` the 56 px "Demo membership" title outweighs the checkout panel (`plan-1440.png`). |
| Typography | 8 | Tabular numerals, mono hashes with "…", red mono error names. Leftovers that have now slipped two rounds: "KeyAlreadyRevoked" in the Cancel body is plain sans while every other error name is red mono (`member-full-1440.png`). At 390 the receipt's "platform key on member 0xEaD1…8512" breaks with the address alone on line two (`home-cheat-390.png`). The 1440 checkout lede still breaks "0.80 / creator" across lines (`plan-1440.png`). |
| Color and semantic use | 7 | The footer false-red is fixed, and no capture shows amber or red there. New misuse: on the CallNotAllowed receipt the only red value is "Left this period 0.00 pathUSD" (`member-try-1440.png`). The rule `left < asked` makes red mean "below the cap", not "the cause", so a recipient refusal is colored as a cap refusal. Red in a receipt should mark one thing, and here it marks two. |
| Spacing and layout | 7 | No layout change at 1440. With the receipt open on home, the right column still ends at y ≈ 350 beside a receipt that reaches y ≈ 680 (`home-cheat-1440.png`). `/new` still has about 350 px of empty left column under "Create the plan" (`new-1440.png`). Home ledger rows at 1440 are about 100 px tall because the left cell stacks time, wallet and chip against one-line amounts (`home-full-1440.png`). |
| Component quality | 7 | The receipt has drifted into two variants: member has a Left row and a branched title, home has neither (`Home.tsx:115` vs `Member.tsx:78`). The Left row's red condition ignores `res.kind`. "Left this period (read before the try)" is the member poll's last value, which can be up to 10 s old (`Member.tsx:56`), not a read taken at the try. Outsider row is still not the `└ ✕ label Code Try it` component. The home cheat still waits on the ledger. |
| Responsive at 390 | 8 | Real progress. Ledger renewals are compact, so the home page dropped about 840 px. The checkout split sentence is hidden and the first action is in the first screen (`plan-390.png`). The member page reads cleanly through to Cancel (`member-390.png`). Remaining: the outsider row wraps, and member stats still spend three display lines before "Three keys on this account". |
| Copy and argument | 7 | Member receipt titles are now true to a read. The home receipt contradicts itself: the title "Platform key asks 0.38, twice its 0.19 cap" says the request was too large, and the footer "This key already pulled its cap for the period" says nothing was left. Both happened to be true at 12:06:14 (0xEaD1 was paid at 12:04:10, see Numbers), but the receipt argues two causes, which is exactly what r8 and r9 asked to remove. The `SpendingLimitExceeded` gloss in `format.ts:28` asserts exhaustion for every instance, read or not. "1,464 capped pulls settled" is still `complete * 3` written as a count. |
| AI-slop (10 = none) | 8 | Nothing stock. The line card, per-code Try it, receipt and key rows exist only because of this content. The texture is unchanged: uppercase micro-labels on almost every block (CREATOR LINE / ONLY TO / CAP PER 5 MINUTES / KEY / BOUND TO / LEFT THIS PERIOD / PERIOD RESETS per card, plus FAN ACCOUNT, PERIOD ENDING, OWNER ONLY, ATTEMPT). |

Average 7.5, minimum 7.

Design Score: B
AI Slop Score: B

## Questions

1. Designed product or styled document? A designed product, on all four routes.
2. Is the primary job obvious in 3 s? Home: yes at both widths. Member: yes, "Active" plus the countdown. Checkout: yes at both widths now.
3. Would a competent practitioner produce exactly this without the content? No for the line card, receipt and key rows. Yes for the uppercase-label texture.
4. Is the home cheat receipt true this round? Yes for this attempt. It targeted 0xEaD1 at 12:06:14, and that member's 12:04:10 renewal is already in the ledger (`home-full-1440.png`, period ending 12:09:10), so its platform key had 0.00 left. The footer is therefore true. But it is true by luck of `renewals[0]`, not by a read, and the title does not say it.
5. Does the member Try it receipt argue one cause? No. For the CallNotAllowed attempt it shows a red "0.00 pathUSD" Left row above a red "CallNotAllowed" code. A reader who sees red on the cap row will think the cap refused it.

## Three highest-leverage fixes

1. Make the receipt one component with one cause. Only show (or only color) the "Left this period" row when `res.reason === 'SpendingLimitExceeded'`, and make the footer gloss branch on the same `left` value as the title. The gloss should be "already pulled its cap" only when left is 0, and "asks more than the key has left" otherwise. Pass `left` from home too, by reading the target member's platform-key remaining before calling `api.attack`, and pick that member from the runner or plan so the button is live at first paint.
2. Make "read before the try" literal. Read `remaining` for the role at the moment Try it is pressed (one `eth_call` at the block you then print), not the member poll's cached value from up to 10 s earlier, or rename the row to what it is. Capture the outsider Try it and confirm the code shown is the response's reason.
3. Close the leftovers that have slipped two rounds. Render the outsider refusal with the line `└ ✕ label Code Try it` row so it stays on one line at 390. Set "KeyAlreadyRevoked" in the Cancel body as red mono. Label the top ledger row so a future period-end time does not read as a clock bug, for example "this period, paid 12:04:10".

## Numbers that look invented

- "This key already pulled its cap for the period" (`format.ts:28`) is a fixed gloss shown for every SpendingLimitExceeded. On home no remaining value is read, so the claim is unread even when it is true.
- "Left this period (read before the try) 0.00" on the member receipt comes from the 10 s member poll (`Member.tsx:56,74`), not a read at the try. It is close to a read, but the label overstates it.
- "1,464 capped pulls settled" is 488 × 3 (`Home.tsx:126`): a derivation worded as a count. Every visible row is 3 OF 3 SETTLED, so it is not wrong in any capture.
- Verified and consistent: 488 × 3 = 1,464. Member 163 renewals = 163.00 pathUSD at 1.00. Member history rows are exactly 5 minutes apart (12:08:56 … 11:43:56). The 0xC18a rows on home (12:08:56 0x9632db…df7bc5, 12:03:56 0xa6b489…972cce) carry the same hashes on `/m/...`. The countdown of 2m 12s at about 12:06:44 ends at 12:08:56, which matches the top row and "PERIOD RESETS in 2m 12s". The member-try countdown of 1m 58s at 12:06:58 ends at the same time. LEFT THIS PERIOD 0.00 of 0.80 / 0.19 / 0.01 matches the full black bars. Receipt blocks (39,236,529 on home, 39,236,598 on member) are after the hero head on their captures (39,236,519). `/new` preview 8.00 / 1.90 / 0.10 = 10.00 at a 20% cut with the 1% fee taken from the platform side.

Blind spot: I judged static captures and source only. The outsider Try it was never captured, `plan-1440.png` is a reused file, and I did not read the platform key's remaining limit at block 39,236,529 myself. Question 4 infers it from the ledger row.

AXES: avg=7.5 min=7
