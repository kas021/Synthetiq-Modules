(() => {
  'use strict';

  const MODULE_NAME = 'XStream';
  const SITE = 'https://xstream.free.nf';
  const IMG = 'https://image.tmdb.org/t/p';
  const TMDB = 'https://api.themoviedb.org/3';
  // Public TMDB v3 key used by several Synthetiq movie modules for metadata only.
  const TMDB_KEY = 'e1a8efff4415028c5c266b3fcd50db6e';
  const VIDZEE_DL = 'https://dl.vidzee.wtf/download';
  const MOVIESAPI = 'https://moviesapi.to';
  // Reliable HLS provider for titles whose Vidzee/Pixeldrain hosts are dead.
  const LOOKMOVIE = 'https://www.lookmovie2.to';
  // Free site Server 1 embeds Videasy — multi-quality HLS incl. 1080p / 4K without account.
  const VIDEASY_API = 'https://api.speedracelight.com';
  const VIDEASY_PLAYER = 'https://player.videasy.to';
  // Server-side Wyzie proxy (keys never ship in the module).
  const SUBS_API = 'https://one.synthetiq.uk/v1/subs';
  const USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';

  // free.nf anti-bot challenge constants (key/iv are site-stable; ciphertext rotates).
  const FREEHOST_KEY_HEX = 'f655ba9d09a112d4968c63579db590b4';
  const FREEHOST_IV_HEX = '98344c2eee86c3994890592585b49f80';

  let freehostCookie = '';
  let freehostCookieAt = 0;
  const FREEHOST_COOKIE_TTL_MS = 4 * 60 * 60 * 1000;

  const detailsCache = Object.create(null);
  const streamCache = Object.create(null);
  const seasonCache = Object.create(null);
  const lookmovieHitCache = Object.create(null);
  const videasySeedCache = Object.create(null);
  const inFlightDetailsMap = Object.create(null);
  const inFlightSeedMap = Object.create(null);
  const inFlightStreamMap = Object.create(null);
  // Session-only provider state. It is deliberately not persisted or sent to
  // the backend; it only prevents a failing provider from delaying a session.
  const providerHealth = Object.create(null);
  const providerHalfOpen = Object.create(null);
  const hostCooldowns = Object.create(null);
  let freshRequestNonce = 0;
  const PROVIDER_MAX_ATTEMPTS = 2;
  const STREAM_CACHE_TTL_MS = 60 * 1000;
  const PROVIDER_QUARANTINE_MS = 60 * 1000;

  function log(message) {
    try {
      console.log('[' + MODULE_NAME + '] ' + String(message || ''));
    } catch (_) {}
  }

  function cleanText(value) {
    return String(value == null ? '' : value)
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#0?39;|&apos;/gi, "'")
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function settleWithin(promise, timeoutMs, fallback) {
    const waitMs = Math.max(1, Number(timeoutMs) || 0);
    let timer;
    return Promise.race([promise, new Promise(resolve => {
      timer = setTimeout(() => resolve(fallback), waitMs);
    })]).finally(() => { if (typeof clearTimeout === 'function') clearTimeout(timer); });
  }

  /* -------------------- compact AES-128-CBC (hex) -------------------- */

  const SBOX = [
    99, 124, 119, 123, 242, 107, 111, 197, 48, 1, 103, 43, 254, 215, 171, 118, 202, 130, 201, 125, 250, 89, 71, 240, 173,
    212, 162, 175, 156, 164, 114, 192, 183, 253, 147, 38, 54, 63, 247, 204, 52, 165, 229, 241, 113, 216, 49, 21, 4, 199,
    35, 195, 24, 150, 5, 154, 7, 18, 128, 226, 235, 39, 178, 117, 9, 131, 44, 26, 27, 110, 90, 160, 82, 59, 214, 179, 41,
    227, 47, 132, 83, 209, 0, 237, 32, 252, 177, 91, 106, 203, 190, 57, 74, 76, 88, 207, 208, 239, 170, 251, 67, 77, 51,
    133, 69, 249, 2, 127, 80, 60, 159, 168, 81, 163, 64, 143, 146, 157, 56, 245, 188, 182, 218, 33, 16, 255, 243, 210, 205,
    12, 19, 236, 95, 151, 68, 23, 196, 167, 126, 61, 100, 93, 25, 115, 96, 129, 79, 220, 34, 42, 144, 136, 70, 238, 184,
    20, 222, 94, 11, 219, 224, 50, 58, 10, 73, 6, 36, 92, 194, 211, 172, 98, 145, 149, 228, 121, 231, 200, 55, 109, 141,
    213, 78, 169, 108, 86, 244, 234, 101, 122, 174, 8, 186, 120, 37, 46, 28, 166, 180, 198, 232, 221, 116, 31, 75, 189,
    139, 138, 112, 62, 181, 102, 72, 3, 246, 14, 97, 53, 87, 185, 134, 193, 29, 158, 225, 248, 152, 17, 105, 217, 142, 148,
    155, 30, 135, 233, 206, 85, 40, 223, 140, 161, 137, 13, 191, 230, 66, 104, 65, 153, 45, 15, 176, 84, 187, 22,
  ];
  const RSBOX = [
    82, 9, 106, 213, 48, 54, 165, 56, 191, 64, 163, 158, 129, 243, 215, 251, 124, 227, 57, 130, 155, 47, 255, 135, 52, 142,
    67, 68, 196, 222, 233, 203, 84, 123, 148, 50, 166, 194, 35, 61, 238, 76, 149, 11, 66, 250, 195, 78, 8, 46, 161, 102, 40,
    217, 36, 178, 118, 91, 162, 73, 109, 139, 209, 37, 114, 248, 246, 100, 134, 104, 152, 22, 212, 164, 92, 204, 93, 101,
    182, 146, 108, 112, 72, 80, 253, 237, 185, 218, 94, 21, 70, 87, 167, 141, 157, 132, 144, 216, 171, 0, 140, 188, 211,
    10, 247, 228, 88, 5, 184, 179, 69, 6, 208, 44, 30, 143, 202, 63, 15, 2, 193, 175, 189, 3, 1, 19, 138, 107, 58, 145, 17,
    65, 79, 103, 220, 234, 151, 242, 207, 206, 240, 180, 230, 115, 150, 172, 116, 34, 231, 173, 53, 133, 226, 249, 55, 232,
    28, 117, 223, 110, 71, 241, 26, 113, 29, 41, 197, 137, 111, 183, 98, 14, 170, 24, 190, 27, 252, 86, 62, 75, 198, 210,
    121, 32, 154, 219, 192, 254, 120, 205, 90, 244, 31, 221, 168, 51, 136, 7, 199, 49, 177, 18, 16, 89, 39, 128, 236, 95,
    96, 81, 127, 169, 25, 181, 74, 13, 45, 229, 122, 159, 147, 201, 156, 239, 160, 224, 59, 77, 174, 42, 245, 176, 200, 235,
    187, 60, 131, 83, 153, 97, 23, 43, 4, 126, 186, 119, 214, 38, 225, 105, 20, 99, 85, 33, 12, 125,
  ];
  const RCON = [0x00, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];

  function hexToBytes(hex) {
    const out = [];
    const s = String(hex || '').replace(/\s+/g, '');
    for (let i = 0; i < s.length; i += 2) out.push(parseInt(s.substr(i, 2), 16));
    return out;
  }

  function bytesToHex(bytes) {
    let out = '';
    for (let i = 0; i < bytes.length; i++) {
      const h = bytes[i].toString(16);
      out += h.length === 1 ? '0' + h : h;
    }
    return out;
  }

  function gmul(a, b) {
    let p = 0;
    for (let i = 0; i < 8; i++) {
      if (b & 1) p ^= a;
      const hi = a & 0x80;
      a = (a << 1) & 0xff;
      if (hi) a ^= 0x1b;
      b >>= 1;
    }
    return p;
  }

  function expandKey(key) {
    const Nk = 4;
    const Nr = 10;
    const w = new Array(4 * (Nr + 1));
    for (let i = 0; i < Nk; i++) {
      w[i] = [key[4 * i], key[4 * i + 1], key[4 * i + 2], key[4 * i + 3]];
    }
    for (let i = Nk; i < 4 * (Nr + 1); i++) {
      let temp = w[i - 1].slice();
      if (i % Nk === 0) {
        temp = [SBOX[temp[1]], SBOX[temp[2]], SBOX[temp[3]], SBOX[temp[0]]];
        temp[0] ^= RCON[i / Nk];
      }
      w[i] = [
        w[i - Nk][0] ^ temp[0],
        w[i - Nk][1] ^ temp[1],
        w[i - Nk][2] ^ temp[2],
        w[i - Nk][3] ^ temp[3],
      ];
    }
    return w;
  }

  function addRoundKey(state, w, round) {
    for (let c = 0; c < 4; c++) {
      for (let r = 0; r < 4; r++) state[r][c] ^= w[round * 4 + c][r];
    }
  }

  function invSubBytes(state) {
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) state[r][c] = RSBOX[state[r][c]];
  }

  function invShiftRows(state) {
    const t = state[1][3];
    state[1][3] = state[1][2];
    state[1][2] = state[1][1];
    state[1][1] = state[1][0];
    state[1][0] = t;
    const a = state[2][0];
    const b = state[2][1];
    state[2][0] = state[2][2];
    state[2][1] = state[2][3];
    state[2][2] = a;
    state[2][3] = b;
    const x = state[3][0];
    state[3][0] = state[3][1];
    state[3][1] = state[3][2];
    state[3][2] = state[3][3];
    state[3][3] = x;
  }

  function invMixColumns(state) {
    for (let c = 0; c < 4; c++) {
      const a0 = state[0][c];
      const a1 = state[1][c];
      const a2 = state[2][c];
      const a3 = state[3][c];
      state[0][c] = gmul(a0, 0x0e) ^ gmul(a1, 0x0b) ^ gmul(a2, 0x0d) ^ gmul(a3, 0x09);
      state[1][c] = gmul(a0, 0x09) ^ gmul(a1, 0x0e) ^ gmul(a2, 0x0b) ^ gmul(a3, 0x0d);
      state[2][c] = gmul(a0, 0x0d) ^ gmul(a1, 0x09) ^ gmul(a2, 0x0e) ^ gmul(a3, 0x0b);
      state[3][c] = gmul(a0, 0x0b) ^ gmul(a1, 0x0d) ^ gmul(a2, 0x09) ^ gmul(a3, 0x0e);
    }
  }

  function decryptBlock(input, w) {
    const state = [
      [input[0], input[4], input[8], input[12]],
      [input[1], input[5], input[9], input[13]],
      [input[2], input[6], input[10], input[14]],
      [input[3], input[7], input[11], input[15]],
    ];
    const Nr = 10;
    addRoundKey(state, w, Nr);
    for (let round = Nr - 1; round >= 1; round--) {
      invShiftRows(state);
      invSubBytes(state);
      addRoundKey(state, w, round);
      invMixColumns(state);
    }
    invShiftRows(state);
    invSubBytes(state);
    addRoundKey(state, w, 0);
    const out = new Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) out[c * 4 + r] = state[r][c];
    return out;
  }

  function aesCbcDecryptHex(cipherHex, keyHex, ivHex) {
    const key = hexToBytes(keyHex);
    const iv = hexToBytes(ivHex);
    const cipher = hexToBytes(cipherHex);
    if (cipher.length % 16 !== 0 || !cipher.length) return '';
    const w = expandKey(key);
    const plain = [];
    let prev = iv.slice();
    for (let i = 0; i < cipher.length; i += 16) {
      const block = cipher.slice(i, i + 16);
      const dec = decryptBlock(block, w);
      for (let j = 0; j < 16; j++) plain.push(dec[j] ^ prev[j]);
      prev = block;
    }
    // free.nf uses toHex(decrypt(...)) of the full 16-byte block (padding included).
    return bytesToHex(plain);
  }

  function extractChallenge(html) {
    const nums = String(html || '').match(/toNumbers\(\"([0-9a-f]+)\"\)/gi);
    if (!nums || nums.length < 3) return null;
    const values = nums.slice(0, 3).map((n) => {
      const m = n.match(/toNumbers\(\"([0-9a-f]+)\"\)/i);
      return m ? m[1] : '';
    });
    if (values.some((v) => !v)) return null;
    return { a: values[0], b: values[1], c: values[2] };
  }

  function isChallengePage(html) {
    const text = String(html || '');
    return text.indexOf('toNumbers') >= 0 && text.indexOf('slowAES') >= 0 && text.length < 4000;
  }

  /* -------------------- HTTP -------------------- */

  async function readBody(res) {
    if (!res) return '';
    if (typeof res.body === 'string' && res.body.length) return res.body;
    if (typeof res.text === 'function') {
      try {
        const text = await res.text();
        if (typeof text === 'string' && text.length) return text;
      } catch (_) {}
    }
    if (typeof res.json === 'function') {
      try {
        return JSON.stringify(await res.json());
      } catch (_) {}
    }
    return '';
  }

  async function rawRequest(url, options) {
    const cfg = options || {};
    const headers = Object.assign(
      {
        'User-Agent': USER_AGENT,
        Accept: cfg.accept || '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      cfg.headers || {},
    );
    const method = cfg.method || 'GET';
    const body = cfg.body == null ? null : cfg.body;
    let res = null;
    try {
      if (typeof fetchv2 === 'function') {
        res = await fetchv2(url, headers, method, body);
      } else if (typeof fetch === 'function') {
        res = await fetch(url, { method, headers, body });
      } else {
        return { ok: false, status: 0, body: '', headers: {}, url };
      }
    } catch (e) {
      log('rawRequest fail ' + String(url || '').slice(0, 90) + ': ' + (e && e.message ? e.message : e));
      return { ok: false, status: 0, body: '', headers: {}, url };
    }
    const status = Number((res && res.status) || 0);
    const ok =
      res &&
      (res.ok === true ||
        res.ok === 1 ||
        (!status && res.ok !== false) ||
        (status >= 200 && status < 400));
    const text = await readBody(res);
    const resHeaders =
      (res && res.headers) ||
      (res && typeof res.get === 'function'
        ? { 'content-type': res.get('content-type') || res.get('Content-Type') || '' }
        : {});
    return { ok: !!ok, status, body: text || '', headers: resHeaders, url };
  }

  async function ensureFreehostCookie(force) {
    const now = Date.now();
    if (!force && freehostCookie && now - freehostCookieAt < FREEHOST_COOKIE_TTL_MS) {
      return freehostCookie;
    }
    const challenge = await rawRequest(SITE + '/?i=1', {
      accept: 'text/html,*/*',
      headers: { Referer: SITE + '/' },
    });
    const ch = extractChallenge(challenge.body);
    if (!ch) {
      // Sometimes the host already lets us through.
      freehostCookie = freehostCookie || 'ok';
      freehostCookieAt = now;
      return freehostCookie;
    }
    const key = ch.a || FREEHOST_KEY_HEX;
    const iv = ch.b || FREEHOST_IV_HEX;
    const cookie = aesCbcDecryptHex(ch.c, key, iv);
    if (!cookie) {
      log('freehost cookie decrypt failed');
      return freehostCookie || '';
    }
    freehostCookie = cookie;
    freehostCookieAt = now;
    log('freehost cookie ready');
    return freehostCookie;
  }

  async function siteRequest(pathOrUrl, options) {
    const cfg = options || {};
    const url = /^https?:\/\//i.test(pathOrUrl) ? pathOrUrl : SITE + (pathOrUrl.charAt(0) === '/' ? pathOrUrl : '/' + pathOrUrl);
    await ensureFreehostCookie(false);
    const headers = Object.assign(
      {
        Referer: SITE + '/',
        Cookie: freehostCookie && freehostCookie !== 'ok' ? '__test=' + freehostCookie : '',
      },
      cfg.headers || {},
    );
    let res = await rawRequest(url, Object.assign({}, cfg, { headers }));
    if (isChallengePage(res.body)) {
      await ensureFreehostCookie(true);
      headers.Cookie = '__test=' + freehostCookie;
      res = await rawRequest(url, Object.assign({}, cfg, { headers }));
    }
    return res;
  }

  async function siteJson(pathOrUrl, options) {
    const res = await siteRequest(pathOrUrl, Object.assign({ accept: 'application/json,*/*' }, options || {}));
    if (!res.body) return null;
    try {
      return JSON.parse(res.body);
    } catch (_) {
      return null;
    }
  }

  function freshRequestUrl(url, attempt) {
    const raw = String(url || '');
    if (!raw || !attempt) return raw;
    const nonce =
      Date.now().toString(36) +
      '-' +
      (++freshRequestNonce).toString(36) +
      '-' +
      String(attempt);
    return raw + (raw.indexOf('?') >= 0 ? '&' : '?') + '_xstream_retry=' + encodeURIComponent(nonce);
  }

  async function externalRequest(url, options) {
    const cfg = options || {};
    const host = String((String(url).match(/^https?:\/\/([^/?#]+)/i) || [])[1] || '').toLowerCase();
    const until = hostCooldowns[host] || 0;
    if (until > Date.now()) {
      return { status: 429, body: '', headers: { 'retry-after': String(Math.ceil((until - Date.now()) / 1000)) } };
    }
    delete hostCooldowns[host];
    const requestUrl = cfg.fresh ? freshRequestUrl(url, cfg.attempt || 1) : url;
    const requestOptions = Object.assign({}, cfg);
    delete requestOptions.fresh;
    delete requestOptions.attempt;
    const response = await rawRequest(requestUrl, requestOptions);
    const status = Number(response && response.status);
    const headers = (response && response.headers) || {};
    const headerKey = Object.keys(headers).find(function (key) { return key.toLowerCase() === 'retry-after'; });
    const value = String(typeof headers.get === 'function' ? headers.get('retry-after') || '' : headers[headerKey] || '').trim();
    if (status === 429 || (status === 503 && value)) {
      const delay = /^\d+$/.test(value) ? Number(value) * 1000 : Date.parse(value) - Date.now();
      hostCooldowns[host] = Math.max(hostCooldowns[host] || 0, Date.now() + (Number.isFinite(delay) ? Math.max(1000, delay) : 60000));
    }
    return response;
  }

  /* -------------------- IDs / mapping -------------------- */

  function posterUrl(path, size) {
    if (!path) return '';
    const raw = String(path);
    if (/^https?:\/\//i.test(raw)) return raw;
    return IMG + '/' + (size || 'w500') + (raw.charAt(0) === '/' ? raw : '/' + raw);
  }

  // IMPORTANT: use real site paths (not custom schemes). The app joins baseUrl +
  // href for extractDetails; custom schemes become unparseable and show as the title.
  function encodeHref(type, id, season, episode) {
    if (type === 'tv') {
      if (season != null && episode != null) {
        return (
          SITE +
          '/watch.php?type=tv&id=' +
          id +
          '&season=' +
          season +
          '&episode=' +
          episode
        );
      }
      return SITE + '/tv.php?id=' + id;
    }
    if (season != null && episode != null) {
      return SITE + '/watch.php?type=movie&id=' + id;
    }
    return SITE + '/movie.php?id=' + id;
  }

  function parseHref(input) {
    const raw = String(input || '').trim();
    if (!raw) return null;

    // App may prepend baseUrl to an already-absolute or custom href — strip it.
    let cleaned = raw;
    cleaned = cleaned.replace(/^https?:\/\/xstream\.free\.nf\/+https?:\/\//i, 'https://');
    cleaned = cleaned.replace(/^https?:\/\/xstream\.free\.nf\/+xstream:\/\//i, 'xstream://');
    if (/xstream:\/\//i.test(cleaned) && cleaned.indexOf('http') === 0) {
      const idx = cleaned.toLowerCase().indexOf('xstream://');
      if (idx >= 0) cleaned = cleaned.slice(idx);
    }

    let m = cleaned.match(/^xstream:\/\/(movie|tv)\/(\d+)(?:\/(\d+)\/(\d+))?$/i);
    if (m) {
      return {
        type: m[1].toLowerCase(),
        id: m[2],
        season: m[3] ? Number(m[3]) : null,
        episode: m[4] ? Number(m[4]) : null,
      };
    }
    m = cleaned.match(/watch\.php\?[^#]*type=(movie|tv)&id=(\d+)(?:&season=(\d+)&episode=(\d+))?/i);
    if (m) {
      return {
        type: m[1].toLowerCase(),
        id: m[2],
        season: m[3] ? Number(m[3]) : null,
        episode: m[4] ? Number(m[4]) : null,
      };
    }
    m = cleaned.match(/(movie|tv)\.php\?id=(\d+)/i);
    if (m) return { type: m[1].toLowerCase(), id: m[2], season: null, episode: null };
    m = cleaned.match(/\/(movie|tv)\/(\d+)(?:\/(\d+)\/(\d+))?/i);
    if (m) {
      return {
        type: m[1].toLowerCase(),
        id: m[2],
        season: m[3] ? Number(m[3]) : null,
        episode: m[4] ? Number(m[4]) : null,
      };
    }
    m = cleaned.match(/^(movie|tv):(\d+)(?::(\d+):(\d+))?$/i);
    if (m) {
      return {
        type: m[1].toLowerCase(),
        id: m[2],
        season: m[3] ? Number(m[3]) : null,
        episode: m[4] ? Number(m[4]) : null,
      };
    }
    if (/^\d+$/.test(cleaned)) return { type: 'movie', id: cleaned, season: null, episode: null };
    return null;
  }

  function mediaTypeOf(item) {
    const t = String((item && (item.media_type || item.mediaType || item.type)) || '').toLowerCase();
    if (t === 'tv' || t === 'show' || t === 'series') return 'tv';
    if (t === 'movie') return 'movie';
    if (item && (item.first_air_date || item.name) && !item.title) return 'tv';
    return 'movie';
  }

  function itemTitle(item) {
    return cleanText((item && (item.title || item.name || item.original_title || item.original_name)) || '');
  }

  function mapTmdbCard(item) {
    if (!item || item.id == null) return null;
    const type = mediaTypeOf(item);
    const id = String(item.id);
    const title = itemTitle(item);
    if (!title) return null;
    const image = posterUrl(item.poster_path || item.backdrop_path, 'w500');
    const year = String((item.release_date || item.first_air_date || '').slice(0, 4) || '');
    const rating =
      item.vote_average != null && item.vote_average !== ''
        ? String(Number(item.vote_average).toFixed(1))
        : '';
    return {
      id: encodeHref(type, id),
      href: encodeHref(type, id),
      title,
      image: image || '',
      poster: image || '',
      description: cleanText(item.overview || ''),
      type,
      mediaType: type,
      rating,
      releaseDate: item.release_date || item.first_air_date || '',
      year,
    };
  }

  function parseHtmlCards(html) {
    const out = [];
    const seen = Object.create(null);
    const text = String(html || '');

    // Home/search use content-card; anime.php uses anime-card.
    const re =
      /<div class="(?:content-card|anime-card)"[^>]*data-id="(\d+)"[^>]*data-type="(movie|tv)"[\s\S]*?<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"/gi;
    let m;
    while ((m = re.exec(text))) {
      const id = m[1];
      const type = m[2].toLowerCase();
      const key = type + ':' + id;
      if (seen[key]) continue;
      seen[key] = true;
      let image = String(m[3] || '').trim();
      if (/placeholder|via\.placeholder/i.test(image)) image = '';
      const title = cleanText(m[4]);
      if (!title) continue;
      // rating/year optional — scan a small window after the match
      const window = text.slice(m.index, m.index + 900);
      const rating = cleanText((window.match(/class="card-rating"[^>]*>[\s\S]*?<\/i>\s*([\d.]+)/i) || [])[1] || '');
      const year = cleanText((window.match(/class="card-year"[^>]*>([^<]+)/i) || [])[1] || '');
      out.push({
        id: encodeHref(type, id),
        href: encodeHref(type, id),
        title,
        image: image || '',
        poster: image || '',
        type,
        mediaType: type,
        rating,
        year,
      });
    }

    // Looser fallback: any data-id/data-type card with nearby image + alt.
    if (!out.length) {
      const loose =
        /data-id="(\d+)"[^>]*data-type="(movie|tv)"[\s\S]{0,800}?<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"/gi;
      while ((m = loose.exec(text))) {
        const id = m[1];
        const type = m[2].toLowerCase();
        const key = type + ':' + id;
        if (seen[key]) continue;
        seen[key] = true;
        let image = String(m[3] || '').trim();
        if (/placeholder|via\.placeholder/i.test(image)) image = '';
        const title = cleanText(m[4]);
        if (!title) continue;
        out.push({
          id: encodeHref(type, id),
          href: encodeHref(type, id),
          title,
          image,
          poster: image,
          type,
          mediaType: type,
        });
      }
    }
    return out;
  }

  async function tmdbJson(path, options) {
    const url =
      TMDB +
      path +
      (path.indexOf('?') >= 0 ? '&' : '?') +
      'api_key=' +
      encodeURIComponent(TMDB_KEY) +
      '&language=en-US';
    const res = await settleWithin(
      externalRequest(url, Object.assign(
        {
        accept: 'application/json,*/*',
        headers: { 'User-Agent': USER_AGENT, Referer: 'https://www.themoviedb.org/' },
        },
        options && options.fresh ? { fresh: true, attempt: options.attempt || 1 } : {},
      )),
      10000,
      null,
    );
    if (!res || !res.body) return null;
    try {
      return JSON.parse(res.body);
    } catch (_) {
      return null;
    }
  }

  /* -------------------- catalogue -------------------- */

  async function loadMorePage(page, type) {
    const pageNum = Math.max(1, Number(page) || 1);
    // xstream.free.nf is suspended by the free host ("Domain Suspended"), so the
    // site catalogue endpoints are dead. TMDB is the catalogue now; the stream
    // pipeline never depended on the site.
    let path;
    if (type === 'movie') path = '/movie/popular?page=' + pageNum;
    else if (type === 'tv') path = '/tv/popular?page=' + pageNum;
    else if (type === 'anime')
      path =
        '/discover/tv?with_genres=16&with_origin_country=JP&sort_by=popularity.desc&page=' +
        pageNum;
    else path = '/trending/all/week?page=' + pageNum;
    const data = await tmdbJson(path);
    const rows = data && Array.isArray(data.results) ? data.results : [];
    const forcedType =
      type === 'anime' ? 'tv' : type === 'movie' || type === 'tv' ? type : '';
    const items = rows
      .map((row) => {
        if (!row) return null;
        if (forcedType && !row.media_type) row.media_type = forcedType;
        if (String(row.media_type || '').toLowerCase() === 'person') return null;
        return mapTmdbCard(row);
      })
      .filter(Boolean);
    const totalPages = Number((data && data.total_pages) || 0);
    return {
      items,
      page: Number((data && data.page) || pageNum),
      hasMore: totalPages ? pageNum < totalPages : items.length >= 15,
      totalPages,
    };
  }

  async function searchApi(query, page) {
    const q = String(query || '').trim();
    if (!q) return loadMorePage((Number(page) || 0) + 1);
    // Site search died with the suspended host; TMDB multi-search is primary.
    const pageNum = Math.max(0, Number(page) || 0);
    const data = await tmdbJson(
      '/search/multi?query=' +
        encodeURIComponent(q) +
        '&include_adult=false&page=' +
        (pageNum + 1),
    );
    const rows = data && Array.isArray(data.results) ? data.results : [];
    const items = rows
      .filter((row) => {
        const t = mediaTypeOf(row);
        return t === 'movie' || t === 'tv';
      })
      .map(mapTmdbCard)
      .filter(Boolean);
    const totalPages = Number((data && data.total_pages) || 0);
    return {
      items,
      page: pageNum + 1,
      hasMore: totalPages ? pageNum + 1 < totalPages : items.length >= 12,
    };
  }

  async function searchTmdbFallback(query) {
    const q = String(query || '').trim();
    if (!q) return [];
    try {
      const data = await tmdbJson(
        '/search/multi?query=' + encodeURIComponent(q) + '&include_adult=false&page=1',
      );
      const rows = data && Array.isArray(data.results) ? data.results : [];
      const out = [];
      for (let i = 0; i < rows.length && out.length < 30; i++) {
        const row = rows[i];
        if (!row) continue;
        const mt = String(row.media_type || '').toLowerCase();
        if (mt !== 'movie' && mt !== 'tv') continue;
        const id = Number(row.id);
        if (!id) continue;
        const title = String(row.title || row.name || row.original_title || row.original_name || '').trim();
        if (!title) continue;
        const year = String(row.release_date || row.first_air_date || '').slice(0, 4);
        out.push({
          href: encodeHref(mt, id),
          id: encodeHref(mt, id),
          title: title + (year ? ' (' + year + ')' : ''),
          image: posterUrl(row.poster_path || row.backdrop_path || ''),
          poster: posterUrl(row.poster_path || row.backdrop_path || ''),
          type: mt,
          mediaType: mt,
          year: year || undefined,
        });
      }
      if (out.length) log('searchTmdbFallback n=' + out.length + ' for ' + q);
      return out;
    } catch (e) {
      log('searchTmdbFallback fail: ' + (e && e.message ? e.message : e));
      return [];
    }
  }

  async function searchResults(query, page) {
    const q = String(query == null ? '' : query).trim();
    const pageNum = Number(page || 0);
    log('searchResults q=' + (q || '(home)') + ' page=' + pageNum);
    try {
      if (!q) {
        const home = await loadMorePage(pageNum + 1);
        return home.items.slice(0, 40);
      }
      const result = await searchApi(q, pageNum);
      let items = (result && result.items) || [];
      // Freehost search can flake; TMDB multi-search keeps catalogue usable.
      if (!items.length && pageNum <= 0) {
        items = await searchTmdbFallback(q);
      }
      return items.slice(0, 40);
    } catch (error) {
      log('searchResults error: ' + (error && error.message ? error.message : error));
      try {
        return (await searchTmdbFallback(q)).slice(0, 40);
      } catch (_) {
        return [];
      }
    }
  }

  async function discoveryHome() {
    log('discoveryHome');
    // IMPORTANT: each section's seed items must be page 1 of its feedId.
    // The app always requests nextPage=2 next. Seeding page 3 while paging
    // from 2 causes all-duplicate pages and stops endless scroll.
    const [trending, movies, tv, anime] = await Promise.all([
      loadMorePage(1),
      loadMorePage(1, 'movie'),
      loadMorePage(1, 'tv'),
      loadMorePage(1, 'anime'),
    ]);
    const animeItems = (anime.items || []).slice(0, 20);
    const sections = [];
    if (trending.items && trending.items.length) {
      sections.push({
        id: 'trending',
        title: 'Trending on X-Stream',
        style: 'hero',
        items: trending.items.slice(0, 8),
        viewAll: { mode: 'feed', feedId: 'trending' },
      });
      sections.push({
        id: 'top10',
        title: 'Top 10 Today',
        style: 'top10',
        items: trending.items.slice(0, 10),
        viewAll: { mode: 'feed', feedId: 'trending' },
      });
    }
    if (movies.items && movies.items.length) {
      sections.push({
        id: 'movies',
        title: 'Popular Movies',
        style: 'poster',
        items: movies.items.slice(0, 20),
        viewAll: { mode: 'feed', feedId: 'movies' },
      });
    }
    if (tv.items && tv.items.length) {
      sections.push({
        id: 'tv',
        title: 'Popular TV Shows',
        style: 'poster',
        items: tv.items.slice(0, 20),
        viewAll: { mode: 'feed', feedId: 'tv' },
      });
    }
    if (animeItems.length) {
      sections.push({
        id: 'anime',
        title: 'Anime',
        style: 'poster',
        items: animeItems,
        viewAll: { mode: 'feed', feedId: 'anime' },
      });
    }
    // Endless workhorse: last section, seed = page 1 of catalog feed.
    if (trending.items && trending.items.length) {
      sections.push({
        id: 'catalog',
        title: 'Browse All',
        style: 'poster',
        items: trending.items.slice(0, 20),
        viewAll: { mode: 'feed', feedId: 'catalog' },
      });
    }
    return { sections };
  }

  async function discoveryFeed(feedId, page) {
    const id = String(feedId || 'catalog').toLowerCase();
    const pageNum = Math.max(1, Number(page) || 1);
    log('discoveryFeed id=' + id + ' page=' + pageNum);
    if (id === 'movies') {
      const res = await loadMorePage(pageNum, 'movie');
      return { items: res.items, page: pageNum, hasMore: !!res.hasMore };
    }
    if (id === 'tv') {
      const res = await loadMorePage(pageNum, 'tv');
      return { items: res.items, page: pageNum, hasMore: !!res.hasMore };
    }
    if (id === 'anime') {
      const res = await loadMorePage(pageNum, 'anime');
      return { items: res.items, page: pageNum, hasMore: !!res.hasMore };
    }
    // trending + catalog share the mixed load-more stream (500 pages).
    const res = await loadMorePage(pageNum);
    // Always boolean true while pages remain — app checks hasMore === true strictly.
    return { items: res.items, page: pageNum, hasMore: pageNum < (res.totalPages || 500) };
  }

  /* -------------------- details / episodes -------------------- */

  function parseMovieDetails(html, id) {
    const title =
      cleanText((String(html).match(/<h1[^>]*class="movie-title"[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || '') ||
      cleanText((String(html).match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || '') ||
      'Movie ' + id;
    const description =
      cleanText((String(html).match(/class="movie-overview"[^>]*>([\s\S]*?)<\/(?:div|p)>/i) || [])[1] || '') ||
      cleanText((String(html).match(/name="description"\s+content="([^"]+)"/i) || [])[1] || '') ||
      'No description available.';
    const image =
      (String(html).match(/class="movie-poster"[\s\S]*?<img[^>]+src="([^"]+)"/i) || [])[1] ||
      (String(html).match(/property="og:image"\s+content="([^"]+)"/i) || [])[1] ||
      '';
    const tagline = cleanText((String(html).match(/class="movie-tagline"[^>]*>([\s\S]*?)<\/p>/i) || [])[1] || '');
    const genres = [];
    const genreRe = /class="genre[^"]*"[^>]*>([\s\S]*?)<\//gi;
    let gm;
    while ((gm = genreRe.exec(String(html || '')))) {
      const g = cleanText(gm[1]);
      if (g && genres.indexOf(g) < 0) genres.push(g);
    }
    const rating =
      cleanText((String(html).match(/fa-star[^>]*>\s*([\d.]+)/i) || [])[1] || '') ||
      cleanText((String(html).match(/([\d.]+)\s*\/\s*10/) || [])[1] || '');
    const year =
      cleanText((String(html).match(/(?:release|aired|date)[^<]{0,40}?(\d{4})/i) || [])[1] || '') ||
      cleanText((String(html).match(/\b(19|20)\d{2}\b/) || [])[0] || '');
    return {
      id: encodeHref('movie', id),
      href: encodeHref('movie', id),
      url: SITE + '/movie.php?id=' + id,
      title,
      description: tagline ? tagline + ' — ' + description : description,
      image,
      poster: image,
      genres,
      rating,
      year,
      type: 'movie',
      mediaType: 'movie',
    };
  }

  function parseTvDetails(html, id) {
    const title =
      cleanText((String(html).match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || '') || 'TV ' + id;
    const description =
      cleanText((String(html).match(/class="movie-overview"[^>]*>([\s\S]*?)<\/(?:div|p)>/i) || [])[1] || '') ||
      cleanText((String(html).match(/name="description"\s+content="([^"]+)"/i) || [])[1] || '') ||
      'No description available.';
    const image =
      (String(html).match(/class="movie-poster"[\s\S]*?<img[^>]+src="([^"]+)"/i) || [])[1] ||
      (String(html).match(/property="og:image"\s+content="([^"]+)"/i) || [])[1] ||
      '';
    const seasons = [];
    const seasonRe = /season\.php\?tv_id=\d+&season=(\d+)/gi;
    let sm;
    const seen = Object.create(null);
    while ((sm = seasonRe.exec(String(html || '')))) {
      const n = Number(sm[1]);
      if (n > 0 && !seen[n]) {
        seen[n] = true;
        seasons.push(n);
      }
    }
    seasons.sort((a, b) => a - b);
    const rating = cleanText((String(html).match(/fa-star[^>]*>\s*([\d.]+)/i) || [])[1] || '');
    const year = cleanText((String(html).match(/\b((?:19|20)\d{2})\b/) || [])[1] || '');
    return {
      id: encodeHref('tv', id),
      href: encodeHref('tv', id),
      url: SITE + '/tv.php?id=' + id,
      title,
      description,
      image,
      poster: image,
      rating,
      year,
      type: 'tv',
      mediaType: 'tv',
      seasons: seasons.length,
      seasonNumbers: seasons,
    };
  }

  async function extractDetails(urlOrId) {
    const parsed = parseHref(urlOrId);
    if (!parsed) {
      // Never surface raw URLs as titles in the app.
      return { title: 'Unknown title', description: 'Unable to resolve this title.' };
    }
    const cacheKey = parsed.type + ':' + parsed.id;
    if (detailsCache[cacheKey]) return detailsCache[cacheKey];
    if (inFlightDetailsMap[cacheKey]) return inFlightDetailsMap[cacheKey];

    const inFlightPromise = (async () => {
      log('extractDetails ' + cacheKey);

      // Prefer TMDB metadata (fast, reliable titles/posters). Site HTML is fallback only.
      try {
        const data = await tmdbJson('/' + parsed.type + '/' + parsed.id + '?append_to_response=external_ids');
        if (data && (data.title || data.name)) {
          const title = cleanText(data.title || data.name);
          const image = posterUrl(data.poster_path, 'w500') || posterUrl(data.backdrop_path, 'w780');
          const seasons = [];
          if (parsed.type === 'tv' && Array.isArray(data.seasons)) {
            data.seasons.forEach((s) => {
              const n = Number(s && s.season_number);
              if (n > 0) seasons.push(n);
            });
          }
          const details = {
            id: encodeHref(parsed.type, parsed.id),
            href: encodeHref(parsed.type, parsed.id),
            url: encodeHref(parsed.type, parsed.id),
            title,
            description: cleanText(data.overview || 'No description available.'),
            image,
            poster: image,
            banner: posterUrl(data.backdrop_path, 'w1280') || image,
            genres: Array.isArray(data.genres)
              ? data.genres.map((g) => g && g.name).filter(Boolean)
              : [],
            rating:
              data.vote_average != null ? String(Number(data.vote_average).toFixed(1)) : '',
            year: String((data.release_date || data.first_air_date || '').slice(0, 4) || ''),
            type: parsed.type,
            mediaType: parsed.type,
            seasons: seasons.length || Number(data.number_of_seasons || 0) || 0,
            seasonNumbers: seasons,
            isMovie: parsed.type === 'movie',
          };
          detailsCache[cacheKey] = details;
          return details;
        }
      } catch (error) {
        log('extractDetails tmdb fail: ' + (error && error.message ? error.message : error));
      }

      const path = parsed.type === 'tv' ? '/tv.php?id=' + parsed.id : '/movie.php?id=' + parsed.id;
      const res = await siteRequest(path, { accept: 'text/html,*/*' });
      const details =
        parsed.type === 'tv' ? parseTvDetails(res.body, parsed.id) : parseMovieDetails(res.body, parsed.id);
      // Guard: never let a URL leak into title.
      if (!details.title || /xstream:\/\//i.test(details.title) || /^https?:\/\//i.test(details.title)) {
        details.title = (parsed.type === 'tv' ? 'TV' : 'Movie') + ' ' + parsed.id;
      }
      if (!details.image) {
        // last-resort: any tmdb image on the page
        const img = (String(res.body || '').match(/https:\/\/image\.tmdb\.org\/t\/p\/[^"'\s]+/) || [])[0] || '';
        details.image = img;
        details.poster = img;
      }
      detailsCache[cacheKey] = details;
      return details;
    })();

    inFlightDetailsMap[cacheKey] = inFlightPromise;
    try {
      return await inFlightPromise;
    } finally {
      delete inFlightDetailsMap[cacheKey];
    }
  }

  function parseSeasonEpisodes(html, tvId, season) {
    const out = [];
    const seen = Object.create(null);
    const re =
      /class="episode-item"[^>]*data-episode="(\d+)"[\s\S]*?<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"/gi;
    let m;
    while ((m = re.exec(String(html || '')))) {
      const ep = Number(m[1]);
      if (!ep || seen[ep]) continue;
      seen[ep] = true;
      const image = String(m[2] || '').trim();
      const title = cleanText(m[3]) || 'Episode ' + ep;
      out.push({
        number: ep,
        season: Number(season),
        title: 'S' + season + 'E' + ep + ' - ' + title,
        href: encodeHref('tv', tvId, season, ep),
        image,
        subAvailable: true,
        dubAvailable: false,
      });
    }
    if (!out.length) {
      const watchRe = /watch\.php\?type=tv&id=(\d+)&season=(\d+)&episode=(\d+)/gi;
      while ((m = watchRe.exec(String(html || '')))) {
        if (String(m[1]) !== String(tvId)) continue;
        if (Number(m[2]) !== Number(season)) continue;
        const ep = Number(m[3]);
        if (!ep || seen[ep]) continue;
        seen[ep] = true;
        out.push({
          number: ep,
          season: Number(season),
          title: 'S' + season + 'E' + ep,
          href: encodeHref('tv', tvId, season, ep),
          subAvailable: true,
          dubAvailable: false,
        });
      }
    }
    out.sort((a, b) => Number(a.number) - Number(b.number));
    return out;
  }

  async function extractEpisodes(seriesId) {
    const parsed = parseHref(seriesId);
    if (!parsed) return [];
    if (parsed.type === 'movie') {
      const details = await extractDetails(encodeHref('movie', parsed.id));
      return [
        {
          number: 1,
          title: details.title || 'Full Movie',
          href: encodeHref('movie', parsed.id),
          image: details.image || details.poster || '',
          isMovie: true,
          mediaType: 'movie',
          subAvailable: true,
          dubAvailable: false,
        },
      ];
    }

    // Fast path: TMDB season JSON (seconds instead of multi-page freehost HTML).
    const details = await extractDetails(encodeHref('tv', parsed.id));
    let seasons = Array.isArray(details.seasonNumbers) ? details.seasonNumbers.slice() : [];
    if (!seasons.length) {
      const show = await tmdbJson('/tv/' + parsed.id);
      if (show && Array.isArray(show.seasons)) {
        seasons = show.seasons
          .map((s) => Number(s && s.season_number))
          .filter((n) => n > 0)
          .sort((a, b) => a - b);
      }
    }
    if (!seasons.length) seasons = [1];

    const episodes = [];
    const CONCURRENCY = 4;
    for (let i = 0; i < seasons.length; i += CONCURRENCY) {
      const chunk = seasons.slice(i, i + CONCURRENCY);
      const pages = await Promise.all(
        chunk.map(async (season) => {
          const cacheKey = parsed.id + ':s' + season;
          if (seasonCache[cacheKey]) return seasonCache[cacheKey];
          const data = await tmdbJson('/tv/' + parsed.id + '/season/' + season);
          const rows = data && Array.isArray(data.episodes) ? data.episodes : [];
          const list = rows
            .map((ep) => {
              const epNum = Number(ep && ep.episode_number);
              if (!epNum) return null;
              const name = cleanText((ep && ep.name) || '') || 'Episode ' + epNum;
              return {
                number: epNum,
                season: Number(season),
                title: 'S' + season + 'E' + epNum + ' - ' + name,
                href: encodeHref('tv', parsed.id, season, epNum),
                image: posterUrl(ep && ep.still_path, 'w300') || details.image || '',
                subAvailable: true,
                dubAvailable: false,
              };
            })
            .filter(Boolean);
          // Fallback to site HTML season page if TMDB empty.
          if (!list.length) {
            try {
              const res = await siteRequest(
                '/season.php?tv_id=' + parsed.id + '&season=' + season,
                { accept: 'text/html,*/*' },
              );
              return parseSeasonEpisodes(res.body, parsed.id, season);
            } catch (_) {
              return [];
            }
          }
          seasonCache[cacheKey] = list;
          return list;
        }),
      );
      pages.forEach((list) => {
        for (let j = 0; j < list.length; j++) episodes.push(list[j]);
      });
    }

    episodes.sort((a, b) => {
      const s = Number(a.season || 1) - Number(b.season || 1);
      if (s !== 0) return s;
      return Number(a.number || 0) - Number(b.number || 0);
    });
    // App episode lists key on `number`. Season-local numbers collide (S1E1 and
    // S2E1 both "1"), which breaks ordering, history, and "play next". Keep
    // season/episode fields and renumber absolutely 1..N across the series.
    for (let i = 0; i < episodes.length; i++) {
      const ep = episodes[i];
      const seasonNum = Number(ep.season || 1) || 1;
      const episodeNum = Number(ep.number || i + 1) || i + 1;
      ep.season = seasonNum;
      ep.seasonNumber = seasonNum;
      ep.episodeNumber = episodeNum;
      ep.number = i + 1;
      if (!ep.title || /^S\d+E\d+$/i.test(String(ep.title))) {
        ep.title = 'S' + seasonNum + 'E' + episodeNum;
      }
    }
    return episodes;
  }

  /* -------------------- streams -------------------- */

  function findDirectStream(text) {
    const body = String(text || '').replace(/\\\//g, '/');
    const match = body.match(/https?:\/\/[^"'\s<>]+\.(?:mp4|m3u8)(?:\?[^"'\s<>]*)?/i);
    return match ? match[0] : '';
  }

  function extractPixeldrainId(text) {
    const body = String(text || '');
    let m = body.match(/pixeldrain\.com\/(?:u|api\/file)\/([A-Za-z0-9]+)/i);
    return m ? m[1] : '';
  }

  function pixeldrainUrl(id) {
    return id ? 'https://pixeldrain.com/api/file/' + id : '';
  }

  function firstBytesLookLikeImage(raw) {
    const s = String(raw || '');
    if (s.length < 3) return false;
    const b0 = s.charCodeAt(0);
    const b1 = s.charCodeAt(1);
    const b2 = s.charCodeAt(2);
    if (b0 === 0xff && b1 === 0xd8 && b2 === 0xff) return true; // JPEG
    if (b0 === 0x89 && b1 === 0x50 && s.charCodeAt(3) === 0x47) return true; // PNG
    if (s.slice(0, 6) === 'GIF87a' || s.slice(0, 6) === 'GIF89a') return true;
    if (s.slice(0, 4) === 'RIFF' && s.slice(8, 12) === 'WEBP') return true;
    if (b0 === 0x42 && b1 === 0x4d) return true; // BMP
    return false;
  }

  function firstBytesLookLikeMedia(raw) {
    const s = String(raw || '');
    if (!s.length) return false;
    if (s.charCodeAt(0) === 0x47) return true; // MPEG-TS
    if (s.indexOf('#EXTM3U') === 0) return true;
    if (s.indexOf('ftyp') >= 0 && s.indexOf('ftyp') < 16) return true; // fMP4
    return false;
  }

  function playlistMediaUris(body) {
    const lines = String(body || '').split(/\r?\n/);
    const out = [];
    for (let i = 0; i < lines.length; i++) {
      const line = String(lines[i] || '').trim();
      if (!line || line.charAt(0) === '#') continue;
      out.push(line);
    }
    return out;
  }

  function samplePlaylistMediaUris(body, limit) {
    const rows = playlistMediaUris(body);
    const max = Math.max(1, Number(limit) || 1);
    if (rows.length <= max) return rows;
    const indexes = [0, Math.floor((rows.length - 1) / 2), rows.length - 1];
    const out = [];
    const seen = Object.create(null);
    for (let i = 0; i < indexes.length && out.length < max; i++) {
      const row = rows[indexes[i]];
      if (!row || seen[row]) continue;
      seen[row] = true;
      out.push(row);
    }
    return out;
  }

  function playlistPointsAtImageSegments(body) {
    const rows = playlistMediaUris(body);
    for (let i = 0; i < rows.length; i++) {
      if (/\.(jpe?g|png|webp|gif|bmp|html?)($|[?#])/i.test(rows[i])) return true;
    }
    return false;
  }

  async function probeBytes(url, headers) {
    try {
      const res = await externalRequest(url, {
        headers: Object.assign(
          {
            'User-Agent': USER_AGENT,
            Range: 'bytes=0-512',
            Accept: 'video/mp4,video/*,application/vnd.apple.mpegurl,*/*',
          },
          headers || {},
        ),
      });
      if (!res || !(res.ok || res.status === 206 || (res.status >= 200 && res.status < 400))) return false;
      const ct = String(
        (res.headers && (res.headers['content-type'] || res.headers['Content-Type'])) || '',
      ).toLowerCase();
      if (/image\//.test(ct) || /text\/html/.test(ct)) return false;
      if (firstBytesLookLikeImage(res.body) || /<!DOCTYPE|<html|Just a moment/i.test(String(res.body || ''))) {
        return false;
      }
      if (/video\/|mpegurl|octet-stream|mp4|mp2t|application\/x-mpegurl/.test(ct)) return true;
      if (firstBytesLookLikeMedia(res.body)) return true;
      return false;
    } catch (_) {
      return false;
    }
  }

  function unpackVidoraPacker(html) {
    const text = String(html || '');
    const start = text.indexOf('eval(function');
    if (start < 0) return '';
    const end = text.indexOf('</script>', start);
    if (end < 0) return '';
    const evalBlock = text.slice(start, end);
    const meta = evalBlock.match(/',(\d+),(\d+),'/);
    if (!meta) return '';
    const radix = Number(meta[1]);
    const count = Number(meta[2]);
    const dictMarker = "'," + radix + ',' + count + ",'";
    const dictStart = evalBlock.lastIndexOf(dictMarker);
    if (dictStart < 0) return '';
    const dictEnd = evalBlock.lastIndexOf("'.split('|')");
    const dict = evalBlock.slice(dictStart + dictMarker.length, dictEnd);
    const packedStart = evalBlock.indexOf("}('") + 3;
    const packedEnd = evalBlock.lastIndexOf(dictMarker);
    let packed = evalBlock.slice(packedStart, packedEnd);
    const keywords = dict.split('|');
    let remaining = count;
    while (remaining--) {
      if (keywords[remaining]) {
        packed = packed.replace(new RegExp('\\b' + remaining.toString(radix) + '\\b', 'g'), keywords[remaining]);
      }
    }
    const fileMatch = packed.match(/file:"([^"]+)"/);
    if (!fileMatch || !fileMatch[1]) return '';
    return fileMatch[1].replace(/https:\/\/bx\./i, 'https://box.');
  }

  function goodstreamMirrors(downloadLink) {
    const match = String(downloadLink || '').match(/\/download\/([^/?#]+)/i);
    if (!match || !match[1]) return [downloadLink].filter(Boolean);
    const id = match[1];
    const hosts = ['goodstream.cc', 'goodstream.one', 'goodstream.se'];
    const out = [];
    const seen = Object.create(null);
    for (let i = 0; i < hosts.length; i++) {
      const url = 'https://' + hosts[i] + '/download/' + id;
      if (!seen[url]) {
        seen[url] = true;
        out.push(url);
      }
    }
    if (downloadLink && !seen[downloadLink]) out.unshift(downloadLink);
    return out;
  }

  function qualityHeightFromText(text) {
    const s = String(text || '');
    if (/\b(2160|4k|uhd)\b/i.test(s)) return 2160;
    if (/\b1080\b/i.test(s)) return 1080;
    if (/\b720\b/i.test(s)) return 720;
    if (/\b540\b/i.test(s)) return 540;
    if (/\b480\b/i.test(s)) return 480;
    if (/\b360\b/i.test(s)) return 360;
    return 0;
  }

  // HubCloud "1080p" rips are often huge MKV remuxes. iOS/media_kit frequently
  // fails to start those even though the signed URL is valid (Range 206).
  function containerFromText(text) {
    const s = String(text || '').toLowerCase();
    if (/\.m3u8(\?|$)/i.test(s) || s.indexOf('mpegurl') >= 0) return 'hls';
    if (/\.mkv(\?|$)/i.test(s) || /\bmkv\b/.test(s) || /\bremux\b/.test(s)) return 'mkv';
    if (/\.mp4(\?|$)/i.test(s) || /\bmp4\b/.test(s) || /\bx264\b/.test(s) && !/\bremux\b/.test(s)) {
      return 'mp4';
    }
    if (/\.webm(\?|$)/i.test(s)) return 'webm';
    return '';
  }

  function isLikelyPlayableOnIos(stream) {
    if (!stream || !stream.url) return false;
    const kind = String(stream.kind || '').toLowerCase();
    const container = String(
      stream.container ||
        containerFromText(stream.fileName || stream.label || stream.url) ||
        kind,
    );
    // Hard reject containers iOS/media_kit regularly fails to start.
    if (container === 'mkv' || container === 'webm') return false;
    if (stream.playable === false) return false;
    // Signed HubCloud/R2 remux hosts are almost always MKV even when labeled HD.
    if (/cloudflarestorage|\.r2\.|hubcloud\.|sportverse\.cc/i.test(stream.url)) {
      return container === 'mp4' || kind === 'hls';
    }
    if (kind === 'hls' || container === 'hls') return true;
    if (kind === 'mp4' || container === 'mp4') return true;
    return false;
  }

  async function sniffContainer(url, headers) {
    try {
      const res = await settleWithin(
        externalRequest(url, {
          method: 'GET',
          accept: '*/*',
          headers: Object.assign(
            {
              'User-Agent': USER_AGENT,
              Range: 'bytes=0-64',
            },
            headers || {},
          ),
        }),
        6000,
        null,
      );
      if (!res || !res.body) return '';
      const body = String(res.body);
      if (body.indexOf('#EXTM3U') === 0) return 'hls';
      // MKV EBML: 1A 45 DF A3 — may appear garbled after utf8 decode; also check filename/url.
      if (
        body.charCodeAt(0) === 0x1a ||
        /matroska|webm/i.test(body.slice(0, 64)) ||
        (res.headers &&
          /matroska|video\/x-matroska/i.test(
            String(res.headers['content-type'] || res.headers['Content-Type'] || ''),
          ))
      ) {
        return 'mkv';
      }
      if (body.indexOf('ftyp') >= 0) return 'mp4';
      const cd = String(
        (res.headers &&
          (res.headers['content-disposition'] || res.headers['Content-Disposition'])) ||
          '',
      );
      const fromCd = containerFromText(cd);
      if (fromCd) return fromCd;
    } catch (_) {}
    return '';
  }

  function qualityLabel(height, kind, provider) {
    const h = Number(height) || 0;
    const q = h >= 360 ? h + 'p' : 'Auto';
    const tag = kind === 'mp4' ? 'MP4' : 'HLS';
    const src =
      provider && String(provider).indexOf('vidzee') >= 0
        ? 'HD'
        : provider === 'lookmovie'
          ? 'Stream'
          : 'Source';
    return 'X-Stream ' + q + ' ' + tag + (src === 'HD' ? '' : '');
  }

  async function pixeldrainInfo(id) {
    if (!id) return null;
    const infoUrl = 'https://pixeldrain.com/api/file/' + id + '/info';
    const res = await settleWithin(
      externalRequest(infoUrl, {
        accept: 'application/json,*/*',
        headers: { 'User-Agent': USER_AGENT, Referer: 'https://pixeldrain.com/' },
      }),
      5000,
      null,
    );
    if (!res || !res.body) return null;
    try {
      const data = JSON.parse(res.body);
      if (data && data.success === false) return null;
      if (data && (data.id || data.name || data.size)) {
        return {
          id: data.id || id,
          name: String(data.name || ''),
          size: Number(data.size) || 0,
          height: qualityHeightFromText(data.name || ''),
        };
      }
    } catch (_) {}
    if (res.ok && res.body.indexOf('not_found') < 0) {
      return { id: id, name: '', size: 0, height: 0 };
    }
    return null;
  }

  async function resolveFromGoodstreamPage(pageBody, downloadLink, options) {
    const headersPd = {
      'User-Agent': USER_AGENT,
      Referer: 'https://pixeldrain.com/',
      Accept: 'video/mp4,video/*,*/*',
    };

    // Collect all pixeldrain candidates (page can list more than one).
    const pdIds = [];
    const pdRe = /pixeldrain\.com\/(?:u|api\/file)\/([A-Za-z0-9]+)/gi;
    let pm;
    while ((pm = pdRe.exec(String(pageBody || '')))) {
      if (pdIds.indexOf(pm[1]) < 0) pdIds.push(pm[1]);
    }

    // Also scrape quality hints from the download page title / filename.
    const pageHint = qualityHeightFromText(
      ((String(pageBody || '').match(/<title[^>]*>([^<]+)/i) || [])[1] || '') +
        ' ' +
        String(pageBody || '').slice(0, 2500),
    );

    let best = null;
    for (let i = 0; i < pdIds.length; i++) {
      const info = await pixeldrainInfo(pdIds[i]);
      if (!info) continue;
      const url = pixeldrainUrl(pdIds[i]);
      const ok = await settleWithin(probeBytes(url, headersPd), 6000, false);
      if (!ok && info.size <= 0) continue;
      const height = info.height || pageHint || 720; // pixeldrain rips are usually ≥720 when named poorly
      const fname = info.name || '';
      if (hasForeignAudioTag(fname) && !/(\bEnglish|\bENG\b)/i.test(fname)) {
        log('goodstream skip non-English file ' + fname);
        continue;
      }
      const container = containerFromText(fname) || 'mp4';
      const candidate = {
        url: url,
        kind: container === 'hls' ? 'hls' : 'mp4',
        container: container,
        height: height,
        label:
          'X-Stream ' +
          (height >= 360 ? height + 'p' : 'HD') +
          (container === 'mp4' ? ' MP4' : container === 'mkv' ? ' MKV' : ''),
        headers: headersPd,
        provider: 'vidzee-pixeldrain',
        fileName: fname,
        playable: container === 'mp4' || container === 'hls',
      };
      if (!best || candidate.height > best.height || (candidate.height === best.height && info.size > 0)) {
        best = candidate;
      }
    }
    if (best) return best;

    const direct = findDirectStream(pageBody);
    if (direct) {
      const headers = {
        'User-Agent': USER_AGENT,
        Referer: downloadLink || 'https://goodstream.cc/',
        Accept: 'video/mp4,application/vnd.apple.mpegurl,*/*',
      };
      if (await settleWithin(probeBytes(direct, headers), 5000, false)) {
        return {
          url: direct,
          kind: /\.m3u8/i.test(direct) ? 'hls' : 'mp4',
          label: 'X-Stream Direct',
          headers,
          provider: 'vidzee-direct',
        };
      }
    }

    const keyMatch = String(pageBody || '').match(/https?:\/\/pkayprek\.com\/key\/[^"'\s]+/i);
    if (keyMatch) {
      const keyPage = await settleWithin(
        externalRequest(
          keyMatch[0],
          Object.assign(
            {
              accept: 'text/html,*/*',
              headers: { Referer: downloadLink || 'https://goodstream.cc/', 'User-Agent': USER_AGENT },
            },
            options && options.fresh ? { fresh: true, attempt: options.attempt || 1 } : {},
          ),
        ),
        8000,
        null,
      );
      const file = findDirectStream((keyPage && keyPage.body) || '');
      if (file && !/pkayprek\.com/i.test(file)) {
        const headers = {
          'User-Agent': USER_AGENT,
          Referer: 'https://goodstream.cc/',
          Accept: 'video/mp4,video/*,*/*',
        };
        if (await settleWithin(probeBytes(file, headers), 5000, false)) {
          return {
            url: file,
            kind: 'mp4',
            label: 'X-Stream Alt',
            headers,
            provider: 'vidzee-streamsvr',
          };
        }
      }
    }
    return null;
  }

  function normalizeHubcloudUrl(url) {
    return String(url || '')
      .replace(/hubcloud\.ist/gi, 'hubcloud.cx')
      .replace(/&amp;/g, '&')
      .trim();
  }

  /**
   * Vidzee v2 (movies): multi-quality HubCloud/4KHDHub links.
   * Page title often has real height (1080p / 2160p). Sportverse "Generate Direct
   * Download Link" yields signed Cloudflare R2 URLs — works for play + IDM-style download.
   */
  async function resolveHubcloudDirect(pageUrl, options) {
    const driveUrl = normalizeHubcloudUrl(pageUrl);
    if (!driveUrl) return null;
    const page = await settleWithin(
      externalRequest(
        driveUrl,
        Object.assign(
          {
            accept: 'text/html,*/*',
            headers: {
              'User-Agent': USER_AGENT,
              Referer: 'https://hubcloud.cx/',
            },
          },
          options && options.fresh ? { fresh: true, attempt: options.attempt || 1 } : {},
        ),
      ),
      12000,
      null,
    );
    if (!page || !page.body) return null;
    const title = cleanText(
      (String(page.body).match(/<title[^>]*>([^<]+)/i) || [])[1] || '',
    );
    const height =
      qualityHeightFromText(title) ||
      qualityHeightFromText(driveUrl) ||
      1080;

    let sportverse = '';
    const sportMatch = String(page.body).match(
      /https?:\/\/sportverse\.cc\/hubcloud\.php\?[^"'\s<>]+/i,
    );
    if (sportMatch) sportverse = normalizeHubcloudUrl(sportMatch[0]);
    if (!sportverse) return null;

    const gen = await settleWithin(
      externalRequest(
        sportverse,
        Object.assign(
          {
            accept: 'text/html,*/*',
            headers: {
              'User-Agent': USER_AGENT,
              Referer: driveUrl,
            },
          },
          options && options.fresh ? { fresh: true, attempt: options.attempt || 1 } : {},
        ),
      ),
      14000,
      null,
    );
    if (!gen || !gen.body) return null;

    // Prefer FSL / Cloudflare R2 signed attachment URLs (direct binary).
    let direct = '';
    const r2 = String(gen.body).match(
      /https?:\/\/[^"'<\s]+r2\.cloudflarestorage\.com[^"'<\s]+/i,
    );
    if (r2) direct = normalizeHubcloudUrl(r2[0]);
    if (!direct) {
      const fsl = String(gen.body).match(
        /href=["'](https?:\/\/[^"']+)["'][^>]*>[\s\S]{0,80}Download\s*\[FSL/i,
      );
      if (fsl) direct = normalizeHubcloudUrl(fsl[1]);
    }
    if (!direct) {
      const anyDl = String(gen.body).match(
        /href=["'](https?:\/\/[^"']+(?:cloudflarestorage|pixel\.hubcloud)[^"']*)["']/i,
      );
      if (anyDl) direct = normalizeHubcloudUrl(anyDl[1]);
    }
    if (!direct || direct.indexOf('http') !== 0) return null;

    const headers = {
      'User-Agent': USER_AGENT,
      // Avoid extra referrer constraints on signed R2 URLs.
      Accept: '*/*',
    };
    // A signed URL is not enough evidence of playability. Require a successful
    // bounded media probe before exposing it to the app.
    const ok = await settleWithin(probeBytes(direct, headers), 7000, false);
    if (!ok) return null;

    let container =
      containerFromText(title) ||
      containerFromText(direct) ||
      containerFromText(gen.body.slice(0, 2000)) ||
      '';
    // Byte-sniff: titles often say "1080p" but body is MKV remux.
    const sniffed = await sniffContainer(direct, headers);
    if (sniffed) container = sniffed;
    if (!container) container = 'mkv';

    // Reliability: do not hand MKV remuxes to the iOS player at all.
    // They show up in the quality picker as "1080p", resolve in ~200ms, then hang/fail.
    if (container === 'mkv' || container === 'webm') {
      log('hubcloud skip unplayable container=' + container + ' title=' + title.slice(0, 80));
      return null;
    }

    if (hasForeignAudioTag(title) && !/(\bEnglish|\bENG\b)/i.test(title)) {
      log('hubcloud skip non-English audio title=' + title.slice(0, 80));
      return null;
    }

    const qLabel = height >= 360 ? height + 'p' : 'HD';
    return {
      url: direct,
      kind: container === 'hls' ? 'hls' : 'mp4',
      container: container,
      height: height,
      label: 'X-Stream ' + qLabel + ' Direct',
      headers: headers,
      provider: 'vidzee-v2-hubcloud',
      fileName: title,
      playable: true,
    };
  }

  async function resolveVidzeeV2(parsed, options) {
    // Currently multi-quality 4KHDHub feed is movie-oriented on v2.
    if (parsed.type !== 'movie') return [];
    const endpoint = VIDZEE_DL + '/movie/v2/' + parsed.id;
    const res = await settleWithin(
      externalRequest(
        endpoint,
        Object.assign(
          {
            accept: 'application/json,*/*',
            headers: {
              Referer: 'https://player.vidzee.wtf/',
              'User-Agent': USER_AGENT,
            },
          },
          options && options.fresh ? { fresh: true, attempt: options.attempt || 1 } : {},
        ),
      ),
      12000,
      null,
    );
    if (!res || !res.body) return [];
    let data = null;
    try {
      data = JSON.parse(res.body);
    } catch (_) {
      return [];
    }
    const links = (data && data.download_links) || [];
    if (!Array.isArray(links) || !links.length) return [];

    // Score candidates: prefer hubcloud pages; 1080 first for playback, then 2160, then HD.
    const ranked = links
      .map(function (link, idx) {
        const url = normalizeHubcloudUrl(link && link.url);
        const q = String((link && (link.quality || link.name)) || '');
        let pref = 0;
        if (/hubcloud/i.test(url)) pref += 50;
        if (/4k|2160|uhd/i.test(q + url)) pref += 30;
        if (/1080|fhd|hd/i.test(q)) pref += 40;
        return { url: url, pref: pref, idx: idx, meta: link };
      })
      .filter(function (x) {
        return x.url && /hubcloud/i.test(x.url);
      })
      .sort(function (a, b) {
        return b.pref - a.pref || a.idx - b.idx;
      });

    const out = [];
    const seenH = Object.create(null);
    // Resolve a few top hubcloud pages (enough to cover 1080 + one alt).
    for (let i = 0; i < ranked.length && out.length < 4; i++) {
      const resolved = await resolveHubcloudDirect(ranked[i].url, options);
      if (!resolved || !resolved.url) continue;
      const h = resolved.height || 0;
      // Keep one stream per height bucket.
      if (seenH[h]) continue;
      seenH[h] = true;
      out.push(resolved);
      // Early exit once we have a solid 1080.
      if (h === 1080 && out.length >= 1) {
        // still try for one more height if cheap
      }
    }
    return out;
  }

  async function resolveVidzee(parsed, options) {
    const endpoints = [];
    if (parsed.type === 'tv') {
      const s = parsed.season || 1;
      const e = parsed.episode || 1;
      endpoints.push(VIDZEE_DL + '/tv/v1/' + parsed.id + '/' + s + '/' + e);
      endpoints.push(VIDZEE_DL + '/tv/' + parsed.id + '/' + s + '/' + e);
    } else {
      endpoints.push(VIDZEE_DL + '/movie/v1/' + parsed.id);
      endpoints.push(VIDZEE_DL + '/movie/' + parsed.id);
    }

    for (let ei = 0; ei < endpoints.length; ei++) {
      for (let attempt = 0; attempt < 2; attempt++) {
        const url =
          endpoints[ei] +
          (attempt ? (endpoints[ei].indexOf('?') >= 0 ? '&' : '?') + '_ts=' + Date.now() : '');
        const res = await settleWithin(
          externalRequest(
            url,
            Object.assign(
              {
                accept: 'application/json,*/*',
                headers: {
                  Referer: 'https://player.vidzee.wtf/',
                  'User-Agent': USER_AGENT,
                  'Cache-Control': 'no-cache',
                },
              },
              options && (options.fresh || attempt > 0)
                ? { fresh: true, attempt: options.attempt || attempt + 1 }
                : {},
            ),
          ),
          10000,
          null,
        );
        if (!res || !res.body) continue;
        let data = null;
        try {
          data = JSON.parse(res.body);
        } catch (_) {
          continue;
        }
        const downloadLink = cleanText(data && data.downloadLink);
        if (!downloadLink) continue;

        const mirrors = goodstreamMirrors(downloadLink);
        // Try mirrors in parallel for speed.
        const pages = await Promise.all(
          mirrors.slice(0, 2).map((mirror) =>
            settleWithin(
              externalRequest(
                mirror,
                Object.assign(
                  {
                    accept: 'text/html,*/*',
                    headers: { Referer: 'https://goodstream.cc/', 'User-Agent': USER_AGENT },
                  },
                  options && (options.fresh || attempt > 0)
                    ? { fresh: true, attempt: options.attempt || attempt + 1 }
                    : {},
                ),
              ),
              9000,
              null,
            ).then((page) => ({ mirror, page })),
          ),
        );
        for (let i = 0; i < pages.length; i++) {
          const item = pages[i];
          if (!item.page || !item.page.body) continue;
          const resolved = await resolveFromGoodstreamPage(item.page.body, item.mirror, options);
          if (resolved && resolved.url) return resolved;
        }
      }
    }
    return null;
  }

  async function resolveMoviesApi(parsed, options) {
    const pageUrl =
      parsed.type === 'tv'
        ? MOVIESAPI + '/tv/' + parsed.id + '-' + (parsed.season || 1) + '-' + (parsed.episode || 1)
        : MOVIESAPI + '/movie/' + parsed.id;
    const page = await settleWithin(
      externalRequest(
        pageUrl,
        Object.assign(
          {
            accept: 'text/html,*/*',
            headers: { Referer: MOVIESAPI + '/', 'User-Agent': USER_AGENT },
          },
          options && options.fresh ? { fresh: true, attempt: options.attempt || 1 } : {},
        ),
      ),
      12000,
      null,
    );
    if (!page || !page.body) return null;

    let iframe =
      (page.body.match(/data-src=["'](https?:\/\/vidora\.stream\/embed\/[^"']+)["']/i) || [])[1] ||
      (page.body.match(/src=["'](https?:\/\/vidora\.stream\/embed\/[^"']+)["']/i) || [])[1] ||
      '';
    if (!iframe) {
      const direct = findDirectStream(page.body);
      if (direct) {
        return {
          url: direct,
          kind: /\.m3u8/i.test(direct) ? 'hls' : 'mp4',
          label: 'MoviesAPI',
          headers: {
            'User-Agent': USER_AGENT,
            Referer: pageUrl,
            Accept: 'application/vnd.apple.mpegurl,video/*,*/*',
          },
          provider: 'moviesapi-direct',
        };
      }
      return null;
    }

    const embed = await settleWithin(
      externalRequest(
        iframe,
        Object.assign(
          {
            accept: 'text/html,*/*',
            headers: {
              Referer: pageUrl,
              Origin: MOVIESAPI,
              'User-Agent': USER_AGENT,
            },
          },
          options && options.fresh ? { fresh: true, attempt: options.attempt || 1 } : {},
        ),
      ),
      12000,
      null,
    );
    if (!embed || !embed.body) return null;
    const m3u8 = unpackVidoraPacker(embed.body) || findDirectStream(embed.body);
    if (!m3u8) return null;
    const headers = {
      'User-Agent': USER_AGENT,
      Referer: 'https://vidora.stream/',
      Origin: 'https://vidora.stream',
      Accept: 'application/vnd.apple.mpegurl,application/x-mpegURL,video/*,*/*',
    };
    return {
      url: m3u8,
      kind: 'hls',
      label: 'X-Stream HLS',
      headers,
      provider: 'moviesapi-vidora',
    };
  }

  async function resolveFromSiteWatch(parsed) {
    // Confirm the title exists on X-Stream watch page (keeps module faithful to the site).
    let path =
      parsed.type === 'tv'
        ? '/watch.php?type=tv&id=' +
          parsed.id +
          '&season=' +
          (parsed.season || 1) +
          '&episode=' +
          (parsed.episode || 1)
        : '/watch.php?type=movie&id=' + parsed.id;
    const res = await settleWithin(
      siteRequest(path, { accept: 'text/html,*/*' }),
      10000,
      null,
    );
    if (!res || !res.body || isChallengePage(res.body)) return { ok: false, embed: '' };
    const embed =
      (res.body.match(/src=["'](https?:\/\/player\.videasy\.(?:net|to)\/[^"']+)["']/i) || [])[1] || '';
    return { ok: res.body.indexOf('videoPlayer') >= 0 || !!embed, embed };
  }

  function lookmovieHeaders() {
    return {
      'User-Agent': USER_AGENT,
      Referer: LOOKMOVIE + '/',
      Origin: LOOKMOVIE,
      Accept: 'application/vnd.apple.mpegurl,application/x-mpegURL,video/*,*/*',
    };
  }

  async function lookmovieRequest(url, options) {
    const opts = options || {};
    const headers = Object.assign(
      {
        'User-Agent': USER_AGENT,
        Accept: opts.accept || 'application/json,text/html,*/*',
        Referer: LOOKMOVIE + '/',
        Origin: LOOKMOVIE,
      },
      opts.headers || {},
    );
    if (opts.xhr) headers['X-Requested-With'] = 'XMLHttpRequest';
    const requestOptions = { headers: headers, accept: headers.Accept };
    if (opts.fresh) {
      requestOptions.fresh = true;
      requestOptions.attempt = opts.attempt || 1;
    }
    return settleWithin(externalRequest(url, requestOptions), opts.timeout || 12000, null);
  }

  function imdbNumFromSlug(slug) {
    const m = String(slug || '').match(/^(\d{5,8})-/);
    return m ? m[1] : '';
  }

  function scoreLookmovieRow(title, year, imdbNum, row) {
    const t = cleanText(row && row.title).toLowerCase();
    const q = cleanText(title).toLowerCase();
    const slugImdb = imdbNumFromSlug(row && row.slug);
    if (imdbNum && slugImdb) return slugImdb === imdbNum ? 5000 : -1;
    // A year or franchise-name prefix is not a media identity.
    if (!q || t !== q || !Number(year) || Number(row && row.year) !== Number(year)) return -1;
    return 1350;
  }

  async function findLookmovieHit(kind, title, year, imdbNum, options) {
    const queries = [];
    const push = (v) => {
      const s = cleanText(v);
      if (s && queries.indexOf(s) < 0) queries.push(s);
    };
    push(title);
    push(String(title || '').replace(/[:\-–—].*$/, ''));
    if (year) push(cleanText(title) + ' ' + year);

    let best = null;
    let bestScore = -1;
    let ambiguous = false;
    for (let i = 0; i < queries.length; i++) {
      const path =
        kind === 'show'
          ? '/api/v1/shows/do-search/?q='
          : '/api/v1/movies/do-search/?q=';
      const res = await lookmovieRequest(LOOKMOVIE + path + encodeURIComponent(queries[i]), {
        xhr: true,
        timeout: 10000,
        fresh: !!(options && options.fresh),
        attempt: options && options.attempt,
      });
      if (!res || !res.body) continue;
      let rows = [];
      try {
        const json = JSON.parse(res.body);
        rows = (json && json.result) || [];
      } catch (_) {
        rows = [];
      }
      for (let j = 0; j < rows.length; j++) {
        const sc = scoreLookmovieRow(title, year, imdbNum, rows[j]);
        if (sc > bestScore) {
          bestScore = sc;
          best = rows[j];
          ambiguous = false;
        } else if (sc >= 1350 && sc === bestScore && best && rows[j].slug !== best.slug) {
          ambiguous = true;
        }
      }
      if (bestScore >= 5000 && !ambiguous) break;
    }
    return bestScore >= 1350 && !ambiguous ? best : null;
  }

  function extractLookmoviePlayHref(html, kind) {
    const re =
      kind === 'movie' ? /href="(\/movies\/play\/[^"]+)"/i : /href="(\/shows\/play\/[^"]+)"/i;
    const m = String(html || '').match(re);
    return m ? m[1] : '';
  }

  function extractLookmovieStorage(html) {
    const text = String(html || '');
    const idMovie = text.match(/id_movie:\s*(\d+)/);
    const hash = text.match(/hash:\s*['"]([^'"]+)['"]/);
    const expires = text.match(/expires:\s*(\d+)/);
    return {
      id_movie: idMovie ? Number(idMovie[1]) : 0,
      hash: hash ? hash[1] : '',
      expires: expires ? expires[1] : '',
    };
  }

  function expandHlsUrls(url) {
    const u = String(url || '');
    if (!u || u.indexOf('http') !== 0) return [];
    const out = [u];
    if (/\/index\.m3u8(\?|$)/i.test(u)) {
      const master = u.replace(/\/index\.m3u8/i, '/master.m3u8');
      if (master !== u) out.push(master);
    } else if (/\/master\.m3u8(\?|$)/i.test(u)) {
      const index = u.replace(/\/master\.m3u8/i, '/index.m3u8');
      if (index !== u) out.unshift(index);
    }
    return out;
  }

  function streamsFromLookmovieAccess(json) {
    const streams = (json && json.streams) || {};
    const out = [];
    const keys = Object.keys(streams).sort(function (a, b) {
      const ha = Number(String(a).replace(/\D/g, '')) || 0;
      const hb = Number(String(b).replace(/\D/g, '')) || 0;
      return hb - ha;
    });
    for (let i = 0; i < keys.length; i++) {
      // Free LookMovie accounts return { "720": null, "1080": null } — skip locked qualities.
      const rawUrl = streams[keys[i]];
      if (!rawUrl || typeof rawUrl !== 'string' || rawUrl.indexOf('http') !== 0) continue;
      const height = qualityHeightFromText(keys[i]) || qualityHeightFromText(rawUrl) || 480;
      const label = height >= 360 ? height + 'p' : /p$/i.test(keys[i]) ? keys[i] : keys[i] + 'p';
      const urls = expandHlsUrls(rawUrl);
      for (let u = 0; u < urls.length; u++) {
        out.push({
          url: urls[u],
          kind: 'hls',
          height: height,
          label: u === 0 ? 'X-Stream ' + label + ' HLS' : 'X-Stream ' + label + ' HLS Alt',
          headers: lookmovieHeaders(),
          provider: 'lookmovie',
          container: 'hls',
          playable: true,
        });
      }
    }
    return out;
  }

  function pickLookmovieEpisodeId(listPayload, season, episode) {
    const s = Number(season), e = Number(episode);
    if (!Number.isInteger(s) || s < 1 || !Number.isInteger(e) || e < 1) return null;
    // The observed API serializes contiguous numeric keys as arrays (including
    // season zero), otherwise objects. Keys remain season/episode numbers;
    // never reinterpret a missing key as an offset or scan a different season.
    const map = listPayload && listPayload[String(s)];
    const cell = map && typeof map === 'object' && map[String(e)];
    if (!cell || !/^\d+$/.test(String(cell.id_episode || ''))) return null;
    const explicitSeason = cell.season_number == null ? cell.season : cell.season_number;
    const explicitEpisode = cell.episode_number == null ? cell.episode : cell.episode_number;
    if (explicitSeason != null && Number(explicitSeason) !== s) return null;
    if (explicitEpisode != null && Number(explicitEpisode) !== e) return null;
    return cell.id_episode;
  }

  async function resolveLookmovie(parsed, options) {
    try {
    const details = await extractDetails(
      parsed.type === 'tv' ? encodeHref('tv', parsed.id) : encodeHref('movie', parsed.id),
    );
    const title = details.title || '';
    const year = details.year || '';
    let imdbNum = '';
    try {
      const ext = await tmdbJson('/' + parsed.type + '/' + parsed.id + '/external_ids', options);
      const imdb = (ext && ext.imdb_id) || '';
      const m = String(imdb).match(/tt(\d+)/i);
      imdbNum = m ? m[1] : '';
    } catch (_) {}

    const cacheKey = parsed.type + ':' + parsed.id;
    let hit = options && options.fresh ? null : lookmovieHitCache[cacheKey] || null;
    if (!hit) {
      hit = await findLookmovieHit(
        parsed.type === 'tv' ? 'show' : 'movie',
        title,
        year,
        imdbNum,
        options,
      );
      if (hit && !(options && options.fresh)) lookmovieHitCache[cacheKey] = hit;
    }
    if (!hit) {
      log('lookmovie no match for ' + cacheKey + ' ' + title);
      return [];
    }

    if (parsed.type === 'movie') {
      const view = await lookmovieRequest(
        LOOKMOVIE + '/movies/view/' + encodeURIComponent(hit.slug),
        { accept: 'text/html,*/*', timeout: 12000, fresh: !!(options && options.fresh), attempt: options && options.attempt },
      );
      if (!view || !view.body) return [];
      const playPath = extractLookmoviePlayHref(view.body, 'movie');
      if (!playPath) return [];
      const play = await lookmovieRequest(LOOKMOVIE + playPath, {
        accept: 'text/html,*/*',
        timeout: 12000,
        fresh: !!(options && options.fresh),
        attempt: options && options.attempt,
      });
      if (!play || !play.body) return [];
      const st = extractLookmovieStorage(play.body);
      if (!st.id_movie || !st.hash || !st.expires) return [];
      const acc = await lookmovieRequest(
        LOOKMOVIE +
          '/api/v1/security/movie-access?id_movie=' +
          st.id_movie +
          '&hash=' +
          encodeURIComponent(st.hash) +
          '&expires=' +
          encodeURIComponent(st.expires),
        { xhr: true, timeout: 12000, fresh: !!(options && options.fresh), attempt: options && options.attempt },
      );
      if (!acc || !acc.body) return [];
      try {
        const json = JSON.parse(acc.body);
        if (!json || !json.success) return [];
        return streamsFromLookmovieAccess(json);
      } catch (_) {
        return [];
      }
    }

    // TV
    const season = parsed.season || 1;
    const episode = parsed.episode || 1;
    const listRes = await lookmovieRequest(
      LOOKMOVIE + '/api/v2/download/episode/list?id=' + encodeURIComponent(String(hit.id_show)),
      { xhr: true, timeout: 12000, fresh: !!(options && options.fresh), attempt: options && options.attempt },
    );
    if (!listRes || !listRes.body) return [];
    let list = {};
    try {
      list = (JSON.parse(listRes.body) || {}).list || {};
    } catch (_) {
      list = {};
    }
    const eid = pickLookmovieEpisodeId(list, season, episode);
    if (!eid) {
      log('lookmovie missing episode ' + season + 'x' + episode);
      return [];
    }
    const view = await lookmovieRequest(
      LOOKMOVIE + '/shows/view/' + encodeURIComponent(hit.slug),
      { accept: 'text/html,*/*', timeout: 12000, fresh: !!(options && options.fresh), attempt: options && options.attempt },
    );
    if (!view || !view.body) return [];
    const playPath = extractLookmoviePlayHref(view.body, 'show');
    if (!playPath) return [];
    const play = await lookmovieRequest(LOOKMOVIE + playPath, {
      accept: 'text/html,*/*',
      timeout: 12000,
      fresh: !!(options && options.fresh),
      attempt: options && options.attempt,
    });
    if (!play || !play.body) return [];
    const st = extractLookmovieStorage(play.body);
    if (!st.hash || !st.expires) return [];
    const acc = await lookmovieRequest(
      LOOKMOVIE +
        '/api/v1/security/episode-access?id_episode=' +
        encodeURIComponent(String(eid)) +
        '&hash=' +
        encodeURIComponent(st.hash) +
        '&expires=' +
        encodeURIComponent(st.expires),
      { xhr: true, timeout: 12000, fresh: !!(options && options.fresh), attempt: options && options.attempt },
    );
    if (!acc || !acc.body) return [];
    try {
      const json = JSON.parse(acc.body);
      if (!json || !json.success) return [];
      const raw = json.streams || {};
      const norm = {};
      Object.keys(raw).forEach(function (k) {
        norm[/p$/i.test(k) ? k : k + 'p'] = raw[k];
      });
      json.streams = norm;
      return streamsFromLookmovieAccess(json);
    } catch (_) {
      return [];
    }
    } catch (e) {
      log('lookmovie fail: ' + (e && e.message ? e.message : e));
      return [];
    }
  }

  function isKnownFragileVideasyHost(url) {
    // Hosts that frequently serve #EXTM3U masters but 403 segment bodies (CF).
    return /moon\.|ironwallnet|solaratom|winterforest|losangeles\d*\.site|checknews|diskphone|waltersamson|vimeos\.zip|itsdeskmate|playhq\.net|ourmovie\.net|workers\.dev/i.test(
      String(url || ''),
    );
  }

  function isSegmentDeadStream(s) {
    return !!(s && (s.segmentDead || s.playlistDead));
  }

  function isSegmentRiskyStream(s) {
    return !!(s && (s.segmentMimeRisky || s.codecRisky || s.segmentProbeFailed || isSegmentDeadStream(s)));
  }

  function streamHeight(s) {
    return Number(s && s.height) || qualityHeightFromText((s && s.label) || '') || qualityHeightFromText((s && s.url) || '') || 0;
  }

  function streamQualityScore(s) {
    if (!s || !s.url) return -1;
    const h = streamHeight(s);
    const playable = s.playable !== false && isLikelyPlayableOnIos(s) && !isSegmentDeadStream(s);
    // Product goal: default to 720–1080 when available. SD LookMovie must not
    // outrank verified HD Videasy (previous 480-first bug).
    let score = 0;
    if (playable) score += 100000;

    // Height tiers dominate provider bonuses.
    if (h === 1080 && playable) score += 50000;
    else if (h >= 720 && h < 1080 && playable) score += 42000;
    else if (h >= 2160 && playable) score += 38000; // list 4K but prefer 1080 default
    else if (h >= 480 && playable) score += 8000;
    else if (playable) score += Math.min(h, 4000);

    if (s.kind === 'hls' && playable) score += 300;
    if (s.segmentProbeOk && playable && !s.segmentMimeRisky) score += 8000;
    else if (s.segmentProbeOk && playable) score += 2500;

    // Only proven-clean Videasy HD may outrank LookMovie SD.
    if (s.provider === 'videasy' && playable && h >= 720 && s.segmentProbeOk && !s.segmentMimeRisky) {
      score += 12000;
    } else if (s.provider === 'videasy' && playable && h >= 720) {
      score -= 20000; // unprobed / jpeg-labelled HD is not a default
    }

    // LookMovie: real TS. HD first; clean SD is the honest fallback.
    if (s.provider === 'lookmovie' && playable && h >= 720 && s.segmentProbeOk && !s.segmentMimeRisky) {
      score += 14000;
    } else if (s.provider === 'lookmovie' && playable && h >= 720) {
      score += 4000;
    } else if (s.provider === 'lookmovie' && playable && h > 0 && h < 720 && s.segmentProbeOk) {
      score += 2500;
    } else if (s.provider === 'lookmovie' && playable && h > 0 && h < 720) {
      score += 800;
    }

    if (/refligns|tracclime|dancric/i.test(s.url || '') && playable && h >= 720 && !s.segmentMimeRisky) {
      score += 2000;
    }
    if ((s.container === 'mp4' || s.kind === 'mp4') && playable && s.segmentProbeOk) score += 2500;
    if (s.provider && String(s.provider).indexOf('vidzee-pixeldrain') >= 0 && playable && h >= 720 && s.segmentProbeOk) {
      score += 6000;
    }

    if (!playable) score -= 50000;
    if (s.container === 'mkv' || /\bmkv\b/i.test(s.label || '')) score -= 2000;
    // Image / jpeg-TS / HTML segments: never preferred. App media guard rejects them.
    if (s.segmentMimeRisky) score -= 200000;
    if (s.codecRisky) score -= 12000;
    if (s.segmentDead || s.playlistDead) score -= 200000;
    if (s.segmentProbeFailed && !s.segmentProbeOk) score -= 90000;
    if (isKnownFragileVideasyHost(s.url) && !s.segmentProbeOk && !s.segmentMimeRisky) score -= 60000;
    return score;
  }

  /** Prefer clean playable first (incl. LM 480). Never promote image HLS. */
  function orderHdFirst(streams) {
    const list = Array.isArray(streams) ? streams.slice() : [];
    list.sort(function (a, b) {
      return streamQualityScore(b) - streamQualityScore(a);
    });
    const clean = list.filter(function (s) {
      return (
        s &&
        s.url &&
        isLikelyPlayableOnIos(s) &&
        !isSegmentDeadStream(s) &&
        !s.segmentMimeRisky &&
        s.segmentProbeOk === true
      );
    });
    const cleanHd = clean.filter(function (s) {
      const h = streamHeight(s);
      return h >= 720 && h <= 1080;
    });
    const preferred = cleanHd.length ? cleanHd : clean;
    if (!preferred.length) return clean.length ? clean : [];
    const seen = Object.create(null);
    const out = [];
    function push(s) {
      if (!s || !s.url || seen[s.url]) return;
      if (s.segmentMimeRisky || isSegmentDeadStream(s)) return;
      seen[s.url] = true;
      out.push(s);
    }
    preferred.sort(function (a, b) {
      return streamQualityScore(b) - streamQualityScore(a);
    });
    for (let i = 0; i < preferred.length; i++) push(preferred[i]);
    for (let c = 0; c < clean.length; c++) push(clean[c]);
    return out;
  }

  function absoluteFromPlaylist(baseUrl, line) {
    const t = String(line || '').trim();
    if (!t) return '';
    if (/^https?:\/\//i.test(t)) return t;
    if (t.charAt(0) === '/') {
      const origin = String(baseUrl).match(/^(https?:\/\/[^/]+)/i);
      return origin ? origin[1] + t : t;
    }
    const cut = String(baseUrl).lastIndexOf('/');
    return cut >= 0 ? String(baseUrl).slice(0, cut + 1) + t : t;
  }

  function firstMediaUri(body) {
    const lines = String(body || '').split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = String(lines[i] || '').trim();
      if (!line || line.charAt(0) === '#') continue;
      return line;
    }
    return '';
  }

  function hlsAttribute(line, name) {
    const match = String(line || '').match(
      new RegExp(name + '\\s*=\\s*(?:"([^"]*)"|([^,\\s]*))', 'i'),
    );
    return cleanText((match && (match[1] || match[2])) || '');
  }

  function audioLanguageClass(value) {
    const normalized = cleanText(value).toLowerCase().replace(/_/g, '-');
    if (!normalized) return 'unknown';
    if (/^(en|eng|english)(?:-|$)/i.test(normalized)) return 'english';
    if (/^(es|spa|spanish|latino|castellano|espanol|fr|fre|fra|french|de|ger|deu|german|it|ita|italian|pt|por|portuguese|ru|rus|russian|hi|hin|hindi|ja|jpn|japanese|ko|kor|korean)(?:-|$)/i.test(normalized)) {
      return 'foreign';
    }
    if (/^(und|unknown|original|main|default|multi|dual|mixed)(?:-|$)/i.test(normalized)) {
      return 'ambiguous';
    }
    if (/(^|[^a-z])(english|eng(?:lish)?)([^a-z]|$)/i.test(normalized)) return 'english';
    if (/(^|[^a-z])(spanish|latino|castellano|espanol|french|german|italian|portuguese|russian|hindi|japanese|korean)([^a-z]|$)/i.test(normalized)) {
      return 'foreign';
    }
    return 'unknown';
  }

  function playlistAudioTracks(body) {
    const found = [];
    const text = String(body || '');
    const re = /#EXT-X-MEDIA:[^\r\n]*TYPE=AUDIO[^\r\n]*/gi;
    let match;
    while ((match = re.exec(text))) {
      const line = match[0];
      const language = hlsAttribute(line, 'LANGUAGE').toLowerCase();
      const name = hlsAttribute(line, 'NAME');
      const value = language || name.toLowerCase();
      found.push({
        language: language,
        name: name,
        group: hlsAttribute(line, 'GROUP-ID'),
        uri: hlsAttribute(line, 'URI'),
        default: /^YES$/i.test(hlsAttribute(line, 'DEFAULT')),
        kind: audioLanguageClass(value),
      });
    }
    return found;
  }

  function playlistAudioLanguages(body) {
    const found = [];
    const tracks = playlistAudioTracks(body);
    for (let i = 0; i < tracks.length; i++) {
      const value = cleanText(tracks[i].language || tracks[i].name).toLowerCase();
      if (value && found.indexOf(value) < 0) found.push(value);
    }
    return found;
  }

  function sourceAudioEvidence(stream) {
    const s = stream || {};
    const explicit = [
      s.audioLanguage,
      s.audio_language,
      s.audioTrackLanguage,
      s.audio_track_language,
      s.audioLocale,
      s.audio_locale,
      s.audioTrack,
      s.audio_track,
      s.audioLabel,
      s.audio_label,
      s.audioName,
      s.audio_name,
      s.sourceAudio,
      s.source_audio,
      s.fileName,
      s.file_name,
      s.sourceLabel,
      s.source_label,
    ].filter(Boolean).join(' ');
    const direct = audioLanguageClass(explicit);
    if (direct !== 'unknown') return direct;
    if (hasForeignAudioTag(explicit) || hasForeignAudioTag(s.url || '')) return 'foreign';
    return 'unknown';
  }

  function audioEvidenceFromTracks(tracks) {
    const rows = Array.isArray(tracks) ? tracks.filter(Boolean) : [];
    if (!rows.length) return 'unknown';
    const english = rows.filter((track) => track.kind === 'english').length;
    const foreign = rows.filter((track) => track.kind === 'foreign').length;
    const ambiguous = rows.filter((track) => track.kind === 'ambiguous').length;
    if (english === rows.length) return 'english';
    if (foreign === rows.length) return 'foreign';

    // HLS DEFAULT=YES is an explicit rendition choice. Accept a mixed
    // playlist only when exactly one default exists and it is English;
    // a foreign or ambiguous default remains unsafe for a DUB request.
    const defaults = rows.filter((track) => track.default === true);
    if (defaults.length === 1 && defaults[0].kind === 'english') return 'english';
    if (english > 0 || foreign > 0 || ambiguous > 0) return 'ambiguous';
    return 'unknown';
  }

  function markAudioLanguageEvidence(stream, body) {
    const currentTracks = playlistAudioTracks(body);
    const currentLanguages = playlistAudioLanguages(body);
    const tracks = Array.isArray(stream.audioTracks) ? stream.audioTracks.slice() : [];
    const languages = Array.isArray(stream.audioLanguages) ? stream.audioLanguages.slice() : [];
    for (let i = 0; i < currentTracks.length; i++) {
      const current = currentTracks[i];
      const key = [current.language, current.name, current.group, current.uri].join('|');
      let exists = false;
      for (let j = 0; j < tracks.length; j++) {
        const existing = tracks[j] || {};
        if ([existing.language, existing.name, existing.group, existing.uri].join('|') === key) {
          exists = true;
          break;
        }
      }
      if (!exists) tracks.push(current);
    }
    for (let i = 0; i < currentLanguages.length; i++) {
      if (languages.indexOf(currentLanguages[i]) < 0) languages.push(currentLanguages[i]);
    }
    const sourceEvidence = sourceAudioEvidence(stream);
    const prior = sourceEvidence !== 'unknown' ? sourceEvidence : stream.audioLanguageEvidence || 'unknown';
    stream.audioTracks = tracks;
    stream.audioLanguages = languages;

    let evidence = prior;
    if (tracks.length) {
      evidence = audioEvidenceFromTracks(tracks);
    }
    stream.audioLanguageEvidence = evidence;
    stream.audioLanguageVerified = evidence === 'english';
    // Unknown is intentionally not treated as a mismatch here. It is allowed
    // for SUB and is rejected only when a caller explicitly requests DUB.
    stream.audioLanguageMismatch = evidence === 'foreign' || evidence === 'ambiguous';
    if (stream.audioLanguageMismatch) {
      log(
        'softProbe rejected non-English/ambiguous audio (' +
          (languages.join(',') || evidence) +
          ') for ' +
          (stream.label || ''),
      );
    }
  }

  function hasForeignAudioTag(text) {
    return /\b(latino|spanish|castellano|dublado|espanol|french|german|italian|russian|hindi|tamil|telugu|audio[\s_-]*latino|audio[\s_-]*es|_spa\b|_lat\b|_fre\b|_ger\b|_ita\b)\b/i.test(String(text || ''));
  }

  function classifyHlsSegmentResponse(response) {
    const status = Number((response && response.status) || 0);
    const ctype = String(
      (response && response.headers &&
        (response.headers['content-type'] || response.headers['Content-Type'])) ||
        '',
    ).toLowerCase();
    const raw = String((response && response.body) || '');
    const html = ctype.indexOf('text/html') === 0 || /<!DOCTYPE|<html|Just a moment/i.test(raw);
    const image = ctype.indexOf('image/') === 0 || firstBytesLookLikeImage(raw);
    const playlist = /^\s*#EXTM3U/i.test(raw);
    const mediaType =
      /^(video\/|audio\/)/i.test(ctype) ||
      /^(application\/(?:octet-stream|mp2t|mp4|fmp4))/i.test(ctype);
    const mediaBytes = !playlist && firstBytesLookLikeMedia(raw);
    const ok = status >= 200 && status < 300 && !html && !image && !playlist && (mediaType || mediaBytes);
    return {
      status: status,
      ctype: ctype,
      ok: ok,
      dead: status < 200 || status >= 300 || html || image || playlist,
      risky: html || image || playlist || (mediaBytes && !!ctype && !mediaType),
    };
  }

  async function probeHlsSegment(url, headers) {
    if (!url) return { status: 0, ctype: '', ok: false, dead: true, risky: false };
    try {
      const response = await settleWithin(
        externalRequest(url, {
          method: 'GET',
          accept: '*/*',
          headers: Object.assign({}, headers || {}, {
            Range: 'bytes=0-512',
            Accept: 'video/mp2t,video/*,application/octet-stream,*/*',
          }),
        }),
        4500,
        null,
      );
      if (!response) return { status: 0, ctype: '', ok: false, dead: true, risky: false };
      return classifyHlsSegmentResponse(response);
    } catch (_) {
      return { status: 0, ctype: '', ok: false, dead: true, risky: false };
    }
  }

  /**
   * Soft-check spread-out media segments of an HLS playlist.
   * Flags:
   *  - segmentMimeRisky: jpeg/png/html disguised media (black screen)
   *  - segmentDead: 403/401/404 or CF HTML challenge on segment
   *  - playlistDead: master not HLS
   *  - segmentProbeFailed: timeout/network (treat as untrusted for Videasy)
   *  - segmentProbeOk: real media bytes seen
   */
  async function softProbeHlsSegmentRisk(stream, options) {
    if (!stream || !stream.url) return stream;
    if (stream.kind !== 'hls' && stream.container !== 'hls' && !/\.m3u8/i.test(stream.url)) {
      return stream;
    }
    // Pre-flag known-fragile CDNs until proven otherwise.
    if (isKnownFragileVideasyHost(stream.url) && stream.provider === 'videasy') {
      stream.segmentProbeFailed = true;
    }
    try {
      const headers = Object.assign(
        { 'User-Agent': USER_AGENT, Accept: 'application/vnd.apple.mpegurl,application/x-mpegURL,*/*' },
        stream.headers || {},
      );
      const pl = await settleWithin(
        externalRequest(stream.url, { accept: headers.Accept, headers: headers }),
        4500,
        null,
      );
      if (!pl) {
        stream.segmentProbeFailed = true;
        stream.playlistDead = true;
        log('softProbe playlist timeout ' + (stream.label || stream.url));
        return stream;
      }
      const plStatus = Number(pl.status || 0);
      if (plStatus && (plStatus === 401 || plStatus === 403 || plStatus === 404 || plStatus === 410 || plStatus >= 500)) {
        stream.playlistDead = true;
        stream.segmentDead = true;
        log('softProbe playlist HTTP ' + plStatus + ' for ' + (stream.label || ''));
        return stream;
      }
      if (!pl.body || String(pl.body).indexOf('#EXTM3U') < 0) {
        // Cloudflare/HTML masquerading as playlist.
        if (/<!DOCTYPE|<html|Just a moment|cf-browser-verification/i.test(String(pl.body || ''))) {
          stream.playlistDead = true;
          stream.segmentDead = true;
          stream.segmentMimeRisky = true;
          log('softProbe playlist HTML/CF for ' + (stream.label || ''));
        } else {
          stream.playlistDead = true;
        }
        return stream;
      }
      const body = String(pl.body);
      markAudioLanguageEvidence(stream, body);
      if (playlistPointsAtImageSegments(body)) {
        stream.segmentMimeRisky = true;
        stream.segmentDead = true;
        stream.playlistDead = true;
        log('softProbe playlist image segments for ' + (stream.label || ''));
        return stream;
      }
      // Detect HEVC/HDR in master tags if present.
      if (/CODECS="[^"]*(hvc1|hev1|dvh1|dvhe)/i.test(body) || /\b(HDR|DOLBY|DV)\b/i.test(body)) {
        stream.codecRisky = true;
      }
      let probeBody = body;
      let probeBaseUrl = stream.url;
      const nestedUrl = absoluteFromPlaylist(stream.url, firstMediaUri(body));
      // If this is a nested master playlist, follow one level.
      if (nestedUrl && /\.m3u8(\?|$)/i.test(nestedUrl)) {
        const nested = await settleWithin(
          externalRequest(nestedUrl, { accept: headers.Accept, headers: headers }),
          3500,
          null,
        );
        if (nested && nested.body && String(nested.body).indexOf('#EXTM3U') >= 0) {
          const nestedBody = String(nested.body);
          markAudioLanguageEvidence(stream, nestedBody);
          if (playlistPointsAtImageSegments(nestedBody)) {
            stream.segmentMimeRisky = true;
            stream.segmentDead = true;
            stream.playlistDead = true;
            return stream;
          }
          probeBody = nestedBody;
          probeBaseUrl = nestedUrl;
        } else if (nested && Number(nested.status) >= 400) {
          stream.segmentDead = true;
          stream.segmentProbeFailed = true;
          log('softProbe nested playlist HTTP ' + nested.status + ' for ' + (stream.label || ''));
          return stream;
        }
      }

      // Retry health checks may use a single segment to limit upstream
      // pressure. The final merged-set probe keeps the full spread sample.
      const sampleLimit = Math.max(1, Number(options && options.sampleLimit) || 3);
      const segmentUris = samplePlaylistMediaUris(probeBody, sampleLimit);
      if (!segmentUris.length) {
        stream.segmentProbeFailed = true;
        stream.segmentDead = true;
        return stream;
      }
      const sampleResults = await Promise.all(
        segmentUris.map(function (uri) {
          return probeHlsSegment(absoluteFromPlaylist(probeBaseUrl, uri), headers);
        }),
      );
      const firstResult = sampleResults[0];
      stream.segmentProbeStatus = firstResult.status;
      stream.segmentProbeCtype = firstResult.ctype;
      stream.segmentProbeSamples = sampleResults.length;
      let failed = null;
      for (let i = 0; i < sampleResults.length; i++) {
        if (!sampleResults[i].ok) {
          failed = sampleResults[i];
          break;
        }
      }
      if (failed) {
        stream.segmentProbeOk = false;
        stream.segmentProbeFailed = true;
        stream.segmentDead = true;
        if (failed.risky) stream.segmentMimeRisky = true;
        log(
          'softProbe rejected sampled segment status=' +
            failed.status +
            ' ct=' +
            failed.ctype +
            ' for ' +
            (stream.label || stream.url),
        );
        return stream;
      }
      stream.segmentProbeOk = true;
      stream.segmentProbeFailed = false;
      stream.segmentDead = false;
      stream.segmentProbeComplete = !(options && options.sampleLimit === 1);
    } catch (e) {
      stream.segmentProbeFailed = true;
      stream.segmentDead = true;
      log('softProbe exception for ' + (stream.label || '') + ': ' + (e && e.message ? e.message : e));
    }
    return stream;
  }

  async function softProbeStreams(streams, options) {
    const list = Array.isArray(streams) ? streams : [];
    const out = list.slice();
    const probeOrder = list
      .map(function (s, idx) {
        return { s: s, idx: idx, h: streamHeight(s) };
      })
      .sort(function (a, b) {
        return b.h - a.h || a.idx - b.idx;
      });
    const jobs = [];
    for (let i = 0; i < probeOrder.length; i++) {
      const s = probeOrder[i].s;
      if (s && s.segmentProbeOk && !isSegmentDeadStream(s) && !s.segmentMimeRisky &&
          (s.kind === 'mp4' || s.segmentProbeComplete === true)) continue;
      const isHls = s && (s.kind === 'hls' || s.container === 'hls' || /\.m3u8/i.test(s.url || ''));
      const isMp4 = s && (s.kind === 'mp4' || s.container === 'mp4');
      if (!s || (!isHls && !isMp4)) continue;
      if (jobs.length >= 16) break;
      jobs.push(probeOrder[i]);
    }
    const CONC = 6;
    for (let i = 0; i < jobs.length; i += CONC) {
      const batch = jobs.slice(i, i + CONC);
      const probed = await Promise.all(
        batch.map(function (job) {
          if (job.s.kind === 'mp4' || job.s.container === 'mp4') {
            return (async function () {
              const ok = await settleWithin(probeBytes(job.s.url, job.s.headers || {}), 4500, false);
              if (ok) {
                job.s.segmentProbeOk = true;
                job.s.segmentDead = false;
              } else {
                job.s.segmentDead = true;
                job.s.segmentProbeFailed = true;
              }
              return job.s;
            })();
          }
          return softProbeHlsSegmentRisk(job.s, options);
        }),
      );
      for (let j = 0; j < batch.length; j++) out[batch[j].idx] = probed[j];
    }
    return out;
  }

  /** Keep only non-image, non-dead routes. Honest empty beats fake HD. */
  function preferReliableStreams(streams) {
    const list = Array.isArray(streams) ? streams.slice() : [];
    if (!list.length) return list;
    const clean = list.filter(function (s) {
      return s && s.url && !isSegmentDeadStream(s) && !s.segmentMimeRisky;
    });
    const proven = clean.filter(function (s) {
      return s.segmentProbeOk === true;
    });
    if (proven.length) return proven;
    return clean;
  }

  function requestedLanguage(lang) {
    return String(lang || 'sub').toLowerCase() === 'dub' ? 'dub' : 'sub';
  }

  function annotateAudioLanguage(stream) {
    const s = stream || {};
    if (!s.audioLanguageEvidence) {
      const evidence = sourceAudioEvidence(s);
      s.audioLanguageEvidence = evidence;
      s.audioLanguageVerified = evidence === 'english';
      if (evidence === 'foreign' || evidence === 'ambiguous') s.audioLanguageMismatch = true;
    }
    return s;
  }

  function filterStreamsForLanguage(streams, lang) {
    const list = Array.isArray(streams) ? streams : [];
    const wanted = requestedLanguage(lang);
    return list.filter(function (stream) {
      const s = annotateAudioLanguage(stream);
      if (!s || !s.url) return false;
      if (wanted !== 'dub') return true;
      // DUB is a hard contract. A playable URL without explicit English
      // evidence is not a DUB candidate, even when its captions are English.
      return s.audioLanguageEvidence === 'english' && s.audioLanguageVerified === true;
    });
  }

  function providerState(name) {
    const key = String(name || 'unknown');
    if (!providerHealth[key]) {
      providerHealth[key] = {
        attempts: 0,
        successes: 0,
        failures: 0,
        failureScore: 0,
        consecutiveFailures: 0,
        quarantinedUntil: 0,
      };
    }
    return providerHealth[key];
  }

  function providerIsQuarantined(name) {
    const state = providerState(name);
    if (state.quarantinedUntil && state.quarantinedUntil <= Date.now()) {
      state.quarantinedUntil = 0;
      state.failureScore = Math.max(0, state.failureScore - 1);
    }
    return state.quarantinedUntil > Date.now();
  }

  function recordProviderHealth(name, ok) {
    const state = providerState(name);
    state.attempts += 1;
    if (ok) {
      state.successes += 1;
      state.consecutiveFailures = 0;
      state.failureScore = Math.max(0, state.failureScore - 2);
      state.quarantinedUntil = 0;
      return;
    }
    state.failures += 1;
    state.consecutiveFailures += 1;
    state.failureScore = Math.min(6, state.failureScore + 1);
    if (state.failureScore >= 3 || state.consecutiveFailures >= 3) {
      state.quarantinedUntil = Date.now() + PROVIDER_QUARANTINE_MS;
    }
  }

  function providerResultStreams(result) {
    if (Array.isArray(result)) return result.filter((s) => s && s.url);
    if (result && result.url) return [result];
    return result && Array.isArray(result.streams)
      ? result.streams.filter((s) => s && s.url)
      : [];
  }

  function providerResultWithStreams(result, streams) {
    if (Array.isArray(result)) return streams;
    if (result && result.url) return streams[0] || null;
    return Object.assign({}, result || {}, { streams: streams });
  }

  function hasVerifiedRoute(result) {
    const streams = providerResultStreams(result);
    for (let i = 0; i < streams.length; i++) {
      const s = streams[i];
      if (s && s.url && !s.segmentDead && s.segmentProbeOk !== false) return true;
    }
    return false;
  }

  async function resolveProviderWithRetries(job, parsed, forceFresh) {
    if (providerHalfOpen[job.name]) return job.empty;
    const quarantined = providerIsQuarantined(job.name);
    if (!quarantined) return runProviderAttempts(job, parsed, forceFresh === true, PROVIDER_MAX_ATTEMPTS);
    if (forceFresh !== true) return job.empty;
    // Never share a stream pack between different title IDs. One explicit
    // retry may probe a quarantined provider; other callers remain bounded.
    providerHalfOpen[job.name] = true;
    let pending = null;
    const probeJob = Object.assign({}, job, { resolve: function (ref, options) {
      pending = Promise.resolve().then(function () { return job.resolve(ref, options); });
      return pending;
    } });
    try {
      return await runProviderAttempts(probeJob, parsed, true, 1);
    } finally {
      // A caller timeout does not cancel provider IO. Hold the lease until
      // that IO settles so repeated retries cannot accumulate orphan work.
      const release = function () { delete providerHalfOpen[job.name]; };
      if (pending) pending.then(release, release);
      else release();
    }
  }

  async function runProviderAttempts(job, parsed, forceFresh, maxAttempts) {
    const name = job.name;

    let lastResult = job.empty;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (attempt > 1) await sleep(250 * attempt);
      let result = job.empty;
      try {
        result = await settleWithin(
          job.resolve(parsed, { fresh: forceFresh || attempt > 1, attempt: attempt }),
          job.timeout,
          job.empty,
        );
      } catch (e) {
        log('provider attempt failed ' + name + ': ' + (e && e.message ? e.message : e));
      }
      const streams = providerResultStreams(result);
      lastResult = result || job.empty;
      if (!streams.length) {
        // Do not score every retry of the same title as a separate provider
        // failure. A single failed resolution is one health event.
        continue;
      }

      // Fully check the best two routes now; reuse their evidence in the final
      // set instead of downloading the same playlists and segments twice.
      const probeCandidates = streams
        .slice()
        .sort((a, b) => streamQualityScore(b) - streamQualityScore(a))
        .slice(0, 2);
      let probed = [];
      try {
        probed = await softProbeStreams(probeCandidates);
      } catch (e) {
        log('provider probe failed ' + name + ': ' + (e && e.message ? e.message : e));
      }
      // Provider health measures real media availability, not whether a
      // caller later requests DUB or SUB. Language eligibility is enforced
      // at extractStreamUrl so one episode is not resolved twice per language.
      const verified = probed.some(function (stream) {
        return stream && stream.segmentProbeOk && !isSegmentDeadStream(stream) && !stream.segmentMimeRisky;
      });
      if (verified || attempt === maxAttempts) {
        recordProviderHealth(name, verified);
        return providerResultWithStreams(result, streams);
      }
    }
    recordProviderHealth(name, false);
    return lastResult;
  }

  function providerHealthSnapshot() {
    const out = {};
    Object.keys(providerHealth).forEach(function (name) {
      const state = providerHealth[name];
      out[name] = {
        attempts: state.attempts,
        successes: state.successes,
        failures: state.failures,
        failureScore: state.failureScore,
        quarantined: state.quarantinedUntil > Date.now(),
      };
    });
    return out;
  }

  /* -------------------- Videasy (free site Server 1) -------------------- */

  function videasyHeaders() {
    return {
      'User-Agent': USER_AGENT,
      Accept: '*/*',
      Origin: VIDEASY_PLAYER,
      Referer: VIDEASY_PLAYER + '/',
    };
  }

  function videasyStreamHeaders() {
    return {
      'User-Agent': USER_AGENT,
      Accept: 'application/vnd.apple.mpegurl,application/x-mpegURL,video/*,*/*',
      Origin: VIDEASY_PLAYER,
      Referer: VIDEASY_PLAYER + '/',
    };
  }

  function videasyImul(a, b) {
    if (typeof Math.imul === 'function') return Math.imul(a, b) >>> 0;
    a = a >>> 0;
    b = b >>> 0;
    const ah = (a >>> 16) & 0xffff;
    const al = a & 0xffff;
    const bh = (b >>> 16) & 0xffff;
    const bl = b & 0xffff;
    return ((al * bl + (((ah * bl + al * bh) << 16) >>> 0)) >>> 0) >>> 0;
  }

  function videasyU32(x) {
    return x >>> 0;
  }

  function videasyMix(e) {
    e = videasyU32(e);
    e ^= e >>> 16;
    e = videasyImul(e, 2246822507);
    e ^= e >>> 13;
    e = videasyImul(e, 3266489909);
    e ^= e >>> 16;
    return videasyU32(e);
  }

  function videasyRotl(e, t) {
    e = videasyU32(e);
    t = t & 31;
    if (!t) return e;
    return videasyU32((e << t) | (e >>> (32 - t)));
  }

  const VIDEASY_F = [
    1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993, 2453635748, 2870763221,
    3624381080, 310598401, 607225278, 1426881987, 1925078388, 2162078206, 2614888103, 3248222580,
  ];
  const VIDEASY_MAGIC = [109, 118, 109, 49]; // mvm1

  function videasyB64Decode(input) {
    const s = String(input || '')
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .replace(/\s+/g, '');
    const pad = s.length % 4 === 0 ? s : s + '===='.slice(s.length % 4);
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const out = [];
    let buf = 0;
    let bits = 0;
    for (let i = 0; i < pad.length; i++) {
      const ch = pad.charAt(i);
      if (ch === '=') break;
      const v = alphabet.indexOf(ch);
      if (v < 0) continue;
      buf = (buf << 6) | v;
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        out.push((buf >>> bits) & 0xff);
      }
    }
    return out;
  }

  function videasyUtf8Decode(bytes) {
    let out = '';
    for (let i = 0; i < bytes.length; ) {
      const c = bytes[i++];
      if (c < 0x80) out += String.fromCharCode(c);
      else if (c < 0xe0) {
        const c2 = bytes[i++];
        out += String.fromCharCode(((c & 0x1f) << 6) | (c2 & 0x3f));
      } else if (c < 0xf0) {
        const c2 = bytes[i++];
        const c3 = bytes[i++];
        out += String.fromCharCode(((c & 0x0f) << 12) | ((c2 & 0x3f) << 6) | (c3 & 0x3f));
      } else {
        const c2 = bytes[i++];
        const c3 = bytes[i++];
        const c4 = bytes[i++];
        let cp = ((c & 7) << 18) | ((c2 & 0x3f) << 12) | ((c3 & 0x3f) << 6) | (c4 & 0x3f);
        cp -= 0x10000;
        out += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
      }
    }
    return out;
  }

  function videasyKeystate(seed, mediaId) {
    const tNum = Number(mediaId) || 0;
    const S = Object.create(null);
    let fnv = 2166136261;
    const seedStr = String(seed || '');
    for (let i = 0; i < seedStr.length; i++) {
      fnv = videasyImul(fnv ^ seedStr.charCodeAt(i), 16777619);
    }
    let a = videasyMix(videasyMix(fnv) ^ videasyMix(videasyU32(tNum) ^ 2654435769));
    for (let e = 0; e < 8; e++) {
      // b(e) = (e*(e+1)&1)==0 is always true for integers
      const tSlot = a % 61;
      a = videasyRotl(videasyU32(a + 2654435769), 7 + (7 & e));
      S[tSlot] = videasyU32(a ^ videasyMix(a));
      a = videasyMix(videasyU32(a + tSlot));
    }
    return { S: S, acc: videasyMix(videasyU32(2779096485 ^ a)) };
  }

  function videasyNextWord(state, tCounter) {
    const r = state.S;
    let o = state.acc;
    const n = o % 61;
    const present = Object.prototype.hasOwnProperty.call(r, n);
    const iMask = present ? 0xffffffff : 0; // 0 - Number(true) === -1 => 0xffffffff as u32
    const l = present ? videasyU32(r[n]) : 0;
    const aVal = videasyU32(l ^ videasyImul(2654435769, tCounter + 1));
    const s = o;
    let d = videasyU32(videasyU32(s ^ aVal) | videasyU32(s & aVal & iMask));
    d = videasyU32(videasyRotl(videasyU32(d + o), 31 & n) ^ videasyRotl(o, 31 & videasyImul(n, 7)));
    o = videasyMix(videasyU32(d + 2654435769));
    r[n] = o;
    state.acc = o;
    return o;
  }

  function videasyKeystream(seed, mediaId, length) {
    const state = videasyKeystate(seed, mediaId);
    const out = new Array(length);
    let o = 0;
    let e = 0;
    while (e < length) {
      const t = videasyNextWord(state, o++);
      out[e++] = t & 255;
      if (e < length) out[e++] = (t >>> 8) & 255;
      if (e < length) out[e++] = (t >>> 16) & 255;
      if (e < length) out[e++] = (t >>> 24) & 255;
    }
    return out;
  }

  function videasyDecrypt(payload, seed, mediaId) {
    const raw = videasyB64Decode(String(payload || '').trim().replace(/^"|"$/g, ''));
    if (!raw.length) throw new Error('videasy empty payload');
    const ks = videasyKeystream(seed, mediaId, raw.length);
    const plain = new Array(raw.length);
    for (let i = 0; i < raw.length; i++) plain[i] = raw[i] ^ ks[i];
    for (let i = 0; i < VIDEASY_MAGIC.length; i++) {
      if (plain[i] !== VIDEASY_MAGIC[i]) throw new Error('videasy decrypt magic mismatch');
    }
    return videasyUtf8Decode(plain.slice(4));
  }

  async function videasyGetSeed(mediaId, options) {
    const id = String(mediaId || '');
    const fresh = !!(options && options.fresh);
    if (fresh) {
      delete videasySeedCache[id];
      delete inFlightSeedMap[id];
    }
    const now = Date.now();
    const hit = videasySeedCache[id];
    if (!fresh && hit && hit.expiresAt - 3000 > now && hit.seed) return hit.seed;
    if (!fresh && inFlightSeedMap[id]) return inFlightSeedMap[id];

    const inFlightPromise = (async () => {
      // Retry empty successful responses only. HTTP failures are governed by
      // provider policy and host Retry-After, not nested rapid retry loops.
      let lastErr = 'videasy seed missing';
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) {
          await sleep(350 * attempt + 150);
        }
        const requestOptions = {
          accept: 'application/json,*/*',
          headers: videasyHeaders(),
          timeout: 8000,
        };
        if (fresh || attempt > 0) {
          requestOptions.fresh = true;
          requestOptions.attempt = (options && options.attempt ? Number(options.attempt) : 1) + attempt;
        }
        const res = await externalRequest(
          VIDEASY_API + '/seed?mediaId=' + encodeURIComponent(id),
          requestOptions,
        );
        const status = Number((res && res.status) || 0);
        if (status >= 400) {
          lastErr = 'videasy seed HTTP ' + status;
          break;
        }
        if (!res || !res.body) {
          lastErr = 'videasy seed empty';
          continue;
        }
        let json = null;
        try {
          json = JSON.parse(res.body);
        } catch (_) {
          lastErr = 'videasy seed parse fail';
          continue;
        }
        if (!json || !json.seed) {
          lastErr = 'videasy seed missing';
          continue;
        }
        const ttl = Number(json.ttlMs) || 30000;
        if (!fresh && inFlightSeedMap[id] === inFlightPromise) videasySeedCache[id] = { seed: json.seed, expiresAt: Date.now() + ttl };
        return json.seed;
      }
      log(lastErr);
      return '';
    })();

    if (!fresh) inFlightSeedMap[id] = inFlightPromise;
    try {
      return await inFlightPromise;
    } finally {
      if (!fresh && inFlightSeedMap[id] === inFlightPromise) delete inFlightSeedMap[id];
    }
  }

  function videasyHeightFromQuality(q) {
    const s = String(q || '');
    if (/4k|2160|uhd/i.test(s)) return 2160;
    if (/1080/i.test(s)) return 1080;
    if (/720/i.test(s)) return 720;
    if (/540/i.test(s)) return 540;
    if (/480/i.test(s)) return 480;
    if (/360/i.test(s)) return 360;
    if (/auto/i.test(s)) return 720;
    return qualityHeightFromText(s) || 0;
  }

  function videasyBuildQuery(params) {
    const parts = [];
    Object.keys(params).forEach(function (k) {
      const v = params[k];
      if (v == null || v === '') return;
      parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(String(v)));
    });
    return parts.join('&');
  }

  function mapVideasySubtitles(rawList) {
    const out = [];
    const seen = Object.create(null);
    const rows = Array.isArray(rawList) ? rawList : [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row || typeof row !== 'object') continue;
      const file = String(row.url || row.file || row.src || '').trim();
      if (!file || file.indexOf('http') !== 0) continue;
      // Skip thumbnails / sprite sheets mistaken as captions.
      if (/\/thumbs?\/|sprite|thumbnail/i.test(file)) continue;
      if (seen[file]) continue;
      seen[file] = true;
      const lang = cleanText(row.lang || row.language || row.srclang || row.label || 'und') || 'und';
      const label = cleanText(row.label || row.language || row.lang || lang) || lang;
      const normalizedLanguage = String(lang + ' ' + label).toLowerCase();
      if (!/(^|[^a-z])(en|eng|english)([^a-z]|$)/.test(normalizedLanguage)) {
        continue;
      }
      out.push({
        label: label || 'English',
        language: 'en',
        lang: 'en',
        url: file,
        file: file,
        kind: 'captions',
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/vtt,text/plain,application/x-subrip,*/*',
          Origin: VIDEASY_PLAYER,
          Referer: VIDEASY_PLAYER + '/',
        },
      });
    }
    return out;
  }

  function mergeVideasySubtitles(into, extra) {
    const seen = Object.create(null);
    const out = [];
    const all = (Array.isArray(into) ? into : []).concat(Array.isArray(extra) ? extra : []);
    for (let i = 0; i < all.length; i++) {
      const s = all[i];
      if (!s || !s.url) continue;
      const key = String(s.url).split('?')[0];
      if (seen[key]) continue;
      seen[key] = true;
      out.push(s);
    }
    return out;
  }

  /**
   * Fetch external EN subtitles via Synthetiq One proxy (Wyzie keys stay server-side).
   * @param {string|number} tmdbId
   * @param {number|null} season
   * @param {number|null} episode
   */
  async function fetchSynthetiqSubs(tmdbId, season, episode) {
    const id = String(tmdbId || '').trim();
    if (!id) return [];
    try {
      const params = { id: id, language: 'en', format: 'srt' };
      if (season != null && Number(season) > 0) params.season = Number(season);
      if (episode != null && Number(episode) > 0) params.episode = Number(episode);
      const url = SUBS_API + '?' + videasyBuildQuery(params);
      const res = await settleWithin(
        externalRequest(url, {
          accept: 'application/json,*/*',
          headers: { Accept: 'application/json' },
          timeout: 4500,
        }),
        4500,
        null,
      );
      if (!res || !res.ok || !res.body) return [];
      let data = null;
      try {
        data = JSON.parse(res.body);
      } catch (_) {
        return [];
      }
      const rows = (data && data.subtitles) || [];
      return mapVideasySubtitles(rows).slice(0, 20);
    } catch (e) {
      log('subs proxy fail: ' + (e && e.message ? e.message : e));
      return [];
    }
  }

  async function videasyFetchEndpoint(path, params, mediaId, seed, options) {
    const empty = { streams: [], subtitles: [] };
    const url = VIDEASY_API + path + '?' + videasyBuildQuery(params);
    const requestOptions = {
      accept: 'text/plain,*/*',
      headers: videasyHeaders(),
      timeout: 14000,
    };
    if (options && options.fresh) {
      requestOptions.fresh = true;
      requestOptions.attempt = options.attempt || 1;
    }
    const res = await externalRequest(url, requestOptions);
    if (!res || !res.ok || !res.body) return empty;
    let plain = '';
    try {
      plain = videasyDecrypt(res.body, seed, mediaId);
    } catch (e) {
      log('videasy decrypt fail ' + path + ': ' + (e && e.message ? e.message : e));
      return empty;
    }
    let data = null;
    try {
      data = JSON.parse(plain);
    } catch (_) {
      return empty;
    }
    const sources = (data && data.sources) || [];
    const out = [];
    for (let i = 0; i < sources.length; i++) {
      const src = sources[i];
      if (!src || !src.url || String(src.url).indexOf('http') !== 0) continue;
      const urlStr = String(src.url);
      // Prefer HLS; skip DASH/MPD for iOS reliability.
      if (/\.mpd(\?|$)/i.test(urlStr) || /type=dash/i.test(urlStr) || String(src.type || '').toLowerCase() === 'dash') {
        continue;
      }
      const height = videasyHeightFromQuality(src.quality || src.label || urlStr);
      const labelH = height >= 360 ? height + 'p' : cleanText(src.quality || 'Auto') || 'Auto';
      const isHls =
        /\.m3u8(\?|$)/i.test(urlStr) ||
        /type=m3u8/i.test(urlStr) ||
        String(src.type || '').toLowerCase() === 'm3u8' ||
        String(src.type || '').toLowerCase() === 'hls';
      const audioLanguage = cleanText(
        src.audioLanguage ||
          src.audio_language ||
          src.audioTrackLanguage ||
          src.audio_track_language ||
          src.audioLocale ||
          src.audio_locale ||
          '',
      );
      const audioLabel = cleanText(
        src.audioLabel ||
          src.audio_label ||
          src.audioTrack ||
          src.audio_track ||
          src.audioName ||
          src.audio_name ||
          src.sourceAudio ||
          src.source_audio ||
          '',
      );
      const fileName = cleanText(src.fileName || src.file_name || src.filename || '');
      out.push({
        url: urlStr,
        kind: isHls ? 'hls' : 'mp4',
        height: height || 0,
        label: 'Videasy ' + labelH + (isHls ? ' HLS' : ''),
        headers: videasyStreamHeaders(),
        provider: 'videasy',
        container: isHls ? 'hls' : '',
        playable: true,
        audioLanguage: audioLanguage || undefined,
        audioLabel: audioLabel || undefined,
        fileName: fileName || undefined,
      });
    }
    const subs = mapVideasySubtitles(
      (data && (data.subtitles || data.subs || data.tracks || data.captions)) || [],
    );
    out.forEach(function (stream) {
      stream.subtitles = subs.slice();
      stream.serverKey = 'videasy:' + path.split('/')[1];
    });
    return { streams: out, subtitles: subs };
  }

  async function resolveVideasy(parsed, options) {
    try {
      const details = await extractDetails(
        parsed.type === 'tv' ? encodeHref('tv', parsed.id) : encodeHref('movie', parsed.id),
      );
      const title = cleanText(details.title || '') || String(parsed.id);
      const year = Number(details.year) || '';
      const mediaId = String(parsed.id);
      const seed = await videasyGetSeed(mediaId, options);
      if (!seed) return { streams: [], subtitles: [] };
      const base = {
        title: title,
        mediaType: parsed.type === 'tv' ? 'tv' : 'movie',
        year: year || undefined,
        tmdbId: mediaId,
        imdbId: '',
        enc: '2',
        seed: seed,
      };
      if (parsed.type === 'tv') {
        base.seasonId = Number(parsed.season || 1);
        base.episodeId = Number(parsed.episode || 1);
        base.totalSeasons = Number(details.seasons) || Number(base.seasonId) || 1;
      }

      // Site free Server 1 ladder: cdn (multi 480–2160), m4uhd (often 4K).
      // Note: /lamovie/ is explicitly excluded as it delivers Spanish/Latino dubbed media.
      const endpoints = [
        '/cdn/sources-with-title',
        '/m4uhd/sources-with-title',
      ];

      // Fetch endpoints in parallel for fast quality resolution.
      const packs = await Promise.all(
        endpoints.map((ep) =>
          settleWithin(
            videasyFetchEndpoint(ep, base, mediaId, seed, options),
            7500,
            { streams: [], subtitles: [] },
          ),
        ),
      );

      const collected = [];
      let subtitles = [];
      const seen = Object.create(null);
      for (let i = 0; i < packs.length; i++) {
        const pack = packs[i];
        const rows = (pack && pack.streams) || [];
        subtitles = mergeVideasySubtitles(subtitles, (pack && pack.subtitles) || []);
        for (let j = 0; j < rows.length; j++) {
          const s = rows[j];
          if (!s || !s.url) continue;
          // Signed query parameters can select a different, newer media route.
          const key = String(s.url);
          if (seen[key]) continue;
          seen[key] = true;
          collected.push(s);
        }
      }

      collected.sort(function (a, b) {
        return streamQualityScore(b) - streamQualityScore(a);
      });
      if (collected.length) {
        log(
          'videasy ' +
            mediaId +
            ' qualities=' +
            collected
              .map(function (s) {
                return (s.height || 0) + 'p';
              })
              .join(',') +
            ' subs=' +
            subtitles.length,
        );
      } else {
        log('videasy no sources for ' + mediaId);
      }
      return { streams: collected, subtitles: subtitles };
    } catch (e) {
      log('videasy fail: ' + (e && e.message ? e.message : e));
      return { streams: [], subtitles: [] };
    }
  }

  async function collectStreams(parsed, lang, bypassCache) {
    // Cache one verified media pack per episode. DUB and SUB still remain
    // independent at the public boundary, but do not duplicate upstream
    // provider requests for the same episode.
    const cacheKey =
      parsed.type +
      ':' +
      parsed.id +
      ':' +
      Number(parsed.season || 0) +
      ':' +
      Number(parsed.episode || 0);
    if (bypassCache === true) {
      delete streamCache[cacheKey];
      delete inFlightStreamMap[cacheKey];
    }
    const cached = streamCache[cacheKey];
    if (cached && cached.expiresAt > Date.now()) return cached.pack;
    delete streamCache[cacheKey];
    if (inFlightStreamMap[cacheKey]) return inFlightStreamMap[cacheKey];

    const inFlightPromise = (async () => {
      const results = [];
      let subtitles = [];

      const providerJobs = [
        { name: 'videasy', timeout: 6000, empty: { streams: [], subtitles: [] }, resolve: resolveVideasy },
        { name: 'lookmovie', timeout: 9000, empty: [], resolve: resolveLookmovie },
        { name: 'vidzee', timeout: 5000, empty: null, resolve: resolveVidzee },
        { name: 'vidzee-v2', timeout: 6000, empty: [], resolve: resolveVidzeeV2 },
        { name: 'moviesapi', timeout: 5000, empty: null, resolve: resolveMoviesApi },
      ];

      // Each provider gets its own bounded retry budget. A provider failure is
      // isolated so one rejected request cannot discard other valid routes.
      // Preserve 1.3.2's fast startup; slow legs only fill their private slot.
      const outcomes = providerJobs.map(function () { return undefined; });
      let earlyFired = false;
      let earlyResolve;
      const earlyRoute = new Promise(function (resolve) { earlyResolve = resolve; });
      const jobs = providerJobs.map(function (job, index) {
        if (index === 3 && parsed.type !== 'movie') {
          outcomes[index] = job.empty;
          return Promise.resolve(job.empty);
        }
        return resolveProviderWithRetries(job, parsed, bypassCache === true).then(
          function (result) {
            outcomes[index] = result;
            if (!earlyFired && hasVerifiedRoute(result)) {
              earlyFired = true;
              earlyResolve();
            }
            return result;
          },
          function () { outcomes[index] = job.empty; return job.empty; },
        );
      });
      await Promise.race([Promise.all(jobs), earlyRoute]);
      const raced = providerJobs.map(function (job, index) {
        return outcomes[index] === undefined ? job.empty : outcomes[index];
      });

      const vd = raced[0];
      if (vd && Array.isArray(vd.streams)) {
        for (let i = 0; i < vd.streams.length; i++) {
          if (vd.streams[i] && vd.streams[i].url) results.push(vd.streams[i]);
        }
        if (Array.isArray(vd.subtitles) && vd.subtitles.length) {
          subtitles = mergeVideasySubtitles(subtitles, vd.subtitles);
        }
      } else if (Array.isArray(vd)) {
        for (let i = 0; i < vd.length; i++) {
          if (vd[i] && vd[i].url) results.push(vd[i]);
        }
      }

      const lm = raced[1];
      if (Array.isArray(lm)) {
        for (let i = 0; i < lm.length; i++) {
          if (lm[i] && lm[i].url) results.push(lm[i]);
        }
      }
      const vz = raced[2];
      if (vz && vz.url) results.push(vz);
      const v2 = raced[3];
      if (Array.isArray(v2)) {
        for (let i = 0; i < v2.length; i++) {
          if (v2[i] && v2[i].url) results.push(v2[i]);
        }
      }
      const ma = raced[4];
      if (ma && ma.url) {
        ma.height = qualityHeightFromText(ma.label || ma.url) || streamHeight(ma) || 0;
        results.push(ma);
      }

      // Keep distinct signed URLs. The same path can carry different expiry
      // tokens, and dropping the query can discard the only fresh route.
      const deduped = [];
      const seen = Object.create(null);
      for (let i = 0; i < results.length; i++) {
        const s = results[i];
        if (!s || !s.url) continue;
        const key = String(s.url) + JSON.stringify(s.headers || {}) + JSON.stringify(s.subtitles || []);
        if (seen[key]) continue;
        seen[key] = true;
        deduped.push(s);
      }

      // Soft-probe HLS risk (403 segments / jpeg-TS / CF) before ranking.
      const probed = await softProbeStreams(deduped);
      const reliable = orderHdFirst(preferReliableStreams(probed));

      const pack = { streams: reliable, subtitles: subtitles };
      if (reliable.length) {
        log(
          'collectStreams qualities=' +
            reliable
              .map(function (s) {
                return (
                  (s.label || '?') +
                  '@' +
                  (s.height || 0) +
                  (s.segmentProbeOk ? '+ok' : '') +
                  (s.segmentDead ? '!dead' : '') +
                  (s.segmentMimeRisky ? '!jpegTS' : '') +
                  (s.segmentProbeFailed ? '!probeFail' : '') +
                  (s.codecRisky ? '!codec' : '')
                );
              })
              .join(',') +
            ' droppedDeadVideasy=' +
            (probed.length - reliable.length) +
            ' subs=' +
            subtitles.length,
        );
        if (inFlightStreamMap[cacheKey] === inFlightPromise) {
          streamCache[cacheKey] = { pack: pack, expiresAt: Date.now() + STREAM_CACHE_TTL_MS };
          const keys = Object.keys(streamCache);
          while (keys.length > 24) delete streamCache[keys.shift()];
        }
      }
      return pack;
    })();

    inFlightStreamMap[cacheKey] = inFlightPromise;
    try {
      return await inFlightPromise;
    } finally {
      if (inFlightStreamMap[cacheKey] === inFlightPromise) {
        delete inFlightStreamMap[cacheKey];
      }
    }
  }

  async function extractStreamUrl(episodeHref, lang, bypassCache) {
    try {
    const parsed = parseHref(episodeHref);
    if (!parsed) {
      log('extractStreamUrl invalid href ' + episodeHref);
      return { streams: [], subtitles: [] };
    }
    // Default TV to S1E1 if episode href only had series id.
    if (parsed.type === 'tv' && (!parsed.season || !parsed.episode)) {
      parsed.season = parsed.season || 1;
      parsed.episode = parsed.episode || 1;
    }
    log(
      'extractStreamUrl ' +
        parsed.type +
        '/' +
        parsed.id +
        (parsed.type === 'tv' ? ' S' + parsed.season + 'E' + parsed.episode : ''),
    );

    const wantedLanguage = requestedLanguage(lang);
    const pack = await collectStreams(parsed, wantedLanguage, bypassCache);
    const streams = (pack && pack.streams) || (Array.isArray(pack) ? pack : []);
    const subtitles = (pack && pack.subtitles) || [];
    if (!streams.length) {
      log('extractStreamUrl no streams');
      return { streams: [], subtitles: [] };
    }

    // Reliability gate: real media only. Image HLS is never a last-resort default.
    let ordered = orderHdFirst(
      preferReliableStreams(filterStreamsForLanguage(streams.slice(), wantedLanguage)),
    );
    let finalOrder = ordered.filter(function (s) {
      return isLikelyPlayableOnIos(s) && !isSegmentDeadStream(s) && !s.segmentMimeRisky;
    });
    if (!finalOrder.length) {
      log('extractStreamUrl only unplayable/dead/image candidates — refusing set');
      return { streams: [], subtitles: [] };
    }
    finalOrder = orderHdFirst(finalOrder);

    // Always return object-form streams so per-source headers stick.
    const entries = finalOrder.map((s, idx) => {
      const height = streamHeight(s);
      const container =
        s.container || containerFromText(s.fileName || s.label || s.url) || (s.kind === 'hls' ? 'hls' : '');
      const headers = Object.assign({ 'User-Agent': USER_AGENT }, s.headers || {});
      // Pixeldrain needs referer; signed R2 links should stay clean.
      if (/pixeldrain/i.test(s.url) && !headers.Referer) {
        headers.Referer = 'https://pixeldrain.com/';
      }
      if (/lookmovie|dancric|refligns|tracclime/i.test(s.url) && !headers.Referer) {
        headers.Referer = LOOKMOVIE + '/';
        headers.Origin = LOOKMOVIE;
      }
      if (
        /videasy|ironwallnet|solaratom|winterforest|checknews|diskphone|waltersamson|workers\.dev|vimeos\.zip|itsdeskmate|playhq\.net|ourmovie\.net|moon\./i.test(
          s.url,
        ) ||
        s.provider === 'videasy'
      ) {
        headers.Referer = VIDEASY_PLAYER + '/';
        headers.Origin = VIDEASY_PLAYER;
      }
      if (/cloudflarestorage|\.r2\./i.test(s.url) && s.provider !== 'videasy') {
        delete headers.Referer;
        delete headers.Origin;
      }
      const label = s.label || (idx === 0 ? 'Auto' : 'Source ' + (idx + 1));
      return {
        label: label,
        url: s.url,
        height: height || undefined,
        quality: height >= 360 ? height + 'p' : undefined,
        streamType: s.kind === 'hls' || container === 'hls' ? 'hls' : 'mp4',
        headers: headers,
        provider: s.provider || undefined,
        serverKey: s.serverKey || s.provider || 'source-' + (idx + 1),
        subtitles: Array.isArray(s.subtitles) ? s.subtitles.slice() : [],
        segmentProbeOk: !!s.segmentProbeOk,
        audioLanguageEvidence: s.audioLanguageEvidence || 'unknown',
        audioLanguageVerified: s.audioLanguageVerified === true,
        audioLanguages: Array.isArray(s.audioLanguages) ? s.audioLanguages.slice(0, 8) : [],
        preferred: idx === 0,
      };
    });

    const primary = finalOrder[0];
    const primaryHeight =
      Number(primary.height) ||
      qualityHeightFromText(primary.label) ||
      qualityHeightFromText(primary.url) ||
      0;
    const primaryPlayable = isLikelyPlayableOnIos(primary);
    // Only request fallback captions when the selected source has none.
    let mergedSubs = entries[0].subtitles.slice();
    if (!mergedSubs.length) {
      const external = await fetchSynthetiqSubs(
        parsed.id,
        parsed.type === 'tv' ? parsed.season || 1 : null,
        parsed.type === 'tv' ? parsed.episode || 1 : null,
      );
      mergedSubs = mergeVideasySubtitles(mergedSubs, external);
      entries.forEach(function (entry) {
        if (!entry.subtitles.length && entry.serverKey === entries[0].serverKey &&
            JSON.stringify(entry.headers) === JSON.stringify(entries[0].headers)) {
          entry.subtitles = mergedSubs.slice();
        }
      });
    }
    // Cap extreme subtitle lists (some TV eps return 70+ langs) for UI/perf.
    const cappedSubs = Array.isArray(mergedSubs) ? mergedSubs.slice(0, 40) : [];
    const servers = [];
    const serverKeys = Object.create(null);
    entries.forEach(function (entry) {
      const key = entry.serverKey + JSON.stringify(entry.headers) + JSON.stringify(entry.subtitles);
      if (serverKeys[key]) return;
      serverKeys[key] = true;
      const names = { 'videasy:cdn': 'Videasy CDN', 'videasy:m4uhd': 'Videasy M4UHD',
        lookmovie: 'LookMovie', vidzee: 'Vidzee', 'vidzee-v2': 'Vidzee V2', moviesapi: 'MoviesAPI' };
      servers.push(Object.assign({}, entry, {
        name: names[entry.serverKey] || entry.provider || entry.label,
        lang: wantedLanguage,
        qualities: entries.filter(e => e.serverKey === entry.serverKey && JSON.stringify(e.headers) === JSON.stringify(entry.headers)),
      }));
    });
    const out = {
      streams: entries,
      servers: servers,
      subtitles: cappedSubs,
      // Provider-specific headers live on each entry, never shared with rivals.
      headers: { 'User-Agent': USER_AGENT },
      streamType:
        primary.kind === 'hls' || primary.container === 'hls' ? 'hls' : 'mp4',
      quality: primaryHeight >= 360 ? primaryHeight + 'p' : 'auto',
      defaultQuality: primaryHeight >= 360 ? primaryHeight + 'p' : undefined,
      qualities: entries
        .filter((e) => e.url)
        .map((e) => ({
          label: e.label,
          height: e.height || 0,
          url: e.url,
          headers: e.headers,
          streamType: e.streamType,
        })),
      lang: wantedLanguage,
      source: 'xstream-v1',
    };

    log(
      'extractStreamUrl primaryPlayable=' +
        primaryPlayable +
        ' best=' +
        (out.quality || 'auto') +
        ' providers=' +
        finalOrder
          .map(function (s) {
            return s.provider;
          })
          .join(',') +
        ' subs=' +
        cappedSubs.length,
    );
    return out;
    } catch (e) {
      log('extractStreamUrl exception: ' + (e && e.message ? e.message : e));
      return { streams: [], subtitles: [] };
    }
  }

  /* -------------------- exports -------------------- */

  globalThis.searchResults = searchResults;
  globalThis.extractDetails = extractDetails;
  globalThis.extractEpisodes = extractEpisodes;
  globalThis.extractStreamUrl = extractStreamUrl;
  globalThis.discoveryHome = discoveryHome;
  globalThis.discoveryFeed = discoveryFeed;

  // Optional helpers for offline/node tests
  globalThis.__xstream = {
    parseHref,
    encodeHref,
    aesCbcDecryptHex,
    mapTmdbCard,
    parseHtmlCards,
    freshRequestUrl,
    audioLanguageClass,
    playlistAudioTracks,
    audioEvidenceFromTracks,
    playlistMediaUris,
    samplePlaylistMediaUris,
    playlistPointsAtImageSegments,
    classifyHlsSegmentResponse,
    sourceAudioEvidence,
    markAudioLanguageEvidence,
    annotateAudioLanguage,
    filterStreamsForLanguage,
    providerHealthSnapshot,
  };
})();
