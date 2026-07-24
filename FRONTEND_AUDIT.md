# Campus Connect — Frontend Audit

**Scope:** Web app (`frontend/`, Next.js 16) and Mobile app (`mobile/`, Expo / React Native)
**Date:** 2026-06-20
**Audited against backend API:** `backend/app/api/v1/`
**Method:** Static code review — all findings verified against current source (not logs).

> Legend — Severity: 🔴 High · 🟠 Medium · 🟡 Low · ⚪ Info. Platform: 🌐 Web · 📱 Mobile · 🔀 Both.

---

## 1. Executive Summary

**Overall health: better than "lacks a lot."** Both apps are **feature-complete** across every
backend capability — auth + OTP, feed, posts, comments, clubs, events, marketplace, messaging,
notifications, academics, admin, and moderation. The mobile app is genuinely substantial (proper
token refresh, WebSocket token rotation, theming, push notifications).

Crucially, **both apps share a consistent design system**:
- Identical RGB palette — light accent `#2563eb` (37 99 235), dark accent `#60a5fa` (96 165 250), same success/warning/error/like/repost tokens.
- Both use the **Inter** font and the same semantic token names (`background`, `surface`, `text-primary/secondary`, `border`, `accent`, `card`, `muted`, etc.).

So the foundation is consistent. The real problems fall into four categories:
1. **Cross-platform crashes** (one hard crash on Android).
2. **Fake / no-op "report" flows** that silently drop user reports (trust issue).
3. **Feature-parity gaps** between web and mobile.
4. **Production polish** — inconsistent states, hardcoded colors, silent error swallowing.

**Headline issues (fix first):**
- 🔴 `Alert.prompt()` in mobile Moderation → **Android crash**.
- 🔴 Mobile PostCard + Club report flows are **no-ops** — reports never reach the API.
- 🔴 Web `report-modal.tsx` uses **non-existent CSS tokens** → broken styling.
- 🟠 Mobile can **create** polls but cannot **view or vote** on them.
- 🟠 Mobile PostCard renders only the **first image** of multi-image posts.

---

## 2. 🔴 High-Severity Findings

### H1 — Mobile Moderation crashes on Android (`Alert.prompt` is iOS-only)
- **Platform:** 📱 Mobile
- **Location:** `mobile/app/moderation/index.tsx:116` and `:134`
- **What's wrong:** `Alert.prompt(...)` is a React Native API that **only exists on iOS**. On Android it throws — there is no `prompt` method. Both `handleResolve` and `handleDismiss` use it to collect resolution notes.
- **Impact:** Any moderator using Android crashes the app the moment they tap **Resolve** or **Dismiss** on a report. Moderation is effectively iOS-only.
- **Fix:** Replace both `Alert.prompt` calls with a cross-platform modal containing a `TextInput` (the app already has a `Dialog` component — `mobile/components/Dialog.tsx` — and the pattern is used elsewhere). Pass the entered notes to the existing `api.patch(\`/moderation/reports/${item.id}\`, …)` call.

### H2 — Mobile "Report" flows are no-ops (reports silently dropped)
- **Platform:** 📱 Mobile
- **Locations:**
  - `mobile/components/PostMenu.tsx:57-65` — "Report post" shows `Alert.alert("Reported", "Thanks for your report.")` for Spam/Inappropriate/Other **but never calls `/reports`**.
  - `mobile/app/clubs/[id].tsx:129` — "Report" option shows `Alert.alert("Reported")` **without calling the API**. (The adjacent "Share" at `:128` is also an empty `() => {}`.)
