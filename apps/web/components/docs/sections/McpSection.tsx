export function McpSection() {
  return (
    <>
      <h2 id="mcp-overview">MCP Integration — Overview</h2>
        <p>The DarkNotes MCP server exposes your notes to <strong>Claude</strong> and any <a href="https://modelcontextprotocol.io">Model Context Protocol</a>-compatible AI client. You can ask Claude to read notes, create new ones, check off tasks, reorganise workspaces, and more — without opening the browser.</p>

        <p>The server can be run directly with Node.js or as a <strong>Docker container</strong>. It offers two ways to connect:</p>
        <ul>
          <li><strong>MCP over stdio</strong> (the default mode) — Claude Desktop and Claude Code launch the server and talk to it directly.</li>
          <li><strong>HTTP server</strong> (API mode, port 3737) — serves the REST API at <code>/api</code> that the web app uses, and the MCP <strong>Streamable HTTP</strong> endpoint at <code>/mcp</code> for remote or local MCP clients.</li>
        </ul>

        <div className="callout"><strong>Note:</strong> All data is stored in <code>~/.darknotes/data.json</code>. You can keep the web app open while Claude edits your notes; see <a href="#sync">Saving &amp; Syncing</a>.</div>

  
        <h2 id="mcp-setup">Setup</h2>

        <div className="steps">
          <div className="step">
            <div className="step-num">1</div>
            <div className="step-body">
              <h4>Option A: Run with Docker (Recommended)</h4>
              <pre>{`# Build the image
docker build -t darknotes .

# Run the container (persisting your notes).
# Publish the port on loopback only: the container binds all interfaces.
docker run -d \\
  -p 127.0.0.1:3737:3737 \\
  -v ~/.darknotes:/root/.darknotes \\
  --name darknotes \\
  darknotes`}</pre>
              <p className="text-muted mt-sm">The image contains the compiled server and the web app, so one container gives you everything on port 3737: open <code>http://localhost:3737</code> for the app (the API is at <code>/api</code> and MCP at <code>/mcp</code>). If the port is reachable by anyone else, also pass <code>-e DARKNOTES_TOKEN=…</code> (see Configuration &amp; Security).</p>
            </div>
          </div>
          <div className="step">
            <div className="step-num">2</div>
            <div className="step-body">
              <h4>Option B: Run with Node.js</h4>
              <pre>{`npm install

npm run build            # compile the server and build the web app (once, and after updates)
npm start                # everything on http://localhost:3737: the web app, /api and /mcp

# for development, with hot reload (the web app on :3000, the server on :3737)
npm run dev:all`}</pre>
              <p className="text-muted mt-sm">Requires Node.js 22 or newer. After <code>npm start</code>, open <code>http://localhost:3737</code>. The server also runs without the web app: <code>npm run serve</code> (API and MCP only, from source), <code>npm run mcp</code> (MCP over stdio only) and <code>npm run serve:mcp-http</code> (the server plus an MCP stdio server in one process, which does not start the web app).</p>
            </div>
          </div>
          <div className="step">
            <div className="step-num">3</div>
            <div className="step-body">
              <h4>Connect an MCP Client over HTTP</h4>
              <p>Start API mode (Docker or <code>npm run serve</code>), then connect to the <strong>Streamable HTTP</strong> endpoint. Clients that send no browser <code>Origin</code> header (MCP clients, <code>curl</code>) work out of the box on localhost.</p>
              <ul>
                <li><strong>Endpoint:</strong> <code>http://localhost:3737/mcp</code></li>
                <li><strong>Sessions:</strong> the first request is <code>initialize</code>; later requests carry the returned <code>mcp-session-id</code> header. <code>DELETE /mcp</code> with that header ends the session; idle sessions expire after 30 minutes.</li>
                <li><strong>Auth:</strong> none by default. If <code>DARKNOTES_TOKEN</code> is set, send <code>Authorization: Bearer &lt;token&gt;</code>.</li>
              </ul>
              <pre>{`claude mcp add --transport http darknotes http://localhost:3737/mcp`}</pre>
            </div>
          </div>
          <div className="step">
            <div className="step-num">4</div>
            <div className="step-body">
              <h4>Configure Claude Desktop (Stdio)</h4>
              <p>Run <code>npm run build</code> once, then add to <code>claude_desktop_config.json</code>:</p>
              <pre>{`{
  "mcpServers": {
    "darknotes": {
      "command": "node",
      "args": ["/absolute/path/to/darknotes/apps/server/dist/index.js"]
    }
  }
}`}</pre>
              <p className="text-muted mt-sm">
                Config location — macOS: <code>~/Library/Application Support/Claude/claude_desktop_config.json</code><br />
                Windows: <code>%APPDATA%\Claude\claude_desktop_config.json</code>
              </p>
            </div>
          </div>
          <div className="step">
            <div className="step-num">5</div>
            <div className="step-body">
              <h4>Configure Claude Code (Stdio)</h4>
              <pre>{`claude mcp add darknotes -- node /absolute/path/to/darknotes/apps/server/dist/index.js`}</pre>
            </div>
          </div>
        </div>

  
        <h2 id="configuration">Configuration &amp; Security</h2>
        <p>The server is configured with environment variables.</p>
        <table className="tool-table"><tbody>
          <tr><th>Variable</th><th>Default</th><th>Purpose</th></tr>
          <tr><td className="tool-name">DARKNOTES_PORT</td><td><code>3737</code></td><td>HTTP port.</td></tr>
          <tr><td className="tool-name">DARKNOTES_HOST</td><td><code>127.0.0.1</code></td><td>Interface to bind. Loopback only by default; containers use <code>0.0.0.0</code>.</td></tr>
          <tr><td className="tool-name">DARKNOTES_TOKEN</td><td>none</td><td>If set, <code>/api</code> and <code>/mcp</code> require <code>Authorization: Bearer &lt;token&gt;</code>.</td></tr>
          <tr><td className="tool-name">DARKNOTES_ALLOWED_HOSTS</td><td>none</td><td>Extra hostnames accepted in the <code>Host</code> header, comma-separated (<code>*</code> disables the check).</td></tr>
          <tr><td className="tool-name">DARKNOTES_ALLOWED_ORIGINS</td><td>none</td><td>Extra browser origins accepted, comma-separated, e.g. <code>https://notes.example.com</code>.</td></tr>
          <tr><td className="tool-name">DARKNOTES_WEB_DIR</td><td>the build in the repository (<code>apps/web/out</code>)</td><td>Directory of the built web app that the server serves at <code>/</code>.</td></tr>
          <tr><td className="tool-name">DARKNOTES_DATA_DIR</td><td><code>~/.darknotes</code></td><td>Directory that holds <code>data.json</code>.</td></tr>
        </tbody></table>

        <h3>What the server protects against</h3>
        <ul>
          <li><strong>Network access</strong> — it listens on <code>127.0.0.1</code> by default, so only your own machine can reach it.</li>
          <li><strong>DNS rebinding</strong> — requests whose <code>Host</code> is not <code>localhost</code>, <code>127.0.0.1</code> or <code>[::1]</code> are rejected with 403.</li>
          <li><strong>Other websites</strong> — requests carrying a foreign browser <code>Origin</code> are rejected with 403, so a web page you visit cannot read or edit your notes.</li>
        </ul>

        <div className="callout"><strong>Exposing the server:</strong> if you publish the port beyond your machine (a LAN, a reverse proxy, a container port mapped without <code>127.0.0.1</code>), set <code>DARKNOTES_TOKEN</code> and add your hostname to <code>DARKNOTES_ALLOWED_HOSTS</code>. The browser app cannot send a token, so a token-protected server is for MCP and API clients.</div>

  
        <h2 id="mcp-tools">MCP Tools Reference</h2>
        <p>All tools operate on <code>~/.darknotes/data.json</code>. The <code>workspaceId</code> parameter defaults to the current workspace when omitted. Invalid input (a missing required argument, a wrong type, an unknown note, group or workspace) comes back as a tool error that names the problem.</p>

        <h3>Workspace tools</h3>
        <table className="tool-table"><tbody>
          <tr><th>Tool</th><th>Description</th><th>Key parameters</th></tr>
          <tr><td className="tool-name">list_workspaces</td><td>List all workspaces with note and group counts.</td><td>—</td></tr>
          <tr><td className="tool-name">create_workspace</td><td>Create a new workspace.</td><td><code>name</code></td></tr>
          <tr><td className="tool-name">rename_workspace</td><td>Rename an existing workspace.</td><td><code>workspaceId</code>, <code>name</code></td></tr>
          <tr><td className="tool-name">delete_workspace</td><td>Delete a workspace and all its contents. The last workspace cannot be deleted.</td><td><code>workspaceId</code></td></tr>
        </tbody></table>

        <h3>Note tools</h3>
        <table className="tool-table"><tbody>
          <tr><th>Tool</th><th>Description</th><th>Key parameters</th></tr>
          <tr><td className="tool-name">list_notes</td><td>List notes with optional filters.</td><td><code>search</code>, <code>label</code>, <code>groupId</code></td></tr>
          <tr><td className="tool-name">get_note</td><td>Get full note content including all lines.</td><td><code>noteId</code></td></tr>
          <tr><td className="tool-name">create_note</td><td>Create a note. Body can be plain text or a <code>lines</code> array. Place and size it with <code>x</code>, <code>y</code>, <code>w</code>, <code>h</code>. The heading font defaults to <code>MesloLG</code> (a sans-serif).</td><td><code>heading</code>, <code>body</code> or <code>lines</code>, <code>labels</code>, <code>bgColor</code>, <code>fontColor</code>, <code>fontSize</code>, <code>headingFont</code>, <code>headingSize</code>, <code>groupId</code>, <code>x</code>, <code>y</code>, <code>w</code>, <code>h</code></td></tr>
          <tr><td className="tool-name">update_note</td><td>Update any note field, including position, size and fonts. Only supplied fields change; <code>groupId: null</code> ungroups.</td><td><code>noteId</code>, any note field</td></tr>
          <tr><td className="tool-name">delete_note</td><td>Delete a note and its connections.</td><td><code>noteId</code></td></tr>
          <tr><td className="tool-name">append_to_note</td><td>Append lines without replacing existing content.</td><td><code>noteId</code>, <code>body</code> or <code>lines</code></td></tr>
          <tr><td className="tool-name">add_label</td><td>Add a label tag to a note.</td><td><code>noteId</code>, <code>label</code></td></tr>
          <tr><td className="tool-name">remove_label</td><td>Remove a label from a note.</td><td><code>noteId</code>, <code>label</code></td></tr>
          <tr><td className="tool-name">check_item</td><td>Check or uncheck a checklist item by line index.</td><td><code>noteId</code>, <code>lineIndex</code>, <code>checked</code></td></tr>
        </tbody></table>

        <h3>Group tools</h3>
        <table className="tool-table"><tbody>
          <tr><th>Tool</th><th>Description</th><th>Key parameters</th></tr>
          <tr><td className="tool-name">list_groups</td><td>List all groups with their note counts.</td><td>—</td></tr>
          <tr><td className="tool-name">create_group</td><td>Create a new group.</td><td><code>name</code>, <code>color</code>, <code>x</code>, <code>y</code>, <code>w</code>, <code>h</code></td></tr>
          <tr><td className="tool-name">delete_group</td><td>Delete a group (notes are ungrouped, not deleted).</td><td><code>groupId</code></td></tr>
          <tr><td className="tool-name">add_note_to_group</td><td>Move a note into a group.</td><td><code>noteId</code>, <code>groupId</code></td></tr>
          <tr><td className="tool-name">remove_note_from_group</td><td>Ungroup a note.</td><td><code>noteId</code></td></tr>
        </tbody></table>

        <h3>Connection tools</h3>
        <table className="tool-table"><tbody>
          <tr><th>Tool</th><th>Description</th><th>Key parameters</th></tr>
          <tr><td className="tool-name">list_connections</td><td>List all connections with note headings resolved.</td><td>—</td></tr>
          <tr><td className="tool-name">create_connection</td><td>Draw a connection between two existing notes. <code>fromSide</code> / <code>toSide</code> are <code>top</code>, <code>right</code>, <code>bottom</code> or <code>left</code>. Optional <code>arrows</code>: <code>none</code>, <code>start</code>, <code>end</code> or <code>both</code>.</td><td><code>fromNote</code>, <code>fromSide</code>, <code>toNote</code>, <code>toSide</code>, <code>arrows</code></td></tr>
          <tr><td className="tool-name">delete_connection</td><td>Remove a connection line.</td><td><code>connectionId</code></td></tr>
        </tbody></table>

        <h3>Search</h3>
        <table className="tool-table"><tbody>
          <tr><th>Tool</th><th>Description</th><th>Key parameters</th></tr>
          <tr><td className="tool-name">search</td><td>Full-text search across all workspaces (heading, body, labels).</td><td><code>query</code></td></tr>
        </tbody></table>

  
        <h2 id="rest-api">REST API Reference</h2>
        <p>Base URL: <code>http://localhost:3737/api</code></p>
        <p>Errors are JSON, <code>{'{'} "error": "message" {'}'}</code>, with status <strong>400</strong> (invalid input, or a rule such as deleting the last workspace), <strong>404</strong> (not found) or <strong>500</strong>. When <code>DARKNOTES_TOKEN</code> is set, requests need an <code>Authorization: Bearer</code> header.</p>

        <h3>Workspaces</h3>
        <table className="api-table"><tbody>
          <tr><th>Method</th><th>Endpoint</th><th>Description</th></tr>
          <tr><td><span className="method get">GET</span></td><td className="endpoint">/workspaces</td><td>List all workspaces</td></tr>
          <tr><td><span className="method post">POST</span></td><td className="endpoint">/workspaces</td><td>Create workspace <code>{'{'} name {'}'}</code></td></tr>
          <tr><td><span className="method post">POST</span></td><td className="endpoint">/workspaces/import</td><td>Create a <strong>new</strong> workspace from an export file's JSON; returns <code>{'{'} workspace, imported, skipped {'}'}</code></td></tr>
          <tr><td><span className="method get">GET</span></td><td className="endpoint">/workspaces/:wsId</td><td>Get full workspace</td></tr>
          <tr><td><span className="method get">GET</span></td><td className="endpoint">/workspaces/:wsId/export</td><td>Download the workspace as an export file (<code>Content-Disposition: attachment</code>)</td></tr>
          <tr><td><span className="method patch">PATCH</span></td><td className="endpoint">/workspaces/:wsId</td><td>Update workspace fields</td></tr>
          <tr><td><span className="method delete">DELETE</span></td><td className="endpoint">/workspaces/:wsId</td><td>Delete workspace</td></tr>
          <tr><td><span className="method post">POST</span></td><td className="endpoint">/workspaces/:wsId/changes</td><td>Apply incremental edits <code>{'{'} "changes": [ … ] {'}'}</code> (create, patch or delete notes, groups and connections; set the view). Safe alongside other writers; returns the resulting workspace</td></tr>
          <tr><td><span className="method put">PUT</span></td><td className="endpoint">/workspaces/:wsId/board</td><td>Replace the whole board. Kept for older clients: it overwrites anything added elsewhere in the meantime, so prefer <code>/changes</code></td></tr>
          <tr><td><span className="method post">POST</span></td><td className="endpoint">/workspaces/:wsId/activate</td><td>Set as current workspace</td></tr>
        </tbody></table>

        <h3>Notes</h3>
        <table className="api-table"><tbody>
          <tr><th>Method</th><th>Endpoint</th><th>Description</th></tr>
          <tr><td><span className="method get">GET</span></td><td className="endpoint">/workspaces/:wsId/notes</td><td>List notes. Query: <code>?search=</code> <code>&amp;label=</code> <code>&amp;groupId=</code></td></tr>
          <tr><td><span className="method post">POST</span></td><td className="endpoint">/workspaces/:wsId/notes</td><td>Create note</td></tr>
          <tr><td><span className="method get">GET</span></td><td className="endpoint">/workspaces/:wsId/notes/:noteId</td><td>Get note</td></tr>
          <tr><td><span className="method patch">PATCH</span></td><td className="endpoint">/workspaces/:wsId/notes/:noteId</td><td>Update note fields</td></tr>
          <tr><td><span className="method delete">DELETE</span></td><td className="endpoint">/workspaces/:wsId/notes/:noteId</td><td>Delete note</td></tr>
        </tbody></table>

        <h3>Groups &amp; Connections</h3>
        <table className="api-table"><tbody>
          <tr><th>Method</th><th>Endpoint</th><th>Description</th></tr>
          <tr><td><span className="method get">GET</span></td><td className="endpoint">/workspaces/:wsId/groups</td><td>List groups</td></tr>
          <tr><td><span className="method post">POST</span></td><td className="endpoint">/workspaces/:wsId/groups</td><td>Create group</td></tr>
          <tr><td><span className="method patch">PATCH</span></td><td className="endpoint">/workspaces/:wsId/groups/:groupId</td><td>Update group</td></tr>
          <tr><td><span className="method delete">DELETE</span></td><td className="endpoint">/workspaces/:wsId/groups/:groupId</td><td>Delete group</td></tr>
          <tr><td><span className="method get">GET</span></td><td className="endpoint">/workspaces/:wsId/connections</td><td>List connections</td></tr>
          <tr><td><span className="method post">POST</span></td><td className="endpoint">/workspaces/:wsId/connections</td><td>Create connection <code>{'{'} fromNote, fromSide, toNote, toSide, arrows? {'}'}</code>; both notes must exist</td></tr>
          <tr><td><span className="method delete">DELETE</span></td><td className="endpoint">/workspaces/:wsId/connections/:connId</td><td>Delete connection</td></tr>
        </tbody></table>

        <h3>Utilities</h3>
        <table className="api-table"><tbody>
          <tr><th>Method</th><th>Endpoint</th><th>Description</th></tr>
          <tr><td><span className="method get">GET</span></td><td className="endpoint">/search?q=query</td><td>Search notes across all workspaces</td></tr>
          <tr><td><span className="method get">GET</span></td><td className="endpoint">/health</td><td>Health check — returns <code>{'{'} ok: true {'}'}</code> (outside <code>/api</code>)</td></tr>
          <tr><td><span className="method get">GET</span></td><td className="endpoint">/documentation</td><td>Serve this documentation page</td></tr>
          <tr><td><span className="method post">POST</span></td><td className="endpoint">/mcp</td><td>MCP Streamable HTTP entry point (<code>initialize</code> starts a session)</td></tr>
          <tr><td><span className="method delete">DELETE</span></td><td className="endpoint">/mcp</td><td>End an MCP session (send <code>mcp-session-id</code>)</td></tr>
        </tbody></table>

  
        <h2 id="mcp-examples">Usage Examples with Claude</h2>
        <p>Once the MCP server is configured, you can talk to Claude naturally:</p>

        <h3>Reading notes</h3>
        <pre>{`"Show me all my notes in the Work workspace"
"Search my notes for anything about the Q3 report"
"List all notes tagged #urgent"
"What are the incomplete items in my Shopping checklist note?"`}</pre>

        <h3>Creating content</h3>
        <pre>{`"Create a note called 'Meeting Notes' with today's agenda items as a checklist"
"Add a new workspace called 'Side Project' and create three notes for tasks, ideas, and research"
"Append action items from our conversation to my 'Project Tracker' note"`}</pre>

        <h3>Organising</h3>
        <pre>{`"Create a group called 'In Progress' and move all notes tagged #active into it"
"Connect the 'Requirements' note to the 'Design' note on the left side"
"Check off the first two items in my grocery list note"
"Move all notes mentioning 'marketing' to a new workspace"`}</pre>
    </>
  );
}
