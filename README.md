# Island-Link

A **Bini.js** application — build full-stack React applications for **web, desktop, and mobile** using a single unified development experience.

Powered by **Bini.js**, **Vite**, **Hono**, and **Tauri**.

---

# Web

## Features

- File-based routing, nested layouts, per-route metadata, and automatic code splitting powered by **bini-router**.
- API routes powered by **Hono**:
  - Plain function handlers
  - Full Hono applications
  - Located inside `src/app/api/`
- API execution through:
  - Vite development middleware
  - bini-server in production
  - Edge runtimes when deployed
- Zero-dependency production server (**bini-server**) with:
  - ETag support
  - 304 responses
  - Graceful shutdown
  - Automatic port fallback
- Deploy anywhere:
  - Netlify Edge Functions
  - Vercel Edge Runtime
  - Cloudflare Workers
  - Node.js
  - Deno
- Development overlay with:
  - Shiki-powered error highlighting
  - Automatic import support
  - GitHub Codespaces compatibility
- Static Site Generation (SSG) powered by **bini-ssg**:
  - Pre-renders routes to static HTML at build time via the `render()` function exported from `main.tsx`
  - Uses React 19's `renderToPipeableStream` under the hood — no extra fallback needed
  - Client hydration handled automatically via `hydrateRoot`

## Commands

| Command | Description |
|---|---|
| `pnpm run dev` | Start the Vite development server with HMR |
| `pnpm run build` | Type-check and build the production application |
| `pnpm start` | Serve production output using bini-server |
| `pnpm run preview` | Preview the production build |
| `pnpm run deploy` | Deploy the application to your chosen platform |

`start` is available only for web-target projects.

Desktop and mobile targets ship as native applications instead.

## Requirements

- Node.js >= 20.19.0

No native SDKs, platform toolchains, or signing setup required.

---

# Windows Desktop

## Features

- Builds a native Windows desktop application using **Tauri** and **WebView2**.
- Small application size without bundling a complete browser engine.
- Native APIs automatically configured through **bini-native**:
  - Filesystem
  - Clipboard
  - Notifications
  - Dialogs
  - OS information
- External URLs automatically open in the user's default browser.
- Supports Windows application signing through Authenticode.

## Commands

| Command | Description |
|---|---|
| `pnpm run tauri:dev` | Start the application in development mode |
| `pnpm run tauri:build` | Build a distributable Windows application |
| `pnpm run tauri:icon` | Generate application icons from `public/logo.png` |
| `pnpm run deploy` | Deploy the Windows application (build + sign + distribute) |

## Requirements

- Microsoft C++ Build Tools

Install:

```
Desktop development with C++
```

- Microsoft Edge WebView2 Runtime

Verify installation:

```bash
cl
```

---

# macOS Desktop

## Features

- Builds a native macOS application using **Tauri** and **WKWebView**.
- Native API integration automatically configured by **bini-native**.
- Supports:
  - Filesystem access
  - Clipboard access
  - Notifications
  - Dialogs
- External URLs open in the user's default browser.
- Supports:
  - Ad-hoc signing for local testing
  - Developer ID signing
  - Application notarization

## Commands

| Command | Description |
|---|---|
| `pnpm run tauri:dev` | Start the application in development mode |
| `pnpm run tauri:build` | Build a distributable macOS application |
| `pnpm run tauri:icon` | Generate application icons from `public/logo.png` |
| `pnpm run deploy` | Deploy the macOS application (build + sign + notarize + distribute) |

## Requirements

- macOS
- Xcode Command Line Tools

```bash
xcode-select --install
```

- Homebrew

- Tauri dependencies:

```bash
brew install gtk+3 webkit2gtk pkg-config
```

- Xcode (required for iOS development)

---

# Linux Desktop

## Features

- Builds native Linux applications using **Tauri** and **WebKitGTK**.
- Automatic native API integration through **bini-native**.
- Supports:
  - Filesystem
  - Clipboard
  - Notifications
  - Dialogs
- External links open using the system browser.
- Supports AppImage distribution.

## Commands

| Command | Description |
|---|---|
| `pnpm run tauri:dev` | Start the application in development mode |
| `pnpm run tauri:build` | Build Linux binaries/AppImage |
| `pnpm run tauri:icon` | Generate application icons from `public/logo.png` |
| `pnpm run deploy` | Deploy the Linux application (build + package + distribute) |

## Requirements

### Debian / Ubuntu

```bash
sudo apt update

sudo apt install -y \
libwebkit2gtk-4.0-dev \
build-essential \
libssl-dev \
libgtk-3-dev \
libayatana-appindicator3-dev \
librsvg2-dev \
libxdo-dev \
pkg-config
```

### Fedora

```bash
sudo dnf groupinstall "C Development Tools and Libraries"

sudo dnf install \
webkit2gtk4.0-devel \
openssl-devel \
gtk3-devel \
libappindicator-gtk3-devel \
librsvg2-devel \
libxdo-devel \
pkg-config
```

