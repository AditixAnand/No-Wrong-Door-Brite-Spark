# No Wrong Door — Calder County Unified Resident View

So basically the problem is this — a county has two systems that hold info about the same people, and those two systems have never once talked to each other. One's a modern-ish REST service (Resident Index), the other's an old cranky XML service (Benefits Register) that's slow and fails on purpose about 40% of the time. A caseworker used to have to go check both manually, by hand, every single time. This project is meant to fix exactly that — one search, one view, both systems pulled together, even when one of them is acting up.

Name of the game: "No Wrong Door." Doesn't matter which door a caseworker walks through, they get the full picture.

## What's actually in here

- Normalizes and matches residents across both systems (no shared ID between them, so this is the genuinely hard part — matching on name/DOB/address only)
- A review queue for the cases where identity is legitimately ambiguous — a human decides, the app never silently guesses
- Caching that keeps showing useful (labeled-stale) data even when the Benefits Register is down
- Live source health + reliability monitoring, with spike alerts
- Login with two roles (Caseworker / Supervisor) and an audit trail of who looked at what
- A dashboard for all of it, dark mode included because why not

More on the reasoning behind all this is in `DECISIONS.md` if you want the longer story.

## Heads up before you try to run this

Everything's in here already — `backend/`, `frontend/`, and `services/` (the two mock data services). Nothing extra to download or copy in separately.

Also — no `.env` file or API key needed anywhere. Everything runs locally, all defaults are already wired to localhost.

---

## Running it on macOS

### 0. Homebrew (skip if you've already got it)
Check with `brew --version` in Terminal. If that fails:
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### 1. Install the stuff you need
```bash
brew install node python3
brew tap mongodb/brew
brew trust mongodb/brew
brew install mongodb-community
brew install redis
```
(that `brew trust` line is only needed because of a tap-trust prompt some Homebrew setups throw — if you don't get that prompt, you can skip it)

### 2. Get the project
Download the ZIP from GitHub, or:
```bash
git clone https://github.com/AditixAnand/No-Wrong-Door-Brite-Spark.git
```

### 3. Start MongoDB and Redis
```bash
brew services start mongodb-community
brew services start redis
```

### 4. Start the two mock services — keep this terminal tab open
```bash
cd /path/to/project
BENEFITS_FAILURE_RATE=0.40 ./services/run_both.sh
```
(the `0.40` matches the actual failure rate this project was built and tested against — leaving it off defaults to 15%, which is the original rate before it got bumped up)

### 5. Backend — new terminal tab, keep this one open too
```bash
cd /path/to/project/backend
npm install
node src/ingestion/runRestIngestion.js
node src/ingestion/runXmlIngestion.js
node src/matching/runEntityResolution.js
node src/server.js
```

### 6. Frontend — another new terminal tab
```bash
cd /path/to/project/frontend
npm install
npm run dev
```

### 7. Open it
Go to `http://localhost:5173` in your browser.

---

## Running it on Windows

### 1. Install Node.js
From `nodejs.org` (LTS version), or:
```powershell
winget install OpenJS.NodeJS.LTS
```

### 2. Install Python
From `python.org/downloads` — make sure you tick "Add python.exe to PATH" while installing. Or:
```powershell
winget install Python.Python.3.12
```

### 3. Install MongoDB
Grab the MongoDB Community Server `.msi` installer from `mongodb.com/try/download/community` and run it with defaults. It sets itself up as a Windows service and starts on its own.

### 4. Install Redis (as Memurai)
Real Redis doesn't run cleanly on Windows anymore, so use **Memurai** instead — it's Redis-compatible and free for what we need here:
- Download from `memurai.com/get-memurai`
- Install with defaults — it runs automatically as a Windows service on port 6379

(If you're already on WSL2, you can skip Memurai and just run actual Redis inside WSL instead: `sudo apt install redis-server && redis-server`)

### 5. Get the project
Download the ZIP from GitHub and extract it somewhere like `C:\Projects\No-Wrong-Door-Brite-Spark-main`, or:
```powershell
git clone https://github.com/AditixAnand/No-Wrong-Door-Brite-Spark.git
```

### 6. Start the mock services — two separate Command Prompt / PowerShell windows
The `run_both.sh` script is bash, so it won't run directly on Windows (unless you're using Git Bash or WSL). Just run the two Python scripts separately instead — it's the same thing really.

**Window 1:**
```powershell
cd C:\Projects\No-Wrong-Door-Brite-Spark-main\services
python rest_service.py --port 8081
```

**Window 2:**
```powershell
cd C:\Projects\No-Wrong-Door-Brite-Spark-main\services
python xml_service.py --port 8082 --failure-rate 0.40
```
Leave both windows open.

### 7. Backend — new window
```powershell
cd C:\Projects\No-Wrong-Door-Brite-Spark-main\backend
npm install
node src\ingestion\runRestIngestion.js
node src\ingestion\runXmlIngestion.js
node src\matching\runEntityResolution.js
node src\server.js
```

### 8. Frontend — another new window
```powershell
cd C:\Projects\No-Wrong-Door-Brite-Spark-main\frontend
npm install
npm run dev
```

### 9. Open it
Go to `http://localhost:5173` in your browser.

---

## Logging in

| Username | Password | What they can do |
|---|---|---|
| `caseworker` | `caseworker123` | Search, view resident records |
| `supervisor` | `supervisor123` | Everything above, plus Review Queue, Source Health, Reliability, and Audit Log |

## If something goes wrong

**"Address already in use"** — something's already running on that port. On Mac: `lsof -i :8081` (swap the port) to find and kill it. On Windows: `netstat -ano | findstr :8081` then `taskkill /PID <pid> /F`.

**Search comes back empty** — you probably haven't run the ingestion commands yet (the three `node` commands before starting the server, in the Backend step). The database starts out completely empty.

**Frontend loads but nothing works / errors everywhere** — check that the backend window is still alive, and that MongoDB + Redis are actually running.

**MongoDB says "refusing to load formula... untrusted tap"** — run `brew trust mongodb/brew` and try again.

You'll end up with 3-4 terminal windows running at once — that's expected, not a bug. Don't close them while you're using the app.
