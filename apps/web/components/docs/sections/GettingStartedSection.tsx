export function GettingStartedSection() {
  return (
    <>
      <h2 id="overview">Overview</h2>
      <p>
        DarkNotes is a canvas-based notes app that runs in your browser and saves to a small server on your own computer. Notes live on a freeform
        board: you can position, resize, style, connect and group them freely. Everything is stored in <code>~/.darknotes/data.json</code>, and
        Claude and other AI tools can read and change your notes through MCP while you work.
      </p>

      <div className="feature-grid">
        <div className="feature-card">
          <h4>
            <span className="icon">📝</span> Rich note editing
          </h4>
          <p>Mixed text and checklist lines, labels, word wrap, and a heading for every note.</p>
        </div>
        <div className="feature-card">
          <h4>
            <span className="icon">🎨</span> Style panel
          </h4>
          <p>Note and text colours, your own saved colours, a contrast check, text size and heading fonts.</p>
        </div>
        <div className="feature-card">
          <h4>
            <span className="icon">🗂️</span> Workspaces
          </h4>
          <p>Unlimited named workspaces, each with its own independent canvas and notes.</p>
        </div>
        <div className="feature-card">
          <h4>
            <span className="icon">🔗</span> Visual connections
          </h4>
          <p>Draw curved lines, with optional arrowheads, between notes to show relationships.</p>
        </div>
        <div className="feature-card">
          <h4>
            <span className="icon">📦</span> Groups
          </h4>
          <p>Cluster related notes inside named, resizable, collapsible group containers.</p>
        </div>
        <div className="feature-card">
          <h4>
            <span className="icon">🗺️</span> Minimap
          </h4>
          <p>An overview of the whole board you can click, drag, resize and shrink to a thumbnail.</p>
        </div>
        <div className="feature-card">
          <h4>
            <span className="icon">📤</span> Import &amp; export
          </h4>
          <p>Save a workspace as a file and bring it back as a new workspace, on this or another machine.</p>
        </div>
        <div className="feature-card">
          <h4>
            <span className="icon">🤖</span> MCP server
          </h4>
          <p>Full access to your notes from Claude and any MCP-compatible AI client, safe to use while you edit.</p>
        </div>
      </div>

      <h2 id="interface">Interface</h2>
      <p>The app has three main areas:</p>
      <ul>
        <li>
          <strong>Toolbar</strong> — the top bar. From the left: the <strong>workspace switcher</strong> (with the number of notes), the{' '}
          <strong>save status</strong>, then <strong>export</strong> and <strong>import</strong> buttons, the <strong>zoom</strong> controls,{' '}
          <strong>+ New Group</strong> and <strong>+ New Note</strong>.
        </li>
        <li>
          <strong>Canvas</strong> — the 4000 × 3000 board where notes, groups and connections live.
        </li>
        <li>
          <strong>Minimap</strong> — an overview panel in the bottom-right corner.
        </li>
      </ul>
      <p>
        The save status shows whether your edits have reached the server: <strong>Saved</strong>, <strong>Unsaved changes</strong> (a moment after you
        stop typing it saves), <strong>Saving…</strong> or <strong>Not saved</strong> (it will keep retrying). If the server cannot be reached when the
        app opens, a banner says it is showing your last saved copy. See <a href="#sync">Saving &amp; Syncing</a>.
      </p>
    </>
  );
}
