/* ============================================================================
 * MovieDB (moviedb.wiki) — SP-VID-083-MOVIEDB
 * Fast + reliable Movies & TV module.
 *
 * Architecture (see PLAN.md):
 *  - Catalogue: moviedb.wiki (TMDB-id routes, HTML server-rendered).
 *  - Resolve:   api.vidlove.cc one-call JSON -> source.url (HLS master) +
 *               inline manifest + full multi-language subtitle list.
 *  - Fallback:  per-source variants (&sources=<key>) raced bounded.
 *  - Playback:  direct-id routing (mdb:movie:<tmdb> / mdb:tv:<tmdb>:<s>:<e>),
 *               segment byte-sniff validation, caches, prefetch-on-details.
 *
 * Module-only code: no app changes, no backend.
 * ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* Constants                                                          */
  /* ------------------------------------------------------------------ */

  var SITE = 'https://www.moviedb.wiki';
  var API = 'https://api.vidlove.cc';
  var VIDZEN = 'https://vidzen.fun';
  var PLAYER_REF = 'https://player.vidlove.cc/';
  var USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';

  // The resolve API enforces a header fingerprint (bare requests get 403
  // from every region; measured 2026-09-22). Always send exactly these.
  function apiHeaders() {
    return {
      'User-Agent': USER_AGENT,
      Referer: PLAYER_REF,
      Origin: 'https://player.vidlove.cc',
      Accept: 'application/json',
    };
  }

  function siteHeaders() {
    return {
      'User-Agent': USER_AGENT,
      Referer: SITE + '/',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    };
  }

  function streamHeaders() {
    return { 'User-Agent': USER_AGENT, Referer: PLAYER_REF };
  }

  // Source keys behind &sources= (from the player's own roster, speed-ordered
  // by measurement: auto best, vidapi fastest fallback).
  var SOURCE_KEYS = ['vidapi', 'megaknight', 'warden', 'cinefreak', 'moviebox2', 'ipcloud', 'tcloud'];

  // Caches (module-lifetime; the app reloads modules per session).
  var PAGE_TTL = 6 * 60 * 1000;       // catalogue pages
  var RESOLVE_TTL = 6 * 60 * 1000;    // resolved routes (below token TTL)
  var NEG_TTL = 25 * 1000;            // negative results
  var INTERNAL_DEADLINE = 15000;      // < tester 20s cap, app 30s budget

  var PAGES = Object.create(null);    // url -> {at, text}
  var RESOLVE = Object.create(null);  // key -> {at, data}
  var NEG = Object.create(null);      // key -> {at, msg}
  var INFLIGHT = Object.create(null);// key -> Promise
  var IMG_CACHE = Object.create(null);

  var ADULT_RE = /\b(porn|xxx|hentai(?!.*\bno\b)|jav\b|adult[\s-]?video)\b/i;

  /* ------------------------------------------------------------------ */
  /* Utilities                                                          */
  /* ------------------------------------------------------------------ */

  function now() {
    return typeof Date !== 'undefined' && Date.now ? Date.now() : new Date().getTime();
  }

  function log(msg) {
    try {
      if (typeof console !== 'undefined' && console.log) console.log('[moviedb] ' + msg);
    } catch (_) {}
  }

  // Portable sleep: resolve the timer through the scope first (the Node
  // sandbox leaves globalThis an empty object; the app runtime has it bare).
  function sleep(ms) {
    var wait = Math.max(0, Number(ms) || 0);
    if (wait <= 0) return Promise.resolve();
    return new Promise(function (resolve) {
      var timer = null;
      try {
        if (typeof setTimeout === 'function') timer = setTimeout;
      } catch (_) {}
      if (!timer) {
        try {
          if (typeof globalThis !== 'undefined' && globalThis && typeof globalThis.setTimeout === 'function') {
            timer = globalThis.setTimeout;
          }
        } catch (_) {}
      }
      if (!timer) {
        resolve();
        return;
      }
      timer(function () {
        resolve();
      }, wait);
    });
  }

  function enc(s) {
    try {
      return encodeURIComponent(String(s || ''));
    } catch (_) {
      return String(s || '').replace(/[^A-Za-z0-9._~-]/g, function (ch) {
        return '%' + ch.charCodeAt(0).toString(16).toUpperCase();
      });
    }
  }

  function cleanText(s) {
    return String(s || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#0?39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .replace(/&#(\d+);/g, function (_, n) {
        var code = parseInt(n, 10);
        return code >= 32 && code < 0x10000 ? String.fromCharCode(code) : ' ';
      })
      .replace(/\s+/g, ' ')
      .trim();
  }

  function absUrl(u) {
    var s = String(u || '').trim();
    if (!s) return '';
    if (s.indexOf('//') === 0) return 'https:' + s;
    if (s.indexOf('http') === 0) return s;
    if (s.charAt(0) === '/') return SITE + s;
    return SITE + '/' + s;
  }

  function decodeAmp(s) {
    // Attribute values in HTML carry &amp; for &, &#38; numerics too.
    return String(s || '')
      .replace(/&amp;/g, '&')
      .replace(/&#38;/g, '&')
      .replace(/&#x26;/gi, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/gi, "'");
  }

  /* ------------------------------------------------------------------ */
  /* HTTP (ported wrapper: fetchv2 -> text/body/json fallthrough,         */
  /* because JSON responses arrive with an empty body and only json())    */
  /* ------------------------------------------------------------------ */

  async function request(url, options) {
    var cfg = options || {};
    var method = cfg.method || 'GET';
    var headers = Object.assign({ 'User-Agent': USER_AGENT }, cfg.headers || {});
    var body = cfg.body === undefined ? null : cfg.body; // NEVER '' on GET

    if (typeof fetchv2 === 'function') {
      var res = await fetchv2(url, headers, method, body, {
        followRedirects: cfg.followRedirects !== false,
        maxBytesHint: cfg.maxBytesHint,
      });
      var textBody = '';
      if (res && typeof res.text === 'function') {
        try {
          textBody = await res.text();
        } catch (_) {
          textBody = '';
        }
      } else if (res && typeof res.body === 'string') {
        textBody = res.body;
      }
      var jsonBody = res && typeof res.json === 'object' ? res.json : null;
      if (textBody) {
        try {
          jsonBody = JSON.parse(textBody);
        } catch (_) {}
      }
      if (jsonBody === null && res && typeof res.json === 'function') {
        try {
          jsonBody = await res.json();
        } catch (_) {}
      }
      var ok = !!(res && (res.ok || (res.status >= 200 && res.status < 300)));
      return {
        ok: ok,
        status: Number((res && res.status) || 0),
        text: textBody || '',
        json: jsonBody,
        headers: (res && res.headers) || {},
        finalUrl: (res && (res.finalUrl || res.url)) || url,
      };
    }

    if (typeof fetch === 'function') {
      var res2 = await fetch(url, {
        method: method,
        headers: headers,
        body: body,
        redirect: cfg.followRedirects === false ? 'manual' : 'follow',
      });
      var t2 = await res2.text();
      var j2 = null;
      try {
        j2 = JSON.parse(t2);
      } catch (_) {}
      return {
        ok: res2.ok,
        status: Number(res2.status || 0),
        text: t2 || '',
        json: j2,
        headers: {},
        finalUrl: res2.url || url,
      };
    }

    throw new Error('No HTTP transport available (fetchv2/fetch missing)');
  }

  async function fetchPage(url) {
    var hit = PAGES[url];
    if (hit && now() - hit.at < PAGE_TTL) return hit.text;
    var res = await request(url, { headers: siteHeaders() });
    if (!res.ok && res.status !== 0) {
      // 404 -> honest miss; let caller decide
      if (hit) return hit.text;
      throw new Error('MovieDB page HTTP ' + res.status + ' for ' + url);
    }
    var text = res.text || '';
    if (text.length > 1500) PAGES[url] = { at: now(), text: text };
    return text;
  }

  /* ------------------------------------------------------------------ */
  /* Reference parsing (accepts bare, URL-wrapped, and watch-URL forms)  */
  /* ------------------------------------------------------------------ */

  // mdb:movie:299536 | mdb:tv:1399:1:1 | https://www.moviedb.wiki/home/movie/299536-slug
  // https://www.moviedb.wiki/home/tv/1399-game-of-thrones | .../home/watch/movie/299536
  // .../home/watch/tv/1399/1/1 | <baseHost>/match:mdb:movie:299536  (URL-wrapped scheme)
  function parseRef(ref) {
    var s = String(ref || '');
    var m = s.match(/mdb:(movie|tv):(\d+)(?::(\d+))?(?::(\d+))?/i);
    if (m) {
      return {
        kind: m[1].toLowerCase(),
        id: m[2],
        season: m[3] ? parseInt(m[3], 10) : null,
        episode: m[4] ? parseInt(m[4], 10) : null,
      };
    }
    m = s.match(/\/home\/watch\/tv\/(\d+)(?:\/(\d+)\/(\d+))?/i);
    if (m) {
      return {
        kind: 'tv',
        id: m[1],
        season: m[2] ? parseInt(m[2], 10) : null,
        episode: m[3] ? parseInt(m[3], 10) : null,
      };
    }
    m = s.match(/\/home\/watch\/movie\/(\d+)/i);
    if (m) return { kind: 'movie', id: m[1], season: null, episode: null };
    m = s.match(/\/home\/(movie|tv)\/(\d+)(?:-([^\/?#\s]*))?/i);
    if (m) {
      return {
        kind: m[1].toLowerCase(),
        id: m[2],
        slug: m[3] || '',
        season: null,
        episode: null,
      };
    }
    return null;
  }

  function cardHref(kind, id, slug) {
    return SITE + '/home/' + kind + '/' + id + (slug ? '-' + slug : '');
  }

  /* ------------------------------------------------------------------ */
  /* Catalogue parsing (tolerant multi-shape)                            */
  /* ------------------------------------------------------------------ */

  function parseCards(html) {
    var out = [];
    var seen = Object.create(null);
    if (!html) return out;

    // Primary path: the site's own card markup —
    //   <article class=poster-card data-id=299534 data-type=movie
    //     data-title="Avengers: Endgame" data-poster="https://image.tmdb.org/t/p/w342/…">
    //   with a poster link inside. Exact titles/posters, dedup by href.
    var cardRe = /<article\b[^>]*poster-card[^>]*>([\s\S]*?)<\/article>/gi;
    var cm;
    while ((cm = cardRe.exec(html))) {
      var tagEnd = cm[0].indexOf('>');
      var tag = tagEnd >= 0 ? cm[0].slice(0, tagEnd + 1) : '';
      var idM2 = tag.match(/data-id=(?:"(\d+)"|'?(\d+)'?)/);
      var typeM = tag.match(/data-type=(?:"(movie|tv)"|'?(movie|tv)'?)/i);
      // NB: the site leaves single-word attributes UNQUOTED (data-title=Colony)
      var titleM = tag.match(/data-title="([^"]*)"/) || tag.match(/data-title=([^\s>]+)/);
      var posterM = tag.match(/data-poster="([^"]*)"/) || tag.match(/data-poster=([^\s>]+)/);
      var hrefM = cm[1].match(/href="([^"]*\/home\/(?:movie|tv)\/[^"]+)"/) || tag.match(/href="([^"]+)"/);
      var id2 = idM2 ? idM2[1] || idM2[2] : null;
      if (!id2 || !titleM) continue;
      var kind2 = typeM ? (typeM[1] || typeM[2]).toLowerCase() : null;
      if (!kind2 && hrefM) {
        var hk = hrefM[1].match(/\/home\/(movie|tv)\//i);
        kind2 = hk ? hk[1].toLowerCase() : null;
      }
      if (!kind2) continue;
      var slug2 = hrefM ? (hrefM[1].match(/\/home\/(?:movie|tv)\/\d+-([^"\/?#]*)/) || [])[1] || '' : '';
      var hrefKey2 = '/home/' + kind2 + '/' + id2;
      if (seen[hrefKey2]) continue;
      seen[hrefKey2] = true;
      out.push({
        href: cardHref(kind2, id2, slug2),
        title: cleanText(titleM[1]),
        image: posterM ? absUrl(decodeAmp(posterM[1])) : '',
        year: null,
        kind: kind2,
        tmdbId: id2,
      });
    }

    var aRe = /<a\b([^>]*)href="([^"]+)"([^>]*)>/gi;
    var m;
    var starts = [];
    while ((m = aRe.exec(html))) {
      starts.push({ index: m.index, end: aRe.lastIndex, attrs: m[1] + ' ' + m[3], href: decodeAmp(m[2]) });
    }

    for (var i = 0; i < starts.length; i++) {
      var h = starts[i].href || '';
      var kind = null;
      var idM = h.match(/\/home\/(movie|tv)\/(\d+)(?:-([^\/?#"]*))?/i);
      if (idM) {
        kind = idM[1].toLowerCase();
      }
      if (!kind) continue;
      if (/\/home\/watch\//i.test(h)) continue;

      var hrefKey = '/home/' + kind + '/' + idM[2];
      if (seen[hrefKey]) continue;

      // inner HTML: from this anchor tag to its closing </a> (bounded)
      var chunk = html.slice(starts[i].end, Math.min(html.length, starts[i].end + 2500));
      var closeIdx = chunk.search(/<\/a>/i);
      if (closeIdx >= 0) chunk = chunk.slice(0, closeIdx);

      var img = '';
      var imgM = chunk.match(/<img\b[^>]*>/i);
      if (imgM) {
        // Rocket-Loader keeps the real URL in data-pagespeed-lazy-src while
        // src points at a placeholder gif — prefer the lazy attribute.
        var srcM = imgM[0].match(/(?:data-pagespeed-lazy-src|data-src|data-lazy-src|data-original|src)="([^"]+)"/i);
        if (srcM) img = decodeAmp(srcM[1]);
      }
      if (!img) {
        // image sometimes precedes the anchor (card wrapper layouts)
        var pre = html.slice(Math.max(0, starts[i].index - 900), starts[i].index);
        var preImg = pre.match(/<img\b[^>]*>/gi);
        if (preImg && preImg.length) {
          var last = preImg[preImg.length - 1];
          var srcM2 = last.match(/(?:data-pagespeed-lazy-src|data-src|data-lazy-src|data-original|src)="([^"]+)"/i);
          if (srcM2) img = decodeAmp(srcM2[1]);
        }
      }
      if (img && img.indexOf('/pagespeed_static/') >= 0) img = ''; // placeholder, not artwork

      var title = '';
      var tAttr = starts[i].attrs.match(/title="([^"]*)"/i);
      if (tAttr && cleanText(tAttr[1])) title = cleanText(tAttr[1]);
      if (!title && imgM) {
        var altM = imgM[0].match(/alt="([^"]*)"/i);
        if (altM) title = cleanText(altM[1]);
      }
      if (!title) title = cleanText(chunk);
      title = title.replace(/\s*\((19|20)\d{2}\)\s*$/, function (w) { return w; });
      if (!title || title.length < 2) continue;

      var yearM = (starts[i].attrs + ' ' + chunk).match(/\b(19|20)\d{2}\b/);
      var slug = idM[3] || '';

      seen[hrefKey] = true;
      out.push({
        href: cardHref(kind, idM[2], slug),
        title: title,
        image: img ? absUrl(img) : '',
        year: yearM ? parseInt(yearM[0], 10) : null,
        kind: kind,
        tmdbId: idM[2],
      });
    }
    return out;
  }

  function filterAdult(cards) {
    var out = [];
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i];
      if (!c) continue;
      if (ADULT_RE.test(c.title || '') || ADULT_RE.test(c.href || '')) continue;
      out.push(c);
    }
    return out;
  }

  function toCards(items, cap) {
    var out = [];
    var seen = Object.create(null);
    for (var i = 0; i < items.length && out.length < (cap || 40); i++) {
      var it = items[i];
      if (!it || !it.href || seen[it.href]) continue;
      seen[it.href] = true;
      out.push({ href: it.href, title: it.title, image: it.image || '' });
    }
    return out;
  }

  function parseHomeSections(html) {
    var sections = [];
    if (!html) return sections;
    var headRe = /<h[1-4][^>]*>([\s\S]{0,140}?)<\/h[1-4]>/gi;
    var heads = [];
    var hm;
    while ((hm = headRe.exec(html))) {
      heads.push({ index: hm.index, end: headRe.lastIndex, title: cleanText(hm[1]) });
    }
    if (!heads.length) {
      var all = filterAdult(parseCards(html));
      if (all.length) sections.push({ title: 'Trending', items: all, viewAll: '' });
      return sections;
    }
    // content before the first heading (hero area) — useful when the first
    // rail has no <h> of its own
    if (heads[0].index > 4000) {
      var pre = filterAdult(parseCards(html.slice(0, heads[0].index)));
      if (pre.length >= 4) sections.push({ title: 'Featured', items: pre, viewAll: '' });
    }
    for (var i = 0; i < heads.length; i++) {
      var start = heads[i].end;
      var stop = i + 1 < heads.length ? heads[i + 1].index : Math.min(html.length, start + 60000);
      var body = html.slice(start, stop);
      var cards = filterAdult(parseCards(body));
      if (cards.length < 3) continue;
      var title = heads[i].title || 'Featured';
      if (title.length > 80) title = title.slice(0, 80);
      // skip tiny/pagination/nav blocks mis-detected as rails
      if (/^(home|movies|tv shows|genres?|search|login|sign up)$/i.test(title) && cards.length < 8) continue;
      var viewAll = '';
      var vaHead = body.slice(0, 2200); // view-all sits in the rail's head block
      // NB: the site's HTML uses UNQUOTED attributes (class=view-all); href is quoted.
      var vaM = vaHead.match(/<a\b[^>]*view-all[^>]*href="([^"]+)"/i);
      if (!vaM) vaM = vaHead.match(/<a\b[^>]*href="([^"]+)"[^>]*view-all[^>]*>/i);
      if (vaM) viewAll = decodeAmp(vaM[1]);
      sections.push({ title: title, items: cards, viewAll: viewAll });
    }
    return sections;
  }

  /* ---- feed registry (viewAll links -> paginated site pages) -------------- */

  var FEEDS = Object.create(null); // feedId -> site-relative href (paginatable)

  function fnv1a(s) {
    var h = 0x811c9dc5;
    for (var i = 0; i < String(s).length; i++) {
      h = (h ^ String(s).charCodeAt(i)) >>> 0;
      if (typeof Math.imul === 'function') h = Math.imul(h, 16777619) >>> 0;
      else h = ((h * 16777619) >>> 0);
    }
    return h >>> 0;
  }

  function feedIdFor(href) {
    return 'f' + fnv1a(href).toString(36);
  }

  function registerFeedViews(sections) {
    for (var i = 0; i < sections.length; i++) {
      var va = sections[i].viewAll;
      if (!va) continue;
      var href = String(va).trim();
      if (!href || /^(javascript:|#)/i.test(href)) continue;
      FEEDS[feedIdFor(href)] = href;
    }
  }

  function pagedUrl(href, page) {
    var h = String(href || '');
    if (h.indexOf('http') !== 0) h = SITE + (h.charAt(0) === '/' ? h : '/' + h);
    var joiner = h.indexOf('?') >= 0 ? '&' : '?';
    return h + joiner + 'page=' + Math.max(1, parseInt(page || 1, 10) || 1);
  }

  function sectionId(title, idx) {
    var s = String(title || 'section').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
    if (!s || s.length > 40) s = 'section';
    return s.slice(0, 48) + '-' + idx;
  }

  /* ------------------------------------------------------------------ */
  /* Details parsing                                                    */
  /* ------------------------------------------------------------------ */

  function metaContent(html, nameOrProp) {
    var esc = nameOrProp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var re = new RegExp(
      '<meta[^>]+(?:name|property)=["\']' + esc + '["\'][^>]*content=["\']([^"\']*)["\']',
      'i'
    );
    var m = html.match(re);
    if (m) return decodeAmp(m[1]);
    var re2 = new RegExp(
      '<meta[^>]+content=["\']([^"\']*)["\'][^>]*(?:name|property)=["\']' + esc + '["\']',
      'i'
    );
    var m2 = html.match(re2);
    return m2 ? decodeAmp(m2[1]) : '';
  }

  function jsonLdBlocks(html) {
    var out = [];
    var re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    var m;
    while ((m = re.exec(html))) {
      try {
        out.push(JSON.parse(m[1]));
      } catch (_) {}
    }
    return out;
  }

  function ldFind(blocks, predicate) {
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      var list = Array.isArray(b) ? b : [b];
      for (var j = 0; j < list.length; j++) {
        var v = list[j];
        if (v && predicate(v)) return v;
        if (v && v['@graph'] && Array.isArray(v['@graph'])) {
          for (var k = 0; k < v['@graph'].length; k++) {
            if (v['@graph'][k] && predicate(v['@graph'][k])) return v['@graph'][k];
          }
        }
      }
    }
    return null;
  }

  // Deterministic extraction of a <p class=...cls...>…</p> by the class
  // fragment. (A raw regex with [^"']* bounds slides past the tag when the
  // paragraph text or later markup contains quotes — walk the tag instead.)
  function extractClassParagraph(html, cls) {
    var from = 0;
    while (true) {
      var idx = html.indexOf(cls, from);
      if (idx < 0) return '';
      var start = html.lastIndexOf('<p', idx);
      var tagEnd = html.indexOf('>', start);
      if (start >= 0 && tagEnd > start && idx < tagEnd) {
        var endTag = html.indexOf('</p>', tagEnd);
        if (endTag > tagEnd && endTag - tagEnd < 6000) {
          var text = cleanText(html.slice(tagEnd + 1, endTag));
          if (text.length > 30) return text;
        }
      }
      from = idx + cls.length;
    }
  }

  function parseTitleData(html) {
    var m = html.match(/<script[^>]*id=["']?titleData["']?[^>]*>([\s\S]*?)<\/script>/i);
    if (!m) return null;
    try {
      return JSON.parse(m[1]);
    } catch (_) {
      return null;
    }
  }

  function parseDetailsPage(html, ref) {
    var out = { title: '', description: '', image: '', year: null, genres: [] };
    var ldBlocks = jsonLdBlocks(html);
    var ld = ldFind(ldBlocks, function (v) {
      var t = String(v['@type'] || '');
      return t === 'Movie' || t === 'TVSeries' || t === 'TVShow' || t === 'CreativeWork';
    });
    var td = parseTitleData(html);

    var ogTitle = metaContent(html, 'og:title');
    var titleTag = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '';
    var h1 = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || '';
    var title = cleanText((td && td.title) || (ld && ld.name) || ogTitle || h1 || titleTag);
    title = title.replace(/\s*[|\-–]\s*(MovieDB|moviedb\.wiki|Watch.*)\s*$/i, '').trim();
    out.title = title;

    var desc = '';
    // the site's own untruncated overview beats og/JSON-LD (both get ellipsised)
    desc = extractClassParagraph(html, 'detail-overview');
    if (!desc && ld && typeof ld.description === 'string') desc = cleanText(ld.description);
    if (!desc || desc.length < 40) {
      var ogDesc = metaContent(html, 'og:description') || metaContent(html, 'description');
      if (ogDesc && cleanText(ogDesc).length > (desc ? desc.length : 0)) desc = cleanText(ogDesc);
    }
    if (!desc || desc.length < 40) {
      var pRe = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
      var pm;
      while ((pm = pRe.exec(html))) {
        var cand = cleanText(pm[1]);
        if (cand.length > 120 && !/cookie|javascript|subscribe|sign in|dmca|disclaimer/i.test(cand)) {
          desc = cand;
          break;
        }
      }
    }
    out.description = desc || '';

    var img = '';
    if (td && td.poster) {
      img = String(td.poster);
      if (img.indexOf('http') !== 0 && img.charAt(0) === '/') img = 'https://image.tmdb.org/t/p/w500' + img;
      if (img.indexOf('//') === 0) img = 'https:' + img;
    }
    if (!img) img = metaContent(html, 'og:image');
    if (!img && ld && ld.image) {
      img = typeof ld.image === 'string' ? ld.image : (ld.image && ld.image.url) || '';
    }
    if (!img) {
      var im = html.match(/<img\b[^>]*class="[^"]*(?:poster|cover|backdrop)[^"]*"[^>]*>/i);
      if (im) {
        var srcM = im[0].match(/(?:data-src|src)="([^"]+)"/i);
        if (srcM) img = srcM[1];
      }
    }
    out.image = img ? absUrl(img) : '';

    var yearM = String((ld && ld.datePublished) || '').match(/\b(19|20)\d{2}\b/);
    if (!yearM) yearM = cleanText(html.slice(0, 20000)).match(/\b(19|20)\d{2}\b/);
    out.year = yearM ? parseInt(yearM[0], 10) : null;

    if (ld && ld.genre) {
      out.genres = Array.isArray(ld.genre) ? ld.genre.slice(0, 8) : [String(ld.genre)];
    }
    return out;
  }

  function parseSeasons(html) {
    // Season picker: <select ... data-tv-id="1399"> <option ...>Season 1 (10 eps)</option>
    var seasons = [];
    var seen = Object.create(null);
    var selM = html.match(/<select\b[^>]*data-tv-id=["']\d+["'][^>]*>([\s\S]*?)<\/select>/i);
    var scopes = [];
    if (selM) scopes.push(selM[1]);
    // secondary: labelled "Season 1 (10 eps)" anywhere
    scopes.push(html);

    for (var s = 0; s < scopes.length; s++) {
      var optRe = /<option\b([^>]*)>([\s\S]*?)<\/option>/gi;
      var om;
      while ((om = optRe.exec(scopes[s]))) {
        var attrs = om[1] || '';
        var label = cleanText(om[2]);
        var num = null;
        var nM = label.match(/season\s*(\d+)/i) || attrs.match(/data-season-number=["']?(\d+)/i) || attrs.match(/value=["']?(\d+)/i);
        if (nM) num = parseInt(nM[1], 10);
        if (!num && /^\d+$/.test(label.trim())) num = parseInt(label.trim(), 10);
        if (!num) continue;
        var cntM = label.match(/\((\d+)\s*eps?\)/i) || attrs.match(/data-episode-count=["']?(\d+)/i) || attrs.match(/data-count=["']?(\d+)/i);
        var count = cntM ? parseInt(cntM[1], 10) : null;
        if (seen[num]) continue;
        seen[num] = true;
        seasons.push({ season: num, count: count });
      }
      if (seasons.length) break;
    }
    // tertiary: JSON-LD seasons array
    if (!seasons.length) {
      var ldBo = jsonLdBlocks(html);
      var ldS = ldFind(ldBo, function (v) {
        return v && Array.isArray(v.seasons);
      });
      if (ldS) {
        for (var q = 0; q < ldS.seasons.length; q++) {
          var sn = ldS.seasons[q];
          if (!sn) continue;
          var snm = parseInt(sn.season_number, 10);
          if (!snm || seen[snm]) continue;
          seen[snm] = true;
          seasons.push({ season: snm, count: sn.episode_count ? parseInt(sn.episode_count, 10) : null });
        }
      }
    }
    seasons.sort(function (a, b) {
      return a.season - b.season;
    });
    return seasons;
  }

  /* ------------------------------------------------------------------ */
  /* VidLove resolve engine                                             */
  /* ------------------------------------------------------------------ */

  function parseManifest(text) {
    // returns {variants: [{height,width,bandwidth,codecs,url}], hasSegments}
    var out = { variants: [], hasSegments: false };
    if (!text || text.indexOf('#EXTM3U') < 0) return null;
    var lines = text.split(/\r?\n/);
    var pending = null;
    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i].trim();
      if (!ln) continue;
      if (ln.indexOf('#EXT-X-STREAM-INF:') === 0) {
        pending = ln.slice('#EXT-X-STREAM-INF:'.length);
        continue;
      }
      if (ln.charAt(0) === '#') {
        if (ln.indexOf('#EXTINF:') === 0) out.hasSegments = true;
        continue;
      }
      if (pending !== null) {
        var h = 0;
        var w = 0;
        var bw = 0;
        var rM = pending.match(/RESOLUTION=(\d+)x(\d+)/i);
        if (rM) {
          w = parseInt(rM[1], 10);
          h = parseInt(rM[2], 10);
        }
        var bM = pending.match(/BANDWIDTH=(\d+)/i);
        if (bM) bw = parseInt(bM[1], 10);
        var cM = pending.match(/CODECS="([^"]*)"/i);
        out.variants.push({ width: w, height: h, bandwidth: bw, codecs: cM ? cM[1] : '', url: ln });
        pending = null;
      } else {
        // URL with no STREAM-INF => looked like a media playlist line
        out.hasSegments = true;
      }
    }
    return out;
  }

  function qualityLabel(w, h) {
    if (h > 0) return String(h) + 'p';
    if (w > 0) {
      if (w >= 1800) return '1080p';
      if (w >= 1200) return '720p';
      if (w >= 900) return '540p';
      if (w >= 600) return '480p';
      if (w >= 400) return '360p';
      return 'Auto';
    }
    return 'Auto';
  }

  function sniffMedia(head) {
    if (!head || typeof head !== 'string' || head.length < 4) return null;
    var c0 = head.charCodeAt(0);
    // fetchv2 decodes bytes as UTF-8, so packet offsets cannot be validated
    // here. Reject printable errors; this is a binary hint, not decode proof.
    var binaryHint = /[\x00-\x08\x0e-\x1f\ufffd]/.test(head.slice(0, 480));
    if (c0 === 71 && head.length >= 188 && binaryHint) return 'ts';
    var probe = head.slice(0, 480);
    var b2 = head.charCodeAt(2), b3 = head.charCodeAt(3);
    var boxSize = b2 * 256 + b3;
    if (c0 === 0 && head.charCodeAt(1) === 0 && b2 <= 255 && b3 <= 255 &&
        boxSize >= 8 && /^(?:ftyp|styp|moof)$/.test(probe.slice(4, 8))) return 'mp4';
    if (c0 === 60) return 'html';
    var t = head.slice(0, 40).trim();
    if (t.charAt(0) === '{' || t.charAt(0) === '[') return 'json';
    return null;
  }

  function absorbAgainst(base, rel) {
    if (!rel) return '';
    if (rel.indexOf('http') === 0) return rel;
    if (rel.indexOf('//') === 0) return 'https:' + rel;
    var m = String(base || '').match(/^(https?:\/\/[^\/]+)(\/.*)?$/);
    if (!m) return rel;
    var origin = m[1];
    var path = m[2] || '/';
    if (rel.charAt(0) === '/') return origin + rel;
    var dir = path.replace(/[^\/]*$/, '');
    return origin + dir + rel;
  }

  // (aliased helper name used by the route walkers below)
  function absAgainst(base, rel) {
    return absorbAgainst(base, rel);
  }

  async function probeSegment(segUrl, headers) {
    if (/\.(?:jpe?g|png|gif|webp|avif|svg)(?:[?#]|$)/i.test(segUrl)) return { ok: false, why: 'image segment URL' };
    var res = await request(segUrl, {
      headers: Object.assign({}, headers || streamHeaders(), { Range: 'bytes=0-4095' }),
      maxBytesHint: 4 * 1024 * 1024,
    });
    if (!res.ok && res.status >= 400) return { ok: false, why: 'http ' + res.status };
    var responseHeaders = res.headers || {};
    for (var key in responseHeaders) {
      if (key.toLowerCase() === 'content-type' && /^image\//i.test(String(responseHeaders[key]))) return { ok: false, why: 'image segment response' };
    }
    if (/^(?:GIF8|\x89PNG|\xff\xd8\xff)/.test(res.text || '')) return { ok: false, why: 'image bytes' };
    var kind = sniffMedia(res.text || '');
    if (kind === 'ts' || kind === 'mp4') return { ok: true, kind: kind };
    return { ok: false, why: kind || 'unknown bytes' };
  }

  async function requestPlaylist(url, headers, deadline) {
    var res = await request(url, { headers: headers, maxBytesHint: 4 * 1024 * 1024 });
    // The source intermittently returns 5xx for a valid playlist. One bounded
    // retry avoids discarding that rung; never retry access/rate-limit errors.
    if (res.status >= 500 && res.status <= 599 && now() + 350 < deadline) {
      await sleep(250);
      res = await request(url, { headers: headers, maxBytesHint: 4 * 1024 * 1024 });
    }
    return res;
  }

  // Walk a playlist route: master -> variant -> segment, byte-verified.
  // Handles direct media playlists (relative segments resolved) too.
  async function probeRoute(srcUrl, headers, deadline) {
    if (now() > deadline) return null;
    var text = '';
    try {
      var res = await requestPlaylist(srcUrl, headers, deadline);
      text = res.ok || res.status === 206 ? res.text || '' : '';
      if (!text && (res.status === 403 || res.status === 401)) return null;
    } catch (e) {
      return null;
    }
    var man = parseManifest(text);
    if (!man) return null;
    var variants = (man.variants || []).slice();
    // Master playlists may carry RELATIVE variant paths (vidzen sv-pi does);
    // normalize them against the master URL — the app needs absolute URLs.
    for (var nv = 0; nv < variants.length; nv++) {
      if (variants[nv] && variants[nv].url) {
        variants[nv] = Object.assign({}, variants[nv], { url: absAgainst(srcUrl, variants[nv].url) });
      }
    }
    if (!variants.length && man.hasSegments) {
      variants = [{ width: 0, height: 0, bandwidth: 0, codecs: '', url: srcUrl, direct: true }];
    }
    if (!variants.length) return null;
    variants.sort(function (a, b) {
      return (b.bandwidth || b.width * b.height) - (a.bandwidth || a.width * a.height);
    });
    var probed = null;
    var verified = [];
    for (var vi = 0; vi < variants.length && vi < 8; vi++) {
      if (now() > deadline) break;
      var vUrl = variants[vi].url;
      var vText = '';
      if (variants[vi].direct) {
        vText = text;
      } else {
        try {
          var vres = await requestPlaylist(vUrl, headers, deadline);
          vText = vres.ok ? vres.text || '' : '';
        } catch (e) {
          vText = '';
        }
      }
      if (vText.indexOf('#EXTM3U') < 0) continue;
      var segM = vText.match(/#EXTINF[^\n]*\n([^\n#][^\n]*)/);
      if (!segM) continue;
      var segUrl = absAgainst(vUrl, segM[1].trim());
      var probe = null;
      try {
        probe = await probeSegment(segUrl, headers);
      } catch (e) {
        probe = { ok: false, why: 'probe error' };
      }
      if (probe && probe.ok) {
        if (!probed) probed = { kind: probe.kind, url: vUrl };
        verified.push(variants[vi]);
      }
    }
    // Never select a failed high rung just because a lower rung worked.
    return verified.length ? { variants: verified, probed: probed } : null;
  }

  function hasSubs(data) {
    return !!(data && data.subtitles && data.subtitles.length);
  }

  // VidLove attempt with the flaky-subtitle retry (the API intermittently
  // answers 0 tracks for the same item; a second fresh call often fills them).
  async function vidloveAttempt(ref, key, deadline) {
    var data = await callApi(ref, key, deadline);
    if (!data) return null;
    var retryP = null;
    if (!hasSubs(data) && now() < deadline) {
      retryP = callApi(ref, key, deadline);
    }
    var ok = await validateSource(data, deadline);
    if (!ok) return null;
    if (retryP) {
      try {
        // Subtitle enrichment must not consume the entire playback budget.
        var d2 = await Promise.race([
          retryP,
          sleep(Math.min(250, Math.max(0, deadline - now()))).then(function () { return null; }),
        ]);
        if (d2 && hasSubs(d2)) ok.subs = mapSubs(d2.subtitles);
      } catch (_) {}
    }
    return ok;
  }

  // Independent second provider (vidzen.fun): plain JSON, ready playlist,
  // per-source Referer. Ranked #1 in the 2026-09-22 roster probe.
  async function vidzenAttempt(ref, server, deadline) {
    if (now() > deadline) return null;
    var vu = VIDZEN + '/api/sources?type=' + enc(ref.kind) + '&id=' + enc(ref.id);
    if (ref.kind === 'tv') vu += '&season=' + enc(ref.season || 1) + '&episode=' + enc(ref.episode || 1);
    vu += '&server=' + enc(server) + '&renew=true';
    var res;
    try {
      res = await request(vu, {
        headers: {
          'User-Agent': USER_AGENT,
          Referer: VIDZEN + '/' + (ref.kind === 'tv' ? 'tv' : 'movie') + '/' + ref.id,
          Origin: VIDZEN,
          Accept: 'application/json',
        },
      });
    } catch (e) {
      return null;
    }
    if (!res.ok || !res.json) return null;
    var list = res.json.sources;
    var entry = null;
    if (Array.isArray(list)) {
      for (var i = 0; i < list.length; i++) {
        if (list[i] && list[i].url) {
          entry = list[i];
          break;
        }
      }
    }
    if (!entry) return null;
    var srcUrl = String(entry.url);
    if (srcUrl.indexOf('http') !== 0) {
      // sv-pi returns paths relative to vidzen.fun (e.g. /api/stream/<token>)
      srcUrl = absAgainst(VIDZEN + '/', srcUrl);
    }
    if (srcUrl.indexOf('http') !== 0) return null;
    var referer = String(entry._referer || '');
    var hdr = {
      'User-Agent': USER_AGENT,
      Referer: referer ? absAgainst(VIDZEN + '/', referer) : VIDZEN + '/',
    };
    var pr = await probeRoute(srcUrl, hdr, deadline);
    if (!pr) return null;
    var label = String(entry.label || 'VidZen ' + server);
    if (pr.variants.length === 1 && !pr.variants[0].height) {
      var hl = label.match(/(\d{3,4})p/i);
      if (hl) pr.variants[0].height = parseInt(hl[1], 10);
    }
    return {
      variants: pr.variants,
      masterUrl: srcUrl,
      subs: mapSubs(res.json.subtitles),
      srcName: 'VidZen · ' + label,
      headers: hdr,
      probed: pr.probed,
    };
  }

  // Validate one VidLove source payload -> route object or null
  async function validateSource(data, deadline) {
    var srcUrl = String((data.source && data.source.url) || '');
    var srcName = 'VidLove · ' + String((data.source && (data.source.label || data.source.source)) || 'VidAPI');
    if (!srcUrl || srcUrl.indexOf('http') !== 0) return null;

    // cheap structural check on the inline manifest first
    var inline = typeof data.source.manifest === 'string' ? data.source.manifest : '';
    if (inline && inline.indexOf('#EXTM3U') < 0) return null;

    if (now() > deadline) return null;
    var pr = await probeRoute(srcUrl, streamHeaders(), deadline);
    if (!pr) return null;
    return {
      variants: pr.variants,
      masterUrl: srcUrl,
      subs: mapSubs(data.subtitles),
      srcName: srcName,
      probed: pr.probed,
    };
  }

  function subsLanguageMap() {
    return {
      english: 'en', arabic: 'ar', french: 'fr', spanish: 'es', italian: 'it', german: 'de',
      portuguese: 'pt', protuguese: 'pt', japanese: 'ja', korean: 'ko', chinese: 'zh',
      mandarin: 'zh', cantonese: 'zh', hindi: 'hi', turkish: 'tr', russian: 'ru',
      persian: 'fa', farsi: 'fa', dutch: 'nl', hebrew: 'he', greek: 'el', serbian: 'sr',
      croatian: 'hr', romanian: 'ro', ukrainian: 'uk', bulgarian: 'bg', hungarian: 'hu',
      czech: 'cs', slovak: 'sk', finnish: 'fi', swedish: 'sv', norwegian: 'no',
      danish: 'da', vietnamese: 'vi', thai: 'th', indonesian: 'id', malay: 'ms',
      bengali: 'bn', tamil: 'ta', telugu: 'te', urdu: 'ur', filipino: 'tl',
      tagalog: 'tl', polish: 'pl', estonian: 'et', latvian: 'lv', lithuanian: 'lt',
      slovene: 'sl', albanian: 'sq', macedonian: 'mk', georgian: 'ka', armenian: 'hy',
      azerbaijani: 'az', kazakh: 'kk', uzbek: 'uz', nepali: 'ne', sinhala: 'si',
      burmese: 'my', khmer: 'km', lao: 'lo', mongolian: 'mn', icelandic: 'is',
      irish: 'ga', welsh: 'cy', catalan: 'ca', basque: 'eu', galician: 'gl',
      malayalam: 'ml', kannada: 'kn', marathi: 'mr', punjabi: 'pa', gujarati: 'gu',
      swahili: 'sw', yoruba: 'yo', zulu: 'zu', afrikaans: 'af', amharic: 'am',
      somali: 'so', pashto: 'ps', kurdish: 'ku', bosnian: 'bs', montenegrin: 'me',
    };
  }

  function mapSubs(rawList) {
    var out = [];
    var seen = Object.create(null);
    var perLang = Object.create(null);
    var undCount = 0;
    var names = subsLanguageMap();
    var rows = Array.isArray(rawList) ? rawList : [];
    log('mapSubs in=' + rows.length);
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      if (!row || typeof row !== 'object') continue;
      var rawFile = String(row.file || row.url || row.src || '').trim();
      if (!rawFile) continue;
      var file = rawFile.indexOf('//') === 0 ? 'https:' + rawFile : rawFile.indexOf('http') === 0 ? rawFile : '';
      if (!file) continue;
      if (/\/thumbs?\/|sprite|thumbnail/i.test(file)) continue;
      if (seen[file]) continue;
      seen[file] = true;

      var raw = cleanText(row.label || row.language || row.lang || '').toLowerCase();
      var baseLang = raw.replace(/\(.*?\)/g, ' ').replace(/\s+/g, ' ').trim();
      // Providers frequently ship numbered variants: 'English2'…'English8',
      // 'English 2', 'Spanish3'. Strip the trailing number for the lookup so
      // these classify as their language (and stay EN-first).
      var baseLangNoNum = baseLang.replace(/[\s-]*\d+$/g, '').trim();
      var lang = names[raw] || names[baseLang] || names[baseLangNoNum] || (/^[a-z]{2,3}(?:[-_][a-z0-9]+)*$/i.test(baseLang) ? baseLang.replace(/_/g, '-') : 'und');

      var labelKey = lang + '|' + cleanText(row.label || row.language || '').toLowerCase();
      if (seen[labelKey]) continue; // identical label twice reads as a bug in the picker
      seen[labelKey] = true;

      if (lang === 'und') {
        if (undCount >= 8) continue;
        undCount += 1;
      } else {
        perLang[lang] = (perLang[lang] || 0) + 1;
        if (perLang[lang] > 4) continue;
      }
      if (out.length >= 200) break;

      out.push({
        label: cleanText(row.label || row.language || 'Unknown language'),
        language: lang,
        lang: lang,
        url: file,
        file: file,
        kind: 'captions',
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/vtt,text/plain,application/x-subrip,*/*',
        },
      });
    }
    // English first, then alphabetical by label
    out.sort(function (a, b) {
      var ae = a.lang === 'en' ? 0 : 1;
      var be = b.lang === 'en' ? 0 : 1;
      if (ae !== be) return ae - be;
      return String(a.label).localeCompare(String(b.label));
    });
    return out;
  }

  async function callApi(ref, sourceKey, deadline) {
    if (now() > deadline) return null;
    var url;
    if (ref.kind === 'tv') {
      url = API + '/tv?id=' + enc(ref.id) + '&season=' + enc(ref.season || 1) + '&episode=' + enc(ref.episode || 1) + '&mode=json';
    } else {
      url = API + '/movie?id=' + enc(ref.id) + '&mode=json';
    }
    if (sourceKey) url += '&sources=' + enc(sourceKey);
    var res;
    try {
      res = await request(url, { headers: apiHeaders() });
    } catch (e) {
      log('api error ' + (e && e.message ? e.message : e));
      return null;
    }
    if (!res.ok || !res.json) {
      log('api http ' + res.status + ' key=' + (sourceKey || 'auto'));
      return null;
    }
    var data = res.json;
    if (!data || !data.source || !data.source.url) {
      log('api no source key=' + (sourceKey || 'auto'));
      return null;
    }
    log(
      'api ok key=' +
        (sourceKey || 'auto') +
        ' subs=' +
        (data.subtitles && data.subtitles.length ? data.subtitles.length : 0) +
        (data.subtitles && data.subtitles.length ? ' sub0=' + Object.keys(data.subtitles[0] || {}).join('/') : '')
    );
    return data;
  }

  function buildResult(ok, extras) {
    extras = (extras || []).slice();
    for (var ei = 0; ei < extras.length; ei++) {
      var alternate = extras[ei];
      if (alternate && alternate.variants && alternate.variants.length &&
          (alternate.variants[0].height || 0) > (ok.variants[0].height || 0)) {
        extras[ei] = ok;
        ok = alternate;
      }
    }
    var streamsArray = [];
    var qualities = [];
    var headers = ok.headers || streamHeaders();
    for (var i = 0; i < ok.variants.length; i++) {
      var v = ok.variants[i];
      var label = qualityLabel(v.width, v.height);
      // keep duplicates distinct when the source ships several same-bucket rungs
      var lbl = label;
      if (i > 0 && lbl === qualities[qualities.length - 1].label) lbl = label + ' (' + (i + 1) + ')';
      var option = {
        label: lbl,
        height: v.height || 0,
        width: v.width || 0,
        url: v.url,
        headers: headers,
      };
      streamsArray.push(lbl, v.url);
      qualities.push(option);
    }
    var primary = ok.variants[0];
    var servers = [
      {
        name: ok.srcName,
        url: primary.url,
        headers: headers,
        subtitles: ok.subs || [],
        streamType: 'hls',
      },
    ];
    for (var e = 0; e < (extras || []).length; e++) {
      var x = extras[e];
      if (!x || !x.variants || !x.variants.length) continue;
      var xu = x.variants[0].url;
      var dup = false;
      for (var d = 0; d < servers.length; d++) {
        if (servers[d].url === xu) dup = true;
      }
      if (dup) continue;
      servers.push({
        name: x.srcName || 'Alternate',
        url: xu,
        headers: x.headers || headers,
        subtitles: x.subs || [],
        streamType: 'hls',
      });
    }
    return {
      url: primary.url,
      stream: primary.url,
      quality: qualityLabel(primary.width, primary.height),
      streamType: 'hls',
      streams: streamsArray,
      headers: headers,
      subtitles: ok.subs || [],
      qualities: qualities,
      servers: servers,
    };
  }

  function usableOnly(arr) {
    var out = [];
    for (var i = 0; i < (arr || []).length; i++) {
      if (arr[i]) out.push(arr[i]);
    }
    return out;
  }

  async function resolveFresh(ref) {
    var deadline = now() + INTERNAL_DEADLINE;

    // A slow primary must not hide an already verified independent route.
    var initial = await firstUsable([
      vidloveAttempt(ref, null, deadline),
      vidzenAttempt(ref, 'sv-ps', deadline),
      vidzenAttempt(ref, 'sv-pi', deadline),
    ], 350, deadline);
    var ready = usableOnly(initial);
    if (ready.length) return buildResult(ready[0], ready.slice(1));
    if (now() >= deadline) throw new Error('MovieDB: resolve budget exceeded');

    // Additional sources start only after the initial attempts have failed.
    var batches = [SOURCE_KEYS.slice(0, 1), SOURCE_KEYS.slice(1, 4), SOURCE_KEYS.slice(4)];
    for (var b = 0; b < batches.length; b++) {
      if (now() > deadline) break;
      var settled = await firstUsable(
        batches[b].map(function (key) {
          return vidloveAttempt(ref, key, deadline);
        }),
        250,
        deadline
      );
      var successes = usableOnly(settled);
      if (successes.length) return buildResult(successes[0], successes.slice(1));
    }
    throw new Error('MovieDB: no playable stream found for this title (source-side)');
  }

  function firstUsable(promises, graceMs, deadline) {
    return new Promise(function (resolve) {
      var settled = new Array(promises.length);
      var remaining = promises.length;
      var finished = false;
      var graceTimer = null;
      var deadlineTimer = null;
      function finish() {
        if (finished) return;
        finished = true;
        // Some module runtimes expose timers without a cancellation function.
        try {
          if (typeof clearTimeout === 'function') {
            if (graceTimer !== null) clearTimeout(graceTimer);
            if (deadlineTimer !== null) clearTimeout(deadlineTimer);
          }
        } catch (_) {}
        resolve(settled.slice());
      }
      function onSettle(index, res) {
        if (finished) return;
        if (!res || !res.variants || !res.variants.length) res = null;
        settled[index] = res;
        remaining -= 1;
        if (res && res.variants && res.variants.length) {
          if (graceTimer === null) graceTimer = setTimeout(finish, Math.max(0, Number(graceMs) || 0));
          if (remaining <= 0) finish();
          return;
        }
        if (remaining <= 0) finish();
      }
      if (typeof deadline === 'number') {
        deadlineTimer = setTimeout(finish, Math.max(0, deadline - now()));
      }
      if (!remaining) finish();
      promises.forEach(function (p, index) {
        Promise.resolve(p).then(
          function (res) {
            onSettle(index, res);
          },
          function () {
            onSettle(index, null);
          }
        );
      });
    });
  }

  function resolveKey(ref) {
    return ref.kind + ':' + ref.id + (ref.kind === 'tv' ? ':' + (ref.season || 1) + ':' + (ref.episode || 1) : '');
  }

  // Background subtitle top-up: when a prefetch resolve lands with zero
  // tracks (the API's subtitle answer is flaky), quietly re-ask a couple of
  // times and patch the cached result — off the user's critical path.
  function upgradeSubsInBackground(ref, key, triesLeft, expectedData) {
    if (triesLeft <= 0) return;
    callApi(ref, null, now() + INTERNAL_DEADLINE).then(
      function (d) {
        if (d && hasSubs(d)) {
          var hit = RESOLVE[key];
          if (hit && hit.data === expectedData) hit.data.subtitles = mapSubs(d.subtitles);
        } else {
          if (RESOLVE[key] && RESOLVE[key].data === expectedData) {
            upgradeSubsInBackground(ref, key, triesLeft - 1, expectedData);
          }
        }
      },
      function () {}
    );
  }

  function resolveStream(ref, background, bypassCache) {
    var key = resolveKey(ref);
    var t = now();
    if (bypassCache === true) {
      delete RESOLVE[key];
      delete NEG[key];
      delete INFLIGHT[key];
    }
    var hit = RESOLVE[key];
    if (hit && t - hit.at < RESOLVE_TTL) return Promise.resolve(hit.data);
    var neg = NEG[key];
    if (neg && t - neg.at < NEG_TTL) return Promise.reject(new Error(neg.msg));
    var inflight = INFLIGHT[key];
    if (inflight) return inflight;

    var p = resolveFresh(ref).then(
      function (data) {
        // A replaced prefetch must not overwrite a newer explicit retry.
        if (INFLIGHT[key] === p) {
          RESOLVE[key] = { at: now(), data: data };
          delete NEG[key];
          delete INFLIGHT[key];
          if (background && data && (!data.subtitles || !data.subtitles.length)) {
            upgradeSubsInBackground(ref, key, 2, data);
          }
        }
        return data;
      },
      function (err) {
        if (INFLIGHT[key] === p) {
          NEG[key] = { at: now(), msg: (err && err.message) || 'resolve failed' };
          delete INFLIGHT[key];
        }
        throw err;
      }
    );
    INFLIGHT[key] = p;
    return p;
  }

  /* ------------------------------------------------------------------ */
  /* Public exports                                                     */
  /* ------------------------------------------------------------------ */

  async function searchResults(query, page) {
    var q = String(query || '').trim();
    var pageIndex = Math.max(0, parseInt(page, 10) || 0);
    try {
      if (!q) {
        // legacy home row: the app calls searchResults('') for its home list;
        // there is only one "page" of that surface.
        if (pageIndex > 0) return [];
        var home = await fetchPage(SITE + '/home/');
        var secs = parseHomeSections(home);
        var flat = [];
        for (var i = 0; i < secs.length; i++) {
          for (var j = 0; j < secs[i].items.length; j++) flat.push(secs[i].items[j]);
        }
        return toCards(flat, 40);
      }
      var url = SITE + '/home/search?q=' + enc(q);
      if (pageIndex > 0) {
        // The site's own search repeats a few results between pages; a "next
        // page" must not re-serve what earlier pages already showed.
        var seenHrefs = Object.create(null);
        for (var pg = 1; pg <= pageIndex; pg++) {
          try {
            var pHtml = await fetchPage(pg === 1 ? url : url + '&page=' + pg);
            var pCards = filterAdult(parseCards(pHtml));
            for (var pi = 0; pi < pCards.length; pi++) seenHrefs[pCards[pi].href] = true;
          } catch (_) {}
        }
        var htmlP = await fetchPage(url + '&page=' + (pageIndex + 1));
        var cardsP = filterAdult(parseCards(htmlP));
        var outP = [];
        for (var ci = 0; ci < cardsP.length; ci++) {
          if (seenHrefs[cardsP[ci].href]) continue;
          outP.push(cardsP[ci]);
        }
        return toCards(outP, 40);
      }
      var html = await fetchPage(url);
      var cards = filterAdult(parseCards(html));
      return toCards(cards, 40);
    } catch (e) {
      log('searchResults failed: ' + (e && e.message ? e.message : e));
      return [];
    }
  }

  async function extractDetails(urlOrId) {
    var ref = parseRef(urlOrId);
    if (!ref) throw new Error('MovieDB: unrecognized reference');
    var pageUrl = cardHref(ref.kind, ref.id, ref.slug || '');
    var html = await fetchPage(pageUrl);
    var parsed = parseDetailsPage(html, ref);

    if (!parsed.image) {
      // rare: fall back to the provider meta (one cheap call) — never a logo.
      try {
        var deadline = now() + 6000;
        var data = await callApi(ref, null, deadline);
        var mp = data && data.meta && data.meta.poster_path;
        if (mp && typeof mp === 'string') {
          parsed.image = mp.indexOf('http') === 0 ? mp : 'https://image.tmdb.org/t/p/w500' + mp;
        }
      } catch (_) {}
    }

    // Prefetch: warm the resolve path for movies while the user reads the page
    // (subscription top-ups keep working in the background from here).
    if (ref.kind === 'movie') {
      try {
        resolveStream({ kind: 'movie', id: ref.id, season: null, episode: null }, true).catch(function () {});
      } catch (_) {}
    }

    return {
      title: parsed.title || 'MovieDB',
      description: parsed.description || '',
      image: parsed.image || '',
      year: parsed.year || null,
      genres: parsed.genres || [],
      url: pageUrl,
      href: pageUrl,
      id: ref.id,
      kind: ref.kind,
    };
  }

  async function extractEpisodes(seriesId) {
    var ref = parseRef(seriesId);
    if (!ref) throw new Error('MovieDB: unrecognized reference');

    // Movies play as a single synthetic episode (module contract convention).
    if (ref.kind === 'movie') {
      var movieTitle = '';
      try {
        var d = await extractDetails(seriesId);
        movieTitle = d && d.title ? d.title : '';
      } catch (_) {}
      return [
        {
          number: 1,
          season: 1,
          title: movieTitle || 'Full Movie',
          href: 'mdb:movie:' + ref.id,
          isMovie: true,
          mediaType: 'movie',
          subAvailable: true,
          dubAvailable: false,
        },
      ];
    }

    var pageUrl = cardHref('tv', ref.id, ref.slug || '');
    var html = await fetchPage(pageUrl);
    var seasons = parseSeasons(html);
    var out = [];
    for (var s = 0; s < seasons.length; s++) {
      var season = seasons[s];
      if (!season.count || season.count < 1) continue;
      var cap = Math.min(season.count, 2000);
      for (var e = 1; e <= cap; e++) {
        out.push({
          number: e,
          season: season.season,
          href: 'mdb:tv:' + ref.id + ':' + season.season + ':' + e,
          title: 'S' + season.season + 'E' + e,
          subAvailable: true,
          dubAvailable: false,
        });
        if (out.length >= 4000) break;
      }
    }
    if (!out.length) {
      throw new Error('MovieDB: no episode list available for this series (source-side)');
    }
    return out;
  }

  async function extractStreamUrl(episodeHref, lang, bypassCache) {
    var ref = parseRef(episodeHref);
    if (!ref) throw new Error('MovieDB: unrecognized episode reference');
    if (ref.kind === 'tv' && (!ref.season || !ref.episode)) {
      ref.season = ref.season || 1;
      ref.episode = ref.episode || 1;
    }
    log('resolve ' + resolveKey(ref));
    var data = await resolveStream(ref, false, bypassCache);
    return data;
  }

  async function discoveryHome() {
    try {
      var home = await fetchPage(SITE + '/home/');
      var sections = parseHomeSections(home);
      if (!sections.length) return { sections: [] };
      registerFeedViews(sections);
      var out = [];
      // hero first (app inserts Continue Watching after the first hero)
      var first = sections[0];
      var heroItems = toCards(first.items, 8);
      // hero art: the app prefers backdropUrl then posterUrl — upscale the
      // TMDB sibling for full-width banner use
      for (var h = 0; h < heroItems.length; h++) {
        var img = heroItems[h].image || '';
        if (img.indexOf('image.tmdb.org') >= 0) {
          heroItems[h].backdropUrl = img.replace('/t/p/w342/', '/t/p/w780/').replace('/t/p/w500/', '/t/p/w780/');
        }
      }
      out.push({
        id: 'featured',
        title: first.title || 'Featured',
        style: 'hero',
        items: heroItems,
      });
      for (var i = 1; i < sections.length; i++) {
        var sec = sections[i];
        var items = toCards(sec.items, 30);
        if (items.length < 3) continue;
        var item = {
          id: sectionId(sec.title, i),
          title: (sec.title || 'Section').slice(0, 80),
          style: 'poster',
          items: items,
        };
        if (sec.viewAll) {
          var fid = feedIdFor(sec.viewAll);
          item.viewAll = { mode: 'feed', feedId: fid };
        }
        out.push(item);
        if (out.length >= 12) break;
      }
      return { sections: out };
    } catch (e) {
      log('discoveryHome failed: ' + (e && e.message ? e.message : e));
      return { sections: [] };
    }
  }

  async function discoveryFeed(feedId, page) {
    var pg = Math.max(1, parseInt(page || 1, 10) || 1);
    try {
      var fid = String(feedId || '');
      if (fid === 'home') {
        var h0 = await fetchPage(SITE + '/home/');
        var secs0 = parseHomeSections(h0);
        var flat = [];
        for (var i = 0; i < secs0.length; i++) {
          for (var j = 0; j < secs0[i].items.length; j++) flat.push(secs0[i].items[j]);
        }
        return { items: toCards(flat, 50), page: pg, hasMore: false };
      }

      // rebuild the feed registry if this instance hasn't served home yet
      if (!FEEDS[fid]) {
        var h1 = await fetchPage(SITE + '/home/');
        registerFeedViews(parseHomeSections(h1));
      }
      var href = FEEDS[fid];
      if (!href) return { items: [], page: pg, hasMore: false };

      var url = pagedUrl(href, pg);
      var html = await fetchPage(url);
      var cards = filterAdult(parseCards(html));
      var items = toCards(cards, 50);
      // hasMore: trust the page's own next-link signal first
      var hasNext = /rel=["']next["']/i.test(html);
      var hasMore = items.length > 0 && (hasNext || items.length >= 15);
      return { items: items, page: pg, hasMore: hasMore };
    } catch (e) {
      log('discoveryFeed failed: ' + (e && e.message ? e.message : e));
      return { items: [], page: pg, hasMore: false };
    }
  }

  /* ------------------------------------------------------------------ */
  /* Global exports                                                     */
  /* ------------------------------------------------------------------ */

  globalThis.searchResults = searchResults;
  globalThis.extractDetails = extractDetails;
  globalThis.extractEpisodes = extractEpisodes;
  globalThis.extractStreamUrl = extractStreamUrl;
  globalThis.discoveryHome = discoveryHome;
  globalThis.discoveryFeed = discoveryFeed;
})();
