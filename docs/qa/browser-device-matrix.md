# Browser & Device Validation Matrix

> **Document Status**: Production Standard  
> **Applies to**: Frontend Engineering & QA Validation  
> **Location**: `docs/qa/browser-device-matrix.md`  

---

## 1. Viewport & Device Resolution Matrix

Every user interface in Pilot Mama must be visually and functionally validated across all standard device resolutions. No pull request with horizontal scrolling or overlapping UI elements will be approved.

| Resolution (Width × Height) | Category | Representative Devices | Validation Focus |
| :---: | :---: | :--- | :--- |
| **320px × 568px** | Ultra-Compact Phone | iPhone SE (1st gen), compact Androids | Single column stack, compact headers, no clipped typography, 44px touch targets. |
| **360px × 800px** | Small Android | Galaxy A-series, Xiaomi Redmi | Safe margin spacing, badge wrapping, touch card padding. |
| **375px × 667px** | Compact iOS | iPhone SE (2nd/3rd gen), iPhone 8 | iOS Safari bottom toolbars, modal action sheet sizing. |
| **390px × 844px** | Standard iOS | iPhone 12 / 13 / 14 | Safe area insets (Notch / Home indicator), sticky bottom navigation. |
| **414px × 896px** | Large Phone | iPhone 11 Pro Max, iPhone XR | Fluid typography scaling, multi-badge skill wrapping. |
| **480px × 854px** | Phablet / Wide Mobile | Budget Androids, landscape foldables | Clean transition from single column to flexible fluid layout. |
| **768px × 1024px** | Tablet Portrait | iPad Mini, iPad 10.2", Galaxy Tab S | Two-column hybrid grid, side rail navigation collapse, split card layouts. |
| **820px × 1180px** | Large Tablet Portrait | iPad Air, iPad 10.9" | Tablet touch targets, multi-card Kanban horizontal scroll controls. |
| **1024px × 768px** | Tablet Landscape | iPad 10.2" landscape, small Chromebooks | Persistent sidebar menu, dual-pane job list and detail preview. |
| **1280px × 800px** | Standard Laptop | 13" MacBook Air, Windows Ultraportable | Desktop layouts, persistent filters, complete Kanban board view. |
| **1440px × 900px** | Desktop Standard | 15" MacBook Pro, standard external monitor | High information density, expanded analytics charts, hover interactions. |
| **1920px × 1080px** | Desktop Widescreen | 1080p Full HD desktop display | Centered container constraint (`max-width: 1440px`) preventing visual distortion. |

---

## 2. Browser & Rendering Engine Matrix

| Browser Engine | Operating Systems | Minimum Supported Version | Validation Priority |
| :--- | :--- | :--- | :---: |
| **Google Chrome (Blink)** | Windows 10/11, macOS, Linux | Current & Previous (N-1) | **P0 (Tier 1)** |
| **Microsoft Edge (Blink)** | Windows 10/11, macOS | Current & Previous (N-1) | **P0 (Tier 1)** |
| **Apple Safari (WebKit)** | macOS (Sonoma, Sequoia) | Safari 16+ | **P0 (Tier 1)** |
| **iOS Safari (WebKit)** | iOS 16+, iPadOS 16+ | iOS 16+ | **P0 (Tier 1)** |
| **Chrome for Android (Blink)**| Android 12+ | Current | **P0 (Tier 1)** |
| **Mozilla Firefox (Gecko)** | Windows, macOS, Linux | Current & Previous (N-1) | **P1 (Tier 2)** |
| **Samsung Internet (Blink)** | Android (Samsung devices) | Current | **P1 (Tier 2)** |
| **Chrome for iOS (WKWebView)**| iOS 16+ | Current | **P1 (Tier 2)** |

---

## 3. QA Validation Checklist for Every Breakpoint

1. **Horizontal Scroll Check**: Execute `window.innerWidth === document.documentElement.offsetWidth` on all views. Zero horizontal scrollbar allowed.
2. **Theme Legibility Check**: Inspect all text elements in both **Dark Mode** and **Light Mode** ensuring minimum WCAG AA contrast ratio (4.5:1 for normal text, 3:1 for large text).
3. **Interactive Sizing**: Ensure all clickable elements meet the minimum 44px × 44px bounding box on touch viewports (≤ 768px).
4. **Form Usability**: Ensure virtual keyboard opening on mobile viewports does not obscure active form fields or sticky modal submit buttons.