### Arch

```bash
sudo pacman -S \
webkit2gtk \
base-devel \
openssl \
gtk3 \
libappindicator-gtk3 \
librsvg \
libxdo \
pkg-config
```

---

# Android

## Features

- Builds a real native Android application using Tauri's Android backend.
- Not a browser wrapper.
- Native capabilities automatically wired by **bini-native**:
  - Camera
  - Filesystem
  - Notifications
  - Geolocation
  - Device APIs
- Android configuration available through:

```
src-tauri/gen/android
```

- Supports release signing with:
  - Android keystore
  - keystore.properties

## Commands

| Command | Description |
|---|---|
| `pnpm run android` | Run on a connected Android emulator or device |
| `pnpm run android:build` | Build a release APK/AAB |
| `pnpm run deploy` | Deploy the Android app (build + sign + distribute to stores) |
| `pnpm run tauri -- android dev` | Manual equivalent of `pnpm run android` |
| `pnpm run tauri -- android build` | Manual equivalent of `pnpm run android:build` |

## Requirements

- Java JDK 17
- Android Studio
- Android SDK
- Android Build Tools
- Android NDK

Environment variables:

```
JAVA_HOME
ANDROID_HOME
```

Rust targets:

```bash
rustup target add aarch64-linux-android
rustup target add armv7-linux-androideabi
rustup target add i686-linux-android
rustup target add x86_64-linux-android
```

---

# iOS

## Features

- Builds a native iOS application using Tauri's iOS backend.
- Uses Apple's WKWebView runtime.
- Native plugin integration automatically managed by **bini-native**.
- Supports:
  - Automatic Xcode signing
  - Manual certificates
  - CI signing workflows

iOS builds require macOS.

Windows and Linux cannot generate iOS applications.

## Commands

| Command | Description |
|---|---|
| `pnpm run ios` | Run on the iOS Simulator or a connected device |
| `pnpm run ios:build` | Build the iOS application |
| `pnpm run deploy` | Deploy the iOS app (build + sign + distribute to TestFlight/App Store) |
| `pnpm run tauri -- ios dev` | Manual equivalent of `pnpm run ios` |
| `pnpm run tauri -- ios build` | Manual equivalent of `pnpm run ios:build` |

## Requirements

(macOS only)

- Xcode
- Xcode Command Line Tools

```bash
xcode-select --install
```

- CocoaPods

```bash
sudo gem install cocoapods
```

Rust targets:

```bash
rustup target add aarch64-apple-ios
rustup target add x86_64-apple-ios
rustup target add aarch64-apple-ios-sim
```

---

# Native Integration

## bini-native

bini-native automatically manages Tauri native configuration during development and builds.

Handled automatically:

- Tauri plugin registration
- Rust dependencies
- Capability permissions
- Android configuration
- iOS configuration
- macOS configuration

No manual native wiring required.

---

# Code Signing

Signing configuration is stored in git-ignored files.

Desktop signing:

```
.env.signing
```

Supported platforms:

- Windows
- macOS
- Linux

Android signing:

```
src-tauri/gen/android/keystore.properties
```

---

# Deployment

The `deploy` command handles the entire release process for your target platform:

| Platform | Deploy Command | What it does |
|---|---|---|
| Web | `pnpm run deploy` | Builds and deploys to your configured hosting platform (Vercel, Netlify, Cloudflare, etc.) |
| Windows | `pnpm run deploy` | Builds, signs with Authenticode, and prepares the Windows installer |
| macOS | `pnpm run deploy` | Builds, signs with Developer ID, notarizes with Apple, and prepares the DMG |
| Linux | `pnpm run deploy` | Builds the AppImage/DEB/RPM and prepares for distribution |
| Android | `pnpm run deploy` | Builds a signed APK/AAB and prepares for Play Store distribution |
| iOS | `pnpm run deploy` | Builds, signs, and prepares for TestFlight/App Store distribution |

Configuration for deployment is managed through:
- `bini-deploy` package
- Environment variables in `.env`
- Platform-specific settings in `tauri.conf.json`

---

# Built With

The Bini.js ecosystem:

- **Vite** — modern build pipeline with Rolldown-powered builds
- **Hono** — lightweight API framework
- **bini-router** — filesystem routing and API middleware
- **bini-server** — zero-dependency production server
- **bini-native** — automatic Tauri integration
- **bini-env** — environment configuration
- **bini-overlay** — development tooling
- **bini-ssg** — static site generation and route pre-rendering
- **bini-deploy** — unified deployment for all platforms
- **Oxlint** — fast Rust-based linting
- **Oxfmt** — Prettier-compatible formatter

- **TypeScript** — static type safety

---

# Documentation

https://bini.js.org

---

Built with **Bini.js v10.0.6**