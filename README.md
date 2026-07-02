# StudyFocus

A study-time management app inspired by the Pomodoro method, with session tracking and progress statistics.

## 1) Overview

StudyFocus includes two parts:
- Backend: Spring Boot REST API (Java 17)
- Frontend: React + Vite

Main flow:
- Users register and log in
- Backend creates an authenticated HTTP session
- Frontend sends session cookies to access study-session and stats APIs

## 2) Current Features

- Register, login, and logout
- Get current user profile
- Create study sessions
- List study sessions
- View study statistics
- Delete a session
- Health-check endpoint for backend

## 3) Tech Stack

### Backend
- Java 17
- Spring Boot 3.2.1
- Spring Web
- Spring Data JPA
- Spring Security
- MySQL
- Lombok
- Maven Wrapper

### Frontend
- React 19
- Vite
- React Router DOM
- Fetch API (with `credentials: 'include'`)
- ESLint

## 4) Project Structure

```text
studyfocus_work/
  backend/
    pom.xml
    src/main/java/org/devnqminh/studyfocus/
      controller/
      service/
      repository/
      model/
      security/
    src/main/resources/
      application.properties
      application-local.properties
  frontend/
    package.json
    vite.config.js
    src/
      api/
      components/
      pages/
```

## 5) Environment Requirements

- Node.js 18+
- npm 9+
- Java JDK 17
- MySQL 8+

Important recommendations:
- Use JDK 17 to build/run the backend
- Avoid newer JDK versions for this repo to reduce Lombok/Javac compatibility issues

## 6) Local Setup & Run

## Step 1: Clone the repository

```bash
git clone <repo-url>
cd studyfocus_work
```

## Step 2: Configure MySQL

Create database:

```sql
CREATE DATABASE studyfocus;
```

Update connection settings in `backend/src/main/resources/application.properties`:
- `spring.datasource.url`
- `spring.datasource.username`
- `spring.datasource.password`

Security note:
- Do not commit real credentials
- Prefer environment variables or a local profile file

## Step 3: Run backend

```bash
cd backend
./mvnw spring-boot:run
```

Backend default URL:
- http://localhost:8080

Quick health check:
- GET http://localhost:8080/api/ping

## Step 4: Run frontend

Open a new terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend default URL:
- http://localhost:5173

Vite proxy is configured to forward `/api` to backend on port `8080`.

## 7) Default Test Account

When backend starts, it seeds a test user if not present:
- username: `testuser`
- password: `123456`

## 8) Main APIs

Base URL (through frontend dev server):
- `/api`

Or direct backend URL:
- `http://localhost:8080/api`

### Auth

- POST `/api/auth/register`
- POST `/api/auth/login`
- POST `/api/auth/logout`
- GET `/api/auth/me`

Example register body:

```json
{
  "name": "Nguyen Van A",
  "username": "nguyenvana",
  "password": "123456"
}
```

Example login body:

```json
{
  "username": "testuser",
  "password": "123456"
}
```

### Study Sessions

- POST `/api/study-sessions`
- GET `/api/study-sessions`
- GET `/api/study-sessions/{id}`
- DELETE `/api/study-sessions/{id}`
- GET `/api/study-sessions/stats`

Example create-session body:

```json
{
  "duration": 25,
  "breakTime": 5,
  "count": 1,
  "mode": "pomodoro"
}
```

Notes:
- Study-session APIs require a valid logged-in session
- Frontend already sends cookies via `credentials: 'include'`

## 9) Build & Verify

### Backend

```bash
cd backend
./mvnw clean test
./mvnw clean package
```

### Frontend

```bash
cd frontend
npm run lint
npm run build
npm run preview
```

## 10) Common Issues

### 1. Frontend gets 401 from APIs
- User is not logged in
- Session cookie is not sent
- Make sure requests are made from frontend dev origin (`5173`) and use `credentials: 'include'`

### 2. Database connection errors
- MySQL is not running
- Wrong username/password
- Database `studyfocus` has not been created

### 3. Backend build fails due to Java version
- Check `java -version`
- Ensure JDK 17 is active

## 11) Next Improvements

- Migrate from session-based auth to full JWT flow
- Add refresh token support
- Add unit/integration tests for services and controllers
- Add Docker Compose for local stack (frontend + backend + mysql)
- Standardize environment config for dev/staging/prod

## 12) Contributing

- Create a new branch from `main`
- Keep commits small and clear
- Open a Pull Request with a complete change summary

## 13) License

No license has been declared yet.
If you plan to publish this project, add a LICENSE file (for example, MIT).
