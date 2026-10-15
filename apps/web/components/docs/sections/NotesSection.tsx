export function NotesSection() {
  return (
    <>
      <h2 id="creating-notes">Creating Notes</h2>
      <p>
        Click <strong>+ New Note</strong> in the toolbar. The new note appears in the centre of the part of the board you are looking at, whatever your
        pan position and zoom level.
      </p>
      <p>
        To copy a note, right-click it and choose <em>Duplicate</em>. The copy sits 30 px down and to the right of the original, with &ldquo;(copy)&rdquo;
        added to its heading, and is not in any group.
      </p>

      <h2 id="editing">Editing Content</h2>
      <p>
        Each note has a <strong>heading</strong> at the top and a <strong>line editor</strong> for the body. Every line is independent, and long lines
        wrap to the width of the note.
      </p>
      <table className="shortcut-table">
        <tbody>
          <tr>
            <th>Action</th>
            <th>Key</th>
          </tr>
          <tr>
            <td>New line below</td>
            <td>
              <kbd>Enter</kbd>
            </td>
          </tr>
          <tr>
            <td>Line break within a line</td>
            <td>
              <kbd>Shift</kbd>+<kbd>Enter</kbd>
            </td>
          </tr>
          <tr>
            <td>Delete an empty line and move up</td>
            <td>
              <kbd>Backspace</kbd> on an empty line
            </td>
          </tr>
          <tr>
            <td>Switch the line between text and checkbox</td>
            <td>
              <kbd>Tab</kbd>
            </td>
          </tr>
        </tbody>
      </table>
      <p>If the content is taller than the note, the body scrolls; drag the note&rsquo;s edge or corner to make it bigger.</p>

      <h2 id="checklists">Checklists</h2>
      <p>Checklists are inline with text: any line can be plain text or a checkbox, and you can mix them in any order.</p>
      <ul>
        <li>
          Press <kbd>Tab</kbd> on a line to turn it into a checkbox, and again to turn it back into text.
        </li>
        <li>
          Press <kbd>Enter</kbd> on a checkbox line to start the next checkbox below it.
        </li>
        <li>Tick a box to strike through and dim its text.</li>
      </ul>
      <div className="callout tip">
        <strong>Tip:</strong> A note can hold a paragraph, then a checklist, then more text, then another checklist. Claude can tick items for you with
        the <code>check_item</code> tool.
      </div>

      <h2 id="styling">Style Panel</h2>
      <p>
        Click <strong>Style</strong> in a note&rsquo;s footer to open one panel for everything about how that note looks. Changes apply to the note as you
        make them. Click outside the panel or press <kbd>Esc</kbd> to close it.
      </p>

      <h3>Colours</h3>
      <ul>
        <li>
          <strong>Note colour</strong> has 20 presets and <strong>Text colour</strong> has 10. The selected colour has a ring.
        </li>
        <li>
          A readout under the text colours shows the contrast between the text and the note (for example <em>9.6 : 1, easy to read</em>) and warns when
          text will be hard to read: 7 : 1 or more is easy, 4.5 : 1 is readable, below that is low contrast. Translucent colours are blended with what
          is behind them first.
        </li>
      </ul>

      <h3>Adding your own colours</h3>
      <p>
        The <strong>+</strong> at the end of each colour row opens a picker with a saturation/brightness square, a hue slider, an opacity slider and a
        hex field (<code>#rgb</code> or <code>#rrggbb</code>). The note changes live while you choose. Click <strong>Save to palette</strong> to keep the
        colour as a swatch in that row, or <strong>Done</strong> to use it without saving.
      </p>
      <ul>
        <li>
          Each row keeps up to 24 saved colours; when it is full the oldest makes room. Hover a saved swatch and click its <strong>×</strong> to remove
          it.
        </li>
        <li>
          Saved colours belong to <strong>this browser</strong> (they are kept in its <code>localStorage</code>, not in the data file), so they do not
          appear in another browser. The notes themselves keep their colours everywhere.
        </li>
      </ul>

      <h3>Text size and heading font</h3>
      <ul>
        <li>
          <strong>Body text</strong> is a − / + stepper through 11, 12, 13, 14, 15, 16, 18, 20 and 24 px.
        </li>
        <li>
          <strong>Heading font</strong> is a list of 20 fonts in groups (Default, Serif, Sans, Mono, Display, Script), each shown in its own typeface.{' '}
          <strong>Heading size</strong> is a slider from 12 to 36 px.
        </li>
        <li>
          <strong>Reset to default</strong> restores the colours, sizes and heading font a new note starts with. Your saved colours are not touched.
        </li>
      </ul>

      <h3>The default font</h3>
      <p>
        New notes use a sans-serif heading font: <strong>MesloLG when it is installed on your computer</strong>, otherwise DM Sans. MesloLG is recognised
        under its common names (<code>MesloLGS NF</code>, the Nerd Font builds, plain <em>Meslo LG</em> and the <em>for Powerline</em> builds), and the
        font list says whether it was found. The default applies to notes created in the app, through MCP and through the REST API alike. Notes you
        already have keep their fonts.
      </p>

      <h2 id="labels">Labels</h2>
      <p>
        Labels are hashtag-style tags. Type a name into the <em>+ label</em> field at the bottom of a note and press <kbd>Enter</kbd> (or click away) to
        add it. Spaces become underscores and a leading <code>#</code> is ignored. Click the <strong>×</strong> on a label to remove it.
      </p>
      <p>Labels are searchable and can be used as a filter through MCP and the REST API.</p>
    </>
  );
}
