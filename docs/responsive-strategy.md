# Responsive Layout Strategy

## Breakpoint Categories

- **Compact** (`≤640px` — Tailwind `sm` and below): mobile phones and narrow viewports.
- **Medium** (`641px – 1024px` — Tailwind `md`): tablets and small laptops.
- **Wide** (`≥1025px` — Tailwind `lg` and above): desktop first layout target.

## Layout Objectives Per Zone

### Header
- Compact: stack logo, nav, and CTA vertically with centered alignment and condensed spacing.
- Medium: logo and nav share a row, CTA wraps below as needed; introduce hamburger overflow for nav links.
- Wide: maintain current three-column layout with generous spacing.

### Market Ticker
- Compact: ticker bar becomes horizontal scroll list with reduced padding; high/low stats wrap beneath ticker.
- Medium: ticker and stats split vertically with shared gap, ensuring no horizontal overflow.
- Wide: ticker stretches full width with stats inline on the right.

### Chart & Controls
- Compact: chart tabs and toggles collapse into wrapped rows; chart height locks to ~55vh with minimum of 320px.
- Medium: chart gains 65vh height and tabs align in two rows; overlay badges move under chart.
- Wide: chart retains overlay badges on the right and 500px+ height.

### Summary Cards
- Compact: single column card list with horizontal scroll fallback.
- Medium: responsive grid (`grid-cols-2` / `grid-cols-3`) with `minmax` sizing.
- Wide: six-column grid matching desktop design.

### Right Panel & Tabs
- Compact: right panel collapses below chart with accordion behaviour; tabs turn into horizontally scrollable pill strip.
- Medium: panel sits below chart but splits sections via two-column responsive grid where possible.
- Wide: fixed-width side panel aligned to the right (max `420px` or 30% of viewport).

### Tables & Feeds
- Compact: convert table rows to stacked cards with labelled fields; ensure accessible headings.
- Medium: tables maintain tabular layout inside `overflow-x-auto`, but tighten padding.
- Wide: tables retain current spacing with zebra hover states and sticky headers.

### Images & Icons
- Compact: icons limited to `clamp(1rem, 2.5vw, 1.75rem)`; logos never exceed container width.
- Medium: scale icons up to `2rem` while keeping `object-fit: contain`.
- Wide: original sizing preserved with `max-width: 100%`.

## Testing & QA Workflow

- **Viewport presets**: validate on Chrome DevTools (`360×640`, `390×844`, `768×1024`, `1024×1366`, `1440×900`) and ensure the header, ticker, chart panel, and right rail rearrange as expected.
- **Real device smoke**: iPhone 13/14, Pixel 7, iPad (portrait + landscape), and 13″ MacBook (Safari + Chrome) to check touch targets, scroll areas, and sticky behaviour.
- **Regression checklist**:
  - Navigation toggles collapse/expand correctly after viewport changes.
  - Right panel hides by default on `<1024px` and restores on larger widths.
  - Tables fall back to card layouts with headings preserved for accessibility.
  - Equity chart resizes without clipping axes or badges; tooltips stay readable.
- **Automation hooks**: add Storybook stories or Percy snapshots for header, ticker, chart, positions, and leaderboard states at `sm`, `md`, `lg` breakpoints. Run in CI as part of visual regression stage.
- **Performance sampling**: Lighthouse mobile run after major responsive updates to ensure layout shifts stay below 0.1 CLS and interaction stays under 200 ms.

## Implementation Roadmap

1. **Phase 1 – Navigation Band**: refactor header and ticker (complete). Review checkpoint to confirm collapse logic and scroll behaviour.
2. **Phase 2 – Core Layout**: restructure chart area and right panel (complete). Verify chart resizing and sticky side rail behaviour before merging.
3. **Phase 3 – Data Displays**: adapt model summaries, trades, positions, leaderboard (complete). Cross-verify mobile card conversions maintain semantic labels.
4. **Phase 4 – QA Automation**: wire responsive Storybook/Percy runs and document manual regression suite; schedule bi-weekly responsive sweeps.
5. **Phase 5 – Future Enhancements**: explore modal responsiveness, add keyboard controls for collapsible panels, and monitor analytics for viewport-specific issues.
