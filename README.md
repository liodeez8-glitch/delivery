# CAC Couriers & Shipping

Full-stack delivery tracking system — Node.js/Express backend with static HTML frontend, deployed as a single Railway service.

## Project Structure

```
cac-couriers/                  ← GitHub repo root
├── cac-backend/               ← Node.js / Express API
│   ├── admin/public/          ← Admin dashboard (served at /admin)
│   ├── config/                ← DB connection & seed scripts
│   ├── middleware/            ← Auth (JWT), error handler
│   ├── models/                ← Mongoose models
│   ├── routes/                ← API routes (/api/track, /api/contact, /api/admin)
│   ├── services/              ← Email & Socket.IO chat
│   ├── server.js              ← Entry point
│   └── package.json
├── frontend/                  ← Static HTML/CSS/JS (served by Express)
│   ├── js/
│   │   ├── script.js          ← Main frontend logic
│   │   └── chat-widget.js     ← Live chat widget
│   ├── css/
│   └── *.html
├── .env.example               ← Template — copy to cac-backend/.env
├── .gitignore
├── package.json               ← Root — used by Railway
├── railway.json               ← Railway deployment config
└── README.md
```

## Local Development

### 1. Clone the repo
```bash
git clone https://github.com/YOUR_USERNAME/cac-couriers.git
cd cac-couriers
```

### 2. Install dependencies
```bash
cd cac-backend
npm install
```

### 3. Create your local .env
```bash
cp .env.example cac-backend/.env
# Edit cac-backend/.env with your values
```

Minimum required for local dev:
```
PORT=3000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/cac_couriers
JWT_SECRET=any_long_random_string_min_32_chars
ADMIN_EMAIL=admin@test.com
ADMIN_PASSWORD=Admin1234!
```

### 4. Run the server
```bash
# From cac-backend/
npm run dev

# From repo root
npm start
```

Open `http://localhost:3000` → frontend  
Open `http://localhost:3000/admin` → admin dashboard

---

## Deploying to Railway

### Step 1 — Push to GitHub

```bash
git init
git add .
git commit -m "Initial deployment"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/cac-couriers.git
git push -u origin main
```

### Step 2 — Create Railway project

1. Go to [railway.app](https://railway.app) → **New Project**
2. Choose **Deploy from GitHub repo**
3. Select your `cac-couriers` repository
4. Railway auto-detects `railway.json` — no extra config needed

### Step 3 — Add environment variables in Railway

Go to your service → **Variables** tab and add each value from `.env.example`:

| Variable | Example value |
|---|---|
| `NODE_ENV` | `production` |
| `MONGO_URI` | `mongodb+srv://user:pass@cluster.mongodb.net/cac_couriers` |
| `JWT_SECRET` | *(run: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`)* |
| `ADMIN_EMAIL` | `admin@yourdomain.com` |
| `ADMIN_PASSWORD` | `StrongPassword123!` |
| `MAIL_USER` | your Gmail address |
| `MAIL_PASS` | your Gmail App Password |
| `FRONTEND_ORIGIN` | leave blank if frontend+backend on same Railway service |

> **MONGO_URI**: Use MongoDB Atlas (free tier). Never use `localhost` in production.

### Step 4 — Generate a domain

Railway → your service → **Settings** → **Networking** → **Generate Domain**

Your app will be live at `https://your-service-name.up.railway.app`

---

## How the frontend/backend sharing works

Express serves the `frontend/` folder as static files from the same process that runs the API:

```
https://your-app.railway.app/           → frontend/index.html
https://your-app.railway.app/tracking   → frontend/tracking.html
https://your-app.railway.app/admin      → admin dashboard
https://your-app.railway.app/api/track  → tracking API
https://your-app.railway.app/health     → health check
```

Because they share the same origin, **no CORS configuration is needed** for production.  
`FRONTEND_ORIGIN` is only required if you host the frontend on a separate custom domain.

---

## Admin Dashboard

Visit `/admin` on your deployed URL. Default credentials are whatever you set in `ADMIN_EMAIL` / `ADMIN_PASSWORD` env vars. The account is auto-created on first server start.

---

## Generating a strong JWT_SECRET

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Copy the output and paste it as `JWT_SECRET` in Railway variables.
