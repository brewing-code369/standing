# STANDING design review, round 2 (fresh critic: demo-judge)

Date: 2026-10-12. Viewed: s4-home-1440.png and s4-home-390.png, plus fresh captures of `/` (1440x4200 and 390x6000) and `/p/c42ee655` (1440x2400), computed styles read from the live DOM, and two cheat buttons clicked against the live API. The `/m/...` member page was judged from a capture taken while it was still loading (its reads take about 10 s).

## Gate zero

- Verb the brief names: Tempo's own post, "If you want to build recurring or scoped billing flows using stablecoins, Tempo makes it easy using access keys and periodic spending limits" (x.com/tempo/status/2080073778693063123). The sponsor adds: "Bonus points ... integrating @mpp".
- Code path that does it: `src/core/pull.ts:66-95` (`pull()` sends `transferWithMemo` signed by a recipient-bound access key, sponsored by the runner, and waits for the receipt); `server/index.ts:193-198` (the live cheat attempts); the keychain install happens in checkout.
- Checked live: "Take more than the cut" returned `SpendingLimitExceeded` ("Platform key pulls 0.38, twice its cut", 09:32:42). "Send the cut elsewhere" returned `CallNotAllowed` (sends 0.19 to 0x...dEaD, 09:33:02). The ledger reads "1181 pulls in 394 renewals, read through block 39,221,012".
- What won last time: not checked. I found no prior Tempo-track winners to compare against.
- VERDICT: ELIGIBLE. The product moves money on chain every period. It is not a read-only product.

## Scores

| Axis | Score | Evidence |
|---|---|---|
| Visual hierarchy | 6 | The largest element is the 84px slogan "three lines. one signature", which carries no data. The biggest number is the price, `1.00`, at 40px, the same size as the three caps. The right half of the hero is an empty grid above the CTAs. A "FAN ACCOUNT" label sits alone with nothing next to it, because the home card passes no `account`. |
| Typography | 7 | Archivo 800 display with tight tracking, 12px/600 caps labels, JetBrains Mono 12.5px for hashes and revert names. The scale is disciplined. The checkout H1 wraps to "renews every 5 / minutes" with an orphan. |
| Color and semantic use | 6 | Red `oklch(0.5 0.19 28)` is used only for revert names, which is good. The green dot on the runner tick is good. Brand yellow does three jobs: the share bar, a decorative full-bleed band, and the "3 OF 3 SETTLED" success chip. So a success state looks the same as decoration. |
| Spacing and layout | 7 | A consistent 12-column grid, wire rows that line up across all three lines, and a clean receipts table. The visible column rules are decoration that does no work. The hero leaves about 250px of empty grid on the right at 1440. |
| Component quality | 7 | The wire row (role, cap bar, cap, recipient seal, refusal stubs) is a real, specific component. The cheat log appends timestamped REFUSED entries. The cheat buttons are plain outlined boxes with no pending state I could see. The home bars show the static share width, not what has been spent this period, because no `states` are passed on home. |
| Responsive at 390 | 6 | Nothing breaks. The nav wraps to three rows with MODERATO on its own line. Each renewal stacks into a 4-row block, so 6 renewals take about 1,500px. The cheat panel starts about 4,000px down, far below the fold. |
| Copy and argument | 7 | "try to cheat a live member." and "you run a platform." are strong and specific. The hero slogan only makes sense after you have seen the wires. The checkout subtitle is garbled: "Creator Demo creator wallet · platform Demo platform wallet". "Demo" appears in nearly every heading, which makes the product feel like a sandbox. |
| AI-slop (10 = none) | 6 | Every heading follows the same lowercase-plus-period pattern ("latest renewals.", "cancel.", "what the chain refuses.", "reading."). The same CTA, "Join the demo membership", appears three times on one page. A yellow band holds a 4-step list. The grid-line background is decorative. On the plus side, the wire component and the live refusal log are not things a template would produce. |

Average 6.5, minimum 6.

## Questions

1. **Designed product or styled document?** Mostly a designed product. The membership card and the cheat log are real product components. The home page still reads as an essay with a demo inside it: the proof (the ledger and the cheat panel) sits at 1,700 to 2,500px on desktop.
2. **Primary job obvious in 3 s?** Partly. The lede says "platform takes its cut without ever holding the creator's money", and the 0.80 / 0.19 / 0.01 rows show the split. What the 3 seconds miss is the claim that it is live: no block height, renewal count or runner status appears above the fold. All three exist, just lower down and in the footer.
3. **Would a competent practitioner produce exactly this without the content?** No, for the wire rows and the refusal stubs. Yes, for the hero, the yellow CTA band and the closing "you run a platform" section, which are standard landing-page scaffolding.
4. **Three highest-leverage fixes:** see below.

## Top three fixes

1. **Put the proof in the first viewport.** Replace the empty right half of the hero with a live status strip: `394 renewals · 1,181 pulls · block 39,221,012 · runner ticked 8s ago`. Give it one inline cheat button whose revert name animates against the platform bar as it hits its cap. Today the strongest moment on the site, the chain refusing a live cheat, starts about 2,500px down at 1440 and about 4,000px down at 390.
2. **Give every refusal its provenance.** The refusal entry shows only the revert name. Add the RPC, the block height when it was attempted, what was attempted (key, to, amount), and the cap remaining from `getRemainingLimitWithPeriod`, so a judge can check it rather than take the string on trust. `pull()` catches the error before any tx hash exists, so say that it was rejected before inclusion and show the block it was checked against.
3. **Fix color meaning and the state bugs.** Give "3 OF 3 SETTLED" an ink or green settled color instead of the brand yellow. Pass live `states` to the home card so the bars show what has been pulled this period. On `/m/...`, stop rendering "reading." as a 100px H1. "There is nothing to cancel on this account" appears while the keys are still loading, which is a false statement during load. Rewrite the checkout subtitle as "0.80 to the creator, 0.19 to the platform, 0.01 to STANDING".

## Claims that look invented or unsourced

- "1181 pulls in 394 renewals": this comes from the logs, but 394 x 3 = 1182. One renewal is short a pull, while every row shown says "3 OF 3 SETTLED". Either show the partial renewal or explain the count.
- Cheat refusals: real (verified live), but they carry no block or hash on screen, so a viewer cannot verify them.
- Member page "There is nothing to cancel on this account": shown before the data loads, so it is false for a member who has active keys.
- "receives 1% of the price, out of the platform cut": computed from plan shares, and consistent (0.19 + 0.01 = 0.20).
- "kept non-extractable" (checkout): this relies on the ox `WebCryptoP256.createKeyPair` default. The code passes no explicit flag (`src/web/lib/wallet.ts:44`).

## Single highest-leverage fix

Move a live cheat button and a block, renewals and runner status strip into the hero's empty right half, so the chain refusing a cut is the first thing anyone sees.
