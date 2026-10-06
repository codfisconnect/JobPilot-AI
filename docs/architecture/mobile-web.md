# Mobile & Cross-Platform Architecture Specification

> **Document Status**: Production Baseline Specification  
> **Target Version**: Pilot Mama V1.0  
> **Location**: `docs/architecture/mobile-web.md`  

---

## 1. Cross-Platform Strategy & Principles

Pilot Mama delivers a seamless, high-performance experience across every device class.
1. **Responsive-First Web (V1 Baseline)**: The web client is designed from the ground up to adapt fluidly from 320px ultra-compact smartphones up to 1920px+ ultra-wide desktop monitors without sacrificing capability.
2. **Unified Backend API**: All client interfaces—desktop browser, mobile browser, browser companion extension, and future native mobile apps—consume the identical, versioned REST API (`/api/v1/*`).
3. **Touch Ergonomics & Safe Area Insets**: Full native-app feel on mobile browsers, honoring iOS notch/Dynamic Island geometries and standard touch target standards.

```
                         ┌───────────────────────────┐
                         │   PILOT MAMA UNIFIED API  │
                         │    (Node / Express TS)    │
                         └─────────────┬─────────────┘
                                       │
            ┌──────────────────────────┼──────────────────────────┐
            ▼                          ▼                          ▼
┌───────────────────────┐  ┌───────────────────────┐  ┌───────────────────────┐
│ Responsive Web (V1)   │  │ Browser Companion(V1) │  │ Native Mobile (Future)│
│ • Desktop & Laptops   │  │ • Chrome / Edge / FF  │  │ • React Native / Expo │
│ • Tablets (iPad/Tab)  │  │ • Form autofill       │  │ • iOS (App Store)     │
│ • Smartphones (iOS/And│  │ • Assisted Apply      │  │ • Android (Play Store)│
└───────────────────────┘  └───────────────────────┘  └───────────────────────┘
```

---

## 2. Responsive Web Breakpoints & Layout Behaviors

The Pilot Mama design system utilizes a standard set of responsive breakpoints enforced in CSS:

| Breakpoint Token | Viewport Range | Primary Device Targets | Layout Behavior |
| :--- | :--- | :--- | :--- |
| **`xs` (Mobile Narrow)** | `320px - 479px` | Compact smartphones (iPhone SE, Galaxy A) | Single column vertical stack, bottom navigation bar, collapsed headers, full-width modal sheets. |
| **`sm` (Mobile Standard)** | `480px - 767px` | Modern smartphones (iPhone 14/15, Galaxy S23) | Fluid single column, touch cards, expandable filter drawer. |
| **`md` (Tablet Portrait)** | `768px - 1023px` | iPad Mini, iPad 10.2", Galaxy Tab portrait | Two-column hybrid grid, collapsible side navigation rail, persistent filter bar. |
| **`lg` (Desktop / Tablet Landscape)** | `1024px - 1279px` | iPad Pro landscape, 13" laptops, MacBooks | Full sidebar navigation, side-by-side job list and detail preview pane. |
| **`xl` (Desktop Wide)** | `1280px - 1919px` | Standard desktop monitors (1080p) | Multi-column dashboard grid, persistent stats drawers, high information density. |
| **`2xl` (Ultra-wide)** | `1920px+` | 4K and Ultra-wide monitors | Centered maximum container constraint (`max-width: 1440px`) to prevent visual eye fatigue. |

---

## 3. Touch Ergonomics & Mobile UX Standards

- **Minimum Hit Targets**: All buttons, form inputs, and interactive icons enforce a minimum touch bounding box of **44px × 44px** (`var(--touch-target-min)`).
- **Safe Area Insets**: All fixed mobile navigation bars and bottom action sheets incorporate iOS safe area environment variables:
  ```css
  padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
  padding-top: calc(12px + env(safe-area-inset-top, 0px));
  ```
- **Virtual Keyboard Awareness**: Fixed action bars automatically accommodate viewport resizing when virtual keyboards deploy on mobile Safari and Chrome.
- **Horizontal Scroll Prevention**: Containers enforce `overflow-x: hidden` and flexible widths (`min-width: 0`) on flex/grid children to eliminate horizontal scroll defects.

---

## 4. Supported Browser Matrix

Pilot Mama production bundles are validated against modern evergreen rendering engines:

| Platform | Supported Browsers | Validation Priority |
| :--- | :--- | :---: |
| **Desktop (Windows / macOS / Linux)** | Google Chrome (Latest 2), Microsoft Edge (Latest 2), Mozilla Firefox (Latest 2), Apple Safari (Latest 2) | Tier 1 (Critical) |
| **iOS / iPadOS** | Mobile Safari (iOS 16+), Chrome for iOS (WKWebView) | Tier 1 (Critical) |
| **Android** | Google Chrome for Android, Samsung Internet, Firefox Mobile | Tier 1 (Critical) |

---

## 5. Future Native Mobile Architecture (Post-V1 Roadmap)

When Pilot Mama transitions to native app store presence:
- **Framework Choice**: **React Native with Expo** (Managed Workflow).
- **Code Sharing**: Direct reuse of TypeScript data interfaces, API client logic, Zod validation schemas, and state management models from the web repository.
- **Native Capabilities**:
  - Push notifications for job match alerts and interview status changes.
  - Native document picker integrating with iCloud Drive and Google Drive.
  - Biometric authentication (FaceID / Fingerprint).
