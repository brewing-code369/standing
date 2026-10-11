# STANDING web UI, review round 11 (fresh critic)

Audit only. Evidence: the Playwright captures `docs/design/r11-1440.png`, `r11-390.png` and `docs/design/r11/critic/*.png`, taken against https://preview.standing-tempo.pages.dev between 12:27:35 and 12:31:19 on 2026-10-12, which is after the r11 commit `197697a` (12:10:28). I also did a read-only pass over `git show HEAD`, `src/web/refusal.tsx`, `src/web/pages/Home.tsx`, `src/web/pages/Member.tsx`, `src/web/receipts.tsx`, `src/web/lib/format.ts` and `src/web/styles.css`. I did not drive a browser.

Capture caveats:

- `plan-1440.png` is byte-identical to r10 (md5 `871ddc9c…`, the same file since r8). `plan-390.png` is also byte-identical to r10 (md5 `f365505e…`). No checkout code changed in r11, so this is expected, but the checkout has now been judged on reused pixels for three rounds.
- `member-try-1440.png` again shows the **platform redirect** Try it (CallNotAllowed). The outsider Try it is still uncaptured, so the outsider code taken from the response has never been seen rendered.
- The commit title says "one receipt, one cause on both routes". The diff achieves "one receipt" by **deleting** the "Left this period" row and the left-branched title (`refusal.tsx`, HEAD diff), not by branching the gloss on a read. `Member.tsx:73-74` still computes `leftBefore` and passes `left`, and `CheatReceipt` destructures it and never uses it.

## Did the round 10 fixes land?

| R10 fix | Status | Evidence |
|---|---|---|
| 1. One receipt, one cause: Left row only for SpendingLimitExceeded, gloss branches on `left`, home passes `left`, cheat target live at first paint | Partly landed, by subtraction | Landed: both routes now render the same receipt, and the false red "0.00" on the CallNotAllowed receipt is gone (`member-try-1440.png` shows only the red `CallNotAllowed`). Landed: the home receipt now spans the hero row (`home-cheat-1440.png`), closing the r10 empty right column. Not landed: the overcut receipt still argues two causes on both routes. Title "Platform key asks 0.38, twice its 0.19 cap" (size), footer "This key already pulled its cap for the period. The account holds the rest." (exhaustion) (`home-cheat-1440.png`, `home-cheat-390.png`, `format.ts:28`). The gloss is now unread on **both** routes, which is a step back for the member route, where r10 had a read. Not landed: the cheat member is still `renewals[0]` and the button still waits on the ledger (`Home.tsx:105,131`). |
| 2. Make "read before the try" literal, capture outsider Try it | Sidestepped | The label is gone, so it no longer overstates. But no read replaced it. The outsider Try it is still not captured. |
| 3. Leftovers: outsider on the line row, KeyAlreadyRevoked red mono, label the future period-end row | Two of three landed | Landed: the outsider row now uses the `stub` elbow and ✕ and fits on one line at 390: "└ ✕ a stranger's account KeyNotFound Try it" (`member-390.png`). Landed: "KeyAlreadyRevoked" is red mono in the Cancel body (`member-full-1440.png`, `member-390.png`). Not landed: the top ledger row still carries a future time with only the column header to explain it. That is "12:29:10" at a 12:27:53 capture on home (`home-full-1440.png`) and "12:33:56" at 12:29:16 on member 390, where the header is hidden entirely (`member-390.png`). |

## Scores

