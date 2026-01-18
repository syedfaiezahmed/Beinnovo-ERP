# Beinnovo-ERP

A comprehensive Enterprise Resource Planning (ERP) and Accounting System built with the MERN stack (MongoDB, Express, React, Node.js).

## 🚀 Features

### 📊 Financial Management
- **Dashboard:** Real-time financial overview and key metrics.
- **General Ledger & Journal:** Complete double-entry bookkeeping.
- **Accounts Payable & Receivable:** Manage bills, invoices, and payments.
- **Chart of Accounts:** Customizable financial structure.
- **Banking:** Bank accounts and cash management.

### 📦 Inventory & Supply Chain
- **Inventory Management:** Track stock levels, warehouses, and valuations.
- **Purchasing:** Purchase orders and vendor management.
- **Invoicing:** Create and manage customer invoices.

### 👥 Human Resources
- **Employee Management:** Track employee details and roles.
- **Payroll:** Process salaries and generate payslips.
- **Attendance:** Timesheet management.

### 📈 Reporting
- **Financial Statements:** Balance Sheet, Profit & Loss, Trial Balance.
- **Export Options:** PDF and Excel export for all reports.

### 🔐 Security & Administration
- **Role-Based Access Control (RBAC):** Admin and User roles.
- **Multi-Tenancy:** Supported via Super Admin Dashboard.
- **Secure Authentication:** JWT-based login.

## 🛠️ Tech Stack

- **Frontend:** React, Vite, Tailwind CSS, Chart.js
- **Backend:** Node.js, Express.js
- **Database:** MongoDB
- **Authentication:** JSON Web Tokens (JWT)

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/syedfaiezahmed/Beinnovo-ERP.git
   cd Beinnovo-ERP
   ```

2. **Install Dependencies**
   ```bash
   # Install server dependencies
   cd server
   npm install

   # Install client dependencies
   cd ../client
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file in the `server` directory:
   ```env
   PORT=5000
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_secret_key
   ```

4. **Run the Application**
   ```bash
   # Run Backend (from server directory)
   npm start

   # Run Frontend (from client directory)
   npm run dev
   ```

## 🚀 Deployment

Configured for deployment on **Vercel** with a monorepo structure.
