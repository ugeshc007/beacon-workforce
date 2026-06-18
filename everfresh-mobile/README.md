# Everfresh Mobile (Native Android App)

Separate native app build for **Everfresh**, packaged from the same web
codebase as the BeBright Planner web portal.

```
everfresh-mobile/
├── capacitor.config.ts   # Everfresh-specific appId, name, splash
├── branding/             # Drop Everfresh logo / splash source files here
│   ├── icon.png          # 1024×1024 master app icon (square, no transparency)
│   └── splash.png        # 2732×2732 master splash (logo centered)
├── resources/            # Generated platform icons/splashes (after cap-assets)
└── android/              # Created when you run `npx cap add android`
```

The web code, database, auth, and APIs are 100% shared with the BeBright web
portal — only the wrapper (appId, name, icon, splash, store listing) differs.

---

## One-time setup

From the **project root**:

```bash
npm install
npm run build
```

Then from this `everfresh-mobile/` folder:

```bash
# 1. Add the Android platform (creates ./android)
npx cap add android --config capacitor.config.ts

# 2. Sync the web build into the native shell
npx cap sync android --config capacitor.config.ts

# 3. Open in Android Studio
npx cap open android --config capacitor.config.ts
```

> Requires Android Studio + JDK 17 installed locally. Lovable's sandbox can't
> run Android Studio — you must do this on your own machine after pulling
> the project from GitHub.

---

## Updating after web changes

Every time the web code changes:

```bash
npm run build                                       # from project root
cd everfresh-mobile
npx cap sync android --config capacitor.config.ts
```

---

## Custom branding (logo + splash)

1. Drop your Everfresh master assets into `branding/`:
   - `branding/icon.png`   → 1024×1024 PNG, square, no transparency
   - `branding/splash.png` → 2732×2732 PNG, logo centered on brand color
2. Generate all platform sizes:

   ```bash
   npm install -g @capacitor/assets
   npx capacitor-assets generate --android \
     --assetPath ./branding \
     --iconBackgroundColor '#0F7A3D' \
     --splashBackgroundColor '#0F7A3D'
   ```
3. Re-sync:
   ```bash
   npx cap sync android --config capacitor.config.ts
   ```

To change the splash background color, edit `backgroundColor` in
`capacitor.config.ts` (currently `#0F7A3D`).

---

## App identifiers

| Field         | Value                      |
| ------------- | -------------------------- |
| App ID        | `ae.everfresh.planner`     |
| App Name      | `Everfresh Planner`        |
| Web bundle    | `../dist` (shared)         |
| Min SDK       | Capacitor default (Android 6+) |

The BeBright native app lives at the project root (`capacitor.config.ts` +
`android/`) with appId `com.bebright.planner` — these two apps are fully
independent on the device and in the Play Store.

---

## Hot reload during development

Set `CAPACITOR_DEV=true` before syncing to point the installed app at the live
Lovable preview URL instead of the bundled `dist/`:

```bash
CAPACITOR_DEV=true npx cap sync android --config capacitor.config.ts
```

Unset it (and re-sync) for production builds.
