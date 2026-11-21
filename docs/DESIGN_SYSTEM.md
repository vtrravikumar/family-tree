# Vansvriksha — Premium Responsive Design System

Status: proposed design baseline for v1  
Product direction: **The Living Family Atlas**  
Implementation approach: incremental React/CSS refactor; preserve existing workflows and family data.

## 1. Product and visual principles

Vansvriksha should feel like a calm, premium place to explore and care for a family's living history. It should not imitate a genealogy research product or reproduce Apple's interface. Borrow the craft and restraint of Apple's visual language and the clarity and interaction conventions of Material Design, expressed through a distinct Vansvriksha identity.

Principles:
- People first: profiles and relationships are the heart of the experience; the tree is an exploration view, not the only way to use the product.
- Calm hierarchy: one clear primary action per context; secondary and administrative actions remain visually quieter.
- Warm editorial character: archival warmth without sepia, scrapbook, or museum clichés.
- Fluid, not flashy: soft curves, layered surfaces, restrained translucency and subtle motion.
- Responsive by design: desktop, tablet and mobile each receive intentional layouts and interactions.
- Accessible and fast: legibility, contrast, keyboard support, reduced motion and performance take priority over decorative effects.

## 2. Brand and visual language

### Palette

Use semantic tokens rather than hard-coded values in components.

| Token | Value | Use |
|---|---|---|
| --color-canvas | #F6F5F1 | Main warm-neutral page background |
| --color-surface | #FFFFFF | Primary cards and dialogs |
| --color-surface-soft | #F0F1EC | Secondary panels and quiet controls |
| --color-surface-glass | rgba(255,255,255,.72) | Select floating surfaces only |
| --color-ink | #202821 | Primary text |
| --color-muted | #68736B | Secondary text |
| --color-line | #E2E4DC | Borders and dividers |
| --color-forest | #315B45 | Primary brand/action |
| --color-forest-hover | #274B39 | Primary hover |
| --color-copper | #B56F50 | Warm accent, highlights |
| --color-indigo | #59658A | Secondary accent and selected states |
| --color-teal | #477F79 | Supporting accent |
| --color-danger | #A9473D | Destructive actions and errors |
| --color-success | #39734D | Success states |
| --color-warning | #946A2D | Warnings |

Colour usage:
- Forest is the principal action colour, not a background for every panel.
- Copper is a small accent, not a second primary action colour.
- Indigo/teal distinguish information or relationship states only where meaning is clear.
- Status must never be communicated by colour alone.
- Maintain WCAG AA contrast for text and essential controls.

### Typography

- UI/body: system sans-serif stack, prioritising platform-native rendering (Inter where already bundled; otherwise system UI).
- Display/headings: restrained editorial serif (Georgia/system serif initially; no remote font dependency).
- Body text: 14–16px with comfortable line-height.
- Labels and metadata: 12–13px; avoid tiny all-caps text for important information.
- Headings use clear scale and restrained weight; avoid oversized hero typography inside dense workflows.

### Shape, spacing and elevation

- Small controls: 10–12px radius.
- Inputs and buttons: 12–14px radius.
- Cards and panels: 16–20px radius.
- Dialogs and large feature surfaces: 20–24px radius.
- Pill shape reserved for compact status tags and segmented controls.
- Base spacing scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64px.
- Borders are subtle; use shadows sparingly for floating layers, not every card.
- Prefer clear surface contrast and spacing over nested boxes.

### Liquid and material-inspired surfaces

Use a restrained interpretation of liquid glass:
- translucent white surfaces with backdrop blur for floating navigation, menus, command/search overlays and selected toolbars;
- subtle edge highlights and soft shadow to distinguish layers;
- keep text and controls on sufficiently opaque surfaces;
- never place body text over busy imagery or low-contrast blur;
- provide a solid-surface fallback when backdrop-filter is unsupported;
- avoid applying blur to every card, form or content panel.

Material-inspired behaviours:
- predictable focus, pressed, selected, disabled and loading states;
- clear elevation hierarchy for menus, dialogs and popovers;
- touch-friendly targets and accessible motion;
- no imitation of Material's default visual theme.

## 3. Component standards

### Buttons

Variants:
- Primary: forest fill, white text; one dominant action per region.
- Secondary: white/soft surface, ink text, subtle border.
- Tertiary: quiet text or icon action for low-emphasis tasks.
- Destructive: danger-tinted surface or outline; confirm irreversible actions.
- Icon-only: rounded-square or circular surface with an accessible label and tooltip where useful.

All buttons require hover, focus-visible, active/pressed, disabled and loading states. Buttons must not shift size between states. Use consistent 40–44px minimum height on desktop and at least 44px touch target on touch devices; aim for 48px on primary mobile actions.

### Links

- Use a deliberate brand-colour link style with underline on hover/focus.
- Links must be distinguishable without relying only on colour.
- Avoid default browser blue and avoid styling navigation actions as inline body links.
- Provide visible keyboard focus and adequate hit areas for standalone navigation links.

### Inputs and forms

- 44–48px control height; 12–14px radius.
- Persistent labels; placeholders are examples, not labels.
- Clear focus ring, validation message and disabled state.
- Group related fields and use responsive grid layouts that collapse cleanly.
- Preserve entered values and show clear progress/error feedback for multi-step operations.

### Cards, menus and dialogs

