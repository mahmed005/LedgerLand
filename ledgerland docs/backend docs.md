# LedgerLand Backend

Express + TypeScript (ESM) API for a land-registry MVP aligned with the **2026-04-12 product-owner interview**:

1. **View & search** land records (district / moza / plot / owner CNIC) with **full ownership history**, **disputed** flag, and a clear **“No record found.”** response when nothing matches.
2. **Transfer** flow: seller (logged in) opens a ticket with buyer CNIC → **`simulate-nadra`** (MVP stand-in for NADRA biometrics) → **on-chain** `LAND_TRANSFER` record + Mongo owner update + history append.
3. **Downloads**: **Fard** and **registry** as text files (when stored), plus a generated **ownership certificate PDF** for court/bank style proof.

Stack: **Solidity `LandLedger`** (Hardhat), **MongoDB/Mongoose**, **ethers v6**, **Jest** (`--runInBand` so Mongo + Hardhat stay deterministic).

## Prerequisites

- **Node.js 20 LTS** recommended.
- **MongoDB** (default `mongodb://127.0.0.1:27017/ledgerland`).
- **Hardhat node** for local chain (`npm run node:chain`) and **deploy** (`npm run deploy:local`).

## Install & run

```bash
cd backend
npm install
npm run compile:solidity
# Terminal A: npm run node:chain
# Terminal B: npm run deploy:local
npm run dev
```

Compiled production run:

```bash
npm run build
npm start
```

## Environment variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | HTTP port | `3000` |
| `MONGODB_URI` | API database | `mongodb://127.0.0.1:27017/ledgerland` |
| `MONGODB_TEST_URI` | Jest database | `mongodb://127.0.0.1:27017/ledgerland_test` |
| `JWT_SECRET` | JWT signing secret | dev placeholder |
| `JWT_EXPIRES_SEC` | Token TTL (seconds) | `86400` |
| `RPC_URL` | EVM JSON-RPC | `http://127.0.0.1:8545` |
| `LEDGER_CONTRACT_ADDRESS` | `LandLedger` address | `deployments/localhost.json` |
| `LEDGER_SIGNER_PRIVATE_KEY` | Relayer key | Hardhat #0 (local only) |
| `UPLOADS_DIR` | Parcel document root | `<cwd>/uploads` |
| `ADMIN_BOOTSTRAP_CNIC` | Optional 13-digit CNIC | — |
| `ADMIN_BOOTSTRAP_PASSWORD` | Password for bootstrap admin | — |

Place a `.env` file in `backend/` (see earlier notes on loading via shell or `node --env-file`).

---

## Query parameters & sample JSON (for frontend)

Only **`GET /api/parcels/search`** uses **URL query parameters**. All other endpoints use **path parameters** (e.g. `:parcelId`) and/or **JSON bodies**—those are documented in the route sections below with sample shapes.

### `GET /api/parcels/search` — query parameters

| Query key | Required | Type | Description |
|-----------|----------|------|-------------|
| `district` | No* | string | Case-insensitive **partial** match against the parcel’s `district`. |
| `moza` | No* | string | Case-insensitive **partial** match against the parcel’s `moza` (mouza). |
| `plotNumber` | No* | string | Case-insensitive **partial** match against the parcel’s `plotNumber`. |
| `ownerCnic` | No* | string | **Current owner** CNIC; non-digits are stripped. Must normalize to **13 digits** to apply; if invalid after normalization, this filter is **silently ignored** (other params still apply). |

\* **At least one** of `district`, `moza`, `plotNumber`, or `ownerCnic` must be sent with a non-empty value after trimming. If the URL has **no** query string or **all** values are empty, the API returns `200` with `found: false` and **`message: "No record found."`** (same as zero results).

**Combination logic:** filters are **AND**ed—every parameter you include must match that parcel.

**Example URLs** (encode spaces and special characters in the browser or with `encodeURIComponent`):

