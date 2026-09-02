# SaaS auth and onboarding (UI)

Visual and interaction spec for `/login`, `/signup`, `/onboarding/profile`, `/onboarding/organization`. UX behaviour: [saas-onboarding.md](../ux/saas-onboarding.md). Shell: [dashboard-shell.md](./dashboard-shell.md). Tokens: [tokens.md](./tokens.md). Copy: [copy-standards.md](./copy-standards.md).

Operator tool, not a the private example marketing page. Do not paste the waitlist landing’s campaign voice onto signup. Do not invent a second design system.

---

## 1. Shared chrome (auth + onboarding)

These routes are **out of** the collapsible operator sidebar (user has no Product yet, or we do not want nav chrome competing with the form).

| Element | Spec |
|---|---|
| Canvas | Same background as current `/login` (dashboard tokens, not a new gradient brand splash) |
| Width | Form column max ~420px, centered. Invite rows on org page may use ~520px |
| Logo | Synawood wordmark / existing login mark. Not the private example |
| Footer | Link to waitlist (`/`) and Sign in / Create account toggle |
| Focus | Visible ring on Google, inputs, primary, Skip |
| Motion | [motion.md](./motion.md) budget: no bounce on page load. Button press ok |

**Avoid:** pill forests, neon, emoji status, full-bleed product screenshots behind a blur.

---

## 2. Login (`/login`)

### 2.1 Hierarchy

1. Heading: **Sign in**
2. Google button (full width, primary-or-equal visual — keep current “Continue with Google” if it already exists)
3. Divider: **or**
4. Email, password
5. Submit: **Sign in**
6. Link: **Create an account** → `/signup`
7. Error region **above** the Google button or directly under the heading (not only under password) so OAuth errors are visible

### 2.2 States

| State | UI |
|---|---|
| Default | Form enabled |
| Submitting | Primary disabled, spinner **on the button**, Google disabled. No full-page blank |
| Error | Red text, sentence case, persisted until the next submit |
| Unconfirmed email | Same error region + waitlist link not required |

Denied (allowlist mode): replace the form’s secondary story with waitlist CTA; keep Sign in for people who *are* allowed (they just typed the wrong email).

### 2.3 What not to change

PKCE callback behaviour, cookie names, `next=` redirect. This is a **productization** of the existing login, not a new auth toy.

---

## 3. Signup (`/signup`)

Mirror login:

- Heading: **Create your account**
- Same Google / or / email+password (password + confirm if the current stack requires it; if today’s signup is “email on login page”, split cleanly here)
- Submit: **Create account**
- Link: **Already have an account? Sign in**

Password rules: show Supabase/policy in one line under the field (“At least 6 characters” or whatever is actually enforced). Do not invent a strength meter for v1.

After success: same callback path as login.

---

## 4. Profile (`/onboarding/profile`)

### 4.1 Structure

```
[Synawood]
About you
Optional. Takes under a minute. You can skip.

Name            [ text ]
What you do     [ Founder ] [ Marketer ] [ Editor ] [ Other ]   ← segmented or radio cards
Why you’re here [ Make ads ] [ Run go-to-market ] [ Exploring ] ← optional row

[ Continue ]     Skip for now
```

- Segmented controls: selected = existing dashboard chip/selected button, not a rainbow.
- **Continue** = primary filled.
- **Skip for now** = ghost/text button to the right (desktop) or under (mobile), 44px min height.
- No progress bar required. If used: two dots, first filled.

### 4.2 Empty Continue

Allowed. Same as Skip. Do not toast “Please enter a name.”

### 4.3 Validation

Name: trim, max 80 chars, toast or inline if over. Job/intent: only the four/three values.

---

## 5. Organization (`/onboarding/organization`)

### 5.1 Structure

```
Your organization
Your team’s Synawood. Studio, brand, and members live here.

Organization name  [ text ]
URL                [ slug ]     helper under field

Invite teammates (optional)
  [ email ] [ job function ▼ ]  [ remove ]
  Add another
You can invite more anytime in Settings → Members.

Have an invite? [ paste ] or open the link from your email.

[ Create organization ]
```

- Name/slug: reuse `CreateProductForm` layout; **relabel only**.
- Job function dropdown: **same component** as `MembersPanel` (do not restyle into something that looks like a different product).
- Max 5 invite rows. “Add another” disables at 5 with helper text.
- Create organization = primary. No Skip.

### 5.2 Errors

| Error | UI |
|---|---|
| Empty name | Inline on name |
| Slug taken | Inline on URL |
| Invite email invalid | Inline on that row; other rows still submit after create |
| Invite API fail after create | Banner on Members or on this page: “Organization created. Could not invite: …” + link to Members |

### 5.3 Success

If landing Members: existing panel, plus toast.  
If landing Home: toast + optional dismissable banner (not a modal maze). Banner copy: **Invite your team in Settings → Members.** Dismiss = gone for this user (localStorage is ok for **this** banner; team roster is server). Prefer a `user_profiles` flag if we already have the table (`members_banner_dismissed_at`) — optional, not a blocker.

---

## 6. Invite accept (`/invite/[token]`)

Keep current accept screen. After SaaS copy pass:

- Title can say **Join {organization name}** (Product name).
- Role/job function shown in the same vocabulary as Members.
- Expired: **Ask an owner for a new invite.**

---

## 7. Settings alignment

| Current card / heading | SaaS label |
|---|---|
| Members and invites | Members and invites (subtitle: people in **{name}**) |
| Create a Product | Create an organization |
| Product switcher | Organizations (display); routes may stay `/products` |

Members table: show `user_profiles.display_name` when set, else email (fallback today).

Roles page (`/settings/roles`): no change required for this program.

---

## 8. Responsive

- < 760px: single column; Google button full width; invite job function full width under email ([responsive.md](./responsive.md)).
- Skip and Continue stack: Continue first (thumb reach).

---

## 9. Dark / tokens

Use existing dashboard CSS variables. Do not introduce a “SaaS purple.” Auth pages should look like the same app they will enter.

---

## 10. QA screenshots (for the implementing PR)

1. `/login` default
2. `/login` error
3. `/signup`
4. `/onboarding/profile` empty
5. `/onboarding/organization` with two invite rows
6. `/settings/members` after onboarding invites
7. Mobile profile + org

Local verification URLs go in the PR (AGENTS.md). Founder walks these on localhost before production `AUTH_ACCESS_MODE=saas`.
