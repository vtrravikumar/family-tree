type Props = { version: string; build: string };

const unreleased = [
  "Add optional relationship linking while adding a family member.",
  "Automatically connect a new sibling to the explicitly linked sibling group and their recorded biological parents.",
  "Add owner/admin person deletion with name confirmation; connected relationships are removed, while deceased profiles remain protected.",
  "Make Family members and Relationships panels collapsible.",
  "Improve generation, ancestor and descendant focus behaviour.",
];

export default function VersionHistory({ version, build }: Props) {
  return <main className="app-shell version-history-page">
    <header className="app-header"><a className="brand" href="/"><img className="brand-mark" src="/banyan-mark.svg" alt="" />Vansvriksha</a><span className="environment">VERSION HISTORY</span></header>
    <section className="version-history-content">
      <p className="eyebrow">PRODUCT RELEASES</p>
      <h1>Version <em>history.</em></h1>
      <p className="intro">A transparent record of what changes in Vansvriksha, release by release.</p>
      <article className="version-entry current-version">
        <div className="version-entry-heading"><div><p className="eyebrow">CURRENT BUILD</p><h2>v{version}</h2></div><span className="version-build">Build {build}</span></div>
        <p className="version-entry-summary">Current development version. Formal release notes are published when this version is tagged and released.</p>
      </article>
      <article className="version-entry">
        <div className="version-entry-heading"><div><p className="eyebrow">IN DEVELOPMENT</p><h2>Unreleased</h2></div><span className="version-build">Next release</span></div>
        <p className="version-entry-summary">Changes merged after the current version. These will be assigned to the next release number.</p>
        <ul>{unreleased.map((item) => <li key={item}>{item}</li>)}</ul>
      </article>
      <article className="version-entry">
        <div className="version-entry-heading"><div><p className="eyebrow">BASELINE</p><h2>v0.1.0</h2></div><span className="version-build">Initial version</span></div>
        <p className="version-entry-summary">Initial application foundation: private family workspaces, family member profiles, relationship management and the first interactive family-tree experience.</p>
      </article>
      <p className="version-history-note">Version format: <strong>vMAJOR.MINOR.PATCH</strong>. During the 0.x development phase, feature releases increase MINOR (for example, v0.2.0); fixes increase PATCH (for example, v0.1.1). Build identifiers distinguish deployments of the same version.</p>
      <a className="button-secondary version-back-link" href="/">← Back to Vansvriksha</a>
    </section>
    <footer className="app-footer"><span>Vansvriksha</span><span>Preserving connections, one generation at a time.</span><a className="version-link" href="/version-history">v{version} (build {build})</a></footer>
  </main>;
}
