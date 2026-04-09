## 🚀 Key Features

*   **👤 User Management**: CRUD operations with role-based attributes (`admin`, `editor`, `viewer`).

*   **📝 Article System**: Full lifecycle management with status tracking (`draft`, `published`, `archived`) and tag support.

*   **📂 Category Organization**: Logical grouping of articles.

*   **💬 Comment Engine**: Interaction layer for every article.

*   **🔍 Advanced Filtering**: Filter articles by `status`, `categoryId`, or specific `tags`.

*   **🛡 Data Integrity**: Automated cascading logic on deletions (In-memory implementation).

*   **✅ Validation**: Strict DTO validation using `class-validator` and global `ValidationPipe`.

*   **📖 Documentation**: Auto-generated interactive OpenAPI (Swagger) documentation.


---

## 🛠 Tech Stack

| Component | Technology |
| :--- | :--- |
| **Framework** | [Nest.js](https://nestjs.com/) (Modular Architecture) |
| **Language** | TypeScript |
| **Documentation** | Swagger / OpenAPI 3.0 |
| **Validation** | class-validator & class-transformer |
| **Database** | PostgreSQL 16 (Dockerized) |
| **Containerization** | Docker & Docker Compose |
| **ORM** |   Prisma    |
| **Database**  | PostgreSQL 16 |


---

## 🐳 Docker Quick Start (Recommended)

The easiest way to run the application is using Docker.

**Docker Hub Image:** [https://hub.docker.com/r/hannamuzychuk/knowledge-hub-api](https://hub.docker.com/r/hannamuzychuk/knowledge-hub-api)

1. **Configure environment:**
   Create a `.env` file based on `.env.example`.

2. **Run the entire stack:**
   ```bash
   docker compose up --build

---
## Access the app:

API: http://localhost:4000

Swagger UI: http://localhost:4000/doc

Adminer (Database UI): 

Run with 

```
docker compose --profile debug up 
```



and access 

http://localhost:8080

---

## 📊 Database Schema (ERD)

The application uses **PostgreSQL** with the following relations:
*   **User ↔ Article**: One-to-Many (Author can have multiple articles).
*   **Category ↔ Article**: One-to-Many (Category contains multiple articles).
*   **Article ↔ Comment**: One-to-Many (Article has multiple comments).
*   **User ↔ Comment**: One-to-Many (User writes multiple comments).
*   **Article ↔ Tag**: Many-to-Many (Articles have multiple tags; tags belong to many articles).
---

## 💎 Prisma ORM Commands

If you need to manage the database manually:

*   **Generate Prisma Client:** `npx prisma generate`
*   **Run Migrations:** `npx prisma migrate dev`
*   **Open Prisma Studio (GUI):** `npx prisma studio`
*   **Seed Database:** `npx prisma db seed`
---

## 🛡️ Data Integrity & Cascading
- **User Deletion**: Articles are kept (`ON DELETE SET NULL`), while comments are removed (`ON DELETE CASCADE`).
- **Article Deletion**: All related comments are automatically removed (`ON DELETE CASCADE`).
- **Category Deletion**: Articles remain in the system but their category reference is cleared (`ON DELETE SET NULL`).
---

## 🌱 Database Seeding
To populate the database with initial data (users, categories, articles, and tags) for testing, run:
```
npx prisma db seed
```
---
## ⚙️ Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/hannamuzychuk/nodejs-2026q1-knowledge-hub.git](https://github.com/hannamuzychuk/nodejs-2026q1-knowledge-hub.git)
   cd nodejs-2026q1-knowledge-hub

2. **Install dependencies:**
    ```bash 
    npm install

3. **Configure environment:**

    Create a .env file in the root directory:

    PORT=4000

--- 

## 🏃 Running the Application

| Mode | Command | URL |
| :--- | :--- | :--- |
| **Development** | `npm run start` | [http://localhost:4000](http://localhost:4000) |
| **Watch Mode** | `npm run start:dev` | [http://localhost:4000](http://localhost:4000) |
| **Swagger UI** | — | [http://localhost:4000/doc](http://localhost:4000/doc) |

---
## 🛣️ API Endpoints Summary

### 👤 Users (`/user`)
*   **GET** `/user` – List all users (passwords excluded).
*   **GET** `/user/:id` – Get user details by UUID.
*   **POST** `/user` – Create a new user.
*   **PUT** `/user/:id` – Update user password (requires `oldPassword`).
*   **DELETE** `/user/:id` – Delete user.
    > **Cascade:** Nullifies author in articles and removes related comments.

### 📝 Articles (`/article`)
*   **GET** `/article` – List articles (Query params: `status`, `categoryId`, `tag`).
*   **POST** `/article` – Create a new article.
*   **DELETE** `/article/:id` – Delete article.
    > **Cascade:** Removes all related comments.

### 📂 Categories (`/category`)
*   **GET** `/category` – List all categories.
*   **POST** `/category` – Create a category.
*   **DELETE** `/category/:id` – Delete category.
    > **Cascade:** Nullifies category reference in related articles.

### 💬 Comments (`/comment`)
*   **GET** `/comment?articleId={id}` – Get comments for a specific article.
*   **POST** `/comment` – Add a new comment (validates `articleId` existence).
---

## 🧹 Quality & Testing
To maintain high code standards and verify requirements:

Bash
# Run Linter (ESLint)
npm run lint

Bash
# Run Automated Test Suite

npm run test

---
## 📜 Assignment Details
This project was developed as part of the Node.js 2026 Q1 course. It adheres to the requirements of modular architecture, dependency injection, and strict input validation.

Requirements met:
 - Modular separation of concerns (Users, Articles, Categories, Comments).

 - Persistent data management with **PostgreSQL** and **Prisma ORM**..

- DTO-based validation and auto-generated Swagger docs.

- Correct cascading behavior for entity deletion.
---

## 📂 Project Structure

```text

NODEJS-2026Q1-KNOWLEDGE-HUB
├── doc/                # API Documentation (api.yaml)
├── prisma 
|   ├──migtarions
|   ├──schema.prisma
|   ├──seed.ts
├── src/                 # Application source code
│   ├── article/         # Article module, controller, and service
│   ├── category/        # Category module, controller, and service
│   ├── comment/         # Comment module, controller, and service
│   ├── db/              # In-memory database logic
│   ├── prisma/          # Prisma ORM logic
│   ├── user/            # User module, controller, and service
│   ├── app.controller.ts
│   ├── app.module.ts
│   ├── app.service.ts
│   └── main.ts          # Application entry point
├── test/                # E2E and Unit tests   
├── .dockerignore        
├── .env.example         # Template for environment variables
├── .eslintrc.js         # Linter configuration
├── .gitignore
├── .docker-compose.yml   # Containerization configuration
├──  Dockerfile 
├── .prettierrc          # Formatter configuration
├── jest.config.json     # Test runner configuration
├── nest-cli.json        # Nest CLI configuration
├── package.json         # Dependencies and scripts
├── README.md            # Project documentation
├── tsconfig.build.json
└── tsconfig.json        # TypeScript configuration



