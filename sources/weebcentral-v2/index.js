const MODULE_NAME = 'WeebCentralV4113';
const BASE_URL = 'https://weebcentral.com';
const FALLBACK_API = 'https://one.synthetiq.uk/manga';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';
const IN_FLIGHT = new Map();

function log(message) {
  console.log('[' + MODULE_NAME + '] ' + message);
}

function sleep(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

function isCloudflareChallenge(response) {
  const status = Number((response && response.status) || 0);
  if (status !== 403 && status !== 429 && status !== 503) return false;
  const body = String((response && response.body) || '').toLowerCase();
  if (
    body.indexOf('cf-chl-') !== -1 ||
    body.indexOf('challenge-platform') !== -1 ||
    body.indexOf('cf-browser-verification') !== -1
  ) {
    return true;
  }
  if (
    body.indexOf('<title>just a moment') !== -1 ||
    body.indexOf('attention required! | cloudflare') !== -1
  ) {
    return true;
  }
  return body.length > 0 &&
    body.length < 250000 &&
    (body.indexOf('cloudflare') !== -1 || body.indexOf('challenge') !== -1);
}

function toAbsoluteUrl(url) {
  const value = String(url || '').trim();
  if (!value) return '';
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  if (value.startsWith('//')) return 'https:' + value;
  if (value.startsWith('/')) return BASE_URL + value;
  return BASE_URL + '/' + value;
}

function decodeHtmlEntities(text) {
  return String(text || '')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x27;/g, "'");
}

function stripHtml(html) {
  return decodeHtmlEntities(String(html || ''))
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDetailListItem(html, labelPattern) {
  const re = new RegExp('<li[^>]*>\\s*<strong>\\s*' + labelPattern + '\\s*:\\s*<\\/strong>([\\s\\S]*?)<\\/li>', 'i');
  const block = (String(html || '').match(re) || [])[1] || '';
  if (!block) return [];
  const values = [];
  const linkRe = /<a[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = linkRe.exec(block)) !== null) {
    const value = stripHtml(match[1]).replace(/,+$/g, '').trim();
    if (value && !values.includes(value)) values.push(value);
  }
  if (values.length) return values;
  const fallback = stripHtml(block).replace(/,+$/g, '').trim();
  return fallback ? [fallback] : [];
}

function parseSimpleDetailValue(html, labelPattern) {
  const values = parseDetailListItem(html, labelPattern);
  return values.length ? values[0] : '';
}

function parseChapterTitleFromAnchor(rawInner) {
  const raw = String(rawInner || '');
  const preferred =
    (raw.match(/<span[^>]*class=""[^>]*>([\s\S]*?Chapter[\s\S]*?)<\/span>/i) || [])[1] ||
    (raw.match(/<span[^>]*>(\s*Chapter\s*\d+(?:\.\d+)?[\s\S]*?)<\/span>/i) || [])[1] ||
    (raw.match(/>\s*(Chapter\s*\d+(?:\.\d+)?[^<]*)</i) || [])[1] ||
    '';
  return stripHtml(preferred || raw);
}

function cleanChapterTitle(raw, chapterNumber) {
  let title = stripHtml(raw)
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?/g, ' ')
    .replace(/\bLast Read\b[\s\S]*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  const fallback = chapterNumber != null ? 'Chapter ' + chapterNumber : 'Chapter';
  if (!title) return fallback;
  const chapterMatch = title.match(/(?:Chapter|Chap|Ch\.?|Act)\s*\d+(?:\.\d+)?(?:\s*[-:–—]\s*[^|]{1,120})?/i);
  if (chapterMatch) return chapterMatch[0].trim();
  if (/fill:|stroke:|font-family|viewBox|xmlns|M\d/i.test(title) || title.length > 140) {
    return fallback;
  }
  return title;
}

