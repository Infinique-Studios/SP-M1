(() => {
  'use strict';

  const DATA = window.SKILLPOINT_DATA;
  const LICENSED = window.SKILLPOINT_LICENSED || {subjects: {}, summary: {}};
  const QUESTION_IMAGES = window.SKILLPOINT_QUESTION_IMAGES || {items: {}};
  const CAMBRIDGE = window.SKILLPOINT_CAMBRIDGE_PAPERS || {codes: {}, summary: {}};
  const PAPERS = window.SKILLPOINT_PAPERS || {codes: {}};
  const app = document.getElementById('app');
  const categories = ['AS & A Level', 'IGCSE', 'O Level'];
  const icons = {
    Mathematics: '∑', Biology: '⌁', Chemistry: '⚗', Physics: '↯', Economics: '↗', Business: '◆',
    Accounting: '≡', Sociology: '◎', Psychology: 'Ψ', 'Computer Science': '</>',
    'Information Technology': '▦', 'Information & Communication Technology': '▦', 'Mathematics (Syllabus D)': '∑'
  };
  const externalAttrs = 'target="_blank" rel="noopener noreferrer"';
  const memoryStore = {};
  let tocCleanup = null;
  let scrollResetTimer = null;

  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (_) {
        return key in memoryStore ? memoryStore[key] : fallback;
      }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); }
      catch (_) { memoryStore[key] = value; }
    }
  };

  const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const subjectById = id => DATA.subjects.find(subject => subject.id === id);
  const subjectByCode = code => DATA.subjects.find(subject => subject.code === code);
  const licensedFor = subject => subject ? LICENSED.subjects?.[subject.code] || null : null;
  const noteItems = record => (record?.notes?.groups || []).flatMap(group => group.items.map(item => ({...item, group: group.title})));
  const topicItems = record => (record?.topicals?.groups || []).flatMap(group => group.items.map(item => ({...item, group: group.title})));
  const noteItem = (record, slug) => noteItems(record).find(item => item.slug === slug);
  const topicItem = (record, slug) => topicItems(record).find(item => item.slug === slug);
  const completedNotes = () => store.get('skillpoint-note-complete-v3', {});
  const bookmarks = () => store.get('skillpoint-bookmarks-v3', {});
  const questionDone = () => store.get('skillpoint-question-done-v3', {});
  const PDF_PICKS_KEY = 'skillpoint-pdf-picks-v1';
  const MAX_PDF_PICKS = 50;
  const pdfPicks = () => {
    const current = store.get(PDF_PICKS_KEY, null);
    if (current && typeof current === 'object') return current;
    const migrated = store.get('skillpoint-practice-queue-v3', {});
    store.set(PDF_PICKS_KEY, migrated);
    return migrated;
  };
  const updatePdfCount = () => document.querySelectorAll('[data-pdf-count]').forEach(element => { element.textContent = Object.keys(pdfPicks()).length; });
  const togglePdfPick = (key, item) => {
    const picks = pdfPicks();
    if (picks[key]) delete picks[key];
    else {
      if (Object.keys(picks).length >= MAX_PDF_PICKS) return false;
      picks[key] = {...item, addedAt: Date.now()};
    }
    store.set(PDF_PICKS_KEY, picks);
    updatePdfCount();
    return true;
  };

  function sourceLinkLabel(subject, open = false) {
    if (subject.source.status === 'official-mirror') return `${open ? 'Open ' : ''}official syllabus · archival mirror ↗`;
    return `${open ? 'Open ' : ''}official Cambridge syllabus ↗`;
  }

  function sourceDescription(subject) {
    return subject.source.status === 'official-mirror'
      ? `official Cambridge ${subject.source.cycle} syllabus accessed through a labelled archival mirror`
      : `official Cambridge ${subject.source.cycle} syllabus`;
  }

  function iconFor(subject) {
    return icons[subject.title] || icons[subject.title.split(' ')[0]] || '•';
  }

  function shell(content, options = {}) {
    tocCleanup?.();
    tocCleanup = null;
    const current = options.current || '';
    document.title = `${options.title || 'Cambridge Revision'} · SkillPoint`;
    app.innerHTML = `
      <a class="skip-link" href="#main-content">Skip to content</a>
      <header class="site-header">
        <a class="brand" href="#/" aria-label="SkillPoint home"><span class="brand-mark">S</span><span>SkillPoint</span></a>
        <nav aria-label="Primary navigation">
          <a class="${current === 'subjects' ? 'active' : ''}" href="#/subjects">Subjects</a>
          <a class="pdf-nav-link ${current === 'pdf' ? 'active' : ''}" href="#/question-pdf">Question PDF <strong data-pdf-count>${Object.keys(pdfPicks()).length}</strong></a>
          <button class="nav-search" type="button" data-open-search>Search</button>
          <button class="timer-trigger" type="button" data-open-timer><span class="timer-dot"></span><span data-timer-mini>Focus timer</span></button>
          <a class="discord-link" href="${esc(DATA.discord)}" ${externalAttrs}>Discord ↗</a>
        </nav>
      </header>
      <main id="main-content">${content}</main>
      <footer class="site-footer">
        <div><strong>Made by SkillPoint</strong><span>Cambridge revision: Notes → Topicals → Past Papers</span></div>
        <div><a href="${esc(DATA.discord)}" ${externalAttrs}>Discord</a><a href="#/subjects">Subjects</a><a href="#/question-pdf">Question PDF</a></div>
      </footer>
      ${timerModal()}
      ${searchModal()}
    `;
    bindGlobal();
  }

  function homePage() {
    const cards = categories.map(category => {
      const subjects = DATA.subjects.filter(subject => subject.category === category);
      const catalogue = subjects.filter(subject => !subject.supplemental).length;
      return `<a class="level-card" href="#/subjects?level=${encodeURIComponent(category)}">
        <span>${esc(category)}</span><strong>${catalogue} subjects</strong><small>Notes, topicals and direct papers in one route</small><b>Explore →</b>
      </a>`;
    }).join('');
    shell(`
      <section class="hero method-hero">
        <div class="hero-copy">
          <span class="eyebrow">Cambridge revision in the right order</span>
          <h1>Understand it. Practise it.<br><em>Then sit the paper.</em></h1>
          <p>SkillPoint now follows the licensed Notes → Topicals → Past Papers method, while retaining the SkillPoint interface and official syllabus boundaries.</p>
          <div class="hero-actions"><a class="primary" href="#/subjects">Choose a subject</a><button class="secondary" data-open-search>Find a topic</button></div>
          <div class="hero-stats">
            <div><strong>${Number(LICENSED.summary?.detailedNotes || 0).toLocaleString()}</strong><span>licensed detailed notes</span></div>
            <div><strong>${Number(LICENSED.summary?.uniqueQuestionRecords || 0).toLocaleString()}</strong><span>tagged question records</span></div>
            <div><strong>${Number(CAMBRIDGE.summary?.pdfLinks || 0).toLocaleString()}</strong><span>Cambridge-hosted PDFs</span></div>
          </div>
          <p class="scope-note">The supplied package contains complete detailed notes and question-level paper tagging for Mathematics 9709; catalogue-only subjects are labelled honestly.</p>
        </div>
        <div class="hero-board" aria-label="SkillPoint study workflow">
          <div class="board-top"><span>Study route</span><b>NOTES → TOPICALS → PAST PAPERS</b></div>
          <ol>
            <li><span>01</span><div><strong>Notes</strong><small>Learn the exact supplied explanations, formulas, examples and diagrams.</small></div></li>
            <li><span>02</span><div><strong>Topicals</strong><small>Work genuine questions grouped by syllabus topic, marks, paper and session.</small></div></li>
            <li><span>03</span><div><strong>Past papers</strong><small>Move to complete timed papers and mark schemes, with Cambridge-hosted links first.</small></div></li>
          </ol>
          <div class="board-note">Licensed package content is imported into the SkillPoint shell; exam PDFs remain externally hosted.</div>
        </div>
      </section>
      <section class="level-section">
        <div class="section-heading"><span>Choose your qualification</span><h2>One subject hub, three connected stages.</h2></div>
        <div class="level-grid">${cards}</div>
      </section>
      <section class="principles">
        <article><span>01</span><h3>Exact supplied notes</h3><p>The former generated study summaries are no longer presented as notes. Detailed licensed text, MathML and inline diagrams are used where the package supplies them.</p></article>
        <article><span>02</span><h3>Question-level topicals</h3><p>Topic lists retain reported marks ranges, frequency, paper, question number, marks and related-topic metadata.</p></article>
        <article><span>03</span><h3>Cambridge links first</h3><p>Public Cambridge-hosted question papers and mark schemes are the default paper source. The detailed licensed index and verified historical mirror remain available.</p></article>
      </section>
    `, {title: 'Cambridge Revision'});
  }

  function subjectsPage() {
    const query = new URLSearchParams(location.hash.split('?')[1] || '');
    const initial = query.get('level') || 'All';
    const filters = ['All', ...categories].map(category => `<button type="button" class="filter-chip ${category === initial ? 'active' : ''}" data-level="${esc(category)}">${esc(category)}</button>`).join('');
    shell(`
      <section class="page-hero compact">
        <span class="eyebrow">All subjects</span><h1>Choose the exact syllabus route.</h1>
        <p>Availability badges distinguish detailed licensed material from catalogue-only entries.</p>
      </section>
      <section class="subject-browser">
        <div class="browser-tools"><div class="filter-row">${filters}</div><label class="inline-search"><span>Search</span><input id="subject-filter" type="search" placeholder="Subject, code or level"></label></div>
        <div id="subject-grid" class="subject-grid"></div>
      </section>
    `, {title: 'Subjects', current: 'subjects'});
    const grid = document.getElementById('subject-grid');
    const input = document.getElementById('subject-filter');
    let level = initial;
    const draw = () => {
      const q = input.value.trim().toLowerCase();
      const subjects = DATA.subjects.filter(subject => (level === 'All' || subject.category === level) && `${subject.title} ${subject.code} ${subject.category}`.toLowerCase().includes(q));
      grid.innerHTML = subjects.length ? subjects.map(subjectCard).join('') : '<div class="empty-state">No matching subject route.</div>';
    };
    document.querySelectorAll('[data-level]').forEach(button => button.addEventListener('click', () => {
      level = button.dataset.level;
      document.querySelectorAll('[data-level]').forEach(item => item.classList.toggle('active', item === button));
      draw();
    }));
    input.addEventListener('input', draw);
    draw();
  }

  function subjectCard(subject) {
    const record = licensedFor(subject);
    const detailed = Object.keys(record?.noteBodies || {}).length;
    const topics = record?.topicals?.reportedTotal || 0;
    const official = (CAMBRIDGE.codes?.[subject.code] || []).length;
    return `<a class="subject-card" href="#/subject/${encodeURIComponent(subject.id)}/notes">
      <div class="subject-icon">${esc(iconFor(subject))}</div>
      <div class="subject-card-head"><span>${esc(subject.category)}${subject.supplemental ? ' · specimen-only' : ''}</span><small>${esc(subject.source.cycle)}${subject.source.status === 'official-mirror' ? ' · mirror' : ''}</small></div>
      <h2>${esc(subject.title)}</h2><p>${esc(subject.code)}</p>
      <div class="availability-row">
        <span class="${detailed ? 'available' : ''}">${detailed ? `${detailed} full notes` : record?.notes ? 'note catalogue' : 'no supplied notes'}</span>
        <span class="${topics ? 'available' : ''}">${topics ? `${topics.toLocaleString()} topical records` : 'no supplied topicals'}</span>
      </div>
      <div class="subject-card-foot"><small>${official ? `${official} Cambridge paper rows` : 'paper bank available'}</small><b>Open hub →</b></div>
    </a>`;
  }

  function subjectTabs(subject, active) {
    return `<nav class="resource-tabs" aria-label="Study stages">
      <a class="${active === 'notes' ? 'active' : ''}" href="#/subject/${encodeURIComponent(subject.id)}/notes"><span>01</span>Notes</a>
      <a class="${active === 'topicals' ? 'active' : ''}" href="#/subject/${encodeURIComponent(subject.id)}/topicals"><span>02</span>Topicals</a>
      <a class="${active === 'papers' ? 'active' : ''}" href="#/papers/${encodeURIComponent(subject.id)}"><span>03</span>Past Papers</a>
      <a class="${active === 'syllabus' ? 'active' : ''}" href="#/syllabus/${encodeURIComponent(subject.id)}"><span>04</span>Syllabus outline</a>
    </nav>`;
  }

  function subjectPage(id, requested = 'notes') {
    const subject = subjectById(id);
    if (!subject) return notFound();
    if (requested === 'papers') return papersPage(id);
    if (requested === 'syllabus') return syllabusPage(id);
    const active = requested === 'topicals' ? 'topicals' : 'notes';
    const record = licensedFor(subject);
    const panel = active === 'notes' ? notesPanel(subject, record) : topicalsPanel(subject, record);
    shell(`
      <section class="subject-hero method-subject-hero">
        <a class="back-link" href="#/subjects">← All subjects</a>
        <div class="subject-title-line"><div class="subject-icon large">${esc(iconFor(subject))}</div><div><span>${esc(subject.category)} · ${esc(subject.code)}</span><h1>${esc(subject.title)}</h1></div></div>
        <p>Study in order: learn from notes, practise by topic, then complete full papers. The syllabus outline remains available as the scope check.</p>
        <div class="subject-actions"><a class="text-button" href="${esc(subject.source.url)}" ${externalAttrs}>${esc(sourceLinkLabel(subject))}</a></div>
      </section>
      ${subject.notice ? `<aside class="notice"><strong>Route and source notice</strong><p>${esc(subject.notice)}</p></aside>` : ''}
      ${subjectTabs(subject, active)}
      ${panel}
    `, {title: `${subject.title} ${active}`, current: 'subjects'});
  }

  function notesPanel(subject, record) {
    const groups = record?.notes?.groups || [];
    const detailed = Object.keys(record?.noteBodies || {}).length;
    const formulaCard = record?.formulaSheet ? `<a class="formula-feature" href="#/formula/${encodeURIComponent(subject.code)}"><div><span>Complete reference</span><h3>Formulas and definitions</h3><p>Everything supplied across all components on one searchable page.</p></div><div><strong>${record.formulaSheet.stats.formulas.toLocaleString()}</strong><span>formula entries</span></div><b>Open reference →</b></a>` : '';
    if (!groups.length) return `<section class="resource-empty"><span>Notes</span><h2>No licensed note catalogue was included for this subject.</h2><p>The generated summaries previously shown as notes have been removed. Use the official syllabus outline and paper bank until an authorised note package is supplied.</p><a class="secondary" href="#/syllabus/${encodeURIComponent(subject.id)}">Open syllabus outline</a></section>`;
    return `<section class="resource-index">
      <header class="resource-index-head"><div><span>Stage 01 · Notes</span><h2>${record.notes.listedItems} topics${detailed ? ` · ${detailed} complete note bodies` : ''}</h2><p>${detailed ? 'Open a topic to read the supplied prose, formulas, worked examples and diagrams inside SkillPoint.' : 'The package includes this subject’s catalogue, but not the detailed page bodies. Those rows are labelled catalogue only.'}</p></div><div class="index-stat"><strong>${detailed}</strong><span>fully readable</span></div></header>
      ${formulaCard}
      <div class="resource-groups">${groups.map(group => `<section class="resource-group"><header><span>${esc(group.number)}</span><div><h3>${esc(group.title)}</h3><p>${group.items.length} note${group.items.length === 1 ? '' : 's'}</p></div></header><div class="resource-rows">${group.items.map(item => {
        const available = !!record.noteBodies?.[item.slug];
        return available
          ? `<a class="resource-row" href="#/note/${encodeURIComponent(subject.code)}/${encodeURIComponent(item.slug)}"><span class="resource-number">${esc(item.number || '•')}</span><strong>${esc(item.title)}</strong><small>Read complete note</small><b>→</b></a>`
          : `<div class="resource-row unavailable"><span class="resource-number">${esc(item.number || '•')}</span><strong>${esc(item.title)}</strong><small>Catalogue only · body not in supplied package</small><b>—</b></div>`;
      }).join('')}</div></section>`).join('')}</div>
    </section>`;
  }

  function topicalsPanel(subject, record) {
    const groups = record?.topicals?.groups || [];
    if (!groups.length) return `<section class="resource-empty"><span>Topicals</span><h2>No licensed topical catalogue was included for this subject.</h2><p>Use complete past papers while a question-level package is unavailable.</p><a class="secondary" href="#/papers/${encodeURIComponent(subject.id)}">Open past papers</a></section>`;
    const detailedCount = Object.values(record.topicQuestions || {}).reduce((sum, rows) => sum + rows.length, 0);
    return `<section class="resource-index topical-index">
      <header class="resource-index-head"><div><span>Stage 02 · Topicals</span><h2>${Number(record.topicals.reportedTotal || 0).toLocaleString()} reported question records</h2><p>Marks ranges and recent-paper frequency come from the supplied catalogue. Question rows open internally only where the package includes paper-level tagging.</p></div><div class="index-stat"><strong>${detailedCount.toLocaleString()}</strong><span>indexed topic placements</span></div></header>
      <div class="resource-groups">${groups.map(group => `<section class="resource-group"><header><span>${esc(group.number)}</span><div><h3>${esc(group.title)}</h3><p>${Number(group.reportedCount).toLocaleString()} questions</p></div></header><div class="resource-rows">${group.items.map(item => {
        const rows = record.topicQuestions?.[item.slug] || [];
        const stats = `<span class="topic-stats"><i>${esc(item.marksRange || '—')} marks</i><i>${item.frequency ? `${item.frequency[0]}/${item.frequency[1]} recent papers` : 'frequency unavailable'}</i><i>${Number(item.questionCount || 0).toLocaleString()} questions</i></span>`;
        return rows.length
          ? `<a class="resource-row topical-row" href="#/topical/${encodeURIComponent(subject.code)}/${encodeURIComponent(item.slug)}"><span class="resource-number">${esc(item.number || '•')}</span><strong>${esc(item.title)}</strong>${stats}<b>→</b></a>`
          : `<div class="resource-row topical-row unavailable"><span class="resource-number">${esc(item.number || '•')}</span><strong>${esc(item.title)}</strong>${stats}<b>catalogue only</b></div>`;
      }).join('')}</div></section>`).join('')}</div>
    </section>`;
  }

  function notePage(code, slug) {
    const subject = subjectByCode(code);
    const record = licensedFor(subject);
    const note = record?.noteBodies?.[slug];
    if (!subject || !record || !note) return notFound();
    const items = noteItems(record).filter(item => record.noteBodies?.[item.slug]);
    const index = items.findIndex(item => item.slug === slug);
    const key = `${code}:${slug}`;
    const done = !!completedNotes()[key];
    const bookmarked = !!bookmarks()[`note:${key}`];
    const matchingTopic = record.topicQuestions?.[slug]?.length ? slug : null;
    const sidebar = record.notes.groups.map(group => `<section><span>${esc(group.number)}</span><strong>${esc(group.title)}</strong>${group.items.filter(item => record.noteBodies?.[item.slug]).map(item => `<a class="${item.slug === slug ? 'active' : ''}" href="#/note/${encodeURIComponent(code)}/${encodeURIComponent(item.slug)}"><i>${esc(item.number)}</i>${esc(item.title)}</a>`).join('')}</section>`).join('');
    const toc = note.toc.map(item => `<button type="button" data-toc="${esc(item.id)}">${esc(item.title)}</button>`).join('');
    shell(`
      <div class="licensed-reader-shell">
        <aside class="licensed-sidebar"><a class="back-link" href="#/subject/${encodeURIComponent(subject.id)}/notes">← ${esc(subject.title)} notes</a><div class="licensed-side-scroll">${sidebar}</div></aside>
        <article class="licensed-reader">
          <header class="licensed-note-header" id="note-top">
            <div class="breadcrumbs"><a href="#/subjects">Subjects</a><span>/</span><a href="#/subject/${encodeURIComponent(subject.id)}/notes">${esc(subject.title)}</a><span>/</span><b>${esc(note.number)}</b></div>
            <span class="eyebrow">${esc(note.group)} · ${esc(note.number)}</span><h1>${esc(note.title)}</h1>
            <div class="note-stats"><span>${Number(note.stats.words).toLocaleString()} words</span><span>${note.stats.formulas.toLocaleString()} formulas</span><span>${note.stats.diagrams} diagrams</span></div>
            <div class="reader-actions"><button type="button" data-note-complete="${esc(key)}" class="${done ? 'selected' : ''}">${done ? '✓ Completed' : 'Mark complete'}</button><button type="button" data-note-bookmark="${esc(key)}" class="${bookmarked ? 'selected' : ''}">${bookmarked ? '★ Bookmarked' : '☆ Bookmark'}</button><button type="button" data-print>Print note</button></div>
          </header>
          <aside class="licensed-source-note"><strong>Licensed package note</strong><span>This detailed text, MathML and its inline diagrams replace the former generated SkillPoint summary for this topic.</span></aside>
          <div class="licensed-note-content">${note.html}</div>
          <section class="note-next-stage"><span>Next stage</span><h2>Apply this topic to real questions.</h2>${matchingTopic ? `<a class="primary" href="#/topical/${encodeURIComponent(code)}/${encodeURIComponent(matchingTopic)}">Open ${esc(note.title)} topicals</a>` : `<a class="primary" href="#/papers/${encodeURIComponent(subject.id)}">Open past papers</a>`}</section>
          <nav class="previous-next">${index > 0 ? `<a href="#/note/${encodeURIComponent(code)}/${encodeURIComponent(items[index - 1].slug)}"><span>Previous note</span><strong>← ${esc(items[index - 1].title)}</strong></a>` : '<span></span>'}${index < items.length - 1 ? `<a class="next" href="#/note/${encodeURIComponent(code)}/${encodeURIComponent(items[index + 1].slug)}"><span>Next note</span><strong>${esc(items[index + 1].title)} →</strong></a>` : '<span></span>'}</nav>
        </article>
        <aside class="toc licensed-toc"><span>On this page</span><button type="button" data-toc="note-top">Overview</button>${toc}<a href="#/topical/${encodeURIComponent(code)}/${encodeURIComponent(matchingTopic || slug)}">Topicals →</a></aside>
      </div>
    `, {title: `${note.title} · ${subject.title}`, current: 'subjects'});
    bindNoteActions(key);
    activateToc(['note-top', ...note.toc.map(item => item.id)]);
    const requestedSection = new URLSearchParams(location.hash.split('?')[1] || '').get('section');
    if (requestedSection) setTimeout(() => document.getElementById(requestedSection)?.scrollIntoView({block: 'start'}), 30);
  }

  function formulaPage(code) {
    const subject = subjectByCode(code);
    const record = licensedFor(subject);
    const sheet = record?.formulaSheet;
    if (!subject || !sheet) return notFound();
    const toc = sheet.toc.map(item => `<button type="button" data-toc="${esc(item.id)}">${esc(item.title)}</button>`).join('');
    shell(`
      <div class="licensed-reader-shell reference-sheet-shell">
        <aside class="licensed-sidebar formula-sidebar"><a class="back-link" href="#/subject/${encodeURIComponent(subject.id)}/notes">← ${esc(subject.title)} notes</a><div class="formula-side-list"><span>Components</span>${toc}</div></aside>
        <article class="licensed-reader">
          <header class="licensed-note-header" id="formula-top"><div class="breadcrumbs"><a href="#/subjects">Subjects</a><span>/</span><a href="#/subject/${encodeURIComponent(subject.id)}/notes">${esc(subject.title)}</a><span>/</span><b>Reference</b></div><span class="eyebrow">Licensed formulas and definitions</span><h1>Formulas and definitions</h1><div class="note-stats"><span>${Number(sheet.stats.words).toLocaleString()} words</span><span>${sheet.stats.formulas.toLocaleString()} formula entries</span><span>${sheet.toc.length} components</span></div><div class="reader-actions"><button type="button" data-print>Print reference</button></div></header>
          <aside class="licensed-source-note"><strong>Complete supplied reference</strong><span>Use this page for recall and checking; follow its linked topic notes for full teaching and examples.</span></aside>
          <div class="licensed-note-content formula-sheet-content">${sheet.html}</div>
          <section class="note-next-stage"><span>Study route</span><h2>Return to notes, then apply the formulas in topicals.</h2><div class="hero-actions"><a class="primary" href="#/subject/${encodeURIComponent(subject.id)}/notes">Topic notes</a><a class="secondary" href="#/subject/${encodeURIComponent(subject.id)}/topicals">Topicals</a></div></section>
        </article>
        <aside class="toc licensed-toc"><span>On this page</span><button type="button" data-toc="formula-top">Overview</button>${toc}</aside>
      </div>
    `, {title: `Formulas and definitions · ${subject.title}`, current: 'subjects'});
    document.querySelector('[data-print]')?.addEventListener('click', () => window.print());
    activateToc(['formula-top', ...sheet.toc.map(item => item.id)]);
  }

  function bindNoteActions(key) {
    document.querySelector('[data-note-complete]')?.addEventListener('click', event => {
      const state = completedNotes();
      state[key] = !state[key];
      if (!state[key]) delete state[key];
      store.set('skillpoint-note-complete-v3', state);
      event.currentTarget.classList.toggle('selected', !!state[key]);
      event.currentTarget.textContent = state[key] ? '✓ Completed' : 'Mark complete';
    });
    document.querySelector('[data-note-bookmark]')?.addEventListener('click', event => {
      const state = bookmarks();
      const bookmarkKey = `note:${key}`;
      state[bookmarkKey] = !state[bookmarkKey];
      if (!state[bookmarkKey]) delete state[bookmarkKey];
      store.set('skillpoint-bookmarks-v3', state);
      event.currentTarget.classList.toggle('selected', !!state[bookmarkKey]);
      event.currentTarget.textContent = state[bookmarkKey] ? '★ Bookmarked' : '☆ Bookmark';
    });
    document.querySelector('[data-print]')?.addEventListener('click', () => window.print());
  }

  function topicalPage(code, slug) {
    const subject = subjectByCode(code);
    const record = licensedFor(subject);
    const item = topicItem(record, slug);
    const refs = record?.topicQuestions?.[slug] || [];
    if (!subject || !record || !item || !refs.length) return notFound();
    const groups = record.topicals.groups;
    const sidebar = groups.map(group => `<section><span>${esc(group.number)}</span><strong>${esc(group.title)}</strong>${group.items.filter(candidate => record.topicQuestions?.[candidate.slug]?.length).map(candidate => `<a class="${candidate.slug === slug ? 'active' : ''}" href="#/topical/${encodeURIComponent(code)}/${encodeURIComponent(candidate.slug)}"><i>${esc(candidate.number)}</i>${esc(candidate.title)}<small>${candidate.questionCount}</small></a>`).join('')}</section>`).join('');
    const years = [...new Set(refs.map(ref => record.papers?.[ref.paper]?.year).filter(Boolean))].sort((a,b) => b-a);
    shell(`
      <div class="topical-shell">
        <aside class="licensed-sidebar topical-sidebar"><a class="back-link" href="#/subject/${encodeURIComponent(subject.id)}/topicals">← ${esc(subject.title)} topicals</a><div class="licensed-side-scroll">${sidebar}</div></aside>
        <section class="topical-workspace">
          <header class="topical-header"><span class="eyebrow">${esc(item.group)} · ${esc(item.number)}</span><h1>${esc(item.title)}</h1><p>Genuine paper questions tagged to this topic in the supplied licensed index.</p><div class="topical-metrics"><div><strong>${item.questionCount}</strong><span>reported questions</span></div><div><strong>${esc(item.marksRange || '—')}</strong><span>usual marks per paper</span></div><div><strong>${item.frequency ? `${item.frequency[0]}/${item.frequency[1]}` : '—'}</strong><span>recent-paper frequency</span></div></div></header>
          <div class="topical-controls">
            <label>Year<select id="topic-year"><option value="all">All years</option>${years.map(year => `<option value="${year}">${year}</option>`).join('')}</select></label>
            <label>Marks<select id="topic-marks"><option value="all">All marks</option><option value="low">1–5</option><option value="mid">6–8</option><option value="high">9+</option></select></label>
            <label>Progress<select id="topic-progress"><option value="all">All questions</option><option value="todo">Not completed</option><option value="done">Completed</option></select></label>
            <label>Sort<select id="topic-sort"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="marks">Most marks</option></select></label>
            <button type="button" id="topic-add-visible">+ Add shown to PDF</button><a class="queue-link" href="#/question-pdf">Question PDF <strong data-pdf-count>${Object.keys(pdfPicks()).length}</strong></a>
          </div>
          <div class="topical-count" id="topical-count"></div><div class="topical-question-list" id="topical-results"></div>
        </section>
      </div>
    `, {title: `${item.title} topicals · ${subject.title}`, current: 'subjects'});
    bindTopical(subject, record, item, refs);
  }

  function bindTopical(subject, record, item, refs) {
    const controls = {
      year: document.getElementById('topic-year'), marks: document.getElementById('topic-marks'),
      progress: document.getElementById('topic-progress'), sort: document.getElementById('topic-sort')
    };
    const target = document.getElementById('topical-results');
    const count = document.getElementById('topical-count');
    const questionKey = row => `${subject.code}:${row.paper}:${row.number}`;
    const decorated = refs.map(ref => ({...ref, paperData: record.papers[ref.paper]})).filter(ref => ref.paperData);
    let visibleRows = decorated;
    const draw = () => {
      const done = questionDone();
      let rows = decorated.filter(row => {
        const markBand = row.marks <= 5 ? 'low' : row.marks <= 8 ? 'mid' : 'high';
        const isDone = !!done[questionKey(row)];
        return (controls.year.value === 'all' || String(row.paperData.year) === controls.year.value)
          && (controls.marks.value === 'all' || markBand === controls.marks.value)
          && (controls.progress.value === 'all' || (controls.progress.value === 'done' ? isDone : !isDone));
      });
      const sessionOrder = {w:3,s:2,m:1};
      rows.sort((a,b) => controls.sort.value === 'marks' ? b.marks - a.marks || b.paperData.year - a.paperData.year
        : controls.sort.value === 'oldest' ? a.paperData.year - b.paperData.year || (sessionOrder[a.paperData.sessionKey] || 0) - (sessionOrder[b.paperData.sessionKey] || 0)
        : b.paperData.year - a.paperData.year || (sessionOrder[b.paperData.sessionKey] || 0) - (sessionOrder[a.paperData.sessionKey] || 0) || Number(a.paperData.component) - Number(b.paperData.component));
      visibleRows = rows;
      count.innerHTML = `Showing <strong>${rows.length.toLocaleString()}</strong> of ${decorated.length.toLocaleString()} supplied question records`;
      const picks = pdfPicks();
      const pdfFull = Object.keys(picks).length >= MAX_PDF_PICKS;
      target.innerHTML = rows.map(row => {
        const key = questionKey(row);
        const doneState = !!done[key];
        const picked = !!picks[key];
        return `<article class="topical-question ${doneState ? 'done' : ''}"><a href="#/paper/${encodeURIComponent(subject.code)}/${encodeURIComponent(row.paper)}/${row.number}"><span>${esc(row.paperData.session)} ${row.paperData.year}</span><strong>Paper ${esc(row.paperData.component)} · Question ${row.number}</strong><small>${row.marks} marks${row.related?.length ? ` · Also ${row.related.map(esc).join(', ')}` : ''}</small></a><div><button type="button" data-question-done="${esc(key)}">${doneState ? '✓ Done' : 'Mark done'}</button><button type="button" class="${picked ? 'selected' : ''}" data-question-pdf="${esc(key)}" data-paper="${esc(row.paper)}" data-number="${row.number}" data-marks="${row.marks}" ${!picked && pdfFull ? 'disabled title="The PDF holds up to 50 questions"' : ''}>${picked ? '✓ In PDF' : '+ Add to PDF'}</button></div></article>`;
      }).join('') || '<div class="empty-state">No question matches these filters.</div>';
    };
    Object.values(controls).forEach(control => control.addEventListener('change', draw));
    document.getElementById('topic-add-visible')?.addEventListener('click', event => {
      const picks = pdfPicks();
      let added = 0;
      for (const row of visibleRows) {
        const key = questionKey(row);
        if (picks[key]) continue;
        if (Object.keys(picks).length >= MAX_PDF_PICKS) break;
        picks[key] = {code: subject.code, paper: row.paper, number: Number(row.number), marks: Number(row.marks), topic: item.slug, topicTitle: item.title, addedAt: Date.now()};
        added++;
      }
      store.set(PDF_PICKS_KEY, picks);
      updatePdfCount();
      const original = '+ Add shown to PDF';
      event.currentTarget.textContent = added ? `✓ Added ${added}` : Object.keys(picks).length >= MAX_PDF_PICKS ? 'PDF is full' : 'Already in PDF';
      setTimeout(() => { if (event.currentTarget) event.currentTarget.textContent = original; }, 1400);
      draw();
    });
    target.addEventListener('click', event => {
      const doneButton = event.target.closest('[data-question-done]');
      const pdfButton = event.target.closest('[data-question-pdf]');
      if (doneButton) {
        const state = questionDone();
        const key = doneButton.dataset.questionDone;
        state[key] = !state[key];
        if (!state[key]) delete state[key];
        store.set('skillpoint-question-done-v3', state);
        draw();
      }
      if (pdfButton) {
        const key = pdfButton.dataset.questionPdf;
        togglePdfPick(key, {code: subject.code, paper: pdfButton.dataset.paper, number: Number(pdfButton.dataset.number), marks: Number(pdfButton.dataset.marks), topic: item.slug, topicTitle: item.title});
        draw();
      }
    });
    draw();
  }

  function officialRows(subject) {
    return (CAMBRIDGE.codes?.[subject.code] || []).map(row => ({...row, source: 'official', sourceLabel: 'Cambridge official', sessionName: row.session, series: row.sessionKey, code: subject.code}));
  }

  function licensedPaperRows(subject) {
    const record = licensedFor(subject);
    return Object.values(record?.papers || {}).map(row => ({...row, source: 'licensed', sourceLabel: 'Detailed licensed index', sessionName: row.session, series: row.sessionKey, code: subject.code, detailHref: `#/paper/${encodeURIComponent(subject.code)}/${encodeURIComponent(row.id)}`}));
  }

  function historicalRows(subject) {
    if (!subject.paperCode) return [];
    return (PAPERS.codes?.[subject.paperCode] || []).map(row => ({...row, source: 'historical', sourceLabel: 'Verified historical mirror', sessionName: row.seriesName, series: row.series, code: subject.paperCode}));
  }

  function papersPage(id) {
    const subject = subjectById(id);
    if (!subject) return notFound();
    const inventories = {official: officialRows(subject), licensed: licensedPaperRows(subject), historical: historicalRows(subject)};
    const available = Object.entries(inventories).filter(([, rows]) => rows.length);
    const isSpecimenOnly = !available.length && subject.code === '0266';
    const defaultSource = inventories.official.length ? 'official' : inventories.licensed.length ? 'licensed' : 'historical';
    shell(`
      <section class="page-hero compact paper-hero"><a class="back-link" href="#/subject/${encodeURIComponent(subject.id)}/notes">← ${esc(subject.title)}</a><span class="eyebrow">Stage 03 · Past Papers</span><h1>${esc(subject.title)} · ${esc(subject.code)}</h1><p>${isSpecimenOnly ? 'This emerging syllabus has specimen papers but no completed past-paper series.' : 'Public Cambridge-hosted files are shown first. Switch source for the supplied detailed index or the broader verified historical bank.'}</p></section>
      ${subject.notice ? `<aside class="notice"><strong>Important syllabus warning</strong><p>${esc(subject.notice)}</p></aside>` : ''}
      ${subjectTabs(subject, 'papers')}
      ${isSpecimenOnly ? `<section class="paper-bank specimen-bank"><div class="paper-guidance"><h2>Official specimen material</h2><p>First assessment is in 2027.</p></div><div class="paper-list">${specimenPaperLinks()}</div></section>` : `<section class="paper-inventory modern-paper-bank">
        <div class="paper-source-cards">${available.map(([key, rows]) => `<button type="button" data-paper-source-card="${key}" class="${key === defaultSource ? 'active' : ''}"><span>${key === 'official' ? 'Cambridge-hosted' : key === 'licensed' ? 'Supplied detailed index' : 'Historical coverage'}</span><strong>${rows.length.toLocaleString()} paper rows</strong><small>${key === 'official' ? 'Public official selection' : key === 'licensed' ? 'Includes question-level details where supplied' : 'Verified direct-PDF mirror links'}</small></button>`).join('')}</div>
        <div class="paper-controls" aria-label="Paper filters"><label>Source<select id="paper-source">${available.map(([key, rows]) => `<option value="${key}" ${key === defaultSource ? 'selected' : ''}>${esc(rows[0].sourceLabel)}</option>`).join('')}</select></label><label>Year<select id="paper-year"><option value="all">All years</option></select></label><label>Session<select id="paper-series"><option value="all">All sessions</option><option value="m">March</option><option value="s">May / June</option><option value="w">October / November</option><option value="sp">Specimen</option></select></label><label>Component<select id="paper-component"><option value="all">All components</option></select></label><button type="button" id="paper-reset">Reset filters</button></div>
        <aside class="paper-metadata-note"><strong>Source policy</strong><p>“Cambridge official” contains only PDFs linked from public Cambridge subject pages (${Number(CAMBRIDGE.summary?.pdfLinks || 0).toLocaleString()} links indexed across the catalogue). It is a public selection, not Cambridge’s restricted School Support Hub. Complete exam PDFs are linked rather than bundled; indexed Mathematics question and mark-scheme crops are included locally.</p></aside><div id="paper-results" class="paper-results"></div>
      </section>`}
      <section class="source-strip"><div><span>Controlling syllabus</span><strong>${esc(sourceDescription(subject))}</strong></div><a href="${esc(subject.source.url)}" ${externalAttrs}>${esc(sourceLinkLabel(subject, true))}</a></section>
    `, {title: `${subject.title} Past Papers`, current: 'subjects'});
    if (!isSpecimenOnly) bindPaperInventory(inventories, defaultSource);
  }

  function specimenPaperLinks() {
    return `<article class="paper-item specimen"><div><span>2027 specimen</span><h3>Paper 1</h3><p>Official Cambridge specimen material</p></div><div><a href="https://www.cambridgeinternational.org/Images/718593-2027-specimen-paper-1.pdf" ${externalAttrs}>Open / download QP ↗</a><a href="https://www.cambridgeinternational.org/Images/718601-2027-specimen-paper-1-mark-scheme.pdf" ${externalAttrs}>Open / download MS ↗</a></div></article><article class="paper-item specimen"><div><span>2027 specimen</span><h3>Paper 2</h3><p>Official Cambridge specimen material</p></div><div><a href="https://www.cambridgeinternational.org/Images/718594-2027-specimen-paper-2.pdf" ${externalAttrs}>Open / download QP ↗</a><a href="https://www.cambridgeinternational.org/Images/718602-2027-specimen-paper-2-mark-scheme.pdf" ${externalAttrs}>Open / download MS ↗</a></div></article>`;
  }

  function bindPaperInventory(inventories, defaultSource) {
    const source = document.getElementById('paper-source');
    const year = document.getElementById('paper-year');
    const series = document.getElementById('paper-series');
    const component = document.getElementById('paper-component');
    const target = document.getElementById('paper-results');
    const rebuildOptions = () => {
      const rows = inventories[source.value] || [];
      const currentYear = year.value;
      const currentComponent = component.value;
      year.innerHTML = `<option value="all">All years</option>${[...new Set(rows.map(row => row.year))].sort((a,b)=>b-a).map(value => `<option value="${value}">${value}</option>`).join('')}`;
      component.innerHTML = `<option value="all">All components</option>${[...new Set(rows.map(row => row.component))].sort((a,b)=>Number(a)-Number(b)).map(value => `<option value="${esc(value)}">Paper ${esc(value)}</option>`).join('')}`;
      if ([...year.options].some(option => option.value === currentYear)) year.value = currentYear;
      if ([...component.options].some(option => option.value === currentComponent)) component.value = currentComponent;
    };
    const draw = () => {
      const sessionOrder = {w:3,s:2,m:1,sp:0};
      const rows = (inventories[source.value] || []).filter(row => (year.value === 'all' || String(row.year) === year.value) && (series.value === 'all' || row.series === series.value) && (component.value === 'all' || String(row.component) === component.value)).sort((a,b) => b.year-a.year || (sessionOrder[b.series] || 0)-(sessionOrder[a.series] || 0) || Number(a.component)-Number(b.component));
      const groups = new Map();
      rows.forEach(row => { const key=`${row.year}-${row.series}`; if(!groups.has(key)) groups.set(key,{year:row.year,name:row.sessionName,rows:[]}); groups.get(key).rows.push(row); });
      target.innerHTML = rows.length ? `<div class="paper-result-count">Showing <strong>${rows.length.toLocaleString()}</strong> paper rows from ${esc(rows[0].sourceLabel)}</div>${[...groups.values()].map(group => `<section class="paper-session-group"><header><div><span>${group.year}</span><h2>${esc(group.name)}</h2></div><small>${group.rows.length} paper${group.rows.length === 1 ? '' : 's'}</small></header><div class="paper-table">${group.rows.map(row => `<article class="paper-record"><span class="paper-code">${esc(row.code)}</span><strong>Paper ${esc(row.component)}</strong><span class="paper-kind">${row.sourceLabel}${row.questions?.length ? ` · ${row.questions.length} tagged questions` : ''}</span><div>${row.detailHref ? `<a class="paper-detail-link" href="${row.detailHref}">Open paper workspace</a>` : ''}${row.qp ? `<a href="${esc(row.qp)}" ${externalAttrs}>Open / download QP ↗</a>` : '<span class="paper-missing">QP not listed</span>'}${row.ms ? `<a href="${esc(row.ms)}" ${externalAttrs}>Open / download MS ↗</a>` : '<span class="paper-missing">MS not listed</span>'}</div></article>`).join('')}</div></section>`).join('')}` : '<div class="empty-state">No paper matches these filters.</div>';
    };
    source.addEventListener('change', () => { rebuildOptions(); draw(); document.querySelectorAll('[data-paper-source-card]').forEach(card => card.classList.toggle('active', card.dataset.paperSourceCard === source.value)); });
    [year, series, component].forEach(control => control.addEventListener('change', draw));
    document.querySelectorAll('[data-paper-source-card]').forEach(card => card.addEventListener('click', () => { source.value = card.dataset.paperSourceCard; source.dispatchEvent(new Event('change')); }));
    document.getElementById('paper-reset').addEventListener('click', () => { source.value = defaultSource; series.value = 'all'; rebuildOptions(); year.value='all'; component.value='all'; draw(); });
    rebuildOptions(); draw();
  }

  function preferredPaperLinks(code, paper) {
    const official = (CAMBRIDGE.codes?.[code] || []).find(row => !row.specimen && row.year === paper.year && row.sessionKey === paper.sessionKey && String(row.component) === String(paper.component));
    return {qp: official?.qp || paper.qp, ms: official?.ms || paper.ms, source: official ? 'Cambridge official' : 'Supplied licensed index'};
  }

  const questionImageRecord = key => QUESTION_IMAGES.items?.[key] || null;
  const questionAsset = (key, kind) => questionImageRecord(key)?.[kind] || '';

  function questionViewerMarkup(key, selected) {
    if (!selected) return `<div class="question-viewer-empty"><span>Select a question</span><h3>Choose a question from the map.</h3><p>The exact cropped exam question will appear here.</p></div>`;
    const image = questionAsset(key, 'question');
    const answer = questionAsset(key, 'answer');
    if (!image) return `<div class="question-viewer-empty"><span>Question image unavailable</span><h3>This crop was not included.</h3><p>Use the source-paper action above to open the complete paper.</p></div>`;
    return `<div class="question-viewer" data-question-viewer>
      <div class="question-view-tabs" role="tablist" aria-label="Question and mark scheme">
        <button type="button" class="active" role="tab" aria-selected="true" data-question-view="question">Question</button>
        ${answer ? '<button type="button" role="tab" aria-selected="false" data-question-view="answer">Mark scheme</button>' : ''}
      </div>
      <div class="question-sheet"><img src="${esc(image)}" alt="Exam question ${selected.number}" data-question-sheet="question"></div>
      ${answer ? `<div class="question-sheet" hidden><img src="${esc(answer)}" alt="Mark scheme for question ${selected.number}" data-question-sheet="answer"></div>` : ''}
    </div>`;
  }

  function bindQuestionViewer() {
    const viewer = document.querySelector('[data-question-viewer]');
    if (!viewer) return;
    viewer.querySelectorAll('[data-question-view]').forEach(button => button.addEventListener('click', () => {
      const view = button.dataset.questionView;
      viewer.querySelectorAll('[data-question-view]').forEach(candidate => {
        const active = candidate === button;
        candidate.classList.toggle('active', active);
        candidate.setAttribute('aria-selected', String(active));
      });
      viewer.querySelectorAll('[data-question-sheet]').forEach(image => { image.closest('.question-sheet').hidden = image.dataset.questionSheet !== view; });
    }));
  }

  function paperPage(code, paperId, selectedQuestion) {
    const subject = subjectByCode(code);
    const record = licensedFor(subject);
    const paper = record?.papers?.[paperId];
    if (!subject || !paper) return notFound();
    const links = preferredPaperLinks(code, paper);
    const questions = paper.questions || [];
    const picks = pdfPicks();
    const pdfFull = Object.keys(picks).length >= MAX_PDF_PICKS;
    const selected = questions.find(question => question.number === Number(selectedQuestion));
    const questionRows = questions.map(question => {
      const key = `${code}:${paperId}:${question.number}`;
      const picked = !!picks[key];
      const topicTitle = question.topicTitles?.length ? question.topicTitles.join(', ') : question.rawTopics || 'Topic not supplied';
      const pick = `<button type="button" class="paper-add-pdf ${picked ? 'selected' : ''}" data-paper-pdf="${esc(key)}" data-paper-id="${esc(paperId)}" data-question-number="${question.number}" data-marks="${question.marks}" data-topic-title="${esc(topicTitle)}" aria-pressed="${picked}" ${!picked && pdfFull ? 'disabled title="The PDF holds up to 50 questions"' : ''}>${picked ? '✓ In PDF' : '+ PDF'}</button>`;
      return `<div id="paper-question-${question.number}" class="paper-question-entry ${Number(selectedQuestion) === question.number ? 'selected' : ''}"><a class="paper-question-row" href="#/paper/${encodeURIComponent(code)}/${encodeURIComponent(paperId)}/${question.number}"><span>${question.number}</span><div><strong>${esc(topicTitle)}</strong><small>${question.marks} marks</small></div><b>→</b></a>${pick}</div>`;
    }).join('');
    const selectedKey = selected ? `${code}:${paperId}:${selected.number}` : '';
    const selectedTopic = selected ? (selected.topicTitles?.join(', ') || selected.rawTopics || 'Topic not supplied') : '';
    const selectedPicked = !!picks[selectedKey];
    shell(`
      <section class="paper-workspace-head"><a class="back-link" href="#/papers/${encodeURIComponent(subject.id)}">← ${esc(subject.title)} papers</a><span class="eyebrow">${esc(paper.session)} ${paper.year}</span><h1>${esc(subject.title)} ${code} · Paper ${esc(paper.component)}</h1><p>${questions.length ? `${questions.length} questions are tagged by topic and marks in the supplied index.` : 'This paper is indexed, but question-level tagging was not included.'}</p><div class="paper-source-badge">PDF source: <strong>${esc(links.source)}</strong></div></section>
      <div class="paper-workspace">
        <section class="paper-question-index"><header><span>Question map</span><h2>Questions in this paper</h2></header>${questions.length ? questionRows : '<div class="empty-state">No question map in the supplied package.</div>'}</section>
        <section class="pdf-workspace direct-paper-workspace"><header><div><span>${selected ? 'Exam content' : 'Paper files'}</span><h2>${selected ? `Question ${selected.number}` : `Paper ${esc(paper.component)}`}</h2></div><div class="pdf-actions">${links.qp ? `<a href="${esc(links.qp)}" ${externalAttrs}>Complete QP ↗</a>` : ''}${links.ms ? `<a href="${esc(links.ms)}" ${externalAttrs}>Complete MS ↗</a>` : ''}</div></header>${questionViewerMarkup(selectedKey, selected)}<div class="question-workspace-actions">${selected ? `<button type="button" class="paper-add-pdf large ${selectedPicked ? 'selected' : ''}" data-paper-pdf="${esc(selectedKey)}" data-paper-id="${esc(paperId)}" data-question-number="${selected.number}" data-marks="${selected.marks}" data-topic-title="${esc(selectedTopic)}" aria-pressed="${selectedPicked}" ${!selectedPicked && pdfFull ? 'disabled title="The PDF holds up to 50 questions"' : ''}>${selectedPicked ? '✓ Question is in your PDF' : '+ Add this question to PDF'}</button>` : ''}<a class="question-pdf-link" href="#/question-pdf">Open Question PDF builder <strong data-pdf-count>${Object.keys(picks).length}</strong> →</a></div></section>
      </div>
    `, {title: `${subject.title} Paper ${paper.component}`, current: 'subjects'});
    bindPaperPdfActions(subject, paper);
    bindQuestionViewer();
    if (selectedQuestion) setTimeout(() => document.getElementById(`paper-question-${Number(selectedQuestion)}`)?.scrollIntoView({block:'center'}), 30);
  }

  function bindPaperPdfActions(subject, paper) {
    const refresh = () => {
      const picks = pdfPicks();
      const full = Object.keys(picks).length >= MAX_PDF_PICKS;
      document.querySelectorAll('[data-paper-pdf]').forEach(button => {
        const picked = !!picks[button.dataset.paperPdf];
        button.classList.toggle('selected', picked);
        button.setAttribute('aria-pressed', String(picked));
        button.disabled = !picked && full;
        button.title = !picked && full ? 'The PDF holds up to 50 questions' : '';
        button.textContent = button.classList.contains('large') ? (picked ? '✓ Question is in your PDF' : '+ Add this question to PDF') : (picked ? '✓ In PDF' : '+ PDF');
      });
    };
    document.querySelectorAll('[data-paper-pdf]').forEach(button => button.addEventListener('click', () => {
      togglePdfPick(button.dataset.paperPdf, {code: subject.code, paper: button.dataset.paperId, number: Number(button.dataset.questionNumber), marks: Number(button.dataset.marks), topic: '', topicTitle: button.dataset.topicTitle});
      refresh();
    }));
  }

  function questionPdfRows() {
    return Object.entries(pdfPicks()).map(([key, item]) => {
      const subject = subjectByCode(item.code);
      const record = licensedFor(subject);
      const paper = record?.papers?.[item.paper];
      if (!paper || !subject) return null;
      const question = paper.questions?.find(candidate => candidate.number === Number(item.number));
      const links = preferredPaperLinks(item.code, paper);
      const images = questionImageRecord(key) || {};
      return {key, ...item, marks: question?.marks ?? item.marks ?? 0, topicTitle: item.topicTitle || question?.topicTitles?.join(', ') || question?.rawTopics || 'Topic not supplied', subject, paper, links, images};
    }).filter(Boolean);
  }

  function questionPdfPage() {
    const rows = questionPdfRows();
    const totalMarks = rows.reduce((sum, row) => sum + Number(row.marks || 0), 0);
    const sourcePapers = new Set(rows.map(row => `${row.code}:${row.paper}`)).size;
    shell(`<section class="page-hero compact pdf-builder-hero"><span class="eyebrow">Question PDF</span><h1>Build a printable question set.</h1><p>Pick questions from any Mathematics topical or paper workspace. The downloaded PDF contains the actual selected exam questions.</p><div class="pdf-builder-stats"><div><strong>${rows.length}</strong><span>picked questions</span></div><div><strong>${totalMarks}</strong><span>total marks</span></div><div><strong>${sourcePapers}</strong><span>source papers</span></div></div></section><section class="pdf-builder"><aside class="pdf-builder-note"><strong>Actual exam content included</strong><p>SkillPoint uses first-party, build-time crops of the licensed question papers, so the worksheet works without blocked frames or cross-origin fetching. If selected below, cropped mark schemes are appended after the questions.</p></aside>${rows.length ? `<div class="pdf-builder-actions"><div><label><input type="checkbox" id="pdf-workspace-lines" checked> Add ruled working space</label><label><input type="checkbox" id="pdf-answer-links" checked> Include mark schemes</label></div><button type="button" class="primary" data-download-question-pdf>Download question PDF</button><button type="button" data-clear-pdf>Clear picked</button></div><div id="pdf-pick-list" class="queue-page pdf-pick-list">${rows.map((row, index) => `<article class="queue-row pdf-pick-row"><span class="pdf-pick-order">${index + 1}</span><a href="#/paper/${encodeURIComponent(row.subject.code)}/${encodeURIComponent(row.paper.id)}/${row.number}"><span>${esc(row.subject.title)} · ${esc(row.paper.session)} ${row.paper.year}</span><strong>Paper ${esc(row.paper.component)} · Question ${row.number}</strong><small>${esc(row.topicTitle)} · ${row.marks} marks</small></a><div><span class="pdf-content-status">Question ✓${row.images.answer ? ' · MS ✓' : ''}</span><a href="${esc(row.links.qp)}" ${externalAttrs}>Complete QP ↗</a>${row.links.ms ? `<a href="${esc(row.links.ms)}" ${externalAttrs}>Complete MS ↗</a>` : ''}<button type="button" data-remove-pdf="${esc(row.key)}">Remove</button></div></article>`).join('')}</div>` : '<div class="resource-empty"><span>PDF empty</span><h2>Add questions from a topical or paper workspace.</h2><p>Use “Add to PDF” beside any supplied Mathematics question.</p><a class="primary" href="#/subject/as-a-level-mathematics-9709/topicals">Choose a Mathematics topical</a></div>'}</section>`, {title:'Question PDF', current:'pdf'});
    document.querySelector('[data-download-question-pdf]')?.addEventListener('click', event => downloadQuestionPdf(rows, {workspace: document.getElementById('pdf-workspace-lines').checked, answers: document.getElementById('pdf-answer-links').checked}, event.currentTarget));
    document.querySelector('[data-clear-pdf]')?.addEventListener('click', () => { store.set(PDF_PICKS_KEY, {}); questionPdfPage(); });
    document.getElementById('pdf-pick-list')?.addEventListener('click', event => { const button=event.target.closest('[data-remove-pdf]'); if(!button)return; const state=pdfPicks(); delete state[button.dataset.removePdf]; store.set(PDF_PICKS_KEY, state); questionPdfPage(); });
  }

  const pdfWinAnsi = {'·':183,'–':150,'—':151,'’':146,'‘':145,'“':147,'”':148,'©':169,'…':133};
  const pdfLiteral = value => {
    let output = '';
    for (const character of String(value)) {
      const point = character.charCodeAt(0);
      const byte = point >= 32 && point < 127 ? point : pdfWinAnsi[character] ?? 63;
      const printable = String.fromCharCode(byte);
      output += printable === '(' || printable === ')' || printable === '\\' ? `\\${printable}` : byte >= 127 ? `\\${byte.toString(8).padStart(3, '0')}` : printable;
    }
    return `(${output})`;
  };
  const pdfNumber = value => (Math.round(Number(value) * 100) / 100).toString();
  const pdfTextWidth = (value, size) => String(value).length * size * .52;

  class SkillPointPdf {
    constructor() { this.pages = []; this.images = []; }
    addImage(bytes, width, height) {
      this.images.push({bytes, width, height});
      return this.images.length - 1;
    }
    image(page, image, x, y, width, height) {
      this.pages[page].ops.push(`q ${pdfNumber(width)} 0 0 ${pdfNumber(height)} ${pdfNumber(x)} ${pdfNumber(y)} cm /Im${image + 1} Do Q`);
    }
    addPage() { this.pages.push({ops: [], links: []}); return this.pages.length - 1; }
    text(page, value, x, y, size, options = {}) {
      const colour = options.colour || (options.grey ? [.35,.35,.35] : [0,0,0]);
      this.pages[page].ops.push(`BT ${colour.map(pdfNumber).join(' ')} rg /${options.bold ? 'F2' : 'F1'} ${pdfNumber(size)} Tf ${pdfNumber(x)} ${pdfNumber(y)} Td ${pdfLiteral(value)} Tj ET`);
    }
    line(page, x1, y1, x2, y2, width = .5, grey = .78) {
      this.pages[page].ops.push(`q ${pdfNumber(grey)} G ${pdfNumber(width)} w ${pdfNumber(x1)} ${pdfNumber(y1)} m ${pdfNumber(x2)} ${pdfNumber(y2)} l S Q`);
    }
    link(page, rect, url) { this.pages[page].links.push({rect, url}); }
    save() {
      const encoder = new TextEncoder();
      const chunks = [];
      const offsets = [];
      let length = 0;
      const push = chunk => { const bytes = typeof chunk === 'string' ? encoder.encode(chunk) : chunk; chunks.push(bytes); length += bytes.length; };
      const object = (id, parts) => {
        offsets[id] = length;
        push(`${id} 0 obj\n`);
        (Array.isArray(parts) ? parts : [parts]).forEach(push);
        push('\nendobj\n');
      };
      push('%PDF-1.4\n%SkillPoint\n');
      const imageStart = 5;
      const pageStart = imageStart + this.images.length;
      object(1, '<< /Type /Catalog /Pages 2 0 R >>');
      object(2, `<< /Type /Pages /Count ${this.pages.length} /Kids [${this.pages.map((_, index) => `${pageStart + index * 2} 0 R`).join(' ')}] >>`);
      object(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
      object(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
      this.images.forEach((image, index) => object(imageStart + index, [encoder.encode(`<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>\nstream\n`), image.bytes, encoder.encode('\nendstream')]));
      const xObjects = this.images.length ? ` /XObject << ${this.images.map((_, index) => `/Im${index + 1} ${imageStart + index} 0 R`).join(' ')} >>` : '';
      this.pages.forEach((page, index) => {
        const pageId = pageStart + index * 2;
        const contentId = pageId + 1;
        const annotations = page.links.map(link => `<< /Type /Annot /Subtype /Link /Rect [${link.rect.map(pdfNumber).join(' ')}] /Border [0 0 0] /A << /S /URI /URI ${pdfLiteral(link.url)} >> >>`).join(' ');
        object(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 3 0 R /F2 4 0 R >>${xObjects} >> /Contents ${contentId} 0 R${annotations ? ` /Annots [${annotations}]` : ''} >>`);
        const stream = encoder.encode(page.ops.join('\n'));
        object(contentId, [encoder.encode(`<< /Length ${stream.length} >>\nstream\n`), stream, encoder.encode('\nendstream')]);
      });
      const objectCount = 4 + this.images.length + this.pages.length * 2;
      const xref = length;
      push(`xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`);
      for (let id = 1; id <= objectCount; id++) push(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
      push(`trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
      const result = new Uint8Array(length);
      let cursor = 0;
      for (const chunk of chunks) { result.set(chunk, cursor); cursor += chunk.length; }
      return result;
    }
  }

  function drawPdfWrapped(doc, page, text, x, y, size, maxWidth, options = {}) {
    const words = String(text).split(/\s+/);
    const lines = [];
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && pdfTextWidth(candidate, size) > maxWidth) { lines.push(line); line = word; }
      else line = candidate;
    }
    if (line) lines.push(line);
    lines.forEach((value, index) => doc.text(page, value, x, y - index * (size + 4), size, options));
    return y - lines.length * (size + 4);
  }

  function drawPdfLink(doc, page, label, url, x, y, size = 10) {
    doc.text(page, label, x, y, size, {bold: true, colour: [0,.38,.22]});
    const width = pdfTextWidth(label, size);
    doc.line(page, x, y - 2, x + width, y - 2, .5, .35);
    doc.link(page, [x, y - 3, x + width, y + size + 2], url);
    return width;
  }

  async function loadPdfImage(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Could not load question image (${response.status})`);
    const sourceBlob = await response.blob();
    const objectUrl = URL.createObjectURL(sourceBlob);
    const image = new Image();
    image.decoding = 'async';
    image.src = objectUrl;
    await image.decode();
    const maximumWidth = 1500;
    const scale = Math.min(1, maximumWidth / image.naturalWidth);
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', {alpha: false});
    context.fillStyle = '#fff';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    URL.revokeObjectURL(objectUrl);
    const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Could not encode question image')), 'image/jpeg', .86));
    return {bytes: new Uint8Array(await blob.arrayBuffer()), width, height};
  }

  async function downloadQuestionPdf(rows, options, button) {
    if (!rows.length) return;
    const original = button.textContent;
    button.disabled = true;
    button.textContent = 'Loading questions…';
    try {
      const required = [];
      rows.forEach(row => {
        if (!row.images.question) throw new Error(`Question image is unavailable for ${row.key}`);
        required.push(row.images.question);
        if (options.answers && row.images.answer) required.push(row.images.answer);
      });
      const unique = [...new Set(required)];
      const loaded = new Map();
      let complete = 0;
      const concurrency = 4;
      let cursor = 0;
      async function worker() {
        while (cursor < unique.length) {
          const url = unique[cursor++];
          const image = await loadPdfImage(url);
          loaded.set(url, image);
          complete += 1;
          button.textContent = `Loading ${complete} / ${unique.length}…`;
        }
      }
      await Promise.all(Array.from({length: Math.min(concurrency, unique.length)}, worker));
      button.textContent = 'Making PDF…';
      const doc = new SkillPointPdf();
      const imageIds = new Map();
      loaded.forEach((image, url) => imageIds.set(url, doc.addImage(image.bytes, image.width, image.height)));
      const codes = [...new Set(rows.map(row => row.code))];
      const drawImagePages = (row, index, kind, headingPrefix) => {
        const source = row.images[kind];
        if (!source) return;
        const image = loaded.get(source);
        let page = doc.addPage();
        doc.text(page, 'SkillPoint', 40, 808, 9, {bold: true, colour: [0,.45,.25]});
        const heading = `${headingPrefix} ${index + 1} of ${rows.length} · ${row.paper.session} ${row.paper.year} · Paper ${row.paper.component} · Q${row.number}`;
        doc.text(page, heading, 40, 785, 10, {bold: true});
        const availableWidth = 515;
        const availableHeight = kind === 'question' && options.workspace ? 505 : 710;
        const scale = Math.min(availableWidth / image.width, availableHeight / image.height);
        const width = image.width * scale;
        const height = image.height * scale;
        const x = 40 + (availableWidth - width) / 2;
        const top = 760;
        const y = top - height;
        doc.image(page, imageIds.get(source), x, y, width, height);
        if (kind === 'question' && options.workspace) {
          let lineY = y - 22;
          while (lineY > 48) {
            doc.line(page, 40, lineY, 555, lineY, .45, .82);
            lineY -= 25;
          }
        }
      };
      rows.forEach((row, index) => drawImagePages(row, index, 'question', 'Question'));
      if (options.answers) rows.forEach((row, index) => drawImagePages(row, index, 'answer', 'Mark scheme'));
      const bytes = doc.save();
      const url = URL.createObjectURL(new Blob([bytes], {type: 'application/pdf'}));
      const anchor = document.createElement('a');
      const codeLabel = codes.length === 1 ? codes[0] : 'mixed';
      anchor.href = url;
      anchor.download = `skillpoint-${codeLabel}-${rows.length}-questions.pdf`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (error) {
      console.error(error);
      alert(`SkillPoint could not create this PDF: ${error.message}`);
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  }

  function syllabusPage(id) {
    const subject = subjectById(id);
    if (!subject) return notFound();
    shell(`<section class="subject-hero"><a class="back-link" href="#/subject/${encodeURIComponent(subject.id)}/notes">← ${esc(subject.title)}</a><span class="eyebrow">Official scope check</span><h1>${esc(subject.title)} syllabus outline</h1><p>This is an extracted outline of ${esc(sourceDescription(subject))}; it is not presented as a replacement note.</p><div class="subject-actions"><a class="primary" href="${esc(subject.source.url)}" ${externalAttrs}>${esc(sourceLinkLabel(subject, true))}</a></div></section>${subjectTabs(subject,'syllabus')}<section class="chapter-hub"><div class="section-heading"><span>Syllabus order</span><h2>${subject.chapters.length} chapters</h2></div><div class="chapter-list">${subject.chapters.map(chapter => `<a class="chapter-row" href="#/chapter/${encodeURIComponent(subject.id)}/${encodeURIComponent(chapter.id)}"><span class="chapter-number">${esc(chapter.number)}</span><div><h3>${esc(chapter.title)}</h3><p>${chapter.sections.map(section=>esc(section.title)).slice(0,4).join(' · ')}${chapter.sections.length>4?' · …':''}</p></div><small>${chapter.sections.length} sections</small><b>→</b></a>`).join('')}</div></section>`, {title:`${subject.title} syllabus`,current:'subjects'});
  }

  function chapterPage(subjectId, chapterId) {
    const subject = subjectById(subjectId);
    const chapter = subject?.chapters.find(item => item.id === chapterId);
    if (!subject || !chapter) return notFound();
    const key = `${subject.id}:${chapter.id}`;
    const state = completedNotes();
    shell(`<article class="syllabus-sheet"><header><a class="back-link" href="#/syllabus/${encodeURIComponent(subject.id)}">← ${esc(subject.title)} syllabus outline</a><span class="eyebrow">Official syllabus topic ${esc(chapter.number)}</span><h1>${esc(chapter.title)}</h1><p>This page records the official scope only. Use licensed notes from the Notes tab where available.</p><div class="reader-actions"><button type="button" data-syllabus-complete class="${state[`syllabus:${key}`] ? 'selected' : ''}">${state[`syllabus:${key}`] ? '✓ Scope reviewed' : 'Mark scope reviewed'}</button><a href="${esc(subject.source.url)}" ${externalAttrs}>${esc(sourceLinkLabel(subject))}</a></div></header><section><span>Included sections</span><ol>${chapter.sections.map(section => `<li><b>${esc(section.number)}</b><strong>${esc(section.title)}</strong></li>`).join('')}</ol></section><div class="note-next-stage"><span>Study route</span><h2>Return to notes, topicals or papers.</h2><div class="hero-actions"><a class="primary" href="#/subject/${encodeURIComponent(subject.id)}/notes">Notes</a><a class="secondary" href="#/subject/${encodeURIComponent(subject.id)}/topicals">Topicals</a><a class="secondary" href="#/papers/${encodeURIComponent(subject.id)}">Past papers</a></div></div></article>`, {title:`${chapter.title} scope`,current:'subjects'});
    document.querySelector('[data-syllabus-complete]')?.addEventListener('click', event => { const current=completedNotes(); const itemKey=`syllabus:${key}`; current[itemKey]=!current[itemKey]; if(!current[itemKey])delete current[itemKey]; store.set('skillpoint-note-complete-v3',current); event.currentTarget.classList.toggle('selected',!!current[itemKey]); event.currentTarget.textContent=current[itemKey]?'✓ Scope reviewed':'Mark scope reviewed'; });
  }

  function activateToc(ids) {
    const links = [...document.querySelectorAll('[data-toc]')];
    const sections = ids.map(id => document.getElementById(id)).filter(Boolean);
    if (!links.length || !sections.length) return;
    links.forEach(link => link.addEventListener('click', () => document.getElementById(link.dataset.toc)?.scrollIntoView({behavior:'smooth', block:'start'})));
    const update = () => {
      const marker = Math.max(140, innerHeight * 0.28);
      let active = sections[0].id;
      sections.forEach(section => { if (section.getBoundingClientRect().top <= marker) active = section.id; });
      links.forEach(link => link.classList.toggle('active', link.dataset.toc === active));
    };
    addEventListener('scroll', update, {passive:true});
    tocCleanup = () => removeEventListener('scroll', update);
    update();
  }

  function timerModal() {
    return `<div class="modal" id="timer-modal" hidden><div class="modal-backdrop" data-close-timer></div><section class="modal-card timer-card" role="dialog" aria-modal="true" aria-labelledby="timer-title"><button class="modal-close" data-close-timer aria-label="Close">×</button><span class="eyebrow">Custom study session</span><h2 id="timer-title">Focus timer</h2><p>Enter your own duration in minutes.</p><div class="timer-display" data-timer-display aria-live="polite">00:00</div><label class="timer-input"><span>Minutes</span><input id="timer-minutes" type="number" min="1" max="720" step="1" placeholder="Enter minutes"></label><p class="timer-message" data-timer-message></p><div class="timer-controls"><button class="primary" data-timer-start>Set and start</button><button class="secondary" data-timer-pause disabled>Pause</button><button class="text-button" data-timer-reset>Reset</button></div></section></div>`;
  }

  function searchModal() {
    return `<div class="modal" id="search-modal" hidden><div class="modal-backdrop" data-close-search></div><section class="modal-card search-card" role="dialog" aria-modal="true" aria-labelledby="search-title"><button class="modal-close" data-close-search aria-label="Close">×</button><span class="eyebrow">Site search</span><h2 id="search-title">Find a subject, note or topical</h2><input id="global-search" type="search" placeholder="Try trigonometry or 9709" autocomplete="off"><div id="search-results" class="search-results"><p>Type at least two characters.</p></div></section></div>`;
  }

  let timer = {remaining:0,total:0,running:false,interval:null};
  function bindGlobal() {
    document.querySelectorAll('[data-open-timer]').forEach(button => button.addEventListener('click', openTimer));
    document.querySelectorAll('[data-close-timer]').forEach(button => button.addEventListener('click', closeTimer));
    document.querySelectorAll('[data-open-search]').forEach(button => button.addEventListener('click', openSearch));
    document.querySelectorAll('[data-close-search]').forEach(button => button.addEventListener('click', closeSearch));
    document.querySelector('[data-timer-start]')?.addEventListener('click', startTimer);
    document.querySelector('[data-timer-pause]')?.addEventListener('click', pauseTimer);
    document.querySelector('[data-timer-reset]')?.addEventListener('click', resetTimer);
    document.getElementById('global-search')?.addEventListener('input', drawSearch);
    updateTimerUI();
  }

  function openTimer(){const modal=document.getElementById('timer-modal');if(!modal)return;modal.hidden=false;document.body.classList.add('modal-open');setTimeout(()=>document.getElementById('timer-minutes')?.focus(),20);}
  function closeTimer(){const modal=document.getElementById('timer-modal');if(modal)modal.hidden=true;document.body.classList.remove('modal-open');}
  function startTimer(){const input=document.getElementById('timer-minutes');const message=document.querySelector('[data-timer-message]');if(!timer.remaining){const minutes=Number(input?.value);if(!Number.isInteger(minutes)||minutes<1||minutes>720){if(message)message.textContent='Enter a whole number from 1 to 720.';return;}timer.total=timer.remaining=minutes*60;}if(message)message.textContent='';clearInterval(timer.interval);timer.running=true;timer.interval=setInterval(()=>{timer.remaining=Math.max(0,timer.remaining-1);if(!timer.remaining){clearInterval(timer.interval);timer.running=false;document.querySelector('[data-timer-message]')?.replaceChildren(document.createTextNode('Session complete.'));try{navigator.vibrate?.([180,80,180]);}catch(_){}}updateTimerUI();},1000);updateTimerUI();}
  function pauseTimer(){clearInterval(timer.interval);timer.running=false;updateTimerUI();}
  function resetTimer(){clearInterval(timer.interval);timer={remaining:0,total:0,running:false,interval:null};const input=document.getElementById('timer-minutes');if(input)input.value='';const message=document.querySelector('[data-timer-message]');if(message)message.textContent='';updateTimerUI();}
  function updateTimerUI(){const minutes=Math.floor(timer.remaining/60);const seconds=timer.remaining%60;const text=`${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;document.querySelectorAll('[data-timer-display]').forEach(el=>el.textContent=text);document.querySelectorAll('[data-timer-mini]').forEach(el=>el.textContent=timer.remaining?text:'Focus timer');document.querySelectorAll('[data-timer-pause]').forEach(button=>button.disabled=!timer.running);document.querySelectorAll('[data-timer-start]').forEach(button=>{button.textContent=timer.remaining&&!timer.running?'Resume':timer.running?'Running':'Set and start';button.disabled=timer.running;});}
  function openSearch(){const modal=document.getElementById('search-modal');if(!modal)return;modal.hidden=false;document.body.classList.add('modal-open');setTimeout(()=>document.getElementById('global-search')?.focus(),20);}
  function closeSearch(){const modal=document.getElementById('search-modal');if(modal)modal.hidden=true;document.body.classList.remove('modal-open');}

  function drawSearch(event) {
    const q = event.target.value.trim().toLowerCase();
    const target = document.getElementById('search-results');
    if (q.length < 2) { target.innerHTML='<p>Type at least two characters.</p>'; return; }
    const rows=[];
    DATA.subjects.forEach(subject => {
      if(`${subject.title} ${subject.code} ${subject.category}`.toLowerCase().includes(q)) rows.push({type:'Subject',title:subject.title,meta:`${subject.category} · ${subject.code}`,href:`#/subject/${subject.id}/notes`});
      const record=licensedFor(subject);
      if(record?.formulaSheet&&`formulas definitions reference ${subject.title}`.toLowerCase().includes(q))rows.push({type:'Reference',title:'Formulas and definitions',meta:`${subject.title} · ${record.formulaSheet.stats.formulas} entries`,href:`#/formula/${subject.code}`});
      noteItems(record).forEach(item=>{if(record?.noteBodies?.[item.slug]&&`${item.title} ${item.group}`.toLowerCase().includes(q))rows.push({type:'Note',title:item.title,meta:`${subject.title} · ${item.number}`,href:`#/note/${subject.code}/${item.slug}`});});
      topicItems(record).forEach(item=>{if(record?.topicQuestions?.[item.slug]?.length&&`${item.title} ${item.group}`.toLowerCase().includes(q))rows.push({type:'Topical',title:item.title,meta:`${subject.title} · ${item.questionCount} questions`,href:`#/topical/${subject.code}/${item.slug}`});});
      subject.chapters.forEach(chapter=>{if(`${chapter.title} ${chapter.number}`.toLowerCase().includes(q))rows.push({type:'Syllabus',title:chapter.title,meta:`${subject.title} · ${chapter.number}`,href:`#/chapter/${subject.id}/${chapter.id}`});});
    });
    target.innerHTML=rows.length?rows.slice(0,24).map(row=>`<a href="${esc(row.href)}" onclick="document.getElementById('search-modal').hidden=true"><span>${esc(row.type)}</span><strong>${esc(row.title)}</strong><small>${esc(row.meta)}</small></a>`).join(''):'<p>No matching resource.</p>';
  }

  function notFound(){shell('<section class="not-found"><span>404</span><h1>That study route does not exist.</h1><a class="primary" href="#/subjects">Return to subjects</a></section>',{title:'Not found'});}

  function route() {
    clearTimeout(scrollResetTimer);
    document.documentElement.style.scrollBehavior = 'auto';
    window.scrollTo(0,0);
    scrollResetTimer = setTimeout(() => { document.documentElement.style.scrollBehavior = ''; }, 250);
    const raw=location.hash.replace(/^#\/?/,'');
    const path=raw.split('?')[0];
    const parts=path.split('/').filter(Boolean).map(decodeURIComponent);
    if(!parts.length)return homePage();
    if(parts[0]==='subjects')return subjectsPage();
    if(parts[0]==='subject'&&parts[1])return subjectPage(parts[1],parts[2]||'notes');
    if(parts[0]==='note'&&parts[1]&&parts[2])return notePage(parts[1],parts[2]);
    if(parts[0]==='formula'&&parts[1])return formulaPage(parts[1]);
    if(parts[0]==='topical'&&parts[1]&&parts[2])return topicalPage(parts[1],parts[2]);
    if(parts[0]==='papers'&&parts[1])return papersPage(parts[1]);
    if(parts[0]==='paper'&&parts[1]&&parts[2])return paperPage(parts[1],parts[2],parts[3]);
    if(parts[0]==='question-pdf'||parts[0]==='practice-queue')return questionPdfPage();
    if(parts[0]==='syllabus'&&parts[1])return syllabusPage(parts[1]);
    if(parts[0]==='chapter'&&parts[1]&&parts[2])return chapterPage(parts[1],parts[2]);
    return notFound();
  }

  addEventListener('hashchange',route);
  route();
})();
