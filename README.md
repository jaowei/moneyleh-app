# Moneyleh (`moneyleh-app`)

A self-hosted, privacy-first personal finance web application built for Singapore banking and investment products. Designed to be deployed locally at home on a local network via Docker.

> 🤖 **Working on this codebase with an AI assistant or coding agent?**
> Please refer to [AGENTS.md](./AGENTS.md) for full architectural context, data models, workflows, API reference, and development conventions. See [ROADMAP.md](./ROADMAP.md) for prioritized development tasks and known technical debt.

---

## Features
- **Automated Statement Ingestion**: Parse PDF e-statements from DBS/POSB, UOB, Citibank, Standard Chartered, Trust Bank, GXS Bank, CPF, and Chocolate Finance, as well as CSV uploads.
- **Machine Learning Auto-Tagging**: Categorizes transaction descriptions automatically using Naive Bayes and KNN sentence embedding classifiers in background worker threads.
- **Card & Account Tracking**: Monitor cash accounts, credit cards (miles, cashback, rewards), and CPF balances by institution.
- **Household Expense Splitting**: Split transactions between household members with customizable shares and view net amounts owed/receivable.
- **Local Network & Home Server Ready**: Runs entirely on your local home network using Bun, Hono, embedded SQLite, and Docker.

---

## Quick Start

### Prerequisites
- [Bun](https://bun.sh/) (v1.2+)
- Docker & Docker Compose (for containerized deployment)

### Local Development

1. **Install dependencies**:
   ```sh
   # Install root and backend dependencies
   bun install

   # Install frontend dependencies
   cd src/frontend && bun install && cd ../..
   ```

2. **Environment Configuration**:
   ```sh
   cp .env.example .env
   ```

3. **Run Database Migrations & Seeds**:
   ```sh
   bun run migrate:db
   bun run seed:db
   ```
   *(Creates default admin user: `testUser1@test.com` / `testUser1pw`)*

4. **Start Development Servers**:
   ```sh
   # Backend API server (runs on port 9000)
   bun run dev

   # In a separate terminal: Frontend dev server
   bun run dev:fe
   ```

5. **Open Application**:
   Navigate to [http://localhost:9000](http://localhost:9000) (or your Vite dev port).

---

## Docker & Home Network Deployment

Moneyleh is pre-configured for Docker Compose deployment on home servers, NAS devices, or local PCs.

1. Ensure your `.env` contains your server's local network IP for `BETTER_AUTH_URL`:
   ```env
   NODE_ENV=production
   BETTER_AUTH_SECRET=your_super_secret_key
   BETTER_AUTH_URL=http://192.168.1.100:9000
   DATABASE_NAME=/data/moneyleh-app.db
   CLASSIFIER_ROOT=/data/
   CLASSIFIER_DATA_NAME=prod
   NUM_CLASSIFIER_WORKERS=1
   ```

2. Build and run:
   ```sh
   docker compose up -d --build
   ```

3. Access the app on your home network at `http://<your-local-ip>:9000`.

---

## Scripts & Commands

- `bun test`: Run test suite.
- `bun run check`: Run Biome linter and formatter check.
- `bun run format`: Auto-format source code.
- `bun run generate:migrations`: Generate Drizzle schema migrations.
- `bun run docker:start`: Run migrations, seeds, and start production server.
- `scripts/deploy_prod.sh`: Pull latest code and rebuild docker container.
- `scripts/extract_db.sh`: Export compressed backup of the Docker volume data.
