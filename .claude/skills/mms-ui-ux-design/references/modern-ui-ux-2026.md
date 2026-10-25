# UI capabilities and accessibility evidence

Reviewed 2026-09-24. Rules SSOT: `mms-ui-ux-design.md`, `mms-form-architecture.md`, `mms-performance.md`. This reference is **advisory**; it distinguishes shipped code from optional improvements.

## Existing MMS architecture

- `apps/frontend/src/components/app/Modal.tsx` and `apps/frontend/src/components/app/DetailDrawerShell.tsx` use React portals. Radix popover/tooltip primitives also use portals. A portal changes DOM placement; it does not put an element in the browser top layer. Native modal dialogs opened with `showModal()` and shown native popovers use the top layer. Preserve current primitives unless an implementation change is actually requested. [MDN top layer](https://developer.mozilla.org/en-US/docs/Glossary/Top_layer)
- `apps/frontend/src/index.css` maps theme colors including HSL channel variables. Use the matching consumer syntax, such as `hsl(var(--primary))`; bare `var(--primary)` is not a complete color for channel-only values. Do not paste a second theme palette into a component.
- Use Tailwind `start-0`/`end-4` utilities; `inset-inline-start`/`inset-inline-end` are CSS property names, not prefixes for invented `inset-inline-start-0` utilities. [Tailwind offsets](https://tailwindcss.com/docs/top-right-bottom-left)

## Optional layout and animation changes

Container queries help when a component responds to its allocated width; viewport breakpoints still control the overall shell. Subgrid requires intentional shared parent tracks. Neither belongs on every component by default.

Adopt native popovers, anchor positioning or discrete entry/exit transitions only after checking supported browsers and a usable fallback. Retain Escape, focus return, outside-click behavior, nested menus, scroll locking and reduced-motion handling. CSS anchors alone do not move content into the top layer or remove clipping.

Measure containment and virtualization against actual content. Paint containment can clip shadows and focus outlines; virtualization can unmount the focused row. Preserve stable row identities, keyboard navigation, screen-reader semantics, print/export completeness and scroll position. The repository's >30-item rule is a local review threshold, not a browser performance law or WCAG criterion; exceptions need measured rationale in the owning review.

## Accessibility criteria: accurate scope

| Criterion | Meaning | MMS review evidence |
|---|---|---|
| [2.4.11 Focus Not Obscured (Minimum), AA](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) | Author-created content must not entirely hide the focused component. | Keyboard through sticky headers, docks and dialogs; scroll padding is one technique, not proof. |
| [2.4.13 Focus Appearance, AAA](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html) | Additional focus-indicator area and contrast requirements, with exceptions. | Do not label a two-pixel ring as proof of AA or of full AAA conformance. |
| [2.5.8 Target Size (Minimum), AA](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) | 24×24 CSS pixels or an applicable exception (including spacing). | MMS's 44×44 touch policy is stricter project guidance, not the text of this AA criterion. |
| Drag alternatives | A single-pointer alternative and keyboard operability are distinct checks. | Move buttons must work by click/tap and keyboard; a keyboard-only drag shortcut is insufficient. |
| Authentication and repeated entry | Paste/password-manager support and reuse of prior input help, but are not full criterion proofs. | Test the complete task and applicable exceptions rather than a single event handler. |

The current `e2e/helpers/a11y.ts` scans WCAG 2.1 A/AA tags, blocks selected impacts, and supports an accepted-at-adoption baseline mechanism (currently empty). Report baseline findings and untested states; a green smoke test is not WCAG 2.2 certification. Add manual zoom/reflow, RTL reading/focus order, forced-colors, reduced-motion, error announcement and modal checks for affected UI. An `aria-hidden` chart cannot contain keyboard-focusable controls; provide an equivalent accessible table or an accessible interactive chart path.