| Axis | Score | Evidence |
|---|---|---|
| Visual hierarchy | 8 | Unchanged and strong. Home: the "503 complete renewals, each pull inside its cap" proof sits beside "Three capped keys. One fan signature.", then the line card, then "Latest renewals" (`r11-1440.png`). The full-width receipt now reads as a consequence of the cheat button directly above it, which is better than r10's narrow column (`home-cheat-1440.png`). Still open: "plan c42ee655" appears twice above the fold at 1440 and again in the ledger copy. On `/p/...` the 56 px "Demo membership" title still outweighs the checkout panel (`plan-1440.png`). |
| Typography | 7 | Tabular numerals, mono hashes, red mono error names, and now KeyAlreadyRevoked matches. New issue from the span-all receipt: at 1440 the gloss runs about 1,220 px, roughly 190 characters per line (`home-cheat-1440.png`), far past a readable measure. At 390 the hero "Three capped keys. One / fan signature." breaks the second phrase across lines (`r11-390.png`), the mid-phrase wrap the slop list bans. At 390 the receipt's "platform key on member" still leaves "0xEaD1…8512" alone on line two (`home-cheat-390.png`). The 1440 checkout lede still breaks "0.80 / creator" (`plan-1440.png`, reused file). |
| Color and semantic use | 8 | The r10 misuse is fixed: each receipt now has one red value, its error code (`member-try-1440.png`). Black means pulled and yellow means available in the bars (legend on member). The footer shows a green runner tick in every capture. Green "each pull inside its cap" and the "3 OF 3 SETTLED" chips are consistent. |
| Spacing and layout | 7 | The home receipt fills the hero row. The ledger meta change is partial: on member (no wallet column) date and chip share one line, but on home the `c-1-3` cell still wraps the chip under date and wallet, so rows stay about 85 px (`home-full-1440.png`). Member stats jitter with the countdown: "6s" fits on one line (`member-try-1440.png`), but "39s until the period ends" drops to a second line (`member-full-1440.png`), so the header height changes as the timer ticks. `/new` still has about 350 px of empty left column under "Create the plan" (`new-1440.png`). |
| Component quality | 6 | The receipt is one component again, but the home wiring regressed in code quality. `Home.tsx:138-142` assigns a module-level `setHeroReceipt` during render and calls it from a child, a mutable global that bypasses props and survives unmount. `cheat.res`, `cheat.at` and `cheat.error` are now set but never rendered (dead state), and the receipt gets a second `Date.now()` instead of `cheat.at`. `left` is computed in `Member.tsx` and accepted by `CheatReceipt`, then ignored. The cheat is still gated on the ledger. |
| Responsive at 390 | 8 | The outsider row now holds on one line (`member-390.png`). The home first screen shows the proof number, the cheat button and the join CTA inside 844 px (`r11-390.png`). The receipt stacks cleanly with its code and gloss (`home-cheat-390.png`). Remaining: the hero wraps mid-phrase, the receipt address orphans, member stats still spend three display lines before "Three keys on this account", and the member ledger hides the "Period ending" header, so "12:33:56" reads as a clock error. |
| Copy and argument | 6 | The overcut receipt still argues two causes. The title says 0.38 is twice the cap, and the footer says the key already pulled its cap. Both are true for 0xEaD1 at 12:27:34, because its 12:24:10 pull is in the ledger with the period ending 12:29:10 (`home-full-1440.png`). But it is true by luck of `renewals[0]`, and nothing on the receipt reads it. The commit title claims "one cause on both routes", which the captures do not show. The redirect receipt is clean: "Platform key sends 0.19 to 0x0000…dEaD", then `CallNotAllowed` and a matching gloss (`member-try-1440.png`). "1,509 capped pulls settled" is still `complete * 3` worded as a count. |
| AI-slop (10 = none) | 8 | Nothing stock. The line card, per-code Try it, refusal elbows and receipt only make sense with this content. The texture is unchanged: uppercase micro-labels on nearly every block (CREATOR LINE, ONLY TO, CAP PER 5 MINUTES, KEY, BOUND TO, LEFT THIS PERIOD, PERIOD RESETS, FAN ACCOUNT, PERIOD ENDING, OWNER ONLY, ATTEMPT). The 390 hero wrap is one slop-list hit. |

Average 7.3, minimum 6.

Design Score: B-
AI Slop Score: B

## Questions

