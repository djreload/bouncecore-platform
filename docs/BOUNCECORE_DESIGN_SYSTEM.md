# Bouncecore Design System

## Brand Personality

Bouncecore should feel premium, dark, fast, high-energy, UK rave-focused, and professional enough for admins and creators to use daily. It should not look like a default framework install or an Owncast reskin.

## Colour Palette

- Void black: `#05050a`
- Ink black: `#0b0d14`
- Panel: `#111421`
- Raised panel: `#171a2a`
- Line: `#2b3148`
- Muted text: `#a7b0c4`
- Electric cyan: `#00d5ff`
- Neon pink: `#ff2bd6`
- Acid green: `#b6ff2e`
- Violet: `#8b5cf6`
- Amber: `#ffb020`
- White text: `#f7fbff`

Use multiple accent families so the interface does not become a single-hue theme.

## Typography

- System sans stack for performance and reliability.
- Large bold headings for public and dashboard landmarks.
- Smaller, tighter headings inside cards, sidebars, tables, and forms.
- Letter spacing remains normal.
- Avoid viewport-scaled font sizes.

## Layout System

- Public shell: sticky top navigation, mobile-friendly horizontal nav wrap, full-width sections.
- Dashboard shell: sidebar plus content on desktop, stacked on small screens.
- Admin shell: wider sidebar with grouped sections and quick search.
- Cards use 8px radius or less.
- Avoid nested cards.
- Use stable dimensions for players, nav rows, buttons, stats, and dashboards to prevent layout shift.

## Component Rules

- Buttons use icons where they represent a clear action.
- Badges communicate status, role, or module state.
- Tables should include filters, search, bulk actions, row actions, and empty states.
- Forms should include labels, helper text, validation states, and clear destructive-action styling.
- Stream-key views must visually separate ingest URL from private stream key.

## Public UI Rules

- First viewport should make Bouncecore obvious.
- Use real/generative stage or product media where useful.
- Public pages should show live/offline badges, DJ cards, producer cards, track cards, merch cards, chatroom UI, supporter/VIP badges, and rewards visuals as modules land.
- Avoid public exposure of admin concepts or private stream secrets.

## Admin UI Rules

- Dark, readable, restrained.
- Prioritise scanning, filtering, and repeated work.
- Group related features.
- Keep actions consistent across modules.
- Include breadcrumbs, page headings, descriptions, and audit visibility.
- Make destructive actions explicit and reversible where possible.

## Dashboard UI Rules

- Account dashboard uses one consistent shell.
- Role-specific sections appear inside the same account shell.
- Streamer dashboard needs status, health, key, OBS setup, schedule, public profile, and go-live context.
- Producer dashboard needs uploads, tracks, approvals, licenses, sales, downloads, and profile context.

## Mobile Responsiveness

- Navigation wraps cleanly on small screens.
- Sidebars stack above content.
- Cards use one column on mobile.
- Inputs and buttons remain touch-friendly.
- Text must not overlap controls or overflow buttons.

## Accessibility and Contrast

- Maintain strong contrast on dark backgrounds.
- Use visible focus states.
- Do not rely on colour alone for status.
- Keep hit targets at least 40px tall.
- Use semantic headings and labels.
- Avoid excessive animation for admin workflows.
