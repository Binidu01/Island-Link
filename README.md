<div align="center">

# Island-Link

**A full-stack e-commerce and supply-chain management platform built for Sri Lanka's regional distribution network.**

[![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)

[![Stars](https://img.shields.io/github/stars/Binidu01/Island-Link?style=for-the-badge&logo=github)](https://github.com/Binidu01/Island-Link/stargazers)
[![Forks](https://img.shields.io/github/forks/Binidu01/Island-Link?style=for-the-badge&logo=github)](https://github.com/Binidu01/Island-Link/network/members)
[![Issues](https://img.shields.io/github/issues/Binidu01/Island-Link?style=for-the-badge&logo=github)](https://github.com/Binidu01/Island-Link/issues)
[![License](https://img.shields.io/github/license/Binidu01/Island-Link?style=for-the-badge)](LICENSE)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
- [Usage](#usage)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)
- [Acknowledgements](#acknowledgements)

---

## Overview

Island-Link is a comprehensive platform designed to streamline order management, logistics, and customer engagement across Sri Lanka's regional distribution network. It supports multiple user roles — from administrators and warehouse staff to delivery teams and end customers — with real-time tracking, automated notifications, and a fully responsive interface.

---

## Features

| Category | Capability |
|---|---|
| **User Roles** | Multi-role dashboards for Admin, HO Manager, RDC Staff, Logistics Team, and Customer |
| **Product Management** | Add, edit, and delete products with WebP image uploads |
| **Order Lifecycle** | Full status pipeline: Place → Confirm → Process → Out for Delivery → Delivered / Rejected |
| **Real-Time Tracking** | Live vehicle location on Leaflet maps with OSRM route optimisation |
| **Email Notifications** | Automatic order status updates via Brevo REST API (edge-native, no SMTP required) |
| **Audit Logging** | Every admin and staff action recorded for accountability |
| **Cart & Wishlist** | Firebase-powered persistent cart and wishlist across sessions |
| **Reviews & Q&A** | Star ratings and product Q&A from customers |
| **Route Planner** | Logistics team can optimise and navigate delivery routes in real time |
| **Responsive UI** | Tailwind CSS v4 layout that adapts to all screen sizes |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Bini.js](https://github.com/Binidu01) — Zero-config React framework |
| Bundler | Vite 8 (Rolldown-powered) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Database & Auth | Firebase (Firestore + Authentication) |
| Email | Brevo REST API — edge-native transactional email via `fetch` |
| Maps & Routing | Leaflet + OpenStreetMap + OSRM |
| API Layer | Hono (bundled with Bini.js) |
| Environment | bini-env — zero-config, request-scoped env vars |
| Linting & Formatting | Oxlint & Oxfmt |
| Profile Images | avatar64 — Base64-encoded images stored in Firestore |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- [pnpm](https://pnpm.io/) (recommended) or npm

### Installation

```bash
# Clone the repository
git clone https://github.com/Binidu01/Island-Link.git

# Navigate to the project directory
cd Island-Link

# Install dependencies
pnpm install

# Start the development server
pnpm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Environment Variables

Create a `.env` file in the project root and populate the following values:

```env
# ── Firebase ──────────────────────────────────────────────────
BINI_FIREBASE_API_KEY=
BINI_FIREBASE_AUTH_DOMAIN=
BINI_FIREBASE_PROJECT_ID=
BINI_FIREBASE_STORAGE_BUCKET=
BINI_FIREBASE_MESSAGING_SENDER_ID=
BINI_FIREBASE_APP_ID=
BINI_FIREBASE_MEASUREMENT_ID=

# ── Email (Brevo REST API) ─────────────────────────────────────
BREVO_API_KEY=
FROM_EMAIL=
SENDER_NAME=
```

---

## Usage

```bash
# Start development server with hot reload
pnpm run dev

# Build for production
pnpm run build

# Start production server
pnpm start

# Lint, format, and type-check
pnpm run check
```

For detailed documentation, refer to the [project wiki](https://github.com/Binidu01/Island-Link/wiki).

---

## Contributing

Contributions are welcome and greatly appreciated. To get started:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Commit your changes: `git commit -m 'Add your-feature-name'`
4. Push to the branch: `git push origin feature/your-feature-name`
5. Open a Pull Request

Please ensure your code passes linting and type-checks (`pnpm run check`) before submitting.

---

## License

This project is licensed under the [MIT License](LICENSE).

---

## Contact

**Binidu Ranasinghe** — [@Binidu01](https://github.com/Binidu01)

Project Link: [https://github.com/Binidu01/Island-Link](https://github.com/Binidu01/Island-Link)

---

## Acknowledgements

- All contributors who have helped this project grow
- The open-source community for the incredible tools that power this platform
- **Academic Supervision:** [Nimesha Rajakaruna](https://github.com/nimesharajakaruna1-beep) — guidance provided as part of undergraduate coursework

---

<div align="center">

Made with ❤️ by [Binidu01](https://github.com/Binidu01)

⭐ If you find this project useful, please consider giving it a star!

</div>
