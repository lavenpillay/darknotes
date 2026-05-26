# DarkNotes MCP Server

Connecting the DarkNotes note-taking application to MCP-compatible AI clients (like Claude) and providing a local REST API for data synchronization.

## Project Overview

DarkNotes is a visual note-taking application. This repository contains the backend server which acts as both an **MCP (Model Context Protocol) server** and a **REST API server**.

- **MCP Server:** Allows AI clients to interact with your notes. Supports both **Stdio** (local) and **Streamable HTTP** transport.
- **REST API:** Used by the DarkNotes browser application to persist data locally.
- **Data Persistence:** All data is stored in a human-readable JSON file at `~/.darknotes/data.json`.

### Main Technologies
- **Runtime:** Node.js (ES Modules)
- **Framework:** Express (REST API + MCP HTTP)
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
- **Combined Mode:** Runs the API/SSE server AND a separate Stdio MCP server.
  ```bash
  node server.js --both
  ```

### MCP Transport Options
- **Stdio:** Default when running `node server.js`. Best for local IDE integrations.
- **Streamable HTTP:** Enabled in `--api` or `--both` modes. Accessible at `http://localhost:3737/mcp`. Best for Docker or remote clients.

### Running with Docker

A lightweight `Dockerfile` is provided to run the DarkNotes server in a container.

#### 1. Build the image
```bash
docker build -t darknotes-server .
```

#### 2. Run the container
To persist your notes, mount a local directory to `/root/.darknotes` in the container.

```bash
docker run -d \
  -p 3737:3737 \
  -v ~/.darknotes:/root/.darknotes \
  --name darknotes \
  darknotes-server
```

The application will be available at `http://localhost:3737`.

## Development Conventions

- **Module System:** Uses standard ES Modules (`import`/`export`).
- **MCP Tools:** New tools should be defined in `TOOLS` and handled in `handleTool` within `tools.js`.
- **API Endpoints:** REST API logic belongs in `api.js`.
- **Data Integrity:** Always use `readData()` and `writeData(data)` from `store.js` to interact with the data file.
- **ID Generation:** Use the counters in the data structure (e.g., `ws.nextNoteId`) to generate new IDs with appropriate prefixes (`ws_`, `n_`, `g_`, `c_`).
- **Error Handling:** In MCP tools, throw descriptive errors which are caught and reported back to the client in `server.js`.
