# 💰 Freelance Escrow Marketplace

A secure, full-stack freelance platform featuring role-based dashboards (Clients and Freelancers) and a robust **Escrow Transaction Flow** to guarantee trust and safety in freelance hiring. Funds are securely locked in escrow before milestones begin and released only when work is submitted and approved.

---

## 🏗️ Project Architecture

The application is structured as a monorepo containing distinct directories for the frontend and backend services:

```text
web_project/
├── backend/          # Node.js + Express API & Database Models
│   ├── config/       # Database connection config
│   ├── middleware/   # JWT authentication & route guards
│   ├── models/       # MongoDB Schemas (User, Job, Contract, EscrowTransaction)
│   ├── routes/       # API endpoints (auth, jobs, contracts, escrow)
│   ├── services/     # Core business logic helpers
│   └── tests/        # Jest integration and logic tests
├── frontend/         # React + Vite Client Application
│   ├── src/          # React components, style sheets, page assets
│   │   ├── App.jsx   # Main React dashboard application logic
│   │   ├── index.css # Premium dynamic responsive styles (Light/Dark themes)
│   │   └── main.jsx  # React application entry point
│   └── index.html    # Base index file
└── README.md         # Project documentation (this file)
```

---

## 🚀 Key Features

*   👥 **Role-Based Authentication**: Custom workflows for **Clients** and **Freelancers** secured via JWT.
*   💼 **Job Board Management**:
    *   Clients can post new jobs with titles, descriptions, and budgets.
    *   Freelancers can browse active listings and submit bids (including cover letters and bid amounts).
*   📜 **Contract Lifecycle**:
    *   Clients can hire a freelancer directly from their submitted applications, generating a binding contract.
    *   Track contract states: `draft` ➔ `funds_locked` ➔ `work_submitted` ➔ `completed` / `disputed` / `refunded`.
*   🔒 **Secure Escrow Flow**:
    *   **Lock Funds**: Client locks contract funds in escrow.
    *   **Submit Work**: Freelancer marks their work as submitted.
    *   **Release Funds**: Client approves work and releases funds to the freelancer's balance.
    *   **Refund / Dispute**: Allow cancellation, returning funds to the client.
*   🎨 **Premium Aesthetic**: Responsive UI featuring dynamic glassmorphism cards, micro-animations, and full **Dark/Light Mode** support (synced with user's local storage preferences).

---

## 🛠️ Technology Stack

### Backend
*   **Core**: Node.js & Express.js
*   **Database**: MongoDB via Mongoose ORM
*   **Authentication**: JSON Web Tokens (JWT) & bcryptjs (password hashing)
*   **Testing**: Jest & Supertest

### Frontend
*   **Framework**: React (v19) + Vite
*   **Icons**: Lucide React
*   **Styling**: Premium custom Vanilla CSS with support for light/dark color variables

---

## ⚡ Setup & Installation

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) (v16+) and a running [MongoDB](https://www.mongodb.com/) instance installed.

### 1. Environment Configuration
Create a `.env` file in the **root** folder of this repository (outside of `/frontend` and `/backend` directories) containing the following variables:

```env
MONGODB_URI=mongodb://localhost:27017/escrow-marketplace
JWT_SECRET=your_jwt_secret_key_here
PORT=5000
```

### 2. Backend Setup
1. Open a terminal and navigate to the backend folder:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the server in development mode (using nodemon):
   ```bash
   npm run dev
   ```
   *The backend will be running on [http://localhost:5000](http://localhost:5000).*

### 3. Frontend Setup
1. Open a new terminal and navigate to the frontend folder:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite dev server:
   ```bash
   npm run dev
   ```
   *The frontend will typically run on [http://localhost:5173](http://localhost:5173).*

---

## 🧪 Running Tests

The backend includes a comprehensive suite of integration and API tests built with Jest and Supertest.

To execute the tests:
1. Navigate to the `backend` folder:
   ```bash
   cd backend
   ```
2. Run the test command:
   ```bash
   npm test
   ```

---

## 🔌 API Endpoints Summary

### Authentication Routes (`/api/auth`)
*   `POST /register` - Register a new User (`client` or `freelancer` role)
*   `POST /login` - Log in and obtain JWT
*   `GET /me` - Get profile of the current logged-in User
*   `GET /freelancers` - Retrieve list of all registered freelancers (Client only)

### Job Board Routes (`/api/jobs`)
*   `POST /` - Create a new Job listing (Client only)
*   `GET /` - List all active/open Jobs
*   `POST /:id/apply` - Submit a bid application for a job (Freelancer only)
*   `GET /applications/my` - Fetch current freelancer's bids (Freelancer only)
*   `GET /:id/applications` - View all applications for a specific job (Client/Creator only)

### Contract Routes (`/api/contracts`)
*   `POST /` - Create a contract from a job application (Client only)
*   `GET /` - List contracts involving the authenticated user
*   `GET /:id` - Get contract & escrow transaction details

### Escrow Routes (`/api/escrow`)
*   `POST /:contractId/lock` - Lock contract funds in Escrow (Client only)
*   `POST /:contractId/submit` - Submit milestone work (Freelancer only)
*   `POST /:contractId/release` - Release locked funds to Freelancer (Client only)
*   `POST /:contractId/refund` - Refund locked funds back to Client (Client only)