function parseChapterNumber(title) {
  // Preserve the source label while recognizing its chapter-like sequence.
  const match = String(title || '').match(
    /\b(?:chapter|chap|ch\.?|act|episode|ep\.?|collar)\s*[:#-]?\s*(\d+(?:\.\d+)?)|(?:^|\s)#\s*(\d+(?:\.\d+)?)/i
  );
  return match ? parseFloat(match[1] || match[2]) : null;
}


async function requestOnce(url, opts) {
  const options = opts || {};
  const method = options.method || 'GET';
  const headers = options.headers || {
    'User-Agent': USER_AGENT,
    Accept: '*/*',
    Referer: BASE_URL + '/',
  };
  const body = options.body == null ? null : options.body;
  const fetchOptions =
    options.fetchOptions && typeof options.fetchOptions === 'object'
      ? options.fetchOptions
      : {};

  try {
    if (typeof fetchv2 === 'function') {
      const res = await fetchv2(url, headers, method, body, fetchOptions);
      const text =
        typeof res.text === 'function'
          ? await res.text()
          : typeof res.body === 'string'
            ? res.body
            : '';
      return {
        ok: !!(res && res.ok === true),
        status: (res && res.status) || 0,
        body: text,
        bodyDropped: !!(res && res.bodyDropped),
        dropReason: res && res.dropReason ? String(res.dropReason) : '',
        bodyBytes: (res && res.bodyBytes) || 0,
        error: (res && res.ok === true) ? '' : 'HTTP ' + ((res && res.status) || 0),
      };
    }
    if (typeof fetch === 'function') {
      const res = await fetch(url, { method, headers, body });
      return {
        ok: res.ok,
        status: res.status || 0,
        body: await res.text(),
        error: res.ok ? '' : 'HTTP ' + (res.status || 0),
      };
    }
    return { ok: false, status: 0, body: '', error: 'No fetch bridge' };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      body: '',
      error: (err && err.message) ? err.message : String(err),
    };
  }
}

async function request(url, opts) {
  const options = opts || {};
  const retry429 = options.retry429 !== false;
  const delays = retry429 ? [0, 900, 1800] : [0];
  let response = null;
  for (let attempt = 0; attempt < delays.length; attempt += 1) {
    if (delays[attempt] > 0) await sleep(delays[attempt]);
    response = await requestOnce(url, options);
    if (!response || ![0, 429, 502, 503, 504].includes(response.status)) return response;
    log('source temporarily unavailable; retrying request attempt=' + String(attempt + 1));
  }
  return response || { ok: false, status: 0, body: '', error: 'Request failed' };
}

