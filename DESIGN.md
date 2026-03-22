# Design System Strategy: The Architectural Orchestrator

## 1. Overview & Creative North Star

### The Creative North Star: "The Architectural Orchestrator"
Enterprise workflow automation often falls into the trap of "Data Exhaustion"—overwhelming the user with dense grids and frantic lines. This design system rejects that chaos. Our North Star is **The Architectural Orchestrator**: a philosophy that treats complex data as a series of curated, high-end gallery spaces. 

Instead of traditional enterprise density, we utilize **intentional asymmetry** and **tonal layering** to guide the eye. We break the "template" look by using exaggerated whitespace, overlapping glass layers, and a sophisticated editorial type scale. The result is a platform that doesn't just manage tasks; it orchestrates them with authority and breathability.

---

## 2. Colors & Surface Logic

The palette is rooted in a deep, intellectual blue spectrum. We move beyond "blue for buttons" to "blue as atmosphere."

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders to section off major UI areas. Boundaries must be defined through background color shifts or tonal transitions.
- **Example:** A sidebar uses `surface_container_low` (#eff4ff) against the main dashboard's `surface` (#f8f9ff). The contrast is felt, not drawn.

### Surface Hierarchy & Nesting
Treat the UI as a physical stack of fine paper. Use the surface-container tiers to create depth:
1.  **Base Layer:** `surface` (#f8f9ff)
2.  **Sectioning:** `surface_container_low` (#eff4ff) for subtle grouping.
3.  **Active Workspace:** `surface_container_lowest` (#ffffff) to provide the highest contrast for focused work.
4.  **Floating Elements:** `surface_bright` (#f8f9ff) for modals or popovers.

### The "Glass & Gradient" Rule
To elevate the experience from "SaaS-standard" to "Signature-Enterprise":
- **Glassmorphism:** For floating side-panels or navigation overlays, use `surface` tokens at 80% opacity with a `20px` backdrop-blur.
- **Signature Textures:** Main CTAs should not be flat. Apply a subtle linear gradient from `primary` (#005f9e) to `primary_container` (#0078c7) at a 135-degree angle to give buttons a machined, premium luster.

---

## 3. Typography: Editorial Authority

We use **Inter** not as a system font, but as a branding tool. By manipulating weight and scale, we create a hierarchy that feels like a premium business publication.

- **Display (Large/Med):** Reserved for high-level dashboard summaries or welcome states. Use `display-md` (2.75rem) with a negative letter-spacing (-0.02em) to feel "tight" and authoritative.
- **Headline & Title:** Used for module headers. Use `headline-sm` (1.5rem) to anchor a section without needing a divider line.
- **Body Scale:** `body-md` (0.875rem) is our workhorse. Ensure a line-height of 1.5x for maximum readability in data-heavy workflow descriptions.
- **Labels:** `label-sm` (0.6875rem) should always be in All Caps with +0.05em letter spacing when used for metadata or table headers.

---

## 4. Elevation & Depth: Tonal Layering

Traditional shadows are messy. We use light to define space.

### The Layering Principle
Depth is achieved by stacking. A card doesn't need a shadow if it is `surface_container_lowest` (#ffffff) sitting on top of a `surface_container_low` (#eff4ff) background. The 1% shift in value creates a cleaner, more sophisticated "lift."

### Ambient Shadows
When a physical "float" is required (e.g., a dropdown or a critical modal):
- **Formula:** `0px 12px 32px rgba(11, 28, 48, 0.06)`
- Use a tint of `on_surface` (#0b1c30) for the shadow color rather than pure black. This mimics natural light reflecting off blue-toned surfaces.

### The "Ghost Border" Fallback
If accessibility requirements demand a border:
- **Rule:** Use `outline_variant` (#c0c7d3) at **15% opacity**. It should be a "suggestion" of a line, never a hard boundary.

---

## 5. Components

### Buttons
- **Primary:** Gradient-filled (`primary` to `primary_container`), `xl` roundedness (0.75rem). Use `on_primary` (#ffffff) for text.
- **Secondary:** `surface_container_high` (#dce9ff) background with `primary` text. No border.
- **Tertiary:** Pure text with `primary` color, but with a `surface_container` ghost-hover state.

### Input Fields
- **Container:** `surface_container_lowest` (#ffffff).
- **Border:** Use the "Ghost Border" (outline-variant at 20%). On focus, transition to a `2px` solid `primary` (#005f9e) but only on the bottom edge or as a subtle glow.
- **Error State:** `error` (#ba1a1a) text with a `error_container` background tint.

### Cards & Lists
- **Prohibition:** Divider lines between list items are forbidden.
- **Spacing:** Use `spacing-4` (1rem) or `spacing-6` (1.5rem) to separate items.
- **Visual Separation:** Alternate background colors slightly (`surface` vs `surface_container_low`) for rows if data is extremely dense.

### Workflow Nodes (Niche Component)
For the automation builder, use `surface_container_highest` (#d3e4fe) for the node container with a `lg` (0.5rem) corner radius. Use `primary` for the "active" path connection.

---

## 6. Do's and Don'ts

### Do
- **Do** use whitespace as a functional tool to group related data.
- **Do** use `primary` sparingly to draw attention to "The Next Best Action."
- **Do** leverage `inter` weights (SemiBold for titles, Regular for body) to create contrast without changing size.
- **Do** ensure all interactive elements have a minimum touch/click target of 44px, even if the visual element is smaller.

### Don't
- **Don't** use 1px solid black or dark grey borders. This instantly kills the premium "Architectural" feel.
- **Don't** use pure black (#000000) for text. Always use `on_surface` (#0b1c30) to maintain the blue-centric tonal harmony.
- **Don't** clutter the dashboard with too many primary buttons. One clear "Ghost" or "Primary" action per view.
- **Don't** use standard "drop shadows" with high opacity. If it looks like it’s casting a heavy shadow, it’s too dark.