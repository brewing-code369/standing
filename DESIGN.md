# STANDING design system

Hallmark catalog theme: **Grid**, signal ink **yellow**. Macrostructure: **Map / Diagram** (one wire diagram carries the page). Genre: editorial-technical.

A membership card has three sealed lines. Each line names who gets paid and the cap the chain enforces. The cap is a solid yellow bar whose length is the share. The seal is an ink bar where the line meets its recipient. Anything outside the line ends in a dead-end stub that carries the chain's own revert name. The cap and the refusal are the picture.

## Tokens

```css
:root {
  --color-paper: oklch(99% 0.003 255);
  --color-paper-2: oklch(97.2% 0.004 255);
  --color-paper-3: oklch(94.5% 0.005 255);
  --color-ink: oklch(16% 0.010 255);
  --color-muted: oklch(45% 0.012 255);
  --color-rule: oklch(88% 0.005 255);
  --color-accent: oklch(82% 0.17 95);
  --color-accent-ink: var(--color-ink);
  --color-ok: oklch(46% 0.12 150);
  --color-refuse: oklch(50% 0.19 28);
  --color-focus: var(--color-ink);

  --font-display: 'Archivo', sans-serif;
  --font-body: 'Archivo', sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;
  --display-weight: 800;
  --tracking-display: -0.045em;

  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px;
  --space-6: 24px; --space-8: 32px; --space-12: 48px; --space-16: 64px; --space-24: 96px;

  --text-xs: 12px; --text-sm: 14px; --text-md: 16px; --text-lg: 20px; --text-xl: 28px; --text-2xl: 40px;
  --text-display: clamp(52px, 9vw, 120px);

  --radius-card: 0;
  --radius-chip: 2px;
  --ease-out: cubic-bezier(0.2, 0.7, 0.2, 1);
  --dur: 0.18s;
}
```

## Type

- Display: Archivo 800, lowercase, tracking -0.045em, leading 0.9. Slammed to the left margin.
- Body: Archivo 400 and 500 at 16px, leading 1.5. Tabular figures on every amount.
- Label voice: Archivo 600, 12px, uppercase, tracking 0.09em, muted. Captions, column heads, folios.
- Mono: JetBrains Mono 500 at 12 to 13px for addresses, hashes and revert names only.

## Material

- Twelve exposed hairline columns behind the content, 1280px shell. The grid is visible across every band.
- Hairlines and ink rules carry the structure. Zero radius on surfaces, no shadows, no gradients.
- One flooded yellow plate per page. Yellow is a fill that carries ink text. Yellow type on paper does not occur.
- Status is a chip with a glyph and text: active (ink fill), paid (yellow fill), refused (outlined, red revert name), revoked (struck through).

## Components

- **Wire** (the card line): role label, recipient and explorer link, cap bar scaled to the share, amount at the bar end, seal mark, refusal stub.
- **Receipt row**: period, member, three pulls under the three wire columns, each a tx link.
- **Plate**: the single yellow band carrying the primary action.
- **Stepper**: key, funding, one signature. One active step at a time.

## Motion

Cap bars draw once with `transform: scaleX`. Rows shift 8px and tint on hover. `prefers-reduced-motion: reduce` removes all of it.
