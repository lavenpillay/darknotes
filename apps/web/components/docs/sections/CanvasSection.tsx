export function CanvasSection() {
  return (
    <>
      <h2 id="arranging">Arranging Notes</h2>

      <h3>Moving notes</h3>
      <p>
        Drag a note by its header or by any empty part of its body (anywhere that is not a text field or button). A note you click or drag comes to the
        front of the stack. Notes stay inside the board.
      </p>

      <h3>Resizing notes</h3>
      <ul>
        <li>
          <strong>Corner handle</strong> (bottom-right, shown when you hover the note) — drag to change width and height together.
        </li>
        <li>
          <strong>Right edge</strong> — drag to change the width only.
        </li>
        <li>
          <strong>Bottom edge</strong> — drag to change the height only.
        </li>
      </ul>
      <p>The minimum note size is 220 × 140 px.</p>

      <h2 id="connections">Connections</h2>
      <p>Notes can be joined with curved lines to show relationships.</p>
      <div className="steps">
        <div className="step">
          <div className="step-num">1</div>
          <div className="step-body">
            <h4>Hover a note</h4>
            <p>Orange connection dots appear in the middle of its top, right, bottom and left edges.</p>
          </div>
        </div>
        <div className="step">
          <div className="step-num">2</div>
          <div className="step-body">
            <h4>Drag from a dot</h4>
            <p>A dashed preview line follows the pointer. Every note shows its dots while you drag.</p>
          </div>
        </div>
        <div className="step">
          <div className="step-num">3</div>
          <div className="step-body">
            <h4>Drop near another note&rsquo;s dot</h4>
            <p>The dot you are close to (within 30 px) is highlighted. Release to create the connection.</p>
          </div>
        </div>
      </div>
      <ul>
        <li>Lines follow their notes as you drag or resize them.</li>
        <li>
          <strong>Click a line to delete it.</strong> <strong>Right-click</strong> it to choose arrowheads: none, at the end, at the start, or at both
          ends.
        </li>
        <li>Joining the same two dots again, in either direction, does nothing, and a note cannot be joined to itself.</li>
        <li>Connections to notes inside a minimized group are hidden along with those notes.</li>
      </ul>

      <h2 id="groups">Groups</h2>
      <p>
        Groups are named, tinted rectangles that sit behind notes, so you can cluster related notes visually. Click <strong>+ New Group</strong> in the
        toolbar to add one in the middle of the visible board.
      </p>

      <h3>Adding and removing notes</h3>
      <p>
        Right-click a note and choose <em>Add to group</em>, then pick a group. If the note is outside the group it moves to the group&rsquo;s top-left
        corner so it is visibly inside. For a note that is in a group, the same menu offers <em>Remove from group</em>; the note stays where it is.
      </p>

      <h3>Group controls</h3>
      <ul>
        <li>
          <strong>Drag the header</strong> (not the name field) to move the group. Every note lying completely inside the group moves with it, whether
          or not it was added through the menu.
        </li>
        <li>
          <strong>Resize</strong> from the handle in the bottom-right corner (minimum 200 × 120 px).
        </li>
        <li>
          <strong>Click the name</strong> to rename the group.
        </li>
        <li>
          <strong>Colour dot</strong> — choose one of 10 tints.
        </li>
        <li>
          <strong>× button</strong> — delete the group. Its notes are kept and become ungrouped.
        </li>
      </ul>

      <h3>Minimizing groups</h3>
      <p>
        Click the <strong>chevron</strong> in a group&rsquo;s header to minimize it. The group shrinks to a small pill showing only its name, and the
        notes inside, and their connections, are hidden. Click the chevron again to restore everything.
      </p>

      <h2 id="navigation">Navigation &amp; Zoom</h2>

      <h3>Panning</h3>
      <ul>
        <li>Scroll (without <kbd>Ctrl</kbd>) to pan.</li>
        <li>
          Hold <kbd>Space</kbd> and drag, or drag with the middle mouse button.
        </li>
        <li>Drag any empty part of the board.</li>
        <li>Click or drag on the <a href="#minimap">minimap</a>.</li>
      </ul>

      <h3>Zooming</h3>
      <ul>
        <li>
          <kbd>Ctrl</kbd> (or <kbd>Cmd</kbd>) + scroll — zoom towards the pointer.
        </li>
        <li>
          <kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>=</kbd> or <kbd>+</kbd> — zoom in; <kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>-</kbd> — zoom out;{' '}
          <kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>0</kbd> — back to 100%.
        </li>
        <li>The toolbar − and + buttons, and the percentage button, which resets to 100%.</li>
      </ul>
      <p>Zoom ranges from 25% to 300%. The pan position and zoom level are saved with each workspace.</p>

      <h2 id="minimap">Minimap</h2>
      <p>
        The minimap in the bottom-right corner shows the whole 4000 × 3000 board at a glance: notes in their own colours, groups as tinted rectangles,
        connections as thin lines, and an orange box for the part you are looking at. Notes inside minimized groups are left out.
      </p>
      <ul>
        <li>
          <strong>Click anywhere</strong> on the map to jump there. <strong>Drag the orange box</strong> to pan the board.
        </li>
        <li>
          <strong>Resize it</strong> by dragging the grip in its top-left corner. It keeps its shape and ranges from 160 to 520 px wide.
        </li>
        <li>
          <strong>Mini-mode:</strong> click the chevron in its header to collapse the map to a small thumbnail. The thumbnail still works for clicking
          and dragging; use its expand button to bring the full map back.
        </li>
        <li>When the map has keyboard focus, the arrow keys pan the board.</li>
        <li>Its size and mode are remembered in this browser.</li>
      </ul>
    </>
  );
}
