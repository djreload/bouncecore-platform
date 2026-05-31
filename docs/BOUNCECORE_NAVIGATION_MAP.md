# Bouncecore Navigation Map

## Public Navigation

- Home: `/`
- Live: `/live`
- Chat: `/chat`
- DJs: `/djs`
- Producers: `/producers`
- Music: `/music`
- Shop: `/shop`
- Rewards: `/rewards`
- Account: `/account`

Logged-out users see Login and Register. Logged-in users should later see Account, Profile, Dashboard, and Logout.

## Account Dashboard Navigation

- Overview: `/account`
- Profile: `/account/profile`
- Orders: `/account/orders`
- Downloads: `/account/downloads`
- Rewards: `/account/rewards`
- Notifications: `/account/notifications`
- Security: `/account/security`
- Settings: `/account/settings`

## DJ/Streamer Dashboard Navigation

These appear inside the same dashboard shell when the user has DJ/Streamer access:

- Streamer overview: `/streamer`
- My stream key: `/streamer/stream-key`
- Stream status: `/streamer/status`
- Stream health: `/streamer/health`
- My schedule: `/streamer/schedule`
- Public DJ profile: `/streamer/profile`
- OBS setup help: `/streamer/obs`

## Producer Dashboard Navigation

These appear inside the same dashboard shell when the user has Producer access:

- Producer overview: `/producer`
- My tracks: `/producer/tracks`
- Upload track: `/producer/upload`
- Review status: `/producer/reviews`
- Licenses: `/producer/licenses`
- Sales: `/producer/sales`
- Downloads: `/producer/downloads`
- Producer profile: `/producer/profile`

## Admin Sidebar

Overview:

- Dashboard: `/admin`
- System health: `/admin/system-health`
- Audit logs: `/admin/audit-logs`

Users & Access:

- Users: `/admin/users`
- Roles: `/admin/roles`
- Permissions: `/admin/permissions`
- VIP supporters: `/admin/supporters`

Live Streaming:

- Stream dashboard: `/admin/stream`
- Stream keys: `/admin/stream-keys`
- Stream sessions: `/admin/stream-sessions`
- Schedules: `/admin/schedules`

Chat & Moderation:

- Chatrooms: `/admin/chatrooms`
- Reports: `/admin/reports`
- Bans: `/admin/bans`

Music Marketplace:

- Tracks: `/admin/tracks`
- Producer approvals: `/admin/producer-approvals`

Merch Shop:

- Products: `/admin/products`
- Orders: `/admin/orders`
- Fulfilment: `/admin/fulfilment`

Payments & Money:

- Payments: `/admin/payments`
- Stars: `/admin/stars`

Rewards:

- Spin wheels: `/admin/spin-wheels`
- Prize claims: `/admin/prize-claims`

Mobile App:

- App config: `/admin/mobile`
- Push notifications: `/admin/push`

Site & Design:

- Pages: `/admin/pages`
- Menus: `/admin/menus`
- Themes: `/admin/themes`

Settings:

- General settings: `/admin/settings`
- Integrations: `/admin/integrations`

## Mobile Navigation

Mobile should prioritise:

- Home
- Live
- Chat
- Music
- Shop
- Account

Secondary items can live in an Account menu or expandable drawer once auth is implemented.

## Role-Based Visibility

- Owner: sees all admin and account sections.
- Admin: sees all admin and account sections except owner-only ownership controls.
- Moderator: sees moderation tools, reports, bans, timeouts, and logs. No raw stream-key access by default.
- DJ/Streamer: sees streamer dashboard and own stream-key tools.
- Producer: sees producer dashboard and own marketplace tools.
- Customer: sees orders, downloads, rewards, security, settings.
- Viewer: sees profile, public chat, follows, rewards where allowed.
- Supporter/VIP: sees VIP perks, stars wallet, prize wins, rewards.

## Breadcrumb Strategy

Use simple breadcrumbs at the top of page shells:

- Public: `Home / Section`
- Account: `Account / Section`
- Streamer: `Account / Streamer / Section`
- Producer: `Account / Producer / Section`
- Admin: `Admin / Group / Section`

Breadcrumbs should be generated from route metadata once route modules mature.

## Admin Quick Search and Quick Actions

Admin should include global quick search for:

- Users
- Orders
- Stream keys
- Stream sessions
- Chat reports
- Tracks
- Products
- Payments
- Prize claims

Quick actions should include:

- Create user
- Rotate stream key
- Create chatroom
- Add product
- Approve track
- Send notification
- Create spin wheel
- Open system health
