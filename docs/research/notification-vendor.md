# Which notification service should Cadence use?

Research for [issue #2](https://github.com/bellcd/cohort-005-project/issues/2) (map: [#1](https://github.com/bellcd/cohort-005-project/issues/1)). Sources read 2026-11-09. Scope: **in-app notifications only**, hosted SaaS, building our own is ruled out.

## Recommendation

- **Pick: Knock.** It is the only candidate that clearly meets all of the first five criteria from first-party docs. The free tier needs no card. It ships a React feed plus headless hooks and a first-party Node SDK. Its feed auth uses **expiring, RS256-signed user JWTs** ("enhanced security mode"). Real-time arrives over a managed websocket. Its weakness is criterion 6: there's no self-host option.
- **Runner-up: Novu Cloud.** It ties Knock on criteria 1 to 3 and 5. On criterion 4 it is slightly weaker: its feed auth is a static HMAC-SHA256 of the subscriber id, which never expires. It wins criterion 6 outright, because its core is MIT-licensed and its community edition (Inbox included) can be self-hosted. Its next paid tier is also much cheaper ($30/mo against Knock's $250/mo). **If lock-in turns out to matter more than token strength, swap the order.**

## Scorecard (criteria in priority order)

| Criterion | Knock | Novu Cloud | Courier | MagicBell | SuprSend |
| --- | --- | --- | --- | --- | --- |
| 1. Free tier | 10,000 messages/mo, no card [K1] | 10,000 workflow runs/mo, unlimited subscribers, no card, 20 workflows, 3 team members [N1] | 10,000 sends/mo. Card requirement and Inbox inclusion not stated [C1] | 1,000 deliveries/mo ("Builder"). Card and Inbox inclusion not stated [M1] | 10k notifications/mo, no card. Inbox included, with SuprSend branding [S1] |
| 2. React feed + headless | `@knocklabs/react` feed components + hooks [K2][K3] | `@novu/react` `<Inbox />` + hooks [N2][N3] | `@trycourier/courier-react` `<CourierInbox />`, `useCourier` [C2] | `@magicbell/react` `Inbox`/`FloatingInbox`. No headless hooks documented on that page [M2] | `@suprsend/react` `Inbox` + hooks `useFeedClient`/`useFeedData` [S2][S3] |
| 3. Node server SDK | `@knocklabs/node` (Apache-2.0) [K4] | `@novu/api` [N4] | `@trycourier/courier` v7+ [C3] | JS client "Browser/Node" [M3] | Node SDK listed [S4] |
| 4. Per-user feed auth | RS256 JWT, `sub` = user id, expiring (default 3600 s) [K5] | HMAC-SHA256(secretKey, subscriberId), no expiry [N5] | Backend mints JWT via `POST /auth/issue-token` with `user_id:` scopes and `expires_in` [C2] | HS256 JWT signed with project secret key [M4] | ES256 JWT (`entity_id` = distinct_id), refresh callback [S5] |
| 5. Real-time | Managed websocket, SDK-managed [K6] | WebSocket. `useNotifications`/`useCounts` update live [N3][N6] | "Real-time socket" [C2] | Not documented on the pages read | "Feed socket" [S2] |
| 6. Lock-in / self-host | Hosted only. No self-host found [K7] | Core MIT. Community self-host includes Inbox + WS service [N6][N7] | Hosted only | Hosted only | Self-host on Enterprise only [S1] |

Not scored: other vendors, such as Engagespot or Stream's activity feeds. The five named candidates already cover the field, and two of them (Knock, Novu) meet every top-five criterion.

## Why Knock over Novu

The first three criteria are a tie. Both have a 10k/month free tier with no card, a drop-in React component plus headless hooks, and a typed Node SDK. Criterion 4 is the first real difference:

- **Knock**: the server signs a short-lived JWT (`signUserToken(userId, { expiresInSeconds })`, RS256, private signing key). If a token leaks, it stops working when it expires. [K5]
- **Novu**: the server computes `HMAC-SHA256(NOVU_SECRET_KEY, subscriberId)` as hex. The hash is deterministic and never expires. A leaked hash grants that user's feed until the secret key is rotated. [N5]

Both are **off by default**. Without them, the public key alone can read any user's feed. In Knock's words, "a request with your public key can act as any user" [K5]. In Novu's, someone "could potentially guess another subscriber's `subscriberId`" [N5]. Whichever vendor we pick, the integration boundary must turn the protection on.

Criterion 6 favours Novu: an MIT core and a community self-host that includes the Inbox components and the WebSocket service [N6][N7]. Since the criteria are in priority order, Knock wins on criterion 4 before criterion 6 is reached.

## Why not the others

- **Courier**: it has a capable Inbox and JWT auth with scopes, but the pricing page doesn't say whether Inbox is on the free Developer plan or whether a card is needed [C1]. Criterion 1 is unconfirmed.
- **MagicBell**: its free tier has only 1,000 deliveries/mo, and Inbox inclusion isn't stated [M1]. No headless hooks are documented on its React page [M2]. Its user JWT examples use a one-year expiry [M4].
- **SuprSend**: it's credible (10k free, no card, ES256 JWT, React hooks). However, the free feed carries SuprSend branding, self-host is Enterprise-only, and its React docs are thinner (the old `@suprsend/react-inbox` package has reached end of support) [S1][S2].

## Facts the integration boundary depends on (Knock)

- **Keys**: secret API key (server, `KNOCK_API_KEY`), public API key (client, `KNOCK_PUBLIC_API_KEY`), in-app feed channel id (`KNOCK_FEED_CHANNEL_ID`), signing key (server, `KNOCK_SIGNING_KEY`, shown once in the dashboard, base-64 PEM) [K2][K4][K5].
- **User identification**: recipients are plain string ids, so Cadence's user id can be used directly. Users can be identified inline in the trigger by passing a full recipient object (`id`, optional `channel_data`, `preferences`) [K8].
- **Trigger (server action)**: `knock.workflows.trigger('<workflow-key>', { recipients: ['<userId>'], data: {...}, actor?, tenant? })`. Up to 1000 recipients per call [K4][K8].
- **Feed auth**: enable **enhanced security mode** per environment. The server calls `signUserToken(userId, { expiresInSeconds })` from `@knocklabs/node/lib/tokenSigner`, and the client passes the token as `userToken` [K5]. With DevUI user switching, a fresh token must be signed whenever the session user changes. Enhanced security can stay off in the Development environment [K5].
- **React components** (`@knocklabs/react`, plus `import "@knocklabs/react/dist/index.css"`): `KnockProvider` (`apiKey`, `user={{ id }}`, `userToken`), `KnockFeedProvider` (`feedId`), `NotificationIconButton` (`badgeCountType="unread"`), `NotificationFeedPopover`, `NotificationFeed` (`renderItem`, `onNotificationClick`), `NotificationCell` [K2].
- **Headless hooks**: `useKnockClient`, `useNotifications(client, feedId)`, `useNotificationStore(feedClient)` → `items`, `metadata`. The feed client has `fetch()`, `markAsSeen`, `markAllAsSeen` [K3].
- **Message states**: unseen, seen, read, archived (archived items leave the feed) [K9].
- **Real-time**: a managed websocket, with connection and reconnect handled by the SDK. Optional auto-disconnect for inactive tabs and cross-tab sync through BroadcastChannel [K2][K6].
- **Retention**: the free plan lists unlimited feed retention [K1].

If Novu is chosen instead: `@novu/api` `novu.trigger({ workflowId, to: { subscriberId }, payload })` [N4]. `@novu/react` `<Inbox applicationIdentifier subscriber subscriberHash />` or `NovuProvider` + `useNotifications`/`useCounts`/`useNovu` [N3][N5][N8]. HMAC is enabled on the Novu In-App integration in the dashboard [N5].

## Sources

- [K1] Knock pricing: https://knock.app/pricing
- [K2] Knock React feed: https://docs.knock.app/in-app-ui/react/feed
- [K3] Knock headless feed: https://docs.knock.app/in-app-ui/react/headless/feed
- [K4] knock-node README: https://github.com/knocklabs/knock-node
- [K5] Knock security & authentication: https://docs.knock.app/in-app-ui/security-and-authentication
- [K6] Knock socket behavior: https://docs.knock.app/in-app-ui/feeds/socket-behavior
- [K7] Knock site search for self-host / on-prem (none found. Knock open-sourced only its docs): https://knock.app/blog/open-sourcing-our-documentation
- [K8] Knock triggering workflows via API: https://docs.knock.app/send-notifications/triggering-workflows/api
- [K9] Knock in-app channel: https://docs.knock.app/integrations/in-app/knock
- [N1] Novu pricing: https://novu.co/pricing
- [N2] Novu Inbox overview: https://docs.novu.co/platform/inbox/overview
- [N3] Novu headless mode: https://docs.novu.co/platform/inbox/headless-mode
- [N4] Novu TypeScript server SDK: https://docs.novu.co/platform/sdks/server/typescript
- [N5] Novu Inbox prepare for production (HMAC): https://docs.novu.co/platform/inbox/prepare-for-production
- [N6] Novu self-hosted vs cloud: https://docs.novu.co/community/self-hosted-and-novu-cloud
- [N7] Novu repo (MIT core, `enterprise/` commercial): https://github.com/novuhq/novu. Self-host overview: https://docs.novu.co/community/self-hosting-novu/overview
- [N8] NovuProvider: https://docs.novu.co/platform/sdks/react/hooks/novu-provider
- [C1] Courier pricing: https://www.courier.com/pricing
- [C2] Courier Inbox authentication: https://www.courier.com/docs/platform/inbox/authentication
- [C3] Courier Inbox overview: https://www.courier.com/docs/platform/inbox/inbox-overview
- [M1] MagicBell pricing: https://www.magicbell.com/pricing
- [M2] MagicBell React: https://www.magicbell.com/docs/libraries/magicbell-react
- [M3] MagicBell docs index: https://www.magicbell.com/docs
- [M4] MagicBell user JWT: https://www.magicbell.com/docs/api/authentication/user
- [S1] SuprSend pricing: https://www.suprsend.com/pricing
- [S2] SuprSend React inbox: https://docs.suprsend.com/docs/inbox-react and https://docs.suprsend.com/docs/react-in-app-feed.md
- [S3] SuprSend React headless: https://docs.suprsend.com/docs/react-sdk-headless-feed.md
- [S4] SuprSend backend SDKs: https://docs.suprsend.com/reference/overview.md
- [S5] SuprSend client authentication: https://docs.suprsend.com/docs/client-authentication
