# STANDING signals (read 2026-10-11)

Every X quote below was fetched in full from api.fxtwitter.com on 2026-10-11 (`curl -m 20 -s https://api.fxtwitter.com/<user>/status/<id>`).
None of these URLs is in tempo/research/signals/tweets.jsonl, so `xsignals verify` will not accept them until a harvest
adds them; the harvest scrapes x.com through the browser, which the track rules forbid after the rate-limit incident.

## Host asks
- https://x.com/tempo/status/2080073778693063123 (@tempo, 2026-07-22)
> If you want to build recurring or scoped billing flows using stablecoins, Tempo makes it easy using access keys and periodic spending limits.
> Access keys enable subscription billing onchain, without needing to re-prompt users or hold their keys, for both humans and agents alike.
- https://x.com/AtownBrown/status/2096977044659704270 (sponsor, already in tempo/research/signals/signals.md)

## People who want it (direct asks are on GitHub, not X)
- https://github.com/wevm/mppx/discussions/905 (nofluffdev, 2026-09-17)
> For a marketplace with recurring payments that means being the recipient and paying creators out, i.e. holding money that isn't ours.
- https://github.com/wevm/mppx/issues/920 (EfeDurmaz16, 2026-09-27)
> A simple example: a $10 membership pays $8 to the creator and $2 to the platform each period.
- https://github.com/wevm/mppx/issues/920 comment (EfeDurmaz16)
> The key still permits 10/0 or an omitted share
- https://github.com/wevm/mppx/discussions/905 comment (horn111, 2026-09-30)
> I'm a solo builder exploring a Tempo testnet demo for fixed creator/platform splits on renewals.

## X posts: pain about platforms holding creator money (not Tempo-specific)
- https://x.com/iam_kinging77/status/2105585788708647038 (2026-10-01)
> Self-custodial is the part creators should pay attention to. No platform holding your tips means no account freeze, no payout threshold, no waiting.
- https://x.com/PantyhoseParty/status/2108947260403024245 (2026-10-10)
> A creator's earnings frozen for weeks, identity verification with no appeal path, support cases auto-closed by bots.
- https://x.com/btcnewsalerts/status/2108967989815210120 (2026-10-10)
> TWO payment checks are still missing.

## Rivals seen on X
- https://x.com/0xPolygon/status/2102837278620176787 (2026-09-23): "Introducing stablecoin subscriptions: now live in Polygon OMS."
- https://x.com/Agent402Tools/status/2106082182888591536 (2026-10-02): one-time MPP splits on Tempo, "up to ten other wallets in the same transaction".
- https://x.com/auras_pay/status/2107432753398505742 (2026-10-06): "Platform Fee Contract is owned by your wallet ... Non-custodial."
