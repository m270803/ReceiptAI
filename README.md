# ReceiptAI

ReceiptAI is a mobile-first personal finance app for tracking spending, income, budgets, and savings goals. Scan receipts to turn purchases into editable expense details, explore your financial activity, pay through Razorpay UPI checkout, and ask an AI assistant questions about your finances.

> **Razorpay UPI payments:** users complete checkout through their UPI/bank app. Payments go to the Razorpay business account connected to the backend; this is not a transfer to an arbitrary UPI ID. Only verified, fully paid payments are recorded as expenses.

## Features

- **Expense tracking** — record and manage purchases by category.
- **Receipt scanning** — scan a receipt image with Groq Vision, review the extracted merchant, date, total, and line items, then save it as an expense. QR codes can also be scanned.
- **Income, budgets, and savings goals** — keep financial records and track progress in one place.
- **Dashboard and insights** — view spending and savings summaries with charts.
- **AI finance assistant** — chat about your financial data, with chat history saved to your account.
- **Accounts and verification** — register and log in with the API; email verification can use SendGrid.
- **Razorpay UPI checkout** — create UPI payment links and save verified transactions to the user's payment history and expenses.
- **Personalization** — profile settings and light, dark, or automatic theme selection.

## Built with

- [Expo](https://expo.dev/) and React Native
- React Navigation
- Express 5 and MongoDB with Mongoose
- JWT-based API sessions
- Groq for assistant responses and receipt image extraction
- SendGrid for production email verification

## Project layout

```text
.
├── App.js                 # Navigation and screen registration
├── screens/               # Expo / React Native screens
├── utils/                 # API client and finance helpers
├── ThemeContext.js        # App theme state
├── server.js              # Express API entry point
├── routes/                # API route definitions
├── controllers/           # API request handlers
├── models/                # Mongoose models
├── middleware/            # Authentication middleware
└── BACKEND_SETUP.md       # Additional backend notes
```

## Requirements

- Node.js and npm
- MongoDB (local or hosted)
- An Android emulator/device, iOS simulator/device, or web browser for the Expo app
- A Groq API key for AI chat and image-based receipt scanning

For production email verification, configure a SendGrid API key and verified sender address. Without SendGrid, local development can use the configured development OTP.

## Quick start

### 1. Install dependencies

```sh
npm install
```

### 2. Configure the backend

Start MongoDB, then copy `.env.example` to `.env` and update the values:

```sh
cp .env.example .env
```

On Windows PowerShell, use:

```powershell
Copy-Item .env.example .env
```

At minimum, set strong, separate values for `JWT_SECRET` and `OTP_SECRET`. Set `GROQ_API_KEY` to enable assistant responses and receipt image extraction. For production verification emails, set `SENDGRID_API_KEY` and `SENDGRID_FROM_EMAIL`, set `NODE_ENV=production`, and remove `DEV_OTP_CODE`.

The default MongoDB connection is `mongodb://127.0.0.1:27017/raseed`; the default API port is `8082`. Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in the backend `.env` to your Razorpay test credentials. Never put the secret in the app or commit it.

For automatic transaction recording, configure a Razorpay webhook at `https://<your-api-host>/api/payments/razorpay/webhook`, subscribe to `payment_link.paid`, and set its signing secret as `RAZORPAY_WEBHOOK_SECRET`. The app can also verify payment status directly with Razorpay.

### 3. Start the API

```sh
npm run server
```

Check that it is running at [http://localhost:8082/health](http://localhost:8082/health). The response includes the MongoDB connection status.

### 4. Start the app

In another terminal:

```sh
npm start
```

Use the Expo CLI to open the app on your preferred platform. Convenience scripts are also available:

```sh
npm run android
npm run ios
npm run web
```

### Connect a physical device

The app selects a default API host for Android emulators (`10.0.2.2`), web (`localhost`), and iOS development. A physical phone needs to reach your computer over the network. Set `EXPO_PUBLIC_API_URL` in `.env` to the computer's LAN address, then restart Expo:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.20:8082
```

Replace the example address with your development machine's reachable LAN IP. Ensure the phone and computer can communicate and that the API port is accessible.

## Backend configuration

| Variable | Purpose |
| --- | --- |
| `PORT` | API listening port (default: `8082`) |
| `NODE_ENV` | Set to `production` for production behavior |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Signs API access tokens; use a strong random value |
| `OTP_SECRET` | Separate secret for verification codes |
| `DEV_OTP_CODE` | Local development OTP; remove for production |
| `SENDGRID_API_KEY` | SendGrid credential for verification email |
| `SENDGRID_FROM_EMAIL` | Verified sender address for SendGrid |
| `GROQ_API_KEY` | Enables AI assistant and receipt scanning |
| `GROQ_MODEL` | Assistant model override |
| `GROQ_VISION_MODEL` | Receipt extraction model override |
| `RAZORPAY_KEY_ID` | Razorpay test or live API key ID |
| `RAZORPAY_KEY_SECRET` | Razorpay API secret; keep server-side |
| `RAZORPAY_WEBHOOK_SECRET` | Signing secret for the Razorpay webhook |
| `EXPO_PUBLIC_API_URL` | Optional API URL override for the mobile app |

Keep `.env` and production credentials out of version control. `.env.example` contains placeholders for local setup, not usable production secrets.

## API overview

Protected endpoints require the bearer token returned by registration or login.

| Endpoint | Purpose |
| --- | --- |
| `GET /health` | API and MongoDB status |
| `/api/auth` | Registration, login, and OTP verification |
| `/api/users/me` | Current user profile and preferences |
| `/api/finance` | User-scoped expense, income, budget, and savings-goal records |
| `GET /api/insights` | Dashboard and financial summaries |
| `/api/assistant/chat` | AI assistant conversations and history |
| `POST /api/receipts/scan` | Receipt image extraction |
| `/api/payments/razorpay` | Razorpay UPI payment creation, verification, and history |

See [BACKEND_SETUP.md](BACKEND_SETUP.md) for additional setup and API details.

## Notes

- Receipt images are sent from the API to Groq for extraction. Keep the API key on the server; do not put it in the Expo app.
- Bank details are handled by the user's UPI app and are not stored by ReceiptAI.
- Firebase data is not imported into MongoDB automatically. Plan and perform any required data migration separately.
- Use HTTPS and production-grade secrets and hosting before deploying the API for real users.

## License

This project currently declares the `0BSD` license in `package.json`.
