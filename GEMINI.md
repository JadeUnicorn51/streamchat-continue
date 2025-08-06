
# GEMINI.md - streamchat-continue

## Project Overview

This is a full-stack web application that implements a streaming chat system with session recovery. The backend is built with Python and FastAPI, utilizing Server-Sent Events (SSE) for real-time communication. The frontend is a React application written in TypeScript.

The application supports creating multiple chat sessions, streaming responses from an AI (presumably OpenAI's GPT), and recovering a streaming session if the browser is refreshed or closed.

**Key Technologies:**

*   **Backend:**
    *   FastAPI
    *   SQLModel (for database interaction with MySQL)
    *   Redis (for caching and session state management)
    *   SSE (Server-Sent Events)
*   **Frontend:**
    *   React
    *   TypeScript
    *   Vite
    *   Axios

## Building and Running

### Backend

1.  **Install dependencies:**
    ```bash
    cd backend
    pip install -r requirements.txt
    ```

2.  **Configure environment:**
    *   Copy `.env.example` to `.env`.
    *   Fill in your `OPENAI_API_KEY`, `DATABASE_URL`, and `REDIS_URL`.

3.  **Run the server:**
    ```bash
    cd backend
    python main.py
    ```

### Frontend

1.  **Install dependencies:**
    ```bash
    cd frontend
    npm install
    ```

2.  **Run the development server:**
    ```bash
    cd frontend
    npm run dev
    ```

## Development Conventions

*   **Backend:**
    *   The code is structured into `routes`, `services`, and `models`.
    *   `database.py` handles database initialization.
    *   `chat_service.py` contains the core logic for handling chat streams, including the session recovery mechanism.
*   **Frontend:**
    *   The code uses React hooks extensively.
    *   `useSSE.ts` provides a custom hook for handling Server-Sent Events.
    *   `useSessionRecovery.ts` implements the logic for recovering chat sessions.
    *   API calls are centralized in `api.ts`.
    *   Types are defined in `types.ts`.
