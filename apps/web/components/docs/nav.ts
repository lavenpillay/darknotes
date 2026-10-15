/** The documentation's table of contents. Every `id` must exist as a heading in the page (a test checks this). */
export interface NavGroup {
  title: string;
  links: Array<{ id: string; label: string }>;
}

export const DOCS_NAV: NavGroup[] = [
  {
    title: 'Getting Started',
    links: [
      { id: 'overview', label: 'Overview' },
      { id: 'interface', label: 'Interface' },
    ],
  },
  {
    title: 'Notes',
    links: [
      { id: 'creating-notes', label: 'Creating Notes' },
      { id: 'editing', label: 'Editing Content' },
      { id: 'checklists', label: 'Checklists' },
      { id: 'styling', label: 'Style Panel' },
      { id: 'labels', label: 'Labels' },
    ],
  },
  {
    title: 'Canvas',
    links: [
      { id: 'arranging', label: 'Arranging Notes' },
      { id: 'connections', label: 'Connections' },
      { id: 'groups', label: 'Groups' },
      { id: 'navigation', label: 'Navigation & Zoom' },
      { id: 'minimap', label: 'Minimap' },
    ],
  },
  {
    title: 'Workspaces',
    links: [
      { id: 'workspaces', label: 'Workspaces' },
      { id: 'import-export', label: 'Import & Export' },
      { id: 'sync', label: 'Saving & Syncing' },
    ],
  },
  {
    title: 'MCP Integration',
    links: [
      { id: 'mcp-overview', label: 'MCP Overview' },
      { id: 'mcp-setup', label: 'Setup' },
      { id: 'configuration', label: 'Configuration & Security' },
      { id: 'mcp-tools', label: 'MCP Tools' },
      { id: 'rest-api', label: 'REST API' },
      { id: 'mcp-examples', label: 'Usage Examples' },
    ],
  },
  {
    title: 'Reference',
    links: [
      { id: 'shortcuts', label: 'Keyboard Shortcuts' },
      { id: 'data', label: 'Data & Privacy' },
    ],
  },
];
