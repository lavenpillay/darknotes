# DarkNotes MCP Server Agent Instructions

This document provides essential information for AI agents working on the DarkNotes MCP server repository.

## 1. Project Overview

This is a Node.js server for the DarkNotes note-taking application. It serves two primary functions:
- A **REST API** for the browser-based client.
- An **MCP (Model Context Protocol) server** for AI clients like Claude.

All data is stored in a single JSON file: `~/.darknotes/data.json`.

## 2. Architecture

The codebase is structured as follows:

- `server.js`: The main entry point. It parses command-line arguments to start the appropriate services (API, MCP, or both).
- `api.js`: Defines the Express router and all REST API endpoints.
- `tools.js`: Implements the logic for all MCP tools.
- `store.js`: The data access layer. It handles all read/write operations to the `data.json` file.
- `*.html`: Frontend application files.

## 3. Development Workflow

### Installation

To install dependencies, run:
```bash
npm install
```

### Running the Server

The server has several modes, controlled by command-line flags:

- **MCP Mode (default, for AI clients):**
  ```bash
  node server.js
  ```
- **API Mode (for the browser app):**
  ```bash
  node server.js --api
  ```
- **Combined Mode (runs both):**
  ```bash
  node server.js --both
  ```
- **Development Mode (restarts on file changes):**
  ```bash
  npm run dev
  ```

### Docker

A `Dockerfile` is provided for containerized execution.

- **Build the image:**
  ```bash
  docker build -t darknotes .
  ```
- **Run the container (persisting data):**
  ```bash
  docker run -d -p 3737:3737 -v ~/.darknotes:/root/.darknotes --name darknotes darknotes-server
  ```

## 4. Key Conventions

- **Module System:** The project uses ES Modules (`import`/`export`).
- **Data Access:** All interactions with the data file **must** go through the `readData()` and `writeData()` functions in `store.js`.
- **ID Generation:** New IDs for notes, groups, etc., should be generated using the counters in the data structure (e.g., `ws.nextNoteId`) with the correct prefix (`n_`, `g_`, etc.).
- **New Features:**
  - New MCP tools should be added to `tools.js`.
  - New REST API endpoints should be added to `api.js`.