- **Impact:** Users believe they have reported abusive posts/clubs, but nothing is recorded. Moderators never see these reports. This is a **trust & safety hole** — the opposite of what the feature implies. The web (`frontend/src/components/report-modal.tsx`) correctly posts to `/reports` with a category + description.
- **Fix:** Wire both flows to `api.post("/reports", { target_type, target_id, category, description })`. Reuse the web's category list (spam, hate_speech, misinformation, inappropriate, harassment, other). A small bottom-sheet modal (reuse `mobile/components/Dialog.tsx`) with category chips + optional notes matches the existing mobile UX patterns.
- **Note:** The **message** report flow in `mobile/app/(tabs)/messages/[id].tsx:280-291` **is implemented correctly** (real `reportMutation` → `/reports`). Use it as the reference implementation.

### H3 — Web Report modal references non-existent design tokens
- **Platform:** 🌐 Web
- **Location:** `frontend/src/components/report-modal.tsx` (lines `:53`, `:57`, `:68`, `:73`, `:83`, `:84`, `:94`, `:101`, `:119`)
- **What's wrong:** The component uses utility classes that map to tokens **not defined** in `frontend/src/app/globals.css`:
  - `bg-bg-surface`, `bg-bg-main` — CSS defines `--bg` and `--bg-surface`, but `@theme inline` does **not** expose `--color-bg-*`, so these classes don't resolve.
  - `text-text-main`, `text-text-muted` — the theme exposes `--color-text-primary` and `--color-text-muted`; `text-main` is **not** a class.
  - `[rgba(var(--bg-hover),0.08)]` — there is **no `--bg-hover` token** anywhere in `globals.css`.
- **Impact:** The report modal renders with broken/missing colors (likely transparent or inherited backgrounds, inconsistent text color). Functionally it still submits, but it looks broken and out of system.
- **Fix:** Map to existing tokens — `bg-bg-surface`→`bg-surface`, `bg-bg-main`→`bg-background`, `text-text-main`→`text-text-primary`, `text-text-muted`→`text-text-secondary`, and replace `var(--bg-hover)` with a token that exists (e.g. `rgb(var(--text-primary) / 0.08)`). This is a token-naming inconsistency that should be standardized once.

### H4 — Stale crash already fixed (verified, no action)
- **Platform:** 📱 Mobile
- **Note:** An Expo dev log (`mobile/.expo/dev/logs/start.log`) recorded `ReferenceError: Property 'borderRadius' doesn't exist` on the home feed. **Verified against current source: already resolved.** `mobile/app/(tabs)/index.tsx:215` now uses a literal `borderRadius: 10` and imports only `spacing, fontSize`. Listed only so it isn't re-flagged.

---

## 3. 🟠 Medium-Severity Findings (Feature Parity)

### M1 — Mobile can create polls but cannot view or vote on them
- **Platform:** 📱 Mobile
- **Locations:**
  - Creation works: `mobile/app/(tabs)/compose.tsx:45-46, 105-111, 140-142, 218-241` (poll toggle + options).
  - Display is missing: `mobile/components/PostCard.tsx` has **no poll UI** (search the file: zero `poll` references). `mobile/types/index.ts:54-68` `Post` has **no `poll` field** at all.
- **What's wrong:** Web `frontend/src/components/feed/PostCard.tsx:144-183` renders a full poll with bars, percentages, optimistic voting via `POST /posts/{id}/poll/vote`. The mobile type doesn't even model polls, so a poll post renders as **just text with no voting UI**.
- **Impact:** Poll posts are broken on mobile — users can author them but no one on mobile can see or vote. Half-implemented feature.
- **Fix:** (1) Add `poll?: PollData` to `mobile/types/index.ts` `Post`. (2) Add a poll block to `PostCard.tsx` mirroring the web's bar+percentage+`POST /posts/{id}/poll/vote` logic, using theme tokens.

