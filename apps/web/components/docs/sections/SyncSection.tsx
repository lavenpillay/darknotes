export function SyncSection() {
  return (
    <>
      <h2 id="sync">Saving &amp; Syncing</h2>
        <p>You can keep the web app open while Claude edits your notes. The app saves only <em>what you changed</em>, and merges in what others changed, so neither side overwrites the other.</p>

        <h3>How it works</h3>
        <ul>
          <li>Edits show immediately. About half a second after you stop, the app sends just the differences (a move, a new note, a deleted group) to the server. The toolbar shows <em>Saved</em>, <em>Unsaved changes</em>, <em>Saving&hellip;</em> or <em>Not saved</em>.</li>
          <li>The server's reply, and a check every 4 seconds while the tab is visible, bring in anything changed elsewhere. Notes, groups and connections Claude adds or edits appear on their own, and are never erased by one of your saves.</li>
          <li>Things you create in the web app get random ids such as <code>n_k3f9a2x</code>, so they cannot collide with the <code>n_1</code>, <code>n_2</code> ids the server hands out. Treat ids as opaque.</li>
        </ul>

        <h3>When both of you change the same thing</h3>
        <ul>
          <li><strong>Different notes, or different fields of one note</strong> (you move it while Claude renames it): both changes are kept.</li>
          <li><strong>The same field of the same note</strong> before the next sync: your value wins until it is saved, then the last write wins. A note's lines are replaced as a whole, so two people typing in the <em>same note</em> at once can overwrite each other.</li>
          <li><strong>A delete beats an edit</strong> made on the other side.</li>
        </ul>

        <h3>Failures and offline</h3>
        <ul>
          <li>If a save fails, your edits stay on screen, the toolbar shows <em>Not saved</em>, and the app retries every 5 seconds. A save is also started when you hide or close the tab.</li>
          <li>If the server cannot be reached when you open the app, it shows the copy it last cached in the browser, marked <em>Offline</em>, and sends your unsaved edits once the server is back.</li>
        </ul>
    </>
  );
}