async function fallbackApi(path) {
  const response = await request(FALLBACK_API + path, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json, text/plain, */*',
      Referer: BASE_URL + '/',
    },
    retry429: true,
  });
  if (!response.ok || !response.body) {
    throw new Error(
      'Cached reader service failed: HTTP ' + (response.status || 0),
    );
  }
  try {
    return JSON.parse(response.body);
  } catch (_) {
    throw new Error('Cached reader service returned an invalid response.');
  }
}

function mapFallbackCard(item) {
  const href = String((item && (item.href || item.id || item.seriesId)) || '').trim();
  const title = String((item && item.title) || '').trim();
  if (!href || !title) return null;
  return {
    href: href,
    id: href,
    title: title,
    image: String((item && (item.image || item.posterUrl)) || '').trim(),
  };
}

async function fallbackSearch(query) {
  const value = String(query || '').trim();
  const path = value
    ? '/v1/search?q=' + encodeURIComponent(value)
    : '/v1/discovery/feed?feedId=more-fast&page=1';
  const data = await fallbackApi(path);
  return (Array.isArray(data.items) ? data.items : [])
    .map(mapFallbackCard)
    .filter(Boolean)
    .slice(0, 30);
}

function dedupe(key, operation) {
  if (IN_FLIGHT.has(key)) return IN_FLIGHT.get(key);
  const request = Promise.resolve()
    .then(operation)
    .finally(function () { IN_FLIGHT.delete(key); });
  IN_FLIGHT.set(key, request);
  return request;
}

function parsePopularPageToken(query) {
  const raw = String(query || '').trim();
  const match = raw.match(/^__popular_page_(\d+)$/);
  if (!match) return null;
  return Math.max(1, parseInt(match[1], 10) || 1);
}

function parseSearchCards(html) {
  const text = String(html || '');
  const marker = '<article class="bg-base-300 flex gap-4 p-4">';
  const blocks = [];
  let start = text.indexOf(marker);
  while (start !== -1) {
    const next = text.indexOf(marker, start + marker.length);
    blocks.push(text.slice(start, next === -1 ? text.length : next));
    start = next;
  }

  const results = [];
  const seen = new Set();
  for (const block of blocks) {
    const hrefMatch = block.match(/href="https:\/\/weebcentral\.com\/series\/([A-Z0-9]{20,})\/([^"]+)"/i);
    if (!hrefMatch) continue;

    const id = hrefMatch[1];
    const slug = hrefMatch[2];
    const href = id + '/' + slug;
    if (seen.has(href)) continue;

    const title =
      stripHtml((block.match(/class="line-clamp-1 link link-hover">([\s\S]*?)<\/a>/i) || [])[1]) ||
      stripHtml((block.match(/class="text-ellipsis truncate text-white text-center text-lg z-20 w-\[90%\]">([\s\S]*?)<\/div>/i) || [])[1]) ||
      stripHtml((block.match(/alt="([^"]+?)\s+cover"/i) || [])[1]) ||
      slug.replace(/-/g, ' ').replace(/\b\w/g, function (ch) { return ch.toUpperCase(); });

    const imageMatch =
      block.match(/<img[^>]+src="([^"]+)"[^>]*>/i) ||
      block.match(/<source[^>]+srcset="([^"]+)"[^>]*>/i);
    const imageValue = imageMatch ? String(imageMatch[1] || '').split(/\s+/)[0] : '';
    const image = toAbsoluteUrl(imageValue);

    seen.add(href);
    results.push({ href, title, image });
  }
  return results;
}

function parseHomeCards(html) {
  const results = [];
  const seen = new Set();
  const anchorRegex = /<a[^>]*href="https:\/\/weebcentral\.com\/series\/([^"#?]+)"[^>]*>/gi;
  let match;
  while ((match = anchorRegex.exec(String(html || ''))) !== null) {
    const href = String(match[1] || '').trim();
    if (!href || seen.has(href) || href === 'random') continue;
    const start = Math.max(0, match.index - 400);
    const end = Math.min(String(html).length, match.index + 1200);
    const context = String(html).slice(start, end);
    const title =
      stripHtml((context.match(/data-tip="([^"]+)"/i) || [])[1]) ||
      stripHtml((context.match(/alt="([^"]+?)\s+cover"/i) || [])[1]) ||
      href.split('/')[1] ||
      'Unknown';
    const image = toAbsoluteUrl((context.match(/<img[^>]+src="([^"]+)"[^>]*alt="[^"]+?\s+cover"/i) || [])[1]);
    seen.add(href);
    results.push({ href, title, image });
  }
  return results;
}

async function warmDiscoverySession() {
  let response = await request(BASE_URL + '/', {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,*/*',
      Referer: BASE_URL + '/',
    },
  });
  if (isCloudflareChallenge(response)) {
    response = await request(BASE_URL + '/', {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,*/*',
        Referer: BASE_URL + '/',
      },
    });
  }
  if (!response.ok) {
    throw new Error('Discovery warm-up failed: HTTP ' + (response.status || 0));
  }
  return response;
}

async function fetchDiscoveryPage(sort, page) {
  const limit = 30;
  const pageNumber = Math.max(1, parseInt(page, 10) || 1);
  const offset = (pageNumber - 1) * limit;
  const url =
    BASE_URL +
    '/search/data?limit=' + limit +
    '&offset=' + offset +
    '&display_mode=Full%20Display' +
    '&sort=' + encodeURIComponent(sort) +
    '&text=';
  const response = await request(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,*/*',
      Referer: BASE_URL + '/search',
      'HX-Request': 'true',
      'HX-Current-URL': BASE_URL + '/search',
    },
  });
  if (response.ok && !isCloudflareChallenge(response)) {
    const direct = parseSearchCards(response.body).slice(0, limit);
    if (direct.length) return direct;
  }
  log('direct discovery unavailable; using cached exact-source catalogue');
  const data = await fallbackApi(
    '/v1/discovery/feed?feedId=more-fast&page=' + encodeURIComponent(pageNumber),
  );
  const fallback = (Array.isArray(data.items) ? data.items : [])
    .map(mapFallbackCard)
    .filter(Boolean)
    .slice(0, limit);
  if (!fallback.length) {
    throw new Error('WeebCentral discovery is temporarily unavailable. Please retry.');
  }
  return fallback;
}

