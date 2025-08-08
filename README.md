# Event Analytics Backend

A lightweight backend service for tracking events, computing funnels, and retention analytics.
Built with **Node.js + Express + MongoDB**.

---

## 📐 Architecture & Design Decisions

### Tech Stack
- **Node.js + Express** – REST API server
- **MongoDB** – Persistent event storage with flexible schema for properties
- **Mongoose** – ODM for MongoDB queries and aggregations
- **TypeScript** – Type safety
- **dotenv** – Environment variable management

### Key Design Decisions
1. **Document-Oriented Storage**
   - Each event is a MongoDB document containing `orgId`, `projectId`, `userId`, `eventName`, `timestamp`, and optional `properties`.
   - Flexible schema allows adding custom event properties without schema migrations.

2. **API Key Authentication**
   - Each request is authenticated using an API key that contains:
     ```json
     {
       "key": "...",
       "orgId": "...",
       "projectId": "...",
       "rateLimitPerMinute": 2000
     }
     ```
   - Ensures events are scoped to an organization/project.

3. **Rate Limiting**
   - Prevents API abuse by applying request limits per API key.

4. **Aggregation Pipelines**
   - Funnels and retention metrics are computed directly using MongoDB aggregation for performance.
   - This avoids loading large datasets into application memory.

5. **Extensible Event Processing**
   - All endpoints use a central `EventModel` so analytics can be extended with minimal changes.

---

## ⚙️ Local Setup Instructions

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/event-analytics-backend.git
cd event-analytics-backend

2. Install Dependencies
bash
Copy
Edit
npm install
3. Environment Variables
Create a .env file in the project root:

env
Copy
Edit
PORT=3000
MONGODB_URI=mongodb://localhost:27017/event_analytics
API_KEYS=[{"key":"local_admin_key_please_change","orgId":"org_local","projectId":"proj_local","rateLimitPerMinute":2000}]
4. Run Locally
bash
Copy
Edit
npm run dev
Server will start on:

arduino
Copy
Edit
http://localhost:3000
🚀 API Usage Examples
1. Create Event
http
Copy
Edit
POST /events
X-API-Key: local_admin_key_please_change
Content-Type: application/json

{
  "userId": "user123",
  "eventName": "signup",
  "timestamp": "2025-08-08T10:00:00.000Z",
  "properties": { "source": "homepage" }
}
2. Funnels
http
Copy
Edit
POST /funnels
X-API-Key: local_admin_key_please_change
Content-Type: application/json

{
  "steps": ["signup", "view_page"],
  "from": "2025-08-08T00:00:00.000Z",
  "to": "2025-08-09T00:00:00.000Z"
}
Example Response

json
Copy
Edit
{
  "totalUsers": 1,
  "steps": [
    { "step": "signup", "users": 1 },
    { "step": "view_page", "users": 1 }
  ],
  "sample": [
    { "userId": "user123", "reached": 2, "droppedAt": null }
  ]
}
3. Retention
http
Copy
Edit
GET /retention?cohort=signup&days=7
X-API-Key: local_admin_key_please_change
Example Response

json
Copy
Edit
{
  "totalCohort": 1,
  "days": 7,
  "retention": [
    { "day": 0, "users": 0, "percent": 0 },
    { "day": 1, "users": 1, "percent": 1 },
    { "day": 2, "users": 0, "percent": 0 },
    { "day": 3, "users": 1, "percent": 1 },
    { "day": 4, "users": 0, "percent": 0 },
    { "day": 5, "users": 1, "percent": 1 },
    { "day": 6, "users": 0, "percent": 0 }
  ]
}
📊 Data Model
ts
Copy
Edit
interface Event {
  _id?: string;
  orgId: string;
  projectId: string;
  userId: string;
  eventName: string;
  timestamp: Date;
  properties?: Record<string, any>;
}
🛠 Development Notes
Aggregations are run with allowDiskUse(true) for large datasets.

Date filtering uses UTC to avoid timezone discrepancies.

You can extend analytics endpoints by adding new aggregation stages.