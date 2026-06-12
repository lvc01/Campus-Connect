# Dashboard Redesign — Three-Column Layout

**Date:** 2026-06-01
**Feature:** Complete dashboard overhaul for CU Campus Connect

## Motivation

The current dashboard is a simple two-column layout (sidebar + feed) with minimal visual polish. Users want a richer, more modern experience with additional information at a glance.

## Layout

```
┌──────────────┬──────────────────────────────┬──────────────────┐
│ LEFT (w-72)  │ CENTER (flex-1)              │ RIGHT (w-80)     │
│              │                              │                  │
│ Logo         │ [Public] [Faculty Only]      │ 🔥 Popular Now  │
│              │                              │   Post mini x 3  │
│ Navigation:  │ ┌─ CreatePost ──────────┐    │                  │
│ ● Feed       │ └───────────────────────┘    │ 📅 Upcoming      │
│   Clubs      │ ┌─ PostCard x N ────────┐    │   Events x 3     │
│   Events     │ │  (infinite scroll)    │    │                  │
│   Academics  │ └───────────────────────┘    │ 🎓 My Courses    │
│              │                              │                  │
│ Profile card │                              │                  │
│ (compact)    │                              │                  │
│              │                              │                  │
│ Logout       │  [mobile: logout here]       │                  │
└──────────────┴──────────────────────────────┴──────────────────┘
```

## Left Panel (Navigation)

- **Logo:** Same CU Campus Connect branding, links to `/`
- **Nav items:** 4 links with SVG icons
  - Feed (`/`), Clubs (`/clubs`), Events (`/events`), Academics (`/academics`)
  - Active state: brand-gradient left border (3px), `bg-zinc-800/80`, indigo text
  - Hover: `scale-[1.02]` + `bg-zinc-800/50`, 200ms transition
  - Active detection via `usePathname()`
- **Profile card:** Compact version — avatar initial, display name, `Faculty · Year`, email beneath. Click navigates to profile.
- **Logout:** Full-width button, always visible.

## Center Panel (Feed)

Same feed logic as current — only visual changes:
- Feed filter buttons: active state uses `brand-gradient` bg instead of zinc
- PostCards get subtle ring border (`ring-1 ring-white/[0.06]`) instead of thick border
- Consistent `rounded-xl` across all cards

## Right Panel (Widgets)

### 🔥 Popular Now
- Pulls top 3 posts from loaded feed by `like_count` (client-side sort)
- Each: avatar initial + truncated content (max 2 lines) + heart count
- Click scrolls to the post in the feed
- Empty: subtle "Posts with the most engagement will appear here"

### 📅 Upcoming Events
- Fetches `GET /api/v1/events?status=upcoming&limit=3`
- Cards: title, relative start time, location pin, RSVP count badge
- Click navigates to `/events` (placeholder page)
- Empty: "No upcoming events — host one!"

### 🎓 My Courses
- Fetches `GET /api/v1/academics/courses`, filters `is_member === true`
- Cards: course code + name, member count icon
- Click navigates to `/academics` (placeholder page)
- Empty: "Join a course to track resources here"

## Placeholder Pages

Minimal pages for `/events` and `/academics`:
- Same dark background, centered message, brand gradient accent
- "Events Calendar — Coming Soon" / "Academics Hub — Coming Soon"
- Back to Feed link

## Styling Enhancements

| Element | Current | New |
|---------|---------|-----|
| Panel bg | `glass-panel` blur | Same, plus `ring-1 ring-white/[0.06]` |
| Card radius | Mix of rounded-xl/2xl | Unified `rounded-xl` |
| Nav active | None | Left border + bg-zinc-800/80 |
| Feed filter active | bg-zinc-800/80 | `brand-gradient` background |
| Transitions | Minimal | 200ms ease on all interactives |
| Typography | Mixed sizes | Tighter hierarchy, consistent spacing |

## Files to Modify

| File | Change |
|------|--------|
| `frontend/src/app/page.tsx` | Rewrite layout to three-column; extract left nav + right widgets inline |
| `frontend/src/app/globals.css` | Add ring utility if needed, maybe nav-active class |
| `frontend/src/app/events/page.tsx` | **New file** — placeholder |
| `frontend/src/app/academics/page.tsx` | **New file** — placeholder |

## Backend Dependencies

None — all data comes from existing endpoints:
- `GET /api/v1/posts` (feed data, client-side sort for trending)
- `GET /api/v1/events?status=upcoming` (events widget)
- `GET /api/v1/academics/courses` (courses widget)