async function safeDiscoveryPage(sort, page) {
  try {
    return await fetchDiscoveryPage(sort, page);
  } catch (error) {
    log('discovery section failed sort=' + sort + ': ' + ((error && error.message) || String(error)));
    return [];
  }
}

async function discoveryHome() {
  // Flutter's native bridge serializes concurrent JS requests on some Android
  // devices. Build the initial sections from one bounded catalogue response;
  // each View All action still opens its correct live feed.
  // Popularity includes legacy catalogue entries whose series pages no longer
  // contain chapters. Latest Updates keeps Home limited to active exact IDs.
  const catalogue = await fetchDiscoveryPage('Latest Updates', 1);
  const featured = catalogue.slice(0, 8);
  const sections = [
    {
      id: 'featured',
      title: 'Featured',
      style: 'poster',
      items: featured,
    },
    {
      id: 'popular',
      title: 'Popular',
      style: 'poster',
      items: catalogue.slice(8, 16),
      viewAll: { mode: 'search', query: '__wc_sort:Popularity' },
    },
    {
      id: 'latest-updates',
      title: 'Latest Updates',
      style: 'poster',
      items: catalogue.slice(16, 23),
      viewAll: { mode: 'feed', feedId: 'reader-all' },
    },
    {
      id: 'recently-added',
      title: 'Recently Added',
      style: 'poster',
      items: catalogue.slice(23, 30),
      viewAll: { mode: 'search', query: '__wc_sort:Recently Added' },
    },
  ].filter(function (section) {
    return Array.isArray(section.items) && section.items.length > 0;
  });
  return { sections: sections };
}

async function discoveryFeed(feedId, page) {
  if (String(feedId || '') !== 'reader-all') {
    return { items: [], page: Math.max(1, parseInt(page, 10) || 1), hasMore: false };
  }
  const pageNumber = Math.max(1, parseInt(page, 10) || 1);
  const items = await fetchDiscoveryPage('Latest Updates', pageNumber);
  return {
    items: items,
    page: pageNumber,
    hasMore: items.length >= 30,
  };
}