### M2 — Mobile PostCard shows only the first image (no gallery, no video on card)
- **Platform:** 📱 Mobile
- **Location:** `mobile/components/PostCard.tsx:145-159` — renders only `post.media[0]`, with a `+N` badge if `media.length > 1`.
- **What's wrong:** Web renders **all** media (`PostCard.tsx:277-289`) and distinguishes `image` vs `video` (renders a `<video controls>`). Mobile shows a single still and a counter; tapping does nothing; videos aren't playable from the feed.
- **Impact:** Multi-image posts lose content on mobile; video posts are invisible until you open the post detail (and even there, `mobile/app/post/[id].tsx:277-287` also renders only `media[0]` as a plain `Image`, not a video player).
- **Fix:** Add a horizontal `ScrollView`/carousel for multiple images and use `expo-av`/`expo-video` (or `react-native-video`) for video media. Post detail (`post/[id].tsx`) needs the same treatment.

### M3 — Mobile uses hardcoded hex colors instead of theme tokens
- **Platform:** 📱 Mobile
- **Locations:**
  - Role icons (duplicated in 3 files): `mobile/components/PostCard.tsx:30-35`, `mobile/app/post/[id].tsx:36-41`, `mobile/app/profile/[id].tsx:39-44` — `#0ea5e9`, `#8b5cf6`, `#6b7280`, `#f59e0b`.
  - Moderation status colors: `mobile/app/moderation/index.tsx:59-64` `STATUS_COLORS` map and `:252,256` inline `#ef444420`/`#ef4444`.
  - Profile role badges: `mobile/app/profile/[id].tsx:33-37` `ROLE_BADGES` hex map.
- **What's wrong:** These bypass `lib/theme.ts` `colors`, so they **don't adapt to theme changes** and can silently drift from the shared palette (e.g. admin is `#f59e0b` in profile badges but `#0ea5e9` for the role icon — inconsistent **within the same app**).
- **Impact:** Color drift, dark-mode mismatches, and a maintenance trap. Note the admin color is already inconsistent across screens.
- **Fix:** Add semantic role colors to `lib/theme.ts` (e.g. `roleAdmin`, `roleModerator`, `roleStaff`) with light/dark variants, and reference them via `useTheme().colors`. Consolidate the 3 duplicate `ROLE_ICONS` maps into one shared module.

### M4 — Mobile PostCard lacks copy-link and inline comments
- **Platform:** 📱 Mobile
- **Location:** `mobile/components/PostCard.tsx:161-211`
- **What's wrong:** Web `PostCard` has a **copy-link** button (`PostCard.tsx:126-142, 395-400`) and **inline expandable comments** (`toggleComments`, `:405-439`). Mobile has neither on the card — comments are only reachable by navigating to `/post/[id]`.
- **Impact:** Minor UX gap; tapping the comment icon on mobile navigates away rather than expanding inline. Acceptable as a design choice, but it's a deliberate parity difference worth recording. Copy-link is genuinely missing (mobile has `Share` via the OS sheet in `PostMenu`, which partially covers it).
- **Fix:** Optional. If parity is desired, add a `Share.share({ url })` copy-to-clipboard path on the card. Inline comments on mobile is lower value (navigation works).

---

## 4. 🟡 Low-Severity Findings (Production Polish)

### L1 — Suspected copy-paste bug: `message_type` on a post payload
- **Platform:** 📱 Mobile
- **Location:** `mobile/app/(tabs)/compose.tsx:136-138`
- **What's wrong:** For video posts it sets `payload.message_type = "video"`. `message_type` is a **messaging** field (`mobile/types/index.ts:120`), not a post field. This looks like a copy-paste from the messaging compose and is almost certainly ignored by the backend.
- **Impact:** Likely no visible effect today (backend ignores the unknown field), but it's dead/misleading code. Verify how the backend signals a video post vs image post and use the correct field (e.g. embed type in the media object, as the web does via `media_type`).
- **Fix:** Confirm the backend post schema (`backend/app/schemas/post.py`) and set the media type on the `media` array entry instead.

