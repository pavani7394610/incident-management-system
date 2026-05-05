# Incident Management System (IMS)

This project is a simplified Incident Management System built to simulate how real-world systems handle failures across different services.

It captures incoming error signals, groups them into incidents, and manages them through a proper lifecycle. Each incident must go through a Root Cause Analysis (RCA) before it can be closed.

---

## What the system does

- Accepts failure signals from different components  
- Groups multiple signals into a single incident  
- Automatically assigns priority (P0, P1, P2)  
- Tracks incident status from OPEN to CLOSED  
- Requires RCA before closing any incident  
- Shows everything in a live dashboard  

---

## Architecture 

Frontend (React - port 3000)  
↓  
Backend (Node.js + Express - port 3001)  
↓  
- In-memory queue for signals  
- Debounce logic for grouping  
- State machine for lifecycle  
- Priority strategy logic  

Databases:
- PostgreSQL → incidents and RCA  
- MongoDB → raw signals  
- Redis → cached dashboard data  

---

## Tech Stack

- Frontend: React  
- Backend: Node.js, Express  
- Database: PostgreSQL  
- Signal storage: MongoDB  
- Cache: Redis  
- Setup: Docker  

---

## How to run the project

### 1. Clone the repo
https://github.com/pavani7394610/incident-management-system.git

---

### 2. Start databases
docker-compose up -d

---

### 3. Start backend
cd backend
npm install
npm run dev

Backend will run on: http://localhost:3001

---

### 4. Start frontend
Open a new terminal: http://localhost:3000

---

### 5. Run failure simulation
cd backend
npm run simulate

This will simulate a real failure starting from database and affecting other services.

---

## API endpoints (basic)

Signals  
- POST /api/signals  

Work Items  
- GET /api/workitems  
- GET /api/workitems/:id  
- PATCH /api/workitems/:id/status  
- POST /api/workitems/:id/rca  

Health  
- GET /health  

---

## How it handles high load

Instead of sending every signal directly to the database:

- Signals go into an in-memory queue  
- API responds immediately (202 Accepted)  
- Background worker processes signals in batches  

This prevents the system from slowing down or crashing under heavy traffic.

---

## Key design decisions

### 1. Debouncing
Multiple signals from the same component within a short time are grouped into one incident.  
This avoids too many duplicate incidents.

---

### 2. Priority logic
- Database failures → P0  
- API failures → P1  
- Cache / Queue → P2  

---

### 3. Incident lifecycle
OPEN → INVESTIGATING → RESOLVED → CLOSED  

An incident cannot be closed without RCA.

---

## Testing
cd backend
npm test

---

## Project structure
incident-management-system/
├── backend/
│ ├── scripts/
│ └── src/
├── frontend/
│ ├── components/
│ └── pages/


---

## Environment variables
PORT=3001
PG_HOST=localhost
MONGO_URI=your_mongo_uri
REDIS_HOST=localhost

---

## Final note

This project focuses on how systems behave during failures  handling large volumes of signals, grouping them properly, and managing incidents in a structured way.