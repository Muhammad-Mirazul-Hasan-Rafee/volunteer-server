# VolunteerCorner — Server

A focused Express + MongoDB API that powers VolunteerCorner, secured with JWT authentication over HttpOnly cookies and deployed as a serverless function on Vercel. 🟢

---

## Live

- Server — https://volunteer-server-chi.vercel.app 🖥️
- Client — https://volunteer-client-phi.vercel.app 🌐

---

## Overview

This repository contains the server for VolunteerCorner — a RESTful API responsible for issuing sessions, managing opportunities, and handling job applications. 🗄️

The design goals are simple and non-negotiable:

- Sessions live in HttpOnly cookies, not local storage. Tokens never touch JavaScript. 🔐
- Middleware enforces trust boundaries. Protected routes are protected by construction, not by convention. 🛡️
- The database connection is cached across invocations. Serverless should not mean fragile. ⚡

---

## Stack

| Layer | Choice |
|---|---|
| Runtime | Node.js 20 🟢 |
| Framework | Express 4 🚂 |
| Database | MongoDB Atlas 🍃 |
| Auth | JSON Web Tokens in HttpOnly cookies 🔐 |
| Middleware | CORS, cookie-parser 🧱 |
| Deployment | Vercel Serverless Functions ▲ |

---

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | /jwt | — | Issue a session cookie 🔑 |
| POST | /logout | — | Clear the session cookie 🚪 |
| POST | /users | — | Create a user record 👤 |
| POST | /jobs | — | Create an opportunity 📋 |
| GET | /jobs | — | List opportunities 📚 |
| GET | /jobs/:id | — | Retrieve a single opportunity 🔍 |
| POST | /job-applications | — | Submit an application 📨 |
| GET | /job-applications | Required ✅ | List the caller's applications 📊 |
| DELETE | /job-applications/:id | Required ✅ | Remove an application 🗑️ |

Protected routes require a valid `token` cookie. Requests without one are rejected at the middleware layer before reaching any handler.

---

## Project Structure

```
api/
└── index.js        Express application and route definitions
vercel.json         Routing configuration for Vercel
package.json
```

---

## Environment

Create a `.env` file at the project root with your own values:

```env
db_user=
db_password=
TOKEN_SECRECT_KEY=
NODE_ENV=production
```

On Vercel, these are configured under Project → Settings → Environment Variables. They are never committed to the repository. 🔒

---

## Running Locally

```bash
npm install
npm run dev
```

The server listens on `http://localhost:5000`. 🖥️

For a production-like run:

```bash
npm start
```

---

## Authentication

The flow is deliberately short and auditable: 🔍

1. The client authenticates with Firebase using email, Google, or GitHub. 🔑
2. The client posts the authenticated email to `/jwt`.
3. The server signs a token and returns it as an HttpOnly, Secure, SameSite=None cookie. 🍪
4. The browser attaches the cookie to every subsequent request automatically.
5. The `verifyToken` middleware validates the token before any protected handler runs. ✅

Nothing is stored client-side. Nothing is trusted without verification.

---

## Serverless Considerations

Vercel invokes functions on demand, and each invocation can create a new Mongo client if you let it. This server avoids that by caching the connection across invocations: ⚡

```js
let cachedDb = null;

async function connectToDatabase() {
  if (cachedDb) return cachedDb;
  // Create the client, connect, and store the database reference.
  cachedDb = client.db("volunteerCorner");
  return cachedDb;
}
```

The result is a single long-lived connection reused across requests, which is what keeps response times stable under load. 📈

---

## Cross-Domain Cookies

When the client and server live on different domains, browsers treat the session cookie as third-party and silently drop it. That is not a bug in the code — it is the browser protecting the user. 🌐

The fix is architectural. The cookie is configured so that it is explicitly cross-site:

```js
{
  httpOnly: true,
  secure: true,
  sameSite: "none",
  maxAge: 10 * 60 * 60 * 1000,
  path: "/"
}
```

And the client proxies all API traffic under `/api/*`, so the browser sees a single origin. The cookie is delivered as first-party, and sessions survive deploys. 🔀

---

## Deployment

Pushing to `main` deploys automatically to Vercel. ▲

Required `vercel.json`:

```json
{
  "version": 2,
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/api"
    }
  ]
}
```

All routes are forwarded to the Express application inside `/api`. 🛠️

---

## License

ISC 📄