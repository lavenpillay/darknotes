# DarkNotes MCP Server

Connecting the DarkNotes note-taking application to MCP-compatible AI clients (like Claude) and providing a local REST API for data synchronization.

## Project Overview

DarkNotes is a visual note-taking application. This repository contains the backend server which acts as both an **MCP (Model Context Protocol) server** and a **REST API server**.

- **MCP Server:** Allows AI clients to interact with your notes through tools (list, create, update, delete notes, workspaces, groups, and connections).
- **REST API:** Used by the DarkNotes browser application to persist data locally instead of using `localStorage`.
- **Data Persistence:** All data is stored in a human-readable JSON file at `~/.darknotes/data.json`.

### Main Technologies
- **Runtime:** Node.js (ES Modules)
- **Framework:** Express (REST API)
- **MCP:** `@modelcontextprotocol/sdk`
- **Storage:** Local filesystem (JSON)

## Architecture

- `server.js`: The main entry point. It parses command-line arguments to determine which services to start (MCP, API, or both).
- `api.js`: Defines the Express router and endpoints for the REST API.
- `tools.js`: Contains the definitions and implementation logic for the MCP tools.
- `store.js`: The data access layer. Handles reading, writing, and normalizing the JSON data file.
- `*.html`: The frontend browser application files (e.g., `darknotes-app.html`, `notes-app.html`).

## Building and Running

### Prerequisites
- Node.js installed.

### Installation
```bash
npm install
```

### Running the Server
The server supports different modes via command-line flags:

- **MCP Mode (default):** Used by Claude Desktop/Code.
  ```bash
  node server.js
  ```
- **API Mode:** Runs the REST API and serves the web app at `http://localhost:3737`.
  ```bash
  node server.js --api
  ```
- **Combined Mode:** Runs both MCP and API services simultaneously.
  ```bash
  node server.js --both
  ```

### Configuration
- **Port:** The API server defaults to port `3737`. You can override this with the `DARKNOTES_PORT` environment variable.
- **Data Path:** Data is stored in `~/.darknotes/data.json`.

## Development Conventions

- **Module System:** Uses standard ES Modules (`import`/`export`).
- **MCP Tools:** New tools should be defined in `TOOLS` and handled in `handleTool` within `tools.js`.
- **API Endpoints:** REST API logic belongs in `api.js`.
- **Data Integrity:** Always use `readData()` and `writeData(data)` from `store.js` to interact with the data file.
- **ID Generation:** Use the counters in the data structure (e.g., `ws.nextNoteId`) to generate new IDs with appropriate prefixes (`ws_`, `n_`, `g_`, `c_`).
- **Error Handling:** In MCP tools, throw descriptive errors which are caught and reported back to the client in `server.js`.