```http
GET /api/parcels/search?district=Lahore
GET /api/parcels/search?district=Lahore&moza=Ravi&plotNumber=P-42
GET /api/parcels/search?ownerCnic=3520111111111
GET /api/parcels/search?ownerCnic=35201-1111111-1
```

**Sample response — matches found** (`200`, `Content-Type: application/json`):

```json
{
  "found": true,
  "parcels": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "district": "Lahore",
      "moza": "Ravi",
      "plotNumber": "P-42",
      "khasra": "",
      "currentOwnerCnic": "3520111111111",
      "disputed": false,
      "ownershipHistory": [
        {
          "ownerCnic": "3520111111111",
          "acquiredAt": "2026-04-12T10:00:00.000Z",
          "transferId": null,
          "note": "Initial record"
        }
      ],
      "hasFard": true,
      "hasRegistry": true,
      "createdAt": "2026-04-12T10:00:00.000Z",
      "updatedAt": "2026-04-12T10:00:00.000Z"
    }
  ]
}
```

**Sample response — no matches or no valid filter** (`200`):

```json
{
  "found": false,
  "message": "No record found.",
  "parcels": []
}
```

### Other endpoints — sample JSON bodies / responses

**`GET /health`** → `200`

```json
{ "status": "ok" }
```

**`POST /api/auth/signup`** — body:

```json
{ "cnic": "3520111111111", "password": "yourpassword", "fullName": "Ali Khan", "email": "optional@example.com" }
```

→ `201`

```json
{
  "user": {
    "id": "uuid",
    "cnic": "3520111111111",
    "email": "optional@example.com",
    "fullName": "Ali Khan",
    "role": "citizen",
    "createdAt": "2026-04-12T10:00:00.000Z"
  }
}
```

