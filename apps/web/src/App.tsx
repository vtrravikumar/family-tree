const principles = [
  {
    title: "Your family, together",
    description: "Create a private family space and invite relatives to contribute to a shared history.",
  },
  {
    title: "Every generation matters",
    description: "Record relationships across generations, even when historical dates are incomplete.",
  },
  {
    title: "Preserve what is known",
    description: "Keep family stories and uncertain dates honest. Unknown information is valid information.",
  },
];

export default function App() {
  return (
    <main className="page-shell">
      <nav className="topbar" aria-label="Main navigation">
        <a className="wordmark" href="/" aria-label="Family Tree home">
          <span className="mark" aria-hidden="true">✳</span>
          <span>family tree</span>
        </a>
        <span className="preview-label">Early preview</span>
      </nav>

      <section className="hero">
        <p className="eyebrow">YOUR FAMILY. YOUR STORY. YOUR LEGACY.</p>
        <h1>Every family has a story worth <em>preserving.</em></h1>
        <p className="hero-copy">
          A thoughtful space to build your family tree, bring generations together,
          and preserve the stories that make your family unique.
        </p>
        <div className="hero-actions">
          <button type="button" disabled title="Authentication will be added in a later milestone">
            Get started — coming soon
          </button>
          <span>Private family spaces · Built for generations</span>
        </div>
      </section>

      <section className="principles" aria-label="Product principles">
        {principles.map((item, index) => (
          <article className="principle-card" key={item.title}>
            <span className="card-number">0{index + 1}</span>
            <h2>{item.title}</h2>
            <p>{item.description}</p>
          </article>
        ))}
      </section>

      <footer>
        <span>Family Tree</span>
        <span>Preserving connections, one generation at a time.</span>
      </footer>
    </main>
  );
}