- Cards use a clear hierarchy and consistent padding; do not wrap every piece of text in a card.
- Menus and popovers float above content with clear boundaries and keyboard dismissal.
- Dialogs have clear title, purpose, action order and mobile full-screen/near-full-screen behaviour where appropriate.
- Destructive confirmations state the consequence plainly.

### Person identity and avatars

- Keep historical family portrait separate from Google account avatar.
- When an identity claim is approved, display the Google avatar as a distinct overlay/badge; never overwrite the historical portrait.
- Provide graceful initials/default-avatar fallbacks and accessible labels.
- Use consistent avatar sizing and overlay placement across directory rows, profile views and tree cards.

## 4. Responsive layout contract

Use content-driven breakpoints and test around them. Initial targets:
- Small mobile: 320–479px
- Large mobile: 480–767px
- Tablet: 768–1023px
- Desktop: 1024px and above
- Wide desktop: 1440px and above

### Desktop
- Persistent left navigation where useful, with a clear top bar for family context, search and account actions.
- Workspace content uses a readable max-width and responsive columns.
- Family tree receives a dedicated, spacious canvas with independent pan/zoom controls.
- Administrative/data-management actions are grouped separately from everyday family exploration.

### Tablet
- Navigation can collapse to a rail or drawer.
- Avoid squeezing desktop multi-column forms; use one or two columns according to available width.
- Tree toolbar and canvas controls remain touch-friendly and do not obscure the tree.

### Mobile
- Single-column content; no horizontal page scrolling.
- Use compact top navigation and/or bottom navigation for primary destinations; avoid desktop sidebar squeezed into a narrow column.
- Full-screen or sheet-style forms and dialogs with clear close/back controls.
- Person profiles prioritise name, life dates, relationships and key actions.
- Family tree supports touch pan, pinch/zoom where feasible, a fit/reset control and a usable focused-person/branch view. Do not force users to navigate a huge desktop canvas at phone width.
- Long tables and administrative views should become stacked rows/cards or intentionally scrollable regions with clear affordances.
- Keep primary actions reachable and avoid fixed overlays that cover content or device safe areas.

### Responsive acceptance criteria
- No accidental horizontal overflow at 320px, 375px, 390px, 768px, 1024px and 1440px widths.
- All primary workflows can be completed on mobile without hover.
- Touch targets are at least 44px where practical.
- Text remains readable at 200% zoom.
- Dialogs, menus, forms and tree controls remain usable in portrait and landscape.
- Validate on current Chrome, Safari (iOS/macOS) and Firefox; include Android Chrome where available.

## 5. Navigation and information architecture

Proposed v1 workspace navigation:
1. Overview — family summary and clear next actions.
2. Family tree — dedicated visual exploration canvas.
3. People — searchable, filterable member directory and profiles.
4. Members — collaborators, roles, invitations and identity-claim administration.
5. Settings — family settings and role-gated data administration.

Do not expose deferred features as if they are available. Stories, memories, family timeline, media uploads, presentation exports and independently managed branches remain future-release concepts unless separately approved and implemented.

The family selector and signed-in account controls remain consistently accessible. Platform administration is separate from family-level settings.

## 6. Interaction and motion

- Use short, purposeful transitions (typically 140–220ms) for hover, focus, menus and state changes.
- Larger page/sheet transitions may be slightly longer but must remain responsive.
- Respect `prefers-reduced-motion`; disable non-essential movement.
- Use motion to clarify state changes, not as decoration.
- Avoid parallax, continuous animation and heavy blur on scroll.
- Every interactive control must have a visible focus state and a meaningful accessible name.

## 7. Accessibility and quality

- WCAG 2.2 AA target for core workflows.
- Semantic headings, landmarks, labels and buttons.
- Keyboard navigation and visible focus throughout.
- Screen-reader announcements for async success/error and important state changes.
- Contrast checks for text, borders, focus rings and disabled states.
- Reduced-motion support.
- Responsive and cross-browser visual review.
- Automated checks supplemented by manual keyboard, touch and screen-reader spot checks.

## 8. Implementation sequence

UI-1 — Foundations:
- Add semantic design tokens and global reset/base styles.
- Establish typography, spacing, radii, elevation and motion tokens.
- Standardise buttons, links, inputs, focus and disabled states.
- Add responsive shell primitives without changing business logic.

UI-2 — Application shell and overview:
- Introduce clear navigation and family context.
- Separate everyday navigation from administration.
- Redesign family overview and empty/loading/error states.

UI-3 — People:
- Directory, person rows/cards, profiles, date and life-status presentation.
- Avatar fallbacks and identity overlay visual treatment.

UI-4 — Family tree:
- Dedicated canvas layout, toolbar, focus panel and responsive touch interactions.
- Preserve existing relationship layout logic while improving presentation and usability.

UI-5 — Collaboration:
- Members, roles, invitations and identity claim/review screens.
- Role-aware actions and clear pending/approved/rejected states.

UI-6 — Quality:
- Responsive QA at target widths, accessibility, browser review, performance and visual regression.

## 9. Engineering guardrails

- Refactor incrementally; do not replace the existing application in one large rewrite.
- Keep domain logic, API contracts and data migrations out of purely visual commits.
- Preserve existing family IDs, person IDs, relationships, memberships, roles and ownership.
- No production data or production environment changes during UI design work.
- Keep CI green at each merge point and verify the Cloudflare development preview.
- Prefer CSS variables and existing dependencies; do not add a UI framework or animation dependency without a demonstrated need.
- Do not mark a design milestone complete until the corresponding screens are implemented and reviewed at desktop, tablet and mobile sizes.
