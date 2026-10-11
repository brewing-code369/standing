# STANDING web UI review, round 1 (fresh critic, demo-judge)

Captures read: s1-home-1440, s1-home-390, s1-plan-1440, s1-plan-390, s1-member-1440, plus live captures taken 2026-10-12 09:10 local: /tmp/st-home-full.png (1440x2600), /tmp/st-member.png (1440x2400), /tmp/st-new.png (1440x1600). Member page DOM polled at 5s, 17s and 29s after load in a deepsurge tab.

## Gate zero

- Verb the brief names: "products that integrate with the Tempo blockchain"; host ask: "build recurring or scoped billing flows using stablecoins ... using access keys and periodic spending limits" (quoted in WIN-CONDITIONS.md).
- Code path that performs it: src/core/pull.ts:66 `pull()` (each key signs transferWithMemo), checkout `authorizeKey` batch via src/web/pages/Checkout.tsx, cancel via `cancelCalls` in src/web/pages/Member.tsx:136. Home ledger renders real settled triples (12 Oct 09:14:10, 09:14:04, 09:13:56, each "3 OF 3 SETTLED" with explorer hashes).
- What won last time: not verified by name in this review (Tempo track is new; no prior-edition winner list read).
- VERDICT: ELIGIBLE. It transacts, it is not read-only.

## Verdict

ARTIFACT: http://127.0.0.1:8644/ (all four routes)
VERDICT: REWORK

| Axis | Score | Evidence |
|---|---|---|
| Visual hierarchy | 6 | Home hero is a ~120px slogan ("three lines. one signature") that carries no data; the price 1.00 is ~34px in a sub-row; at 1440x900 only the creator line is above the fold, so the "three lines" the headline promises show one. |
| Typography | 7 | Grotesk display plus mono for addresses and revert names is disciplined and consistent. Lowercase period-terminated headings are a strong voice but repeated on every section. |
| Color and semantic use | 5 | All three split bars are the same brand yellow; creator, platform and fee are not distinguishable by color. Red is used correctly for CallNotAllowed / SpendingLimitExceeded. Green dot for runner freshness is good but tiny (footer only). Disabled checkout steps are grey enough to be hard to read. |
| Spacing and layout | 6 | Swiss 12-column grid with visible column rules. The rules run through body text ("Pulled so far" table, ledes) and add noise. Member hero leaves the right 60% empty above the stat list. |
| Component quality | 5 | Ledger table, split rows, attack panel and checkout stepper are well built. Member page is broken in practice: h1 reads "reading." at 104px and every stat reads "reading" for 30s+, renewal history stays a skeleton, and "There is nothing to cancel on this account" renders while the membership has not loaded, for an account the home ledger shows settling at 09:13:56. |
| Responsive at 390 | 6 | Hero, CTAs and checkout stack cleanly. Header takes three rows (wordmark, nav, MODERATO), about 120px of the first screen. Split rows not checked narrow beyond the plan page. |
| Copy and argument | 6 | Sub-line "the platform takes its cut without ever holding the creator's money" is the right claim. The refusal annotations under each bar make the novel claim concrete. But the headline sells the mechanism (lines, signature), not the outcome, and checkout lede reads "Demo creator wallet on Demo platform wallet." which is raw interpolation. |
| AI-slop (10 = none) | 6 | Distinct direction, not a shadcn template. Tells: identical "FAN ACCOUNT / One signature installs the three keys..." block repeated verbatim on all four routes; every section the same "lowercase word + period" heading; decorative column rules; four-step yellow band with square bullets reads as a generic how-it-works strip. |

Average 5.9, min 5.

## Answers

1. **Designed product or styled document?** Designed product on home, /new and checkout: the live ledger and the live split preview on /new are real product surfaces. The member page currently ships as a styled document full of placeholders.
2. **Primary job obvious in 3 seconds?** Half. "Join the demo membership" is the dominant button and the sub-line names the outcome. "Chain enforces the split" is not visible in 3 seconds at 1440x900 because two of the three capped lines and every refusal sit below the fold.
3. **Would a competent practitioner produce exactly this without thinking about the content?** No for the split rows (cap bar, recipient lock, named reverts) and the "try to cheat" panel; those are content-specific. Yes for the yellow four-bullet band and the repeated fan-account preamble.
4. **Three highest-leverage fixes**
   - **Member page hero ("reading." h1, Next renewal, stats).** Fix the load so `loadMembership` resolves or surfaces `memError`; never render "There is nothing to cancel" while `mem` is null. Until it resolves, show the plan's known values, not the word "reading" at 104px. This is the page a judge lands on after joining.
   - **Home first screen.** Replace the slogan-only hero with the three split lines themselves, compressed to one row each (creator 0.80 / platform 0.19 / STANDING 0.01, recipient lock, a live "last pull 09:14:10, 3 of 3 settled" stamp) beside the CTA, so "the chain caps each cut" is visible at the fold. Give each line its own hue so the split reads as a split.
   - **"Try to cheat" panel.** It is the strongest proof on the site and it sits at y~1500 on the member page only. Put a one-click version on home (run against a demo member) with the returned revert name and tx hash inline.

## Numbers and claims that look unsourced

- "sixty seconds, three pulls." (Home.tsx:135): the demo plan renews every 5 minutes; nothing measures a 60-second join-to-pull path on screen.
- "DEMO PLAN, READ FROM THE CHAIN" (Home.tsx:80): the plan object comes from `api.demoPlan()` (runner API), not a chain read. Caps are on chain per member; the plan record is not. Either read the caps from a member's keys or relabel the source.
- Checkout lede "Demo creator wallet on Demo platform wallet." is template interpolation, not a claim, but reads like a bug.
- Ledger hashes, 0.80/0.19/0.01 split (1% fee out of a 20% cut on 1.00) and /new preview (8.00 / 1.90 / 0.10 on 10.00 at 20%) are internally consistent.

## Blind spot

Member-page "reading" may depend on RPC rate limits at capture time; I polled 30s once and did not read the browser console or network log.
