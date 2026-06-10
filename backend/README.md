# TaskMaster: A Collaborative Task Tracking System

A robust, production-grade RESTful API for collaborative task management built with **Node.js**, **Express.js**, and **MongoDB**. TaskMaster enables teams to create projects, assign tasks, collaborate through comments and file attachments, and manage everything with secure JWT-based authentication.

> **AirTribe Backend Assignment** — Collaborative Task Tracking System

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Setup Instructions](#setup-instructions)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
  - [User Authentication](#user-authentication)
  - [Task Management](#task-management)
  - [Team Management](#team-management)
  - [Project Management](#project-management)
  - [Comments](#comments)
  - [Attachments](#attachments)
- [Data Models](#data-models)
- [Error Handling](#error-handling)
- [Testing](#testing)
- [Project Structure](#project-structure)

---

## Features

### ✅ User Authentication & Management
- Secure user registration and login
- JWT-based session management (7-day expiry)
- bcryptjs password hashing (10 salt rounds)
- View and update your profile

### ✅ Task Management
- Full CRUD operations for tasks
- Rich task model: title, description, due date, priority, tags
- **Filtering** by completion status, priority, and due date range
- **Sorting** by due date, priority, title, or creation date
- **Text search** across title and description
- Task scoped to creator and assignee (users only see their own + assigned tasks)

### ✅ Team / Project Collaboration
- Create and manage teams with role-based access (`owner`, `admin`, `member`)
- Join teams using a simple team ID (open join flow)
- Create projects under teams
- Assign tasks to team members
- Add and delete **comments** on tasks
- Add and delete **file attachment metadata** on tasks

### ✅ RESTful API Best Practices
- Proper HTTP status codes and structured error responses
- Input validation on all endpoints
- JWT auth middleware protecting all private routes
- Role guards protecting admin/owner-only operations

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js (v18+) |
| Framework | Express.js |
| Database | MongoDB (Atlas) via Mongoose |
| Auth | JSON Web Tokens (JWT) |
| Password Hashing | bcryptjs |
| Testing | tap + supertest |
| Config | dotenv |

---

## Prerequisites

- **Node.js** >= 18.0.0
- **npm** (comes with Node.js)
- A **MongoDB** instance (local or MongoDB Atlas)

---

## Setup Instructions

### 1. Clone the repository

```bash
git clone https://github.com/airtribe-projects/task-manager-api-PrinceMakavana.git
cd task-manager-api-PrinceMakavana
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root (see [Environment Variables](#environment-variables)):

```bash
cp .env.example .env
# then edit .env with your values
```

### 4. Start the server

```bash
# Development (auto-reload)
npm run dev

# Production
npm start
```

The server starts at `http://localhost:3000`.

---

## Environment Variables

| Variable | Description | Example |
|---|---|---|
| `MONGODB_URI` | MongoDB connection string | `mongodb+srv://user:pass@cluster.mongodb.net/` |
| `JWT_SECRET` | Secret key for signing JWTs | `your-super-secret-key` |
| `JWT_EXPIRES_IN` | JWT token expiry | `7d` |
| `PORT` | Server port (optional) | `3000` |

---

## API Reference

All protected routes require a `Bearer` token in the `Authorization` header:

```
Authorization: Bearer <your_jwt_token>
```

---

### User Authentication

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/users/register` | ❌ | Register a new user |
| `POST` | `/users/login` | ❌ | Login and receive a JWT |
| `GET` | `/users/profile` | ✅ | Get the current user's profile |
| `PUT` | `/users/profile` | ✅ | Update the current user's profile |

#### POST `/users/register`
```json
{
  "name": "Prince Makavana",
  "email": "prince@example.com",
  "password": "SecurePass123"
}
```
**Response:** `201 Created` — returns the user object and a JWT token.

#### POST `/users/login`
```json
{
  "email": "prince@example.com",
  "password": "SecurePass123"
}
```
**Response:** `200 OK` — returns the user object and a JWT token.

---

### Task Management

All task endpoints require authentication (🔒 JWT).

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/tasks` | Create a new task |
| `GET` | `/tasks` | List all your tasks (with filters) |
| `GET` | `/tasks/:id` | Get a specific task |
| `PUT` | `/tasks/:id` | Update a task |
| `DELETE` | `/tasks/:id` | Delete a task |

#### POST `/tasks` — Create a task
```json
{
  "title": "Design landing page",
  "description": "Create wireframes and final design",
  "dueDate": "2026-06-30",
  "priority": "high",
  "tags": ["design", "frontend"],
  "project": "<projectId>",
  "assignedTo": "<userId>"
}
```
> `dueDate` accepts `YYYY-MM-DD` or `DD/MM/YYYY` format.
> `priority` must be `low`, `medium`, or `high` (default: `medium`).
> `project` and `assignedTo` are optional — for team tasks only.

#### GET `/tasks` — Query Parameters

| Parameter | Type | Description | Example |
|---|---|---|---|
| `completed` | boolean | Filter by completion | `?completed=false` |
| `priority` | string | Filter by priority | `?priority=high` |
| `dueBefore` | date | Tasks due before date | `?dueBefore=2026-12-31` |
| `dueAfter` | date | Tasks due after date | `?dueAfter=2026-01-01` |
| `search` | string | Search title & description | `?search=landing+page` |
| `sortBy` | string | Sort field | `?sortBy=dueDate` |
| `order` | string | Sort direction | `?order=desc` |
| `project` | ObjectId | Filter by project | `?project=<id>` |
| `assignedTo` | ObjectId | Filter by assignee | `?assignedTo=<userId>` |

---

### Team Management

All team endpoints require authentication (🔒 JWT).

| Method | Endpoint | Auth Level | Description |
|---|---|---|---|
| `POST` | `/teams` | Member | Create a new team (you become owner) |
| `GET` | `/teams` | Member | List all teams you belong to |
| `GET` | `/teams/:id` | Member | Get a specific team |
| `PUT` | `/teams/:id` | Admin/Owner | Update team name or description |
| `POST` | `/teams/:id/join` | Member | Join a team by its ID |
| `POST` | `/teams/:id/leave` | Member | Leave a team (owner cannot leave) |
| `DELETE` | `/teams/:id/members/:userId` | Admin/Owner | Remove a member from the team |
| `PUT` | `/teams/:id/members/:userId/role` | Owner | Change a member's role |

#### POST `/teams` — Create a team
```json
{
  "name": "Alpha Team",
  "description": "Our primary development team"
}
```
**Response:** `201 Created` — creator is automatically assigned the `owner` role.

#### PUT `/teams/:id/members/:userId/role` — Update role
```json
{
  "role": "admin"
}
```
Valid roles (assignable): `admin`, `member`. The `owner` role cannot be changed.

---

### Project Management

All project endpoints require authentication (🔒 JWT). Creating/deleting projects requires Admin or Owner role.

| Method | Endpoint | Auth Level | Description |
|---|---|---|---|
| `POST` | `/teams/:teamId/projects` | Admin/Owner | Create a project under a team |
| `GET` | `/teams/:teamId/projects` | Member | List all projects in a team |
| `GET` | `/projects/:id` | Member | Get a specific project |
| `PUT` | `/projects/:id` | Admin/Owner | Update a project |
| `DELETE` | `/projects/:id` | Owner | Delete a project |

#### POST `/teams/:teamId/projects` — Create a project
```json
{
  "name": "Website Redesign",
  "description": "Full redesign of the company website"
}
```

---

### Comments

Comments are sub-resources on tasks. Any user who can access the task can comment.

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/tasks/:id/comments` | Add a comment to a task |
| `DELETE` | `/tasks/:id/comments/:commentId` | Delete a comment (author or task owner only) |

#### POST `/tasks/:id/comments`
```json
{
  "text": "Wireframes are ready for review."
}
```
**Response:** `201 Created` — returns the new comment object with `_id`, `text`, `user`, and timestamps.

---

### Attachments

Attachments store metadata (filename + URL). File upload to a storage provider is handled client-side.

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/tasks/:id/attachments` | Add an attachment to a task |
| `DELETE` | `/tasks/:id/attachments/:attachmentId` | Delete an attachment (uploader or task owner only) |

#### POST `/tasks/:id/attachments`
```json
{
  "filename": "wireframes-v2.pdf",
  "url": "https://storage.example.com/wireframes-v2.pdf"
}
```

---

## Data Models

### User
| Field | Type | Notes |
|---|---|---|
| `name` | String | Required |
| `email` | String | Required, unique, lowercase |
| `password` | String | Hashed with bcryptjs |
| `role` | String | `user` or `admin` (default: `user`) |

### Task
| Field | Type | Notes |
|---|---|---|
| `title` | String | Required |
| `description` | String | Optional |
| `dueDate` | Date | Accepts DD/MM/YYYY or YYYY-MM-DD |
| `priority` | String | `low`, `medium`, `high` |
| `completed` | Boolean | Default: `false` |
| `tags` | [String] | Array of tag strings |
| `createdBy` | ObjectId | Ref: User |
| `project` | ObjectId | Ref: Project (optional) |
| `assignedTo` | ObjectId | Ref: User (optional) |
| `comments` | [Comment] | Embedded subdocuments |
| `attachments` | [Attachment] | Embedded subdocuments |

### Team
| Field | Type | Notes |
|---|---|---|
| `name` | String | Required |
| `description` | String | Optional |
| `createdBy` | ObjectId | Ref: User |
| `members` | [{ user, role }] | Embedded — roles: `owner`, `admin`, `member` |

### Project
| Field | Type | Notes |
|---|---|---|
| `name` | String | Required |
| `description` | String | Optional |
| `team` | ObjectId | Ref: Team |
| `createdBy` | ObjectId | Ref: User |

---

## Error Handling

The API returns structured JSON error responses with appropriate HTTP status codes:

| Status | Meaning |
|---|---|
| `200` | Success |
| `201` | Resource created |
| `400` | Bad request / validation error |
| `401` | Unauthorized (missing or invalid JWT) |
| `403` | Forbidden (insufficient permissions) |
| `404` | Resource not found |
| `409` | Conflict (e.g., duplicate email or already a member) |
| `500` | Internal server error |

**Error response format:**
```json
{
  "error": "Human-readable error message.",
  "details": "Optional extra details (e.g. validation message)"
}
```

---

## Testing

The project uses **tap** and **supertest** for automated integration tests against a real MongoDB Atlas database.

```bash
npm test
```

Current test coverage: **78 tests** covering:
- User registration & login
- All 5 task CRUD operations
- Task filtering, searching, sorting
- Comments — add and delete
- Attachments — add and delete
- Team create, list, get, update, join, leave
- Project create, list, get, update, delete
- Project-linked task creation
- Auth guard (401 on all protected routes without token)

---

## Project Structure

```
├── app.js                        # Express app — routes, middleware, DB connection
├── .env                          # Environment variables (not committed)
│
├── models/
│   ├── userModel.js              # User schema (bcrypt hooks)
│   ├── tasksModel.js             # Task schema (comments, attachments embedded)
│   ├── teamModel.js              # Team schema (members with roles)
│   └── projectModel.js           # Project schema (linked to team)
│
├── controllers/
│   ├── userController.js         # register, login, getProfile, updateProfile
│   ├── tasksController.js        # CRUD + addComment, deleteComment, addAttachment, deleteAttachment
│   ├── teamController.js         # createTeam, getMyTeams, getTeamById, updateTeam, joinTeam, leaveTeam, removeMember, updateMemberRole
│   └── projectController.js      # createProject, getProjectsByTeam, getProjectById, updateProject, deleteProject
│
├── routes/
│   ├── userRoutes.js             # /users/*
│   ├── tasksRoutes.js            # /tasks/* + /tasks/:id/comments/* + /tasks/:id/attachments/*
│   ├── teamRoutes.js             # /teams/*
│   └── projectRoutes.js          # /teams/:teamId/projects/* + /projects/*
│
├── middleware/
│   ├── authMiddleware.js         # JWT verification — attaches req.user
│   └── loggerMiddleware.js       # Request logger
│
└── test/
    └── server.test.js            # 78 integration tests (tap + supertest)
```

# Rezorpay  Payment Geteway Inegration

---

## License

ISC