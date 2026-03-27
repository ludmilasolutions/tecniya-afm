# Design System: TECNIYA Home & Styles
**Project ID:** 8336169564380520755

## 1. Visual Theme & Atmosphere
The design follows a **Premium Dark Aesthetic** with a "Glassmorphic" and "Futuristic" mood. It feels **Dense yet Organized**, utilizing depth and glow effects to create a sense of high-fidelity professional service trust. The interface is optimized for mobile-first interactions but maintains a structured, grid-based layout for desktop.

## 2. Color Palette & Roles
* **Deep Indigo Background (#4850e5 - Base Custom):** The core brand color, used for primary accents, brand identity, and soft glows.
* **Midnight Navy (#020617):** The deepest background color, providing the canvas for the dark mode.
* **Slate Blue-Gray (#0f172a):** Used for elevated cards and section backgrounds to create hierarchical depth.
* **Vibrant Cyan-Blue (#06b6d4):** Secondary accent color for secondary actions, tags, and status indicators.
* **Urgent Orange (#f97316):** High-priority accent for urgent service buttons and alerts.
* **Ghost Light (#f8fafc):** Primary text color, highly legible against dark backgrounds.
* **Muted Slate (#94a3b8):** Secondary text and icon color for less critical information.

## 3. Typography Rules
* **Font Family:** **Inter**, sans-serif.
* **Headers:** Extremely bold (Extra-Bold/800) with tight line-height (1.2). Large headers often use linear gradients from Ghost Light to Vibrant Cyan.
* **Body:** Clean and legible (Regular/400).
* **Letter-spacing:** Standard for body, slightly tighter for large headers.

## 4. Component Stylings
* **Buttons:** 
    * **Generously Rounded (12px):** All buttons have consistent corner rounding.
    * **Primary:** Linear gradients (Indigo to Purple) with soft drop shadows and glow effects.
    * **Urgent:** Bright Orange with pulse animations and high contrast.
    * **Ghost:** Transparent backgrounds with thin border and backdrop-blur effects.
* **Cards/Containers:** 
    * **Glassmorphic Effect:** Backgrounds use translucent colors with `backdrop-filter: blur(10px)`.
    * **Rounded Corners (12px):** Consistent with the project's `ROUND_TWELVE` theme setting.
    * **Subtle Elevation:** Borders are very thin (1px) and translucent, creating a "whisper-soft" hairline edge.
* **Inputs/Forms:** 
    * **Embedded Style:** Inputs use a slightly darker background than the containers they sit in, with colored borders on focus.

## 5. Layout Principles
* **Whitespace strategy:** Generous margins between major sections, but dense information within components using tight paddings (e.g., 16px-24px).
* **Grid alignment:** Professionals and service categories are presented in refined grids with consistent spacing.
* **Glow/Atmosphere:** strategically placed radial gradients (blobs) behind content to create visual interest and section boundaries.