### L2 — Leftover/mismatched import in events create
- **Platform:** 📱 Mobile
- **Location:** `mobile/app/events/create.tsx:25` — `import type { Club } from "../../types";`
- **What's wrong:** This is the **events** create screen but it imports `Club`. Likely a copy from `clubs/create.tsx`. Verify whether `Club` is actually used (for the `club_id` selector) — if not, remove it.
- **Impact:** Cosmetic / lint noise.

### L3 — Mobile PostCard swallows interaction errors silently
- **Platform:** 📱 Mobile
- **Location:** `mobile/components/PostCard.tsx:51-87` (`handleLike`, `handleSave`, `handleShare`).
- **What's wrong:** On API failure the optimistic update is rolled back (good) but **no feedback** is shown to the user. Web shows `toast.error("Failed to update like")` etc. The mobile app has a `Toast` component (`mobile/components/Toast.tsx`) that isn't used here.
- **Impact:** A failed like/save looks identical to success-then-revert — confusing. Network errors give no signal.
- **Fix:** Surface a toast on `catch`.

### L4 — Inconsistent loading / empty / error states across screens
- **Platform:** 📱 Mobile
- **What's wrong:** Patterns vary screen-to-screen: some return `null` while loading (`post/[id].tsx:222`, `admin/index.tsx:37`), some show a spinner (`moderation/index.tsx:365-367`), the app has a `Skeleton` component (`mobile/components/Skeleton.tsx`) that isn't used consistently. Empty states also vary in style.
- **Impact:** Feels unpolished / inconsistent vs. the web, which has dedicated `feed-skeleton-list`, `feed-empty-state`, `feed-error-state` components.
- **Fix:** Standardize three reusable states (loading skeleton, empty, error) and apply them to the list screens.

### L5 — Inconsistent screen header / navigation patterns
- **Platform:** 📱 Mobile
- **What's wrong:** Header implementations differ — `SafeAreaView + custom header` with varying `paddingHorizontal` (16 vs `spacing.lg`), inconsistent back-button handling, and the tab bar hides some routes (`compose`, `notifications`, `explore` are `href: null` in `(tabs)/_layout.tsx:84-86` but still navigable, which is fine but undocumented).
- **Impact:** Minor visual inconsistency.
- **Fix:** Extract a shared `<ScreenHeader>` component and standardize spacing via the `spacing` tokens already in use.

### L6 — README omits the mobile app entirely
- **Platform:** 🔀 Both
- **Location:** `README.md`
- **What's wrong:** The README documents only `backend/` and `frontend/`. There is **no mention** of `mobile/`, its stack (Expo/React Native 0.85), how to run it (`expo start`), or its env vars (`EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_WS_HOST`).
- **Impact:** Onboarding gap; the mobile app is effectively undocumented.
- **Fix:** Add a Mobile section to the README mirroring the Frontend section.

---

## 5. ⚪ Architecture Notes (NOT bugs — intentional, document for clarity)

### A1 — Auth architectures differ by design (web cookies vs mobile tokens)
- **Web** (`frontend/src/lib/api-client.ts`): httpOnly cookies for access/refresh tokens + a `cc_csrf` cookie read into an `X-CSRF-Token` header on mutations; refresh via `POST /auth/refresh` with `withCredentials`.
- **Mobile** (`mobile/lib/api-client.ts`, `mobile/lib/auth.ts`): bearer tokens in `expo-secure-store`, refresh via a dedicated `POST /auth/mobile/refresh`, plus short-lived **ws-tokens** (`mobile/lib/websocket.ts`) so the long-lived access token is never sent in the WebSocket handshake.
- **Verdict:** This is **correct per-platform** and **not** an inconsistency. Cookie-based auth isn't available to native apps; the mobile approach is the right one. Worth documenting so future readers don't "fix" it.

### A2 — Token-refresh queueing exists on both sides
- Both clients implement a failed-request queue + single-flight refresh (`isRefreshing`/`failedQueue`). Mobile additionally preserves the refresh token on 5xx (`api-client.ts:63-69`) — a nice touch the web could adopt. Info only.

