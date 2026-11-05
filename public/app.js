// AI Foundation Course viewer.
// Fetches /course.md, renders it, and builds navigation from its headings.
(function () {
  'use strict';

  // ---------- Minimal markdown renderer (headings, lists, hr, paragraphs, inline) ----------
  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function inline(text) {
    let s = esc(text);
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    return s;
  }

  function renderBlocks(lines) {
    const out = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) { i++; continue; }

      if (/^---+\s*$/.test(line)) { out.push('<hr>'); i++; continue; }

      const h = line.match(/^(#{1,6})\s+(.*)$/);
      if (h) { out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); i++; continue; }

      if (/^\s*[-*]\s+/.test(line)) {
        const items = [];
        while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
          items.push(`<li>${inline(lines[i].replace(/^\s*[-*]\s+/, ''))}</li>`);
          i++;
        }
        out.push(`<ul>${items.join('')}</ul>`);
        continue;
      }

      if (/^\s*\d+\.\s+/.test(line)) {
        const items = [];
        while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
          items.push(`<li>${inline(lines[i].replace(/^\s*\d+\.\s+/, ''))}</li>`);
          i++;
        }
        out.push(`<ol>${items.join('')}</ol>`);
        continue;
      }

      // paragraph: consecutive plain lines; two trailing spaces = line break
      const para = [];
      while (i < lines.length && lines[i].trim() &&
             !/^(#{1,6}\s|---+\s*$|\s*[-*]\s+|\s*\d+\.\s+)/.test(lines[i])) {
        para.push(lines[i]);
        i++;
      }
      const html = para.map((l, idx) =>
        inline(l.trim()) + (/ {2,}$/.test(l) && idx < para.length - 1 ? '<br>' : '')
      ).join(' ').replace(/<br> /g, '<br>');
      out.push(`<p>${html}</p>`);
    }
    return out.join('\n');
  }

  // ---------- Parse the course into sections (h2) and subsections (h3) ----------
  function parseCourse(md) {
    const lines = md.replace(/\r\n/g, '\n').split('\n');
    const course = { title: 'AI Foundation Course', intro: [], sections: [] };
    let cur = null;   // current h2
    let sub = null;   // current h3

    for (const line of lines) {
      let m;
      if ((m = line.match(/^#\s+(.*)$/))) { course.title = m[1].trim(); continue; }
      if ((m = line.match(/^##\s+(.*)$/))) {
        cur = { title: m[1].trim(), lines: [], subs: [] };
        course.sections.push(cur);
        sub = null;
        continue;
      }
      if ((m = line.match(/^###\s+(.*)$/)) && cur) {
        sub = { title: m[1].trim(), lines: [] };
        cur.subs.push(sub);
        continue;
      }
      if (sub) sub.lines.push(line);
      else if (cur) cur.lines.push(line);
      else course.intro.push(line);
    }
    return course;
  }

  const stripNumber = t => t.replace(/^\d+\.\s*/, '');
  const slug = t => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  // ---------- Build the list of views ----------
  // Overview: sections before the modules section.
  // One view per module (h3 inside the modules section).
  // Assessment/resources/outputs: sections after the modules, except the planning checklist.
  // Items to finalize: the planning checklist.
  function buildViews(course) {
    const modIdx = course.sections.findIndex(s => /module/i.test(s.title));
    const views = [];

    const before = modIdx === -1 ? course.sections : course.sections.slice(0, modIdx);
    const modules = modIdx === -1 ? null : course.sections[modIdx];
    const after = modIdx === -1 ? [] : course.sections.slice(modIdx + 1);

    views.push({ id: 'overview', group: 'Course', label: 'Overview', parts: before });

    if (modules) {
      // any text directly under the modules heading is shown on each module's page? keep it simple:
      // it is shown on the first module only if present.
      modules.subs.forEach((m, i) => {
        views.push({
          id: 'module-' + (i + 1),
          group: 'Modules',
          label: m.title,
          module: m,
          lead: i === 0 ? modules.lines : null,
        });
      });
    }

    const finalize = after.filter(s => /items to finalize/i.test(s.title));
    const rest = after.filter(s => !/items to finalize/i.test(s.title));
    if (rest.length) {
      views.push({ id: 'assessment', group: 'Delivery', label: 'Assessment, resources and outputs', parts: rest });
    }
    if (finalize.length) {
      views.push({ id: 'finalize', group: 'Delivery', label: 'Items to finalize', parts: finalize });
    }
    return views;
  }

  // ---------- Rendering ----------
  function decorate(html) {
    // Highlight the learning-outcome line of each module as a callout.
    return html.replace(/<p>(<strong>Learning outcome:<\/strong>[\s\S]*?)<\/p>/g,
      '<p class="callout">$1</p>');
  }

  function renderView(view) {
    if (view.module) {
      const lead = view.lead && view.lead.some(l => l.trim()) ? renderBlocks(view.lead) : '';
      return `<article>
        <p class="eyebrow">Module ${view.id.replace('module-', '')}</p>
        <h1>${inline(view.module.title.replace(/^Module\s+\d+:\s*/i, ''))}</h1>
        ${lead}
        ${decorate(renderBlocks(view.module.lines))}
      </article>`;
    }
    const body = view.parts.map(s =>
      `<section id="${slug(s.title)}">
        <h2>${inline(stripNumber(s.title))}</h2>
        ${decorate(renderBlocks(s.lines))}
      </section>`).join('\n');
    return `<article><h1>${inline(view.label)}</h1>${body}</article>`;
  }

  const sidebar = document.getElementById('sidebar');
  const content = document.getElementById('content');
  const toggle = document.getElementById('menu-toggle');
  let views = [];

  function renderNav(activeId) {
    let html = '';
    let lastGroup = null;
    for (const v of views) {
      if (v.group !== lastGroup) {
        if (lastGroup !== null) html += '</ul>';
        html += `<h2 class="nav-group">${esc(v.group)}</h2><ul>`;
        lastGroup = v.group;
      }
      const label = v.module ? v.label.replace(/^Module\s+(\d+):\s*/i, '$1. ') : v.label;
      html += `<li><a href="#${v.id}" class="${v.id === activeId ? 'active' : ''}"` +
              `${v.id === activeId ? ' aria-current="page"' : ''}>${esc(label)}</a></li>`;
    }
    html += '</ul>';
    sidebar.innerHTML = html;
  }

  function pager(index) {
    const prev = views[index - 1];
    const next = views[index + 1];
    const link = (v, dir) => v
      ? `<a class="pager-${dir}" href="#${v.id}"><span>${dir === 'prev' ? 'Previous' : 'Next'}</span>${esc(v.label)}</a>`
      : '<span></span>';
    return `<nav class="pager" aria-label="Page navigation">${link(prev, 'prev')}${link(next, 'next')}</nav>`;
  }

  function show() {
    const id = location.hash.replace('#', '') || views[0].id;
    let index = views.findIndex(v => v.id === id);
    if (index === -1) index = 0;
    const view = views[index];
    renderNav(view.id);
    content.innerHTML = renderView(view) + pager(index);
    document.title = `${view.label} | ${document.getElementById('course-title').textContent}`;
    window.scrollTo(0, 0);
    document.body.classList.remove('nav-open');
    toggle.setAttribute('aria-expanded', 'false');
  }

  toggle.addEventListener('click', () => {
    const open = document.body.classList.toggle('nav-open');
    toggle.setAttribute('aria-expanded', String(open));
  });

  window.addEventListener('hashchange', show);

  fetch('/course.md', { cache: 'no-store' })
    .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
    .then(md => {
      const course = parseCourse(md);
      document.getElementById('course-title').textContent = course.title;
      views = buildViews(course);
      show();
    })
    .catch(err => {
      content.innerHTML = `<p class="error">Could not load the course (${esc(String(err.message))}). ` +
        'Make sure the server is running and AI-Foundation-Course.md exists.</p>';
    });
})();