1. Designed product or styled document? A designed product, on all four routes.
2. Is the primary job obvious in 3 s? Home: yes at both widths. Member: yes, "Active" plus the countdown. Checkout: yes (judged on reused captures).
3. Would a competent practitioner produce exactly this without the content? No for the line card, the receipt and the refusal elbows. Yes for the uppercase-label texture.
4. Does the overcut receipt argue one cause now? No. It argues size in the title and exhaustion in the gloss, on both routes. The fix removed the only read instead of using it.
5. Is the home cheat receipt true this round? Yes for this attempt, by inference from the ledger row (0xEaD1 paid 12:24:10, period ending 12:29:10, attempt at 12:27:34). If the runner pays a new member just before the click, `renewals[0]` points at a key that still has 0.19 left. The gloss would then be false, while the title would still be true.

## Three highest-leverage fixes

1. Make the overcut receipt argue one cause from a read. Before `api.attack`, read the target's platform-key remaining at a block, then pick the copy. If left is 0: title "Platform key pulls 0.38 after its 0.19 cap is spent" with gloss "already pulled its cap". Otherwise: title "asks 0.38, twice its 0.19 cap" with gloss "asks more than the key has left this period". Make `REFUSALS.SpendingLimitExceeded` neutral ("The request is over what this key may still pull this period") so no path asserts unread exhaustion. Use the same code on home and member, and either use the `left` prop or delete it.
2. Undo the module-level `setHeroReceipt`. Lift the cheat state into `Home` (or pass an `onResult` prop into `LiveProof`), render the receipt from that state, delete the dead `cheat.res`/`cheat.error` writes, and use one timestamp. Pick the cheat member from the plan or runner so the button is live at first paint. Cap the receipt gloss at about 70ch, since the receipt is now full width.
3. Fix the 390 and layout leftovers. Keep "One fan signature." together at 390 (`text-wrap: balance`, or a `<br>` after "keys."). Show "Period ending" on member rows at 390, or relabel the top row "this period, paid 12:28:56". Pin the member stats so the countdown cannot reflow the header (fixed `min-width` on the countdown, or three fixed columns). Widen the home `rcpt__meta` cell so the chip stays on the date line.

## Numbers that look invented

- "This key already pulled its cap for the period. The account holds the rest." (`format.ts:28`) is a fixed gloss for every SpendingLimitExceeded. After r11 no remaining value is read on either route, so the claim is never backed by a read even when it is true.
- "1,509 capped pulls settled" / "1,500 capped pulls settled" is `complete × 3` (`Home.tsx:126`), a derivation worded as a count. It is not wrong in any capture, because every visible row is 3 OF 3 SETTLED.
- Verified and consistent: 503 × 3 = 1,509 and 500 × 3 = 1,500. Member 167 renewals = 167.00 pathUSD at 1.00, and 168 → 168.00 at 12:29:16 after the 12:28:56 pull. The member countdown "39s" at 12:28:18 ends at 12:28:57, which matches the 12:28:56 top row. "6s" at about 12:28:50 matches too, and "4m 40s" at 12:29:16 ends at 12:33:56, the 390 top row. The member history rows are exactly 5 minutes apart. Hashes for 0xC18a carry over between home and member (12:28:56 0x053585…18e916, 12:23:56 0x0243a7…6280b1). LEFT THIS PERIOD 0.00 of 0.80 / 0.19 / 0.01 matches the full black bars. The receipt blocks (39,238,621 at 1440, 39,238,635 at 390, 39,238,744 on member) are after the hero heads on their captures (39,238,611 and 39,238,626). On `/new`, 8.00 / 1.90 / 0.10 = 10.00 at a 20% cut with the 1% fee taken from the platform side.

Blind spot: I judged static captures and source only. The checkout captures are reused files, the outsider Try it was never captured, and I did not read the platform key's remaining limit at block 39,238,621 myself. Question 5 infers it from the ledger row.

AXES: avg=7.3 min=6
