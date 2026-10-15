export function DataSection() {
  return (
    <>
      <h2 id="data">Data &amp; Privacy</h2>
        <p>All DarkNotes data is stored <strong>locally on your machine</strong>:</p>
        <ul>
          <li><strong>Browser</strong>: <code>localStorage</code> keeps a cached copy so the app can work offline (<code>darknotes:v3:*</code>), your saved colours (<code>darknotes:v1:palette</code>) and the minimap's size and mode (<code>darknotes:v1:minimap</code>).</li>
          <li><strong>MCP server</strong>: <code>~/.darknotes/data.json</code> — plain, human-readable JSON. Back it up, version-control it, or copy it between machines freely.</li>
        </ul>
        <p>No data is sent to any cloud service. The server listens on <code>127.0.0.1</code> by default and talks to Claude via stdio or HTTP on your own machine (see Configuration &amp; Security before exposing it further).</p>

        <h3>How the data file is protected</h3>
        <ul>
          <li><strong>Atomic writes</strong> — each save goes to a temporary file that is then renamed into place, so a crash cannot leave a half-written file.</li>
          <li><strong>Automatic backup</strong> — the previous version is kept as <code>data.json.bak</code>.</li>
          <li><strong>No silent reset</strong> — if <code>data.json</code> is not valid JSON, the server reports an error, leaves the file untouched and saves a copy as <code>data.json.corrupt-&lt;timestamp&gt;</code>. Fix or restore the file (the <code>.bak</code> is a good start) and retry.</li>
          <li><strong>Ids are never reused</strong> — id counters are repaired on load if they are missing or behind the existing notes.</li>
        </ul>

        <div className="callout tip"><strong>Backup tip:</strong> Copy <code>~/.darknotes/data.json</code> to back up all your workspaces, or export individual workspaces from the toolbar for sharing.</div>
    </>
  );
}
