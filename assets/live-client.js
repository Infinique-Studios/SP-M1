(() => {
  'use strict';

  const config = window.SKILLPOINT_LIVE_CONFIG || {};
  const scriptUrl = document.currentScript?.src || new URL('./assets/live-client.js', location.href).href;
  const assetRoot = new URL('./', scriptUrl);
  const topicCache = new Map();
  const paperCache = new Map();
  const detailCache = new Map();
  const noteCache = new Map();
  const pdfCache = new Map();
  const renderedCache = new Map();

  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = window.SKILLPOINT_PDF_WORKER_URL || new URL('pdf.worker.min.js', assetRoot).href;
  }

  const configured = () => !!config.enabled && /^https:\/\//.test(config.proxyBase || '') && !/YOUR-SUBDOMAIN/.test(config.proxyBase || '');
  const base = () => String(config.proxyBase || '').replace(/\/$/, '');
  const proxyUrl = path => `${base()}${path.startsWith('/') ? path : `/${path}`}`;
  const apiUrl = (path, query = {}) => {
    const url = new URL(proxyUrl(path));
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
    });
    return url.href;
  };

  async function request(url, type = 'json') {
    if (!configured()) throw new Error('Live content proxy is not configured. Set proxyBase in assets/live-config.js.');
    const response = await fetch(url, {credentials: 'omit'});
    if (!response.ok) throw new Error(`Live content request failed (${response.status})`);
    return type === 'text' ? response.text() : response.json();
  }

  async function fetchTopic(subjectSlug, topicSlug, onProgress) {
    const key = `${subjectSlug}:${topicSlug}`;
    if (topicCache.has(key)) return topicCache.get(key);
    const promise = (async () => {
      const query = {c: 'cambridge', s: subjectSlug, topic: topicSlug, page: 1};
      const first = await request(apiUrl('/api/questions', query));
      const items = [...(first.items || [])];
      const pageSize = Math.max(1, first.items?.length || 25);
      const pages = Math.ceil(Number(first.total || items.length) / pageSize);
      onProgress?.(items.length, Number(first.total || items.length));
      for (let start = 2; start <= pages; start += 6) {
        const batch = [];
        for (let page = start; page < Math.min(start + 6, pages + 1); page++) {
          batch.push(request(apiUrl('/api/questions', {...query, page})));
        }
        const results = await Promise.all(batch);
        results.forEach(result => items.push(...(result.items || [])));
        onProgress?.(Math.min(items.length, Number(first.total || items.length)), Number(first.total || items.length));
      }
      return {total: Number(first.total || items.length), items};
    })();
    topicCache.set(key, promise);
    try { return await promise; }
    catch (error) { topicCache.delete(key); throw error; }
  }

  async function fetchPaper(subjectSlug, year, session, component, onProgress) {
    const code = String(component || '');
    const paper = code.charAt(0);
    const variant = code.slice(1);
    const key = `${subjectSlug}:${year}:${session}:${code}`;
    if (paperCache.has(key)) return paperCache.get(key);
    const promise = (async () => {
      const query = {c: 'cambridge', s: subjectSlug, year, session, paper, variant, page: 1};
      const first = await request(apiUrl('/api/questions', query));
      const items = [...(first.items || [])];
      const pageSize = Math.max(1, first.items?.length || 25);
      const pages = Math.ceil(Number(first.total || items.length) / pageSize);
      onProgress?.(items.length, Number(first.total || items.length));
      for (let start = 2; start <= pages; start += 6) {
        const batch = [];
        for (let pageNumber = start; pageNumber < Math.min(start + 6, pages + 1); pageNumber++) {
          batch.push(request(apiUrl('/api/questions', {...query, page: pageNumber})));
        }
        const results = await Promise.all(batch);
        results.forEach(result => items.push(...(result.items || [])));
        onProgress?.(Math.min(items.length, Number(first.total || items.length)), Number(first.total || items.length));
      }
      return {total: Number(first.total || items.length), items};
    })();
    paperCache.set(key, promise);
    try { return await promise; }
    catch (error) { paperCache.delete(key); throw error; }
  }

  async function fetchDetail(subjectSlug, id) {
    const key = `${subjectSlug}:${id}`;
    if (detailCache.has(key)) return detailCache.get(key);
    const promise = request(apiUrl(`/api/questions/${encodeURIComponent(id)}`, {c: 'cambridge', s: subjectSlug}));
    detailCache.set(key, promise);
    try { return await promise; }
    catch (error) { detailCache.delete(key); throw error; }
  }

  async function fetchNote(subjectSlug, noteSlug) {
    const key = `${subjectSlug}:${noteSlug}`;
    if (noteCache.has(key)) return noteCache.get(key);
    const promise = request(proxyUrl(`/cambridge/${encodeURIComponent(subjectSlug)}/notes/${encodeURIComponent(noteSlug)}`), 'text');
    noteCache.set(key, promise);
    try { return await promise; }
    catch (error) { noteCache.delete(key); throw error; }
  }

  function sourceUrl(value) {
    const source = new URL(value);
    if (source.hostname !== 'files.pastopic.com') throw new Error('Unexpected live document host');
    return proxyUrl(`/source${source.pathname}${source.search}`);
  }

  async function pdfDocument(url) {
    if (!window.pdfjsLib) throw new Error('The bundled PDF renderer did not load.');
    const proxied = sourceUrl(url);
    if (!pdfCache.has(proxied)) {
      const promise = (async () => {
        // Download each source PDF in one cacheable request. Passing a URL to
        // PDF.js can create many byte-range requests, each of which counts as a
        // Worker invocation. The full response is cached by both the browser
        // and Cloudflare, then parsed locally by PDF.js.
        const response = await fetch(proxied, {credentials: 'omit', cache: 'force-cache'});
        if (!response.ok) throw new Error(`Source PDF request failed (${response.status})`);
        const data = new Uint8Array(await response.arrayBuffer());
        return window.pdfjsLib.getDocument({data}).promise;
      })();
      pdfCache.set(proxied, promise);
    }
    try { return await pdfCache.get(proxied); }
    catch (error) { pdfCache.delete(proxied); throw error; }
  }

  async function renderPageCrop(pdf, pageNumber, top, bottom) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({scale: Number(config.renderScale || 2)});
    const full = document.createElement('canvas');
    full.width = Math.ceil(viewport.width);
    full.height = Math.ceil(viewport.height);
    const context = full.getContext('2d', {alpha: false});
    context.fillStyle = '#fff';
    context.fillRect(0, 0, full.width, full.height);
    await page.render({canvasContext: context, viewport, background: '#fff'}).promise;
    const y = Math.max(0, Math.floor(full.height * top));
    const height = Math.max(1, Math.min(full.height - y, Math.ceil(full.height * (bottom - top))));
    const crop = document.createElement('canvas');
    crop.width = full.width;
    crop.height = height;
    const cropContext = crop.getContext('2d', {alpha: false});
    cropContext.fillStyle = '#fff';
    cropContext.fillRect(0, 0, crop.width, crop.height);
    cropContext.drawImage(full, 0, y, full.width, height, 0, 0, full.width, height);
    page.cleanup();
    return crop;
  }

  async function renderDocument(source) {
    if (!source?.url || !source?.region) return null;
    const pdf = await pdfDocument(source.url);
    const region = source.region;
    const first = Number(region.page);
    const last = Number(region.endPage || region.page);
    const pieces = [];
    for (let page = first; page <= last; page++) {
      pieces.push(await renderPageCrop(
        pdf,
        page,
        page === first ? Number(region.top || 0) : 0,
        page === last ? Number(region.bottom || 1) : 1
      ));
    }
    if (pieces.length === 1) return pieces[0];
    const gap = 12;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(...pieces.map(piece => piece.width));
    canvas.height = pieces.reduce((sum, piece) => sum + piece.height, 0) + gap * (pieces.length - 1);
    const context = canvas.getContext('2d', {alpha: false});
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    let y = 0;
    pieces.forEach(piece => { context.drawImage(piece, 0, y); y += piece.height + gap; });
    return canvas;
  }

  const canvasBlob = canvas => new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not encode rendered question')), 'image/png'));

  async function directImage(value) {
    if (!value) return null;
    const response = await fetch(sourceUrl(value), {credentials: 'omit'});
    if (!response.ok) throw new Error(`Live image request failed (${response.status})`);
    return URL.createObjectURL(await response.blob());
  }

  async function renderAsset(detail, kind) {
    if (!['question', 'answer'].includes(kind)) throw new Error('Unknown question asset kind');
    const key = `${detail.id}:${kind}`;
    if (renderedCache.has(key)) return renderedCache.get(key);
    const promise = (async () => {
      const source = kind === 'question' ? detail.qp : detail.ms;
      const fallback = kind === 'question' ? detail.images?.question : detail.images?.answer;
      const canvas = source ? await renderDocument(source) : null;
      return {
        url: canvas ? URL.createObjectURL(await canvasBlob(canvas)) : await directImage(fallback),
        size: canvas ? [canvas.width, canvas.height] : null
      };
    })();
    renderedCache.set(key, promise);
    try { return await promise; }
    catch (error) { renderedCache.delete(key); throw error; }
  }

  async function renderAssets(detail) {
    const [questionResult, answerResult] = await Promise.allSettled([
      renderAsset(detail, 'question'),
      renderAsset(detail, 'answer')
    ]);
    if (questionResult.status === 'rejected') throw questionResult.reason;
    const question = questionResult.value;
    const answer = answerResult.status === 'fulfilled' ? answerResult.value : {url: null, size: null};
    return {
      question: question.url,
      answer: answer.url,
      questionSize: question.size,
      answerSize: answer.size,
      answerError: answerResult.status === 'rejected' ? answerResult.reason?.message || 'Mark scheme rendering failed' : ''
    };
  }

  window.SKILLPOINT_LIVE = {
    config,
    configured,
    proxyUrl,
    fetchTopic,
    fetchPaper,
    fetchDetail,
    fetchNote,
    sourceUrl,
    renderDocument,
    renderAsset,
    renderAssets
  };
})();