async function searchResults(query, page) {
  const pageFromToken = parsePopularPageToken(query);
  const pageNumber = pageFromToken || Math.max(1, parseInt(page, 10) || 1);

  let text = String(query || '').trim();
  let sort = 'Best Match';
  const limit = 30;

  if (pageFromToken) {
    text = '';
  } else if (text.startsWith('__wc_sort:')) {
    sort = text.substring('__wc_sort:'.length).trim() || 'Best Match';
    text = '';
  }

  // Handle Home Feed pagination (Static)
  if (!text && sort === 'Best Match') {
    const cards = await fetchDiscoveryPage('Popularity', pageNumber);
    log('home results=' + cards.length + ' page=' + pageNumber);
    return cards;
  }

  // Handle Paginated Search (Text or Sort)
  const offset = (pageNumber - 1) * limit;
  const url =
    BASE_URL +
    '/search/data?limit=' + limit +
    '&offset=' + offset +
    '&display_mode=Full%20Display' +
    '&sort=' + encodeURIComponent(sort) +
    '&text=' + encodeURIComponent(text);

  const doSearch = async () => {
    const res = await request(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,*/*',
        Referer: BASE_URL + '/search',
        'HX-Request': 'true',
        'HX-Current-URL': BASE_URL + '/search',
      },
    });

    if (!res.ok) {
      throw new Error('Search failed: HTTP ' + (res.status || 0) + ' — the source may be temporarily unavailable');
    }
    if (isCloudflareChallenge(res)) {
      throw new Error('WeebCentral is temporarily blocked by Cloudflare. Please retry in a moment.');
    }
    return res;
  };

  let res;
  try {
    res = await doSearch();
  } catch (err) {
    log('Search failed, retrying immediately: ' + ((err && err.message) || String(err)));
    try {
      res = await doSearch();
    } catch (_) {
      const fallback = await fallbackSearch(text);
      if (!fallback.length) {
        throw new Error('WeebCentral search is temporarily unavailable. Please retry.');
      }
      return fallback;
    }
  }

  const parsed = parseSearchCards(res.body).slice(0, limit);
  if (!parsed.length) {
    const fallback = await fallbackSearch(text);
    if (fallback.length) return fallback;
    throw new Error('WeebCentral returned no readable search results. Please retry.');
  }
  log('paginated results=' + parsed.length + ' query="' + text + '" sort="' + sort + '" page=' + pageNumber);
  return parsed;
}

function normalizeSeriesPath(seriesId) {
  const raw = String(seriesId || '').trim();
  if (!raw) return '';
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    const m = raw.match(/\/series\/([^/?#]+)/i);
    return m ? m[1] : raw;
  }
  return raw.replace(/^\/+/, '').replace(/^series\//i, '');
}

async function extractDetailsImpl(seriesId) {
  const seriesPath = normalizeSeriesPath(seriesId);
  if (!seriesPath) throw new Error('Invalid series id');
  const seriesUrl = BASE_URL + '/series/' + seriesPath;

  const res = await request(seriesUrl, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,*/*',
      Referer: BASE_URL + '/',
    },
  });
  if (!res.ok || isCloudflareChallenge(res)) {
    const data = await fallbackApi('/v1/details?id=' + encodeURIComponent(seriesPath));
    if (!data || !data.title) {
      throw new Error('WeebCentral details are temporarily unavailable. Please retry.');
    }
    return {
      title: data.title,
      description: data.description || 'No description available.',
      image: data.image || data.posterUrl || undefined,
      author: data.author || undefined,
      genres: Array.isArray(data.genres) ? data.genres : undefined,
      status: data.status || undefined,
      type: data.type || undefined,
    };
  }

  const html = res.body;
  const unavailable = /this series is currently unavailable/i.test(html);
  const metaTitle = html.match(/<meta\b[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
  const headingTitle = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  const descriptionMatch = html.match(/<meta\b[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
  const imageMatch = html.match(/<meta\b[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
  const title = stripHtml(
    (metaTitle && metaTitle[1]) ||
    (headingTitle && headingTitle[1]) ||
    seriesPath.split('/')[1] ||
    'Unknown'
  );
  const description = stripHtml(descriptionMatch && descriptionMatch[1]);
  const image = toAbsoluteUrl(imageMatch && imageMatch[1]);
  return {
    title,
    description:
      (description || 'No description available.') +
      (unavailable ? ' — Note: this series is currently unavailable on WeebCentral, so no chapters can load.' : ''),
    image: image || undefined,
  };
}

function parseChaptersFromHtml(html) {
  const chapters = [];
  const seen = new Set();
  const anchorRegex = /<a\b([^>]*href=(["'])([^"']*\/chapters\/[^"']+)\2[^>]*)>([\s\S]*?)<\/a>/gi;
  let match = null;
  while ((match = anchorRegex.exec(String(html || ''))) !== null) {
    const href = toAbsoluteUrl(decodeHtmlEntities(match[3] || ''));
    if (!href || seen.has(href)) continue;
    const rawInner = String(match[4] || '');
    const nestedTitle =
      (rawInner.match(/<span\b[^>]*class=["'][^"']*\bflex\b[^"']*["'][^>]*>\s*<span\b[^>]*>([\s\S]*?)<\/span>/i) || [])[1] ||
      (rawInner.match(/<span\b[^>]*class=["'][^"']*\bgrow\b[^"']*["'][^>]*>\s*<span\b[^>]*>([\s\S]*?)<\/span>/i) || [])[1] ||
      rawInner;
    const inner = stripHtml(nestedTitle).split('\n')[0].trim();
    if (!inner) continue;
    const chapterNumber = parseChapterNumber(inner);
    seen.add(href);
    chapters.push({
      id: href,
      href: href,
      url: href,
      number: chapterNumber == null ? undefined : chapterNumber,
      title: cleanChapterTitle(inner, chapterNumber),
    });
  }
  // The source is newest-first. Keep that order for mixed chapters, specials,
  // and volumes rather than imposing an incompatible cross-label sort.
  return chapters;
}

async function extractChaptersImpl(seriesId) {
  const seriesPath = normalizeSeriesPath(seriesId);
  if (!seriesPath) throw new Error('Invalid series id');

  const idOnly = seriesPath.split('/')[0];
  const seriesUrl = BASE_URL + '/series/' + seriesPath;
  const fullListUrl = BASE_URL + '/series/' + idOnly + '/full-chapter-list';

  const res = await request(fullListUrl, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml',
      Referer: BASE_URL + '/',
    },
    fetchOptions: {
      responseClass: 'chapter_list_html',
      maxBytesHint: 12 * 1024 * 1024,
    },
  });

  let chapters = [];
  if (res.ok && !res.bodyDropped && !isCloudflareChallenge(res)) {
    chapters = parseChaptersFromHtml(res.body || '');
  }
  if (!chapters.length) {
    log('direct chapter list unavailable; using cached exact-series list');
    try {
      const data = await fallbackApi('/v1/chapters?id=' + encodeURIComponent(seriesPath));
      chapters = (Array.isArray(data.items) ? data.items : []).map(function (chapter) {
        const href = String((chapter && (chapter.href || chapter.id)) || '').trim();
        const number = Number(chapter && (chapter.number != null ? chapter.number : chapter.chapterNumber));
        return {
          href: href,
          id: href,
          number: isFinite(number) ? number : undefined,
          title: String((chapter && chapter.title) || (isFinite(number) ? 'Chapter ' + number : 'Chapter')),
        };
      }).filter(function (chapter) { return !!chapter.href; });
    } catch (error) {
      log('cached chapter fallback unavailable: ' +
        ((error && error.message) ? error.message : String(error)));
    }
  }
  if (!chapters.length) {
    const unavailable = await seriesUnavailable(seriesPath);
    if (unavailable) {
      throw new Error(
        'This series is currently unavailable on WeebCentral (removed or region-restricted) — no chapters can load.',
      );
    }
    throw new Error('WeebCentral returned no chapters for this title. Please retry.');
  }
  const limited = chapters.slice(0, 2000);
  log('chapters parsed=' + limited.length + ' series=' + seriesPath + ' bytes=' + (res.bodyBytes || 0));
  return limited;
}

// A series can be pulled/region-restricted on the source: its pages render
// "This series is currently unavailable." and the chapter list is empty.
// Probe the series page (cached ~10 min) so the reader reports the real reason
// instead of an unhelpful "retry" message for a permanent state.
const unavailableProbeCache = {};
async function seriesUnavailable(seriesPath) {
  const key = String(seriesPath || '').toLowerCase();
  const hit = unavailableProbeCache[key];
  if (hit && hit.until > Date.now()) return hit.result;
  let result = false;
  try {
    const probe = await request(BASE_URL + '/series/' + seriesPath, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
        Referer: BASE_URL + '/',
      },
      fetchOptions: { responseClass: 'series_probe_html', maxBytesHint: 400000 },
    });
    if (probe.ok && !probe.bodyDropped && typeof probe.body === 'string') {
      result = /this series is currently unavailable/i.test(probe.body);
    }
  } catch (_) {
    /* probe is best-effort — on failure keep the generic retry message */
  }
  unavailableProbeCache[key] = { until: Date.now() + 10 * 60 * 1000, result };
  return result;
}

async function extractImagesImpl(chapterId) {
  const rawId = String(chapterId || '').trim();
  const idMatch = rawId.match(/(?:https:\/\/weebcentral\.com)?\/?chapters\/([a-z0-9]+)/i);
  const id = idMatch ? idMatch[1] : (/^[a-z0-9]+$/i.test(rawId) ? rawId : '');
  if (!id) throw new Error('Invalid chapter id');
  const url = BASE_URL + '/chapters/' + id + '/images?is_prev=False&reading_style=long_strip';

  const res = await request(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml',
      Referer: BASE_URL + '/',
    },
  });
  const html = res.ok && !isCloudflareChallenge(res) ? res.body : '';
  const urls = [];
  const seen = new Set();
  const regex = /(data-src|src|srcset)="([^"]+)"/gi;
  let match = null;
  while ((match = regex.exec(html)) !== null) {
    const value = String(match[2] || '').trim();
    if (!value) continue;
    const first = value.split(/\s+/)[0];
    const finalUrl = toAbsoluteUrl(first);
    if (!/\.(jpg|jpeg|png|webp|avif)(\?|$)/i.test(finalUrl)) continue;
    if (/logo|icon|sprite/i.test(finalUrl)) continue;
    if (seen.has(finalUrl)) continue;
    seen.add(finalUrl);
    urls.push(finalUrl);
  }

  if (!urls.length) {
    log('direct chapter pages unavailable; using cached exact-chapter pages');
    const data = await fallbackApi('/v1/pages?id=' + encodeURIComponent(id));
    const pages = Array.isArray(data.pages)
      ? data.pages
      : Array.isArray(data.images)
        ? data.images
        : [];
    for (const page of pages) {
      const value = typeof page === 'string' ? page : String((page && (page.url || page.image)) || '');
      if (value && !seen.has(value)) {
        seen.add(value);
        urls.push(value);
      }
    }
  }
  log('images parsed=' + urls.length + ' chapter=' + id);
  if (!urls.length) {
    throw new Error('No chapter pages were parsed. Please retry.');
  }
  return urls;
}

// Compatibility handlers required by current V2 validator.
async function extractEpisodes(seriesId) {
  return globalThis.extractChapters(seriesId);
}

async function extractStreamUrl(chapterId) {
  const images = await globalThis.extractImages(chapterId);
  if (!images.length) return '';
  return images[0];
}

globalThis.searchResults = searchResults;
globalThis.extractDetails = function (seriesId) {
  return Promise.resolve(extractDetailsImpl(seriesId)).catch(function (error) {
    throw new Error('WeebCentral details failed: ' +
      ((error && error.message) ? error.message : String(error)));
  });
};
globalThis.extractChapters = function (seriesId) {
  return dedupe('chapters:' + String(seriesId || ''), function () {
    return extractChaptersImpl(seriesId);
  }).catch(function (error) {
    throw new Error('WeebCentral chapters failed: ' +
      ((error && error.message) ? error.message : String(error)));
  });
};
globalThis.extractImages = function (chapterId) {
  return dedupe('pages:' + String(chapterId || ''), function () {
    return extractImagesImpl(chapterId);
  }).catch(function (error) {
    throw new Error('WeebCentral pages failed: ' +
      ((error && error.message) ? error.message : String(error)));
  });
};
globalThis.extractEpisodes = extractEpisodes;
globalThis.extractStreamUrl = extractStreamUrl;
globalThis.discoveryHome = discoveryHome;
globalThis.discoveryFeed = discoveryFeed;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    searchResults,
    extractDetails: globalThis.extractDetails,
    extractChapters: globalThis.extractChapters,
    extractImages: globalThis.extractImages,
    extractEpisodes,
    extractStreamUrl,
    discoveryHome,
    discoveryFeed,
  };
}
