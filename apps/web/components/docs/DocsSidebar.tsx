'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { DOCS_NAV } from './nav';

/** The fixed side navigation. The link for the section being read is highlighted as the page scrolls. */
export function DocsSidebar() {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const headings = DOCS_NAV.flatMap((g) => g.links).flatMap((l) => {
      const el = document.getElementById(l.id);
      return el ? [el] : [];
    });
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: '-20% 0px -75% 0px' },
    );
    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, []);

  return (
    <aside aria-label="Documentation contents">
      <span className="sidebar-logo">
        DarkNotes<span>.</span>
      </span>
      <Link href="/" className="back-link">
        ← Back to your notes
      </Link>
      <nav>
        {DOCS_NAV.map((group) => (
          <div className="nav-section" key={group.title}>
            <span className="nav-section-title">{group.title}</span>
            {group.links.map((l) => (
              <a
                key={l.id}
                href={`#${l.id}`}
                className={`nav-link${active === l.id ? ' active' : ''}`}
                aria-current={active === l.id ? 'location' : undefined}
              >
                {l.label}
              </a>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