---

## 6. Feature-Parity Matrix

| Feature | Web | Mobile | Notes |
|---|:---:|:---:|---|
| Auth (login/register/OTP/forgot/reset) | ✅ | ✅ | Parity |
| Profile (view/edit/setup, tabs) | ✅ | ✅ | Parity |
| Feed (for-you / faculty tabs) | ✅ | ✅ | Parity |
| Post create (text/image/video) | ✅ | ⚠️ | L1: video flag field likely wrong |
| Post like/save/repost | ✅ | ✅ | Parity (mobile silent on error — L3) |
| Post **polls** | ✅ | ⚠️ | M1: create-only, no display/vote |
| Post **multi-image** | ✅ | ❌ | M2: first image only, no video on card |
| Post copy-link | ✅ | ⚠️ | M4: covered by OS share only |
| Inline comments | ✅ | ❌ | M4: navigation-only (acceptable) |
| Post detail / threaded comments | ✅ | ✅ | Parity (detail also single-image — M2) |
| **Report** content | ✅ | ❌ | H2: posts & clubs are no-ops (messages OK) |
| Clubs (list/detail/create/join) | ✅ | ✅ | Parity (club report no-op — H2) |
| Events (list/detail/create/RSVP) | ✅ | ✅ | Parity (L2 minor import) |
| Marketplace (list/detail/create) | ✅ | ✅ | Parity |
| Messaging (conversations/threads/WS) | ✅ | ✅ | Parity |
| Search / Explore | ✅ | ✅ | Parity |
| Notifications (WS + unread badge) | ✅ | ✅ | Parity |
| Theming (light/dark/system) | ✅ | ✅ | Parity (M3: mobile hex drift) |
| Admin dashboard | ✅ | ✅ | Parity |
| Moderation (reports/filters) | ✅ | ❌→iOS | H1: Android crash |
| Academics (courses/resources/groups) | ✅ | ✅ | Parity |
| Ads (impression/click) | ✅ | ✅ | Parity (`mobile/components/AdCard.tsx`) |
| Settings | ✅ | ⚠️ | H2/stub: push-notifications is a dead-end alert |

---

## 7. Recommended Prioritization

**Do first (correctness & safety):**
1. **H1** — Fix `Alert.prompt` Android crash in Moderation (blocks all Android moderators).
2. **H2** — Wire mobile report flows (posts + clubs) to `/reports` (trust/safety hole).
3. **H3** — Fix web `report-modal.tsx` token references (broken styling).

**Do next (visible quality gaps):**
4. **M1** — Add poll display + voting to mobile PostCard + types.
5. **M2** — Add multi-image gallery + video to mobile PostCard & post detail.
6. **M3** — Extract role/status colors into theme tokens; dedupe the 3 ROLE_ICONS maps.

**Polish pass:**
7. **L3** — Toast feedback on failed mobile interactions.
8. **L4 / L5** — Standardize loading/empty/error states + screen headers.
9. **L6** — Document the mobile app in the README.
10. **L1** — Verify/fix the video `message_type` field on post compose.

---

## 8. Open Questions (need your decision)

1. **Comments on mobile** — is navigation-only (M4) an intentional mobile pattern, or should it match web's inline-expand behavior? (Recommendation: leave navigation-only; it's idiomatic for mobile.)
2. **Role colors** — what's the canonical admin/moderator/staff palette? Currently `#0ea5e9` (role icon) vs `#f59e0b` (profile badge) for admin **within the same app**. Pick one set.
3. **Polls on mobile** — should this be a priority, or are polls low-usage enough to defer? (M1 makes mobile polls effectively broken, so recommend prioritizing.)
4. **Video on mobile** — is video a first-class post type? If yes, M2's video support and L1's field verification should move up the list.

---

*Generated by static review of the repository on 2026-06-20. All file:line references verified against current source at time of audit.*
