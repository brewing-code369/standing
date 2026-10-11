# STANDING web UI, review round 12 (fresh critic)

Audit only. Evidence: the Playwright captures `docs/design/r12-1440.png`, `r12-390.png` and `docs/design/r12/critic/*.png`, taken against https://preview.standing-tempo.pages.dev between 12:40:57 and 12:48:04 on 2026-10-12. That is after the r12 commit `2f90e79` (12:39:47). I also did a read-only pass over `git show HEAD`, `src/web/pages/Home.tsx`, `src/web/pages/Member.tsx`, `src/web/refusal.tsx`, `src/web/lib/format.ts` and `src/web/styles.css`. I did not drive a browser.

Capture caveats:

- The r12 code is live in the captures. The neutral gloss, the 70ch receipt measure and the balanced 390 h1 all appear in the pixels (`home-cheat-1440.png`, `r12-390.png`).
- `plan-1440.png` (md5 `871ddc9c…`) and `plan-390.png` (md5 `f365505e…`) are byte-identical to r11 and r10, so the same files have been reused since r8. This is the fourth round the checkout has been judged on reused pixels. No checkout code changed, so this is defensible, but it is still unverified.
- `member-try-1440.png` is the **platform redirect** Try it (CallNotAllowed) for the third round running. Nobody has ever captured the outsider Try it (KeyNotFound from the response) or the member-page overcut.

## Did the round 11 fixes land?

| R11 fix | Status | Evidence |
|---|---|---|
| 1. Overcut receipt argues one cause, from a read; neutral `REFUSALS.SpendingLimitExceeded`; use or delete `left` | Landed via the neutral option, no read | `format.ts:28` now reads "The request is more than this key may still pull this period. The account holds the rest." The title "Platform key asks 0.38, twice its 0.19 cap" and this gloss now argue the same cause, size against what is left, and both are true whether the key is fresh or spent (`home-cheat-1440.png`, `home-cheat-390.png`). `left` is deleted from `Member.tsx` and from the `CheatReceipt` signature. The suggested read-before-try branching was not built. The receipt no longer claims anything that needs a read, so this is honest, but it is the weaker of the two options. |
| 2. Undo the module-level `setHeroReceipt`, delete dead state, one timestamp, cheat live at first paint, cap gloss at 70ch | Mostly landed | Landed: `Home` owns `heroReceipt` state and `LiveProof` gets an `onResult` prop (`Home.tsx:96,139,154`). The global is gone. The dead `res`, `at` and `error` fields are gone, and there is a single `const at`. The receipt text is capped at 70ch (`styles.css:605`). At 1440 the gloss now wraps at about 540 px instead of 1,220 px (`home-cheat-1440.png`). Not landed: the target is still `data?.renewals[0]?.member` and the button is still `disabled={!member}` until the ledger loads (`Home.tsx:105,131`). |
| 3. 390 and layout leftovers: hero wrap, member "Period ending" at 390, pin member stats, home `rcpt__meta` chip on the date line | One and a half of four | Landed: at 390 the h1 now breaks as "Three capped keys. / One fan signature." (`r12-390.png`, `home-390-full.png`). Half landed: the countdown no longer reflows the header. "1m 50s until the period ends" and "1m 16s" each stay on one line (`member-full-1440.png`, `member-try-1440.png`). But the fix used `min-width: 5.5ch` on every `.inline-stats b`, which opens a dead gap of about 65 px between "170" and "renewals" (see Spacing). Not landed: the home ledger chip still drops under the date and wallet at 1440, with rows still about 85 px (`home-full-1440.png`). The `white-space: nowrap` on the chip stops the chip itself from breaking, but the cell is still too narrow to hold date, wallet and chip together. Not landed: the member and home ledgers at 390 still hide "Period ending", so the top rows read as future clock times. Examples: "12:43:56" at a 12:43:29 capture (`member-390.png`) and "12:49:10" at a 12:45:59 capture (`home-390-full.png`). |

## Scores

