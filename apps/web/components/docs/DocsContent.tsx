import { DocsSidebar } from './DocsSidebar';
import { CanvasSection } from './sections/CanvasSection';
import { DataSection } from './sections/DataSection';
import { GettingStartedSection } from './sections/GettingStartedSection';
import { McpSection } from './sections/McpSection';
import { NotesSection } from './sections/NotesSection';
import { ShortcutsSection } from './sections/ShortcutsSection';
import { SyncSection } from './sections/SyncSection';
import { WorkspacesSection } from './sections/WorkspacesSection';

/** The whole documentation page, separate from the route so tests can render it. */
export function DocsContent() {
  return (
    <div className="dn-docs">
      <div className="dn-page">
        <DocsSidebar />
        <main>
          <h1>
            DarkNotes<span className="accent">.</span> Documentation
          </h1>
          <p className="subtitle">
            A canvas-based note-taking application with workspaces, groups, connections, and full MCP integration for AI-assisted note management.
          </p>

          <GettingStartedSection />
          <NotesSection />
          <CanvasSection />
          <WorkspacesSection />
          <SyncSection />
          <McpSection />
          <hr />
          <ShortcutsSection />
          <DataSection />
        </main>
      </div>
    </div>
  );
}
