<div align="center">

# Island-Link

A full-stack e-commerce and supply-chain management platform built for Sri Lanka's regional distribution network.

![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?style=for-the-badge&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TailwindCSS](https://img.shields.io/badge/Tailwind%20CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)

[![Stars](https://img.shields.io/github/stars/Binidu01/Island-Link?style=for-the-badge&logo=github)](https://github.com/Binidu01/Island-Link/stargazers)
[![Forks](https://img.shields.io/github/forks/Binidu01/Island-Link?style=for-the-badge&logo=github)](https://github.com/Binidu01/Island-Link/network/members)
[![Issues](https://img.shields.io/github/issues/Binidu01/Island-Link?style=for-the-badge&logo=github)](https://github.com/Binidu01/Island-Link/issues)
[![License](https://img.shields.io/github/license/Binidu01/Island-Link?style=for-the-badge)](https://github.com/Binidu01/Island-Link/blob/main/LICENSE)

</div>

---

## 📋 Table of Contents

- [🚀 Features](#-features)
- [🛠️ Installation](#️-installation)
- [💻 Usage](#-usage)
- [🏗️ Built With](#️-built-with)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)
- [📞 Contact](#-contact)
- [🙏 Acknowledgments](#-acknowledgments)

---

## 🚀 Features

- 👥 **Multi-role dashboards** — Admin, HO Manager, RDC Staff, Logistics Team, and Customer
- 📦 **Product management** — Add, edit, and delete products with WebP image uploads
- 🔄 **Order lifecycle** — Place → Confirm → Process → Out for Delivery → Delivered / Rejected
- 🗺️ **Real-time tracking** — Live vehicle location on Leaflet maps with OSRM route optimisation
- 📧 **Email notifications** — Automatic order status updates via Brevo SMTP
- 🔒 **Audit logging** — Every admin and staff action recorded for accountability
- 🛒 **Cart & wishlist** — Firebase-powered persistent cart and wishlist across sessions
- ⭐ **Reviews & Q&A** — Customers can leave star ratings and ask product questions
- 🚚 **Route planner** — Logistics team optimises and navigates delivery routes in real time
- 📱 **Responsive UI** — Tailwind CSS v4 layout that adapts to all screen sizes

---

## 🛠️ Installation

### Prerequisites

- Node.js (v18 or higher)
- pnpm (recommended) or npm

### Quick Start

```bash
# Clone the repository
git clone https://github.com/Binidu01/Island-Link.git

# Navigate to project directory
cd Island-Link

# Install dependencies
pnpm install

# Start development server
pnpm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

### Environment Variables

Create a `.env` file in the project root:

```env
# ── Firebase ──────────────────────────────────────
BINI_FIREBASE_API_KEY=
BINI_FIREBASE_AUTH_DOMAIN=
BINI_FIREBASE_PROJECT_ID=
BINI_FIREBASE_STORAGE_BUCKET=
BINI_FIREBASE_MESSAGING_SENDER_ID=
BINI_FIREBASE_APP_ID=
BINI_FIREBASE_MEASUREMENT_ID=

# ── Email (Brevo SMTP) ────────────────────────────
SMTP_USER=
SMTP_PASS=
FROM_EMAIL="IslandLink <your@email.com>"
```

---

## 💻 Usage

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

For more detailed usage instructions, please refer to our [documentation](https://github.com/Binidu01/Island-Link).

---

## 🏗️ Built With

- **[Bini.js](https://github.com/Binidu01/bini)** — Zero-config React framework
- **[Vite 8](https://vitejs.dev/)** — Rolldown-powered bundler
- **[TypeScript](https://www.typescriptlang.org/)** — Strongly typed JavaScript
- **[Tailwind CSS v4](https://tailwindcss.com/)** — Utility-first styling
- **[Firebase](https://firebase.google.com/)** — Firestore database and Authentication
- **[avatar64](https://github.com/Binidu01/avatar64)** — Profile images encoded as Base64 and stored in Firestore
- **[Brevo SMTP](https://www.brevo.com/) + [Nodemailer](https://nodemailer.com/)** — Transactional email
- **[Leaflet](https://leafletjs.com/) + [OpenStreetMap](https://www.openstreetmap.org/) + [OSRM](http://project-osrm.org/)** — Maps and route optimisation
- **[Hono](https://hono.dev/)** — Lightweight API layer (bundled with Bini.js)
- **[Oxlint & Oxfmt](https://oxc.rs/)** — Fast linting and formatting

---

## 🤝 Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch `git checkout -b feature/AmazingFeature`
3. Commit your Changes `git commit -m 'Add some AmazingFeature'`
4. Push to the Branch `git push origin feature/AmazingFeature`
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

## 📞 Contact

**Binidu Ranasinghe** — [@Binidu01](https://github.com/Binidu01)

Project Link: [https://github.com/Binidu01/Island-Link](https://github.com/Binidu01/Island-Link)

---

## 🙏 Acknowledgments

- Thanks to all contributors who have helped this project grow
- Special thanks to the open source community
- Academic supervision provided by **Nimesha Rajakaruna** ([@nimesharajakaruna1-beep](https://github.com/nimesharajakaruna1-beep)) as part of undergraduate coursework
- Built with ❤️ and lots of ☕

---

## Academic Supervision

This project was guided by Nimesha Rajakaruna as part of undergraduate coursework.

GitHub Name: nimesharajakaruna1-beep

---

<div align="center">

**[⬆ Back to Top](#island-link)**

Made with ❤️ by [Binidu01](https://github.com/Binidu01)

⭐ Star this repo if you find it useful!

</div>
