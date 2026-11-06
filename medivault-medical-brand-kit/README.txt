MediVault medical brand assets

This revision makes the medical meaning immediate: a medical cross with an ECG pulse inside a protective shield. The muted rose and warm ivory colors match the supplied portal UI.

Palette:
- Muted rose: #914B54
- Soft rose wordmark accent: #DDA6A3
- Warm ivory: #F4EEE8
- Portal charcoal: #211F1D

Files:
- medivault-logo.svg: transparent horizontal navbar logo
- medivault-icon.svg: square app icon
- favicon.svg / favicon.ico / favicon-16.png / favicon-32.png: browser tab assets
- apple-touch-icon.png: 180px touch icon
- medivault-icon-512.png: high-resolution app icon
- medivault-logo.png: transparent PNG lockup
- preview-on-portal-dark.png: navbar preview on charcoal

Copy the files into your Vite project's public/ directory. In index.html <head>:
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png" />
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />

Navbar JSX:
<img src="/medivault-logo.svg" alt="MediVault" className="h-10 w-auto" />