| Axis | Score | Evidence |
|---|---|---|
| Visual hierarchy | 8 | Unchanged and strong. The proof number "512 complete renewals, each pull inside its cap" sits against "Three capped keys. One fan signature.", then the line card, then the ledger (`r12-1440.png`). The full-width receipt reads as the result of the button directly above it (`home-cheat-1440.png`). Still open: "plan c42ee655" appears in the hero label, the card head and the ledger copy. The 56 px "Demo membership" title on `/p/...` still outweighs the checkout panel (`plan-1440.png`, reused). |
| Typography | 8 | Two r11 hits are fixed: the 390 h1 is balanced, and the receipt gloss now has a readable measure. Remaining: at 390 the receipt "platform key on member" still leaves "0xEaD1…8512" alone on line two (`home-cheat-390.png`). The checkout lede still breaks "0.80 / creator" (`plan-1440.png`, reused file). |
| Color and semantic use | 8 | One red value per receipt, its error code (`home-cheat-1440.png`, `member-try-1440.png`). Black means pulled and yellow means available, and the legend is on member. The "3 OF 3 SETTLED" green chips and the green runner tick are consistent. KeyAlreadyRevoked is red mono in the Cancel copy (`member-full-1440.png`). |
| Spacing and layout | 7 | New regression: `.inline-stats b { min-width: 5.5ch }` pads every stat to the countdown's width. At 1440 this leaves about 65 px of air between "170" and "renewals", while "170.00" sits tight against "pathUSD pulled" (`member-full-1440.png`). At 390 the three stats now read as a ragged two-column table: "170 … renewals", "29s … until the period ends" (`member-390.png`). Only the countdown needed pinning. The home ledger rows still stack the chip under the date (`home-full-1440.png`). `/new` still has about 350 px of empty left column under "Create the plan" (`new-1440.png`). |
| Component quality | 7 | The r11 wiring smell is gone: no mutable global, no dead state, one timestamp, and `left` is removed end to end. What is left: `useState<{ busy: boolean }>` is an object wrapping one boolean. `onResult` hands up a rendered `ReactNode` instead of the result data, so `Home` cannot re-render the receipt when `plan` changes. The cheat target is still "whoever renewed last" and the button stays disabled until the ledger read finishes (`Home.tsx:105,131`). |
| Responsive at 390 | 8 | The hero no longer wraps mid-phrase. The proof number, cheat button, h1 and join CTA all fit inside the first 844 px (`r12-390.png`). The receipt stacks cleanly (`home-cheat-390.png`), and the outsider row holds on one line (`member-390.png`). Remaining: the receipt address orphan, the hidden "Period ending" header with its future times, and the new stat-column gap. |
| Copy and argument | 7 | The overcut receipt now argues one cause on both routes, and the argument is true without a read. That closes the r9 to r11 thread. The redirect receipt is clean: "Platform key sends 0.19 to 0x0000…dEaD", then `CallNotAllowed` and a matching gloss (`member-try-1440.png`). Still open: "1,527 capped pulls settled" / "1,536" is `complete * 3` worded as a count. At 390 a bare "12:49:10" on the top ledger row reads as a clock error. The member intro "Four refusals on this card can be tried live" is accurate against the four Try it buttons (creator redirect, platform redirect, platform overcut, outsider). |
| AI-slop (10 = none) | 8 | Nothing stock. The line card, refusal elbows, per-code Try it and receipt only make sense with this content. The 390 hero wrap, which was a slop-list hit, is gone. The texture is unchanged: an uppercase micro-label on nearly every block (CREATOR LINE, ONLY TO, CAP PER 5 MINUTES, KEY, BOUND TO, LEFT THIS PERIOD, PERIOD RESETS, FAN ACCOUNT, PERIOD ENDING, OWNER ONLY, ATTEMPT, LIVE SPLIT, FOR PLATFORM OPERATORS). |

Average 7.6, minimum 7.

Design Score: B
AI Slop Score: B

## Questions

1. Designed product or styled document? A designed product, on all four routes.
2. Is the primary job obvious in 3 s? Home: yes at both widths. Member: yes, "Active" plus the countdown. Checkout: yes, but judged on captures reused since r8.
3. Would a competent practitioner produce exactly this without the content? No for the line card, the receipt and the refusal elbows. Yes for the uppercase-label texture.
4. Does the overcut receipt argue one cause now? Yes, on both routes. The title says 0.38 against a 0.19 cap, and the gloss says the request is more than the key may still pull. Neither claim depends on how much was pulled earlier.
5. Did the stat pin fix the jitter without a new defect? The jitter is fixed. The pin was applied to all three stats instead of the countdown alone, which opened a visible gap after "170".

## Three highest-leverage fixes

1. Scope the stat pin to the countdown. Replace `.inline-stats b { min-width: 5.5ch }` with a class on the countdown `<b>` only, sized to "4m 59s". At 390, either stack each stat as number over label, or keep number and label inline with a normal gap. Never use a padded column.
2. Fix the ledger meta at both widths. On home at 1440, widen the `rcpt__meta` cell or move the wallet under the date, so date and chip share one line and rows drop to about 60 px. At 390, show the period end in the row itself ("period ends 12:49:10", or "paid 12:44:10 · ends 12:49:10") instead of relying on a header that is hidden.
3. Make the cheat honest at first paint and capture the unseen states. Pick the overcut target from the plan or the runner's member list so the button is live before the ledger read. Then capture the outsider Try it, the member-page overcut, and a fresh `plan-1440`/`plan-390`, so the next round judges pixels that are not four rounds old. Fix the 390 receipt orphan by letting "Signed by" stack its value under the label below 480 px.

## Numbers that look invented

- "1,527 capped pulls settled" / "1,536 capped pulls settled" is `complete × 3` (`Home.tsx:124`), a derivation worded as a count. It is not wrong in any capture, because every visible row is 3 OF 3 SETTLED. It still asserts a count that nobody read.
- Nothing else. The r11 unread exhaustion claim ("already pulled its cap") is gone.
- Verified and consistent:
  - Totals: 509 × 3 = 1,527 and 512 × 3 = 1,536.
  - Member renewals: 170 renewals = 170.00 pathUSD at 1.00. That is the r11 count of 168 plus the 12:33:56 and 12:38:56 pulls shown in the history.
  - Countdowns: "1m 50s" at 12:42:06 ends at 12:43:56, the top member row. "1m 16s" at about 12:42:40 ends at the same time. "29s" at about 12:43:29 matches too.
  - Member history: rows are exactly 5 minutes apart (12:18:56 to 12:43:56). Hashes carry over from r11 (12:28:56 0x053585…18e916, 12:23:56 0x0243a7…6280b1).
  - Home overcut: the 12:40:55 attempt targets 0xEaD1…8512, whose 12:39:10 pull is in the ledger.
  - Receipt blocks: 39,239,932 at 1440 and 39,239,955 at 390, after the hero heads 39,239,919 and 39,239,945. The member receipt block 39,240,101 is later than both.
  - `/new`: 8.00 / 1.90 / 0.10 = 10.00 at a 20% cut, with the 1% fee taken from the platform side.

Blind spot: I judged static captures and source only. The checkout captures are files reused since r8, the outsider and member-overcut Try it have never been captured, and I did not read 0xEaD1's remaining platform limit at block 39,239,932 myself.

AXES: avg=7.6 min=7
