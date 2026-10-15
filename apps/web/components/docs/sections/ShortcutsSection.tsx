export function ShortcutsSection() {
  return (
    <>
      <h2 id="shortcuts">Keyboard Shortcuts</h2>
      <table className="shortcut-table">
        <tbody>
          <tr>
            <th>Action</th>
            <th>Shortcut</th>
          </tr>
          <tr>
            <td>Pan the board</td>
            <td>
              <kbd>Space</kbd> + drag
            </td>
          </tr>
          <tr>
            <td>Zoom in</td>
            <td>
              <kbd>Ctrl</kbd>/<kbd>Cmd</kbd>+<kbd>=</kbd> or toolbar +
            </td>
          </tr>
          <tr>
            <td>Zoom out</td>
            <td>
              <kbd>Ctrl</kbd>/<kbd>Cmd</kbd>+<kbd>-</kbd> or toolbar −
            </td>
          </tr>
          <tr>
            <td>Reset zoom to 100%</td>
            <td>
              <kbd>Ctrl</kbd>/<kbd>Cmd</kbd>+<kbd>0</kbd> or the percentage button
            </td>
          </tr>
          <tr>
            <td>Zoom towards the pointer</td>
            <td>
              <kbd>Ctrl</kbd>/<kbd>Cmd</kbd>+<kbd>Scroll</kbd>
            </td>
          </tr>
          <tr>
            <td>New line below</td>
            <td>
              <kbd>Enter</kbd> (in a note body)
            </td>
          </tr>
          <tr>
            <td>Line break within a line</td>
            <td>
              <kbd>Shift</kbd>+<kbd>Enter</kbd>
            </td>
          </tr>
          <tr>
            <td>Switch a line between text and checkbox</td>
            <td>
              <kbd>Tab</kbd> (in a note body)
            </td>
          </tr>
          <tr>
            <td>Delete an empty line</td>
            <td>
              <kbd>Backspace</kbd> on the empty line
            </td>
          </tr>
          <tr>
            <td>Add a label</td>
            <td>
              <kbd>Enter</kbd> (in the label field)
            </td>
          </tr>
          <tr>
            <td>Close the Style panel, a menu or the import dialog</td>
            <td>
              <kbd>Esc</kbd>
            </td>
          </tr>
          <tr>
            <td>Pan with the minimap focused</td>
            <td>
              <kbd>←</kbd> <kbd>→</kbd> <kbd>↑</kbd> <kbd>↓</kbd>
            </td>
          </tr>
          <tr>
            <td>Create / rename a workspace</td>
            <td>
              <kbd>Enter</kbd> (cancel a rename with <kbd>Esc</kbd>)
            </td>
          </tr>
        </tbody>
      </table>
    </>
  );
}