**`POST /api/auth/login`** — body: `{ "cnic": "3520111111111", "password": "yourpassword" }` → `200`

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { "id": "uuid", "cnic": "3520111111111", "email": null, "fullName": "Ali Khan", "role": "citizen", "createdAt": "..." }
}
```

**`GET /api/auth/me`** — header `Authorization: Bearer <token>` → `200` `{ "user": { ...same public user fields... } }`

**`GET /api/parcels/:parcelId`** → `200`

```json
{
  "parcel": {
    "id": "uuid",
    "district": "Lahore",
    "moza": "Ravi",
    "plotNumber": "P-42",
    "khasra": "",
    "currentOwnerCnic": "3520111111111",
    "disputed": false,
    "ownershipHistory": [
      {
        "ownerCnic": "3520111111111",
        "acquiredAt": "2026-04-12T10:00:00.000Z",
        "transferId": null,
        "note": "Initial record"
      }
    ],
    "hasFard": true,
    "hasRegistry": false,
    "createdAt": "2026-04-12T10:00:00.000Z",
    "updatedAt": "2026-04-12T10:00:00.000Z"
  }
}
```

Unknown id → `404` JSON: `{ "error": "No record found for this parcel id." }`

**`POST /api/transfers`** — header `Authorization: Bearer <token>`, body: `{ "parcelId": "<uuid>", "buyerCnic": "3520222222222" }` → `201`

```json
{ "transferId": "uuid-of-transfer", "status": "pending_nadra" }
```

**`POST /api/transfers/:transferId/simulate-nadra`** — header `Authorization: Bearer <token>` (seller or buyer) → `200`

```json
{
  "message": "NADRA verification simulated and transfer completed.",
  "transferId": "uuid",
  "transactionHash": "0x...",
  "parcelId": "uuid",
  "newOwnerCnic": "3520222222222"
}
```

**`POST /api/admin/parcels`** — admin JWT, body (all strings unless noted):

```json
{
  "district": "Lahore",
  "moza": "Ravi",
  "plotNumber": "P-42",
  "currentOwnerCnic": "3520111111111",
  "khasra": "optional",
  "disputed": false,
  "fardText": "optional plain text stored as fard.txt",
  "registryText": "optional plain text stored as registry.txt"
}
```

→ `201` `{ "parcel": { ...same shape as search list items... } }`

**`GET /api/blockchain`** → `200`

```json
{
  "valid": true,
  "blockCount": 3,
  "tip": { "hash": "0x...", "chainId": "31337" },
  "contractAddress": "0x..."
}
```

**`GET /api/blockchain/blocks`** → `200`

```json
{
  "blocks": [
    {
      "index": 0,
      "author": "0x...",
      "timestamp": 1234567890,
      "payload": { "type": "LAND_TRANSFER", "...": "..." }
    }
  ]
}
```

**`POST /api/blockchain/blocks`** — JWT, body: `{ "data": { "any": "json object" } }` → `201`

```json
{
  "transactionHash": "0x...",
  "recordIndex": 2,
  "envelope": {
    "type": "LEDGER_APPEND",
    "recordedAt": "2026-04-12T10:00:00.000Z",
    "actorUserId": "uuid",
    "actorCnic": "3520111111111",
    "body": { "any": "json object" }
  }
}
```

Document routes **`.../documents/fard`**, **`.../registry`**, **`.../ownership-certificate.pdf`** return **file streams** (not JSON): `text/plain` or `application/pdf`, or `404` with `{ "error": "..." }`.

---

## HTTP API (routes)

Each subsection below lists a **quick reference table**, then a **textual description** of what the route is for, who typically calls it, and what happens on success or common errors.

### Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | No | Liveness: `{ status: "ok" }`. |

**`GET /health`** — Lightweight probe for load balancers, uptime checks, or local sanity. It does not touch MongoDB or the blockchain. If the process is running and Express is bound, you get `200` and a small JSON body confirming the API is up.

---

### Authentication — `/api/auth`

CNIC is the **primary** login identifier (13 digits; dashes allowed in input).

| Method | Path | Auth | Body | Success |
|--------|------|------|------|---------|
| `POST` | `/api/auth/signup` | No | `{ cnic, password, fullName, email? }` | `201` `{ user }` |
| `POST` | `/api/auth/login` | No | `{ cnic, password }` | `200` `{ token, user }` |
| `GET` | `/api/auth/me` | Bearer JWT | — | `200` `{ user }` |

**`POST /api/auth/signup`** — Creates a **new account** tied to a national CNIC. The password is hashed; the response returns a **public user** (id, cnic, fullName, role, etc.) and never the hash. Optional `email` is stored for future notifications. Use this once per person before they can log in. Errors: duplicate CNIC (`409`), password too short or invalid CNIC format (`400`).

**`POST /api/auth/login`** — Verifies CNIC + password and returns a **JWT** the client sends as `Authorization: Bearer <token>` on protected routes. The token encodes the user id and CNIC. Errors: wrong credentials (`401`), malformed CNIC (`400`).

**`GET /api/auth/me`** — Returns the **currently authenticated** profile parsed from the JWT. Use after login to confirm session, show dashboard name, or read `role` (e.g. citizen vs admin). Requires a valid non-expired token (`401` if missing/invalid).

---

### Parcels (public) — `/api/parcels`

Per MVP, **search**, **detail**, and **document** routes are **public** (no JWT), so anyone can inspect land records and download available documents—matching the product vision of transparent, verifiable records.

| Method | Path | Query / params | Success |
|--------|------|----------------|---------|
| `GET` | `/api/parcels/search` | At least one of: `district`, `moza`, `plotNumber`, `ownerCnic` | `200` `{ found, message?, parcels[] }` |
| `GET` | `/api/parcels/:parcelId` | — | `200` `{ parcel }` or `404` |
| `GET` | `/api/parcels/:parcelId/documents/fard` | — | `200` `text/plain` attachment or `404` |
| `GET` | `/api/parcels/:parcelId/documents/registry` | — | `200` `text/plain` attachment or `404` |
| `GET` | `/api/parcels/:parcelId/documents/ownership-certificate.pdf` | — | `200` `application/pdf` or `404` |

**`GET /api/parcels/search`** — **Finds parcels** matching **all** query parameters you supply (AND logic). Text fields use case-insensitive partial matching; `ownerCnic` is normalized to 13 digits and matched against the **current** owner. If **no query parameter** is provided, or **no row** matches, the response still returns `200` with `found: false`, `parcels: []`, and **`message: "No record found."`** so the UI can show the stakeholder-required wording clearly.

**`GET /api/parcels/:parcelId`** — **Single parcel record** for a known id (returned from search or admin creation). Includes **full `ownershipHistory`** from first registration through each transfer, **`disputed`** flag, **`currentOwnerCnic`**, and flags **`hasFard` / `hasRegistry`**. Returns `404` if the id does not exist.

**`GET /api/parcels/:parcelId/documents/fard`** — **Downloads the Fard (title-deed) file** when an officer stored one at parcel creation. Streams UTF-8 plain text as an attachment. `404` if no file was stored for this parcel.

**`GET /api/parcels/:parcelId/documents/registry`** — **Downloads the registry document** when present (some parcels may have registry, some only Fard—per domain rules). Same behavior as Fard: attachment or `404`.

**`GET /api/parcels/:parcelId/documents/ownership-certificate.pdf`** — **Generates a PDF** summarizing parcel identity, current owner CNIC, disputed status, and **full ownership history**—suitable for printing or attaching as “proof” in demos (not a government-issued doc). `404` if the parcel id is unknown.

---

### Transfers — `/api/transfers`

| Method | Path | Auth | Body | Success |
|--------|------|------|------|---------|
| `POST` | `/api/transfers` | Bearer (seller) | `{ parcelId, buyerCnic }` | `201` `{ transferId, status }` |
| `POST` | `/api/transfers/:transferId/simulate-nadra` | Bearer (seller **or** buyer) | — | `200` + `transactionHash`, `parcelId`, `newOwnerCnic` |

**`POST /api/transfers`** — Starts a **land transfer ticket**: the **logged-in user must be the current owner** of `parcelId`. The body supplies the **buyer’s CNIC** (the party who will receive title after verification). Creates a row in `pending_nadra` state. Blocked if the parcel is **disputed**, if a pending transfer already exists, if buyer CNIC is invalid, or if buyer equals seller. Used in the “seller initiates transfer” step from the interview.

**`POST /api/transfers/:transferId/simulate-nadra`** — **MVP substitute for NADRA office fingerprint verification.** Any authenticated user who is **either the seller or the buyer** on that ticket may call it. The server treats both parties as NADRA-verified, then **finalizes** the transfer: appends a **`LAND_TRANSFER`** payload to the Solidity ledger, moves **`currentOwnerCnic`** to the buyer, pushes a new **history** entry, and marks the ticket **completed** with the Ethereum **transaction hash**. In production this would be split/replaced with real NADRA callbacks.

---

### Admin — `/api/admin`

Requires JWT with **`role: "admin"`** (e.g. Patwari / land-record officer in the product story).

| Method | Path | Body | Success |
|--------|------|------|---------|
| `POST` | `/api/admin/parcels` | `{ district, moza, plotNumber, currentOwnerCnic, khasra?, disputed?, fardText?, registryText? }` | `201` `{ parcel }` |

**`POST /api/admin/parcels`** — **Registers a new parcel** not yet in the system: location fields, optional **khasra**, **current owner CNIC**, optional **disputed** flag, and optional **plain-text** bodies for Fard/registry (saved under `UPLOADS_DIR` for later download). Seeds an initial **ownership history** entry. Returns the same **public parcel** shape as search/detail. Non-admins receive `403`.

**Bootstrap admin:** set `ADMIN_BOOTSTRAP_CNIC` + `ADMIN_BOOTSTRAP_PASSWORD` once; the server creates that admin user on startup if the CNIC is unused—so you can log in and call this route without manual DB edits.

---

### On-chain ledger — `/api/blockchain`

| Method | Path | Auth | Notes |
|--------|------|------|--------|
| `GET` | `/api/blockchain` | No | RPC + contract summary |
| `GET` | `/api/blockchain/blocks` | No | Full chain (dev transparency) |
| `POST` | `/api/blockchain/blocks` | Bearer | Generic append (`LEDGER_APPEND` envelope with `actorCnic`) |

**`GET /api/blockchain`** — **Operational summary** of the deployed `LandLedger` contract and JSON-RPC endpoint: whether the node responded (`valid` / `rpcOk`), how many **`recordCount`** entries exist, latest block hash / chain id, and **contract address**. Useful for dashboards and debugging local Hardhat.

**`GET /api/blockchain/blocks`** — **Reads every on-chain record**, parsing JSON payloads where possible. Intended for **audit transparency** in development; tighten or paginate before production exposure.

**`POST /api/blockchain/blocks`** — **Low-level append** of an arbitrary JSON object under a standard envelope (`LEDGER_APPEND`, actor id + CNIC, timestamp). Authenticated users can post ad-hoc audit notes. Domain transfers normally go through **`/api/transfers`** which writes **`LAND_TRANSFER`**; this route remains for extensions and tests.

---

## MVP acceptance ↔ tests

| Criterion (interview) | Test file | Test name |
|------------------------|-----------|-----------|
| Login / register with CNIC | `tests/mvpAcceptance.test.ts` | `AC: citizen registers and logs in with CNIC` |
| Search needs filters; empty → “No record found.” | `mvpAcceptance` | `AC: search with no filters…`, `…unknown search says no record` |
| Search by district/moza/plot | `mvpAcceptance` | `AC: search by district/moza/plot…` |
| Search by owner CNIC | `mvpAcceptance` | `AC: search by owner CNIC…` |
| Detail shows history + disputed | `mvpAcceptance` | `AC: parcel detail shows full ownership history…` |
| Download Fard, registry, PDF certificate | `mvpAcceptance` | `AC: download Fard and registry…` |
| Transfer + simulated NADRA + chain | `mvpAcceptance` | `AC: seller initiates transfer; simulate NADRA completes…` |
| Disputed blocks transfer | `mvpAcceptance` | `AC: disputed parcel blocks new transfer` |
| Core auth + chain append | `tests/app.test.ts`, `tests/authService.test.ts`, `tests/ethLedgerService.test.ts` | (regression) |

Run tests (Mongo must be up):

```bash
npm test
```

Uses `jest --runInBand` to avoid cross-suite collisions on `ledgerland_test`.

---

## Project layout (selected)

| Path | Role |
|------|------|
| `contracts/LandLedger.sol` | On-chain append-only store |
| `src/models/User.ts` | CNIC users + partial unique email index |
| `src/models/Parcel.ts` | Parcel + `ownershipHistory` |
| `src/models/Transfer.ts` | Transfer tickets |
| `src/services/parcelService.ts` | Search, create, document paths |
| `src/services/transferService.ts` | Transfer + NADRA simulation + ledger |
| `src/services/documentService.ts` | Ownership PDF |
| `src/routes/parcelRoutes.ts` | Public parcel + downloads |
| `src/routes/transferRoutes.ts` | Authenticated transfers |
| `src/routes/adminRoutes.ts` | Admin parcel creation |
| `src/utils/cnic.ts` | Normalize / validate CNIC |
| `tests/mvpAcceptance.test.ts` | Product-owner acceptance |

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | `tsx watch src/index.ts` |
| `npm run build` / `npm start` | Compile / run `dist/` |
| `npm run compile:solidity` | `hardhat compile` |
| `npm run node:chain` / `deploy:local` | Local chain + deploy |
| `npm test` | Jest `--runInBand` |

## Source documentation

- **README:** narrative per route, plus **[Query parameters & sample JSON](#query-parameters--sample-json-for-frontend)** for frontend integration.
- **Code:** each HTTP handler in `src/auth/authRoutes.ts`, `src/routes/*.ts`, and the `/health` handler in `src/app.ts` has a **JSDoc** block naming the method/path and describing behavior (including **`GET /api/parcels/search`** query keys).
- **Services:** `ParcelService`, `TransferService`, `AuthService`, etc. document their public methods with JSDoc.
