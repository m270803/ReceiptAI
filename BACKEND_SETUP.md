# ReceiptAI backend setup

The Express API uses MongoDB for user accounts, finance data, settings, email
verification codes, and assistant chat history. Email/password authentication
is handled by the API with bcrypt-hashed passwords and signed JWT access
tokens. Groq chat and receipt-scanning requests are made on the server so the
Groq API key is never included in the mobile app.

## Configure and run MongoDB and the API

1. Start a local MongoDB server on `mongodb://127.0.0.1:27017`, or set
   `MONGODB_URI` in `.env` to a different MongoDB connection string.
2. Copy `.env.example` to `.env`. Set strong, separate random values for
   `JWT_SECRET` and `OTP_SECRET`.
3. Configure `GROQ_API_KEY` for assistant and receipt scanning. Set
   `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in the backend `.env` to your
   Razorpay test credentials. Never add either credential to the mobile app or
   commit them.    Razorpay UPI checkout creates hosted payment links; when the app
   confirms a paid link directly with Razorpay or receives a verified
   `payment_link.paid` webhook, the transaction is stored in the signed-in
   user's payment history and Expenses. Only verified, fully paid links are
   added as expenses. This checkout collects payment for the connected
   Razorpay business account and does not transfer money to arbitrary UPI IDs.
   For automatic recording, configure a Razorpay webhook pointing to
   `https://<your-api-host>/api/payments/razorpay/webhook`, subscribe to
   `payment_link.paid`, and set the webhook signing secret as
   `RAZORPAY_WEBHOOK_SECRET` in `.env`. The app's status check is also available
   when webhooks are not configured. Local
   development uses `DEV_OTP_CODE` (default `1234`) instead of email delivery.
   In production, set `NODE_ENV=production`, remove `DEV_OTP_CODE`, and set
   `SENDGRID_API_KEY` and `SENDGRID_FROM_EMAIL` for email verification.
4. Install dependencies and start the API:

   ```sh
   npm install
   npm run server
   ```

The API listens on port `8082` by default. `GET /health` reports whether
MongoDB is connected. Protected endpoints require the bearer token returned by
`POST /api/auth/register` or `POST /api/auth/login`. Email verification uses
`POST /api/auth/send-otp` and `POST /api/auth/verify-otp`.

The finance endpoints under `/api/finance` support CRUD operations for
expenses, incomes, budgets, and savings goals. Insights and assistant
responses read the signed-in user's MongoDB document. Chat history is stored
in MongoDB, and receipt images are sent to Groq Vision for extraction.
Protected Razorpay endpoints under `/api/payments/razorpay` create payment
links, check payment status with Razorpay, and list the signed-in user's
transactions. The app can recheck a transaction after returning from checkout
or from its transaction history. Configure UPI as an enabled payment method
in the linked Razorpay account for UPI Payment Links to work.
Existing Firebase data is not imported automatically; export and migrate it
separately before switching users to this backend.

## Connect Expo to the API

The app uses `10.0.2.2:8082` for the Android emulator, `localhost:8082` for
web, and Expo's development host for iOS by default. For a physical device,
set `EXPO_PUBLIC_API_URL` to a reachable backend URL, such as
`http://192.168.1.20:8082`, then restart Expo.

Use HTTPS and deploy the API behind a production-ready hosting service before
releasing the app. Never commit `.env` or database credentials.
