export function WorkspacesSection() {
  return (
    <>
      <h2 id="workspaces">Workspaces</h2>
      <p>
        Workspaces are completely independent boards. Each has its own notes, groups, connections, pan position and zoom level. The list of workspaces
        lives on the server, so a workspace created or renamed through MCP appears in the app, and the other way round.
      </p>

      <h3>The workspace switcher</h3>
      <p>
        The pill at the left of the toolbar shows the current workspace and how many notes it has. Click it to open a list of all workspaces with their
        note counts, and click one to switch. Pending edits are saved first, and the workspace you switch to becomes the one MCP tools use by default.
      </p>

      <h3>Creating workspaces</h3>
      <p>
        Type a name into <em>New workspace name…</em> at the bottom of the list and press <kbd>Enter</kbd> or click <strong>+</strong>. The new
        workspace starts empty and opens straight away.
      </p>

      <h3>Renaming workspaces</h3>
      <p>
        Hover a workspace in the list and click the pencil. Type the new name and press <kbd>Enter</kbd> to save, or <kbd>Esc</kbd> to cancel.
      </p>

      <h3>Deleting workspaces</h3>
      <p>
        Hover a workspace and click <strong>×</strong>, then click <strong>Delete?</strong> to confirm. The last remaining workspace cannot be deleted
        (it has no × button).
      </p>

      <h2 id="import-export">Import &amp; Export</h2>
      <p>
        Use the download button in the toolbar to <strong>export</strong> the current workspace, and the upload button to <strong>import</strong> one.
      </p>

      <h3>Exporting</h3>
      <p>
        Pending edits are saved first, then your browser downloads <code>darknotes-&lt;name&gt;-&lt;date&gt;.json</code>. The file is one flat JSON
        document holding everything on the board: note content, colours, fonts, positions, sizes and stacking order; groups and which notes belong to
        them; connections and their arrowheads; and the saved pan and zoom. It holds nothing else, so it is safe to share or keep as a backup.
      </p>

      <h3>Importing</h3>
      <p>
        Choose a file (or paste its contents) in the import dialog and click <strong>Import</strong>. The file always becomes a{' '}
        <strong>new workspace</strong>, named after the file or &ldquo;Imported workspace&rdquo;, and the app switches to it. Your existing workspaces are
        never changed or overwritten.
      </p>
      <ul>
        <li>
          Every note, group and connection gets a fresh id, and the links between them (group membership, connection ends) are rewritten to match. An
          import can never collide with what you already have.
        </li>
        <li>
          Besides this app&rsquo;s own files it accepts older exports (notes without ids, lists or id-keyed objects, numeric ids) and a plain list of
          notes.
        </li>
        <li>
          A file with a bad value, for example a note position that is not a number, is rejected whole with a message naming the entry, and nothing is
          created.
        </li>
        <li>
          A connection that is malformed, or points at a note the file does not contain, is skipped, and the app tells you how many. Older exports carry
          no note ids, so their connections often cannot be restored.
        </li>
        <li>Limits: 5,000 notes, groups and connections each, and about 10 MB.</li>
      </ul>
    </>
  );
}
