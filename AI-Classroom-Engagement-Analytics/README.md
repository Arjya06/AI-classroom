# AI Classroom Engagement Analytics

A full-stack educational analytics platform built for a B.Tech Computer Science & Engineering project. It helps teachers manage classrooms and students, track attendance, conduct live webcam-based classroom monitoring using **MediaPipe Face Landmarker**, compute transparent engagement indicators, inspect historical analytics, and generate downloadable reports.

---

## 1. Architecture Overview

```
React.js (Vite) + MediaPipe Face Landmarker (Browser CV)
        │
        │  Axios REST API (JWT Bearer Token, aggregated numerical metrics only)
        ▼
Spring Boot 3.3 (Java 17)
  ├── controller/   (REST API endpoints)
  ├── service/      (Engagement calculation, renormalization, analytics, reports)
  ├── repository/   (Spring Data JPA)
  ├── entity/       (JPA Hibernate entities)
  ├── dto/          (Validated request/response records)
  ├── security/     (Spring Security + JWT + BCrypt)
  └── exception/    (Global REST exception handler)
        │
        │  JDBC / Hibernate
        ▼
MySQL 8.0+ (classroom_engagement_db)
```

### Privacy & Scientific Scope
- **No Raw Video Storage**: Webcam frames are processed locally in the browser using MediaPipe Face Landmarker. Only numerical attention indicators are sent to the backend.
- **No Facial Recognition or Emotion Inference**: The system never identifies individuals biometrically or infers internal emotions/intelligence.
- **Transparent Scoring Formula**:
  `Engagement Score = 50% Attention Orientation + 30% Face Presence + 20% Participation`
  When participation data is unavailable or disabled, weights are **renormalized** across Attention Orientation (`62.5%`) and Face Presence (`37.5%`) rather than inventing arbitrary participation values.
- **Demo Mode Separation**: Demonstration records and simulated live sessions are explicitly labelled `DEMO MODE`.

---

## 2. Project Folder Structure

```
AI-Classroom-Engagement-Analytics/
├── backend/                  # Spring Boot 3.3 + Java 17 + Maven REST API
│   ├── pom.xml
│   └── src/
│       ├── main/java/com/classroom/
│       │   ├── config/       # SecurityConfig & CORS
│       │   ├── controller/   # Auth, Classroom, Student, Monitoring, Attendance, Analytics, Reports, Settings
│       │   ├── dto/          # Validated DTO records
│       │   ├── entity/       # Teacher, Classroom, Student, MonitoringSession, EngagementRecord, Attendance, ParticipationEvent, TeacherSettings
│       │   ├── exception/    # GlobalExceptionHandler
│       │   ├── repository/   # Spring Data JPA repositories
│       │   ├── security/     # JwtTokenProvider, JwtAuthenticationFilter, CustomUserDetailsService
│       │   └── service/      # Business logic & scoring
│       ├── main/resources/application.properties
│       └── test/java/com/classroom/ClassroomEngagementTests.java
├── database/
│   ├── schema.sql            # MySQL DDL schema
│   └── sample-data.sql       # Demo teacher, classrooms, students, sessions, attendance
├── frontend/                 # React + Vite + Tailwind + Recharts + Axios + MediaPipe
└── README.md
```

---

## 3. MySQL Setup

1. Ensure MySQL 8.0+ is running locally on port `3306`.
2. Run the schema and sample data scripts:
   ```bash
   mysql -u root -p < database/schema.sql
   mysql -u root -p < database/sample-data.sql
   ```
3. Configure credentials via environment variables (or `backend/src/main/resources/application.properties`):
   ```bash
   export DB_HOST=localhost
   export DB_PORT=3306
   export DB_NAME=classroom_engagement_db
   export DB_USERNAME=root
   export DB_PASSWORD=your_mysql_password
   export JWT_SECRET=YourSecure256BitSecretKeyHereAtLeast32CharactersLong
   ```

---

## 4. Running the Application Locally

### Backend (Spring Boot)
```bash
cd backend
mvn test
mvn spring-boot:run
```
Spring Boot starts at `http://localhost:8080`.

### Frontend (React + Vite)
```bash
cd frontend
cp .env.example .env
# Set VITE_API_BASE_URL=http://localhost:8080/api in .env
npm install
npm run dev
```
React starts at `http://localhost:5173` (or `http://localhost:3000`).

---

## 5. REST API Reference

| Area | Method & Endpoint | Description |
| --- | --- | --- |
| Auth | `POST /api/auth/register` | Register a teacher account (BCrypt + JWT) |
| Auth | `POST /api/auth/login` | Authenticate teacher and receive JWT |
| Classrooms | `GET/POST /api/classrooms`, `GET/PUT/DELETE /api/classrooms/{id}` | Manage classrooms |
| Students | `GET/POST /api/students`, `GET/PUT/DELETE /api/students/{id}` | Manage students |
| Monitoring | `POST /api/sessions/start`, `/{id}/metrics`, `/{id}/participation`, `/{id}/pause`, `/{id}/resume`, `/{id}/stop` | Live session lifecycle & metric ingestion |
| Attendance | `GET/POST /api/attendance`, `PUT /api/attendance/{id}`, `GET /api/attendance/classroom/{classroomId}` | Manual attendance tracking |
| Analytics | `GET /api/analytics/dashboard`, `/engagement`, `/classrooms`, `/students/{id}`, `/sessions/{id}` | Aggregated analytics |
| Reports | `GET /api/reports/engagement`, `/attendance`, `/session/{sessionId}` | Structured report payloads |
| Settings | `GET/PUT /api/settings` | Scoring weights, thresholds, sampling interval |

---

## 6. Using Webcam Monitoring & Demo Mode

1. **Live Monitoring**: Navigate to **Live Monitoring**, select a classroom, enter a session title, choose **Live Webcam (MediaPipe CV)**, and click **Start Monitoring**. Grant browser camera permission when prompted. MediaPipe Face Landmarker extracts face presence, head yaw/pitch orientation, and eye openness locally in the browser and sends only numerical summaries at the configured sampling interval.
2. **Demo Mode**: Select **Simulated Demo Mode** on the Live Monitoring page (or explore `[DEMO]` classrooms) when testing without a physical classroom camera. All simulated sessions and records are explicitly labelled `DEMO MODE`.

---

## 7. Troubleshooting

- **Backend Unavailable / Network Error**: Verify Spring Boot is running on port `8080` and `VITE_API_BASE_URL` matches.
- **MySQL Connection Refused**: Check MySQL service status (`sudo service mysql status` / Windows Services) and confirm `DB_USERNAME` / `DB_PASSWORD`.
- **Camera Permission Denied**: Enable camera access in browser site settings (`https://` or `localhost` is required by `navigator.mediaDevices.getUserMedia`).
- **Low Lighting / Face Not Detected**: Ensure adequate front lighting; when detection confidence drops, the app marks records as `Insufficient visual data` rather than guessing scores.
