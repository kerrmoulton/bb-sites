/* @meta
{
  "name": "twitter/read-download",
  "description": "Discover X media URLs only; filesystem download is separate",
  "domain": "x.com",
  "readOnly": true,
  "args": {
    "request": {
      "required": false,
      "description": "JSON object containing original OpenCLI argument names and values; avoids BB global flag collisions"
    }
  },
  "example": "bb-browser site twitter/read-download --json"
}
*/
// Private browser port of OpenCLI X read adapter (Apache-2.0). See tools/x-read/OPENCLI-LICENSE.txt and tools/x-read/NOTICE.md.
async function(args){
if(args.request){try{args=JSON.parse(args.request);}catch(e){return {ok:false,failure:{code:"INVALID_REQUEST_JSON",message:e.message}};}}
var XRead = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // <stdin>
  var stdin_exports = {};
  __export(stdin_exports, {
    runRead: () => runRead
  });

  // src/shims/registry.js
  var commands = {};
  function cli(def) {
    if (def.access !== "read") throw new Error("WRITE_ADAPTER_FORBIDDEN");
    commands[def.name] = def;
  }
  var Strategy = { COOKIE: "cookie", INTERCEPT: "intercept", PUBLIC: "public" };

  // src/shims/errors.js
  var CliError = class extends Error {
    constructor(message, ...extra) {
      super(message);
      this.name = this.constructor.name;
      this.details = extra;
    }
  };
  var ArgumentError = class extends CliError {
  };
  var AuthRequiredError = class extends CliError {
    constructor(site, message) {
      super(message || site);
    }
  };
  var CommandExecutionError = class extends CliError {
  };
  var EmptyResultError = class extends CliError {
    constructor(subject, message) {
      super(message || subject);
      this.subject = subject;
    }
  };

  // src/shims/utils.js
  function throwIfLoginWall(value) {
    if (value?.__loginWall) throw new Error("LOGIN_WALL_OR_CHALLENGE");
    return value;
  }

  // src/upstream/shared.js
  var QUERY_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
  var SCREEN_NAME_PATTERN = /^[A-Za-z0-9_]{1,15}$/;
  var TWEET_PATH_PATTERN = /^\/(?:[^/]+|i)\/status\/(\d+)\/?$/;
  var TWEET_HOSTS = /* @__PURE__ */ new Set(["x.com", "twitter.com"]);
  var SCREEN_NAME_HOSTS = /* @__PURE__ */ new Set(["x.com", "twitter.com", "mobile.twitter.com"]);
  var RESERVED_SCREEN_NAME_PATHS = /* @__PURE__ */ new Set(["compose", "explore", "help", "home", "i", "intent", "jobs", "login", "logout", "messages", "notifications", "privacy", "search", "settings", "signup", "tos"]);
  function isTwitterHost(hostname) {
    return TWEET_HOSTS.has(hostname) || hostname.endsWith(".x.com") || hostname.endsWith(".twitter.com");
  }
  function parseTweetUrl(rawUrl) {
    const value = String(rawUrl ?? "").trim();
    if (!value) {
      throw new ArgumentError("twitter tweet URL cannot be empty", "Example: opencli twitter retweet https://x.com/jack/status/20");
    }
    let parsed;
    try {
      parsed = new URL(value);
    } catch {
      throw new ArgumentError(`Invalid tweet URL: ${value}`, "Use a full https://x.com/<user>/status/<id> URL");
    }
    const hostname = parsed.hostname.toLowerCase();
    if (parsed.protocol !== "https:" || !isTwitterHost(hostname)) {
      throw new ArgumentError(`Invalid tweet URL host: ${value}`, "Use a full https://x.com/<user>/status/<id> URL");
    }
    const match = parsed.pathname.match(TWEET_PATH_PATTERN);
    if (!match?.[1]) {
      throw new ArgumentError(`Could not extract tweet ID from URL: ${value}`, "Use a full https://x.com/<user>/status/<id> URL");
    }
    return {
      id: match[1],
      url: parsed.toString()
    };
  }
  function sanitizeQueryId(resolved, fallbackId) {
    return typeof resolved === "string" && QUERY_ID_PATTERN.test(resolved) ? resolved : fallbackId;
  }
  function normalizeTwitterScreenName(value) {
    const raw = String(value ?? "").trim();
    if (!raw) return "";
    let candidate = "";
    try {
      const url = raw.startsWith("/") ? new URL(raw, "https://x.com") : new URL(raw);
      if (url.protocol !== "https:" || url.username || url.password || url.port || !SCREEN_NAME_HOSTS.has(url.hostname)) {
        return "";
      }
      const segments = url.pathname.split("/").filter(Boolean);
      if (segments.length !== 1) return "";
      candidate = segments[0];
    } catch {
      if (raw.includes("/") || raw.includes("?") || raw.includes("#")) return "";
      candidate = raw.replace(/^@+/, "");
    }
    if (!SCREEN_NAME_PATTERN.test(candidate)) return "";
    if (RESERVED_SCREEN_NAME_PATHS.has(candidate.toLowerCase())) return "";
    return candidate;
  }
  function keysToFlags(keys) {
    if (!Array.isArray(keys)) return {};
    return Object.fromEntries(keys.filter((key) => typeof key === "string" && key).map((key) => [key, true]));
  }
  function normalizeTwitterOperationFlags(value) {
    if (Array.isArray(value)) return keysToFlags(value);
    if (!value || typeof value !== "object") return {};
    return Object.fromEntries(Object.entries(value).filter(([key, flag]) => typeof key === "string" && key && typeof flag === "boolean"));
  }
  function normalizeOperationFallback(fallback) {
    if (typeof fallback === "string") return {
      queryId: fallback,
      features: {},
      fieldToggles: {}
    };
    return {
      queryId: fallback?.queryId || null,
      features: normalizeTwitterOperationFlags(fallback?.features),
      fieldToggles: normalizeTwitterOperationFlags(fallback?.fieldToggles)
    };
  }
  function unwrapBrowserResult(value) {
    if (value && typeof value === "object" && typeof value.session === "string" && Object.prototype.hasOwnProperty.call(value, "data")) {
      return value.data;
    }
    return value;
  }
  function normalizeTwitterGraphqlPayload(value) {
    const unwrapped = unwrapBrowserResult(value);
    if (unwrapped?.data && typeof unwrapped.data === "object") return unwrapped;
    if (unwrapped && typeof unwrapped === "object" && (Object.prototype.hasOwnProperty.call(unwrapped, "user") || Object.prototype.hasOwnProperty.call(unwrapped, "search_by_raw_query"))) {
      return {
        data: unwrapped
      };
    }
    return unwrapped;
  }
  function sanitizeTwitterOperationMetadata(resolved, fallback) {
    const value = unwrapBrowserResult(resolved);
    const normalizedFallback = normalizeOperationFallback(fallback);
    return {
      queryId: sanitizeQueryId(value?.queryId, normalizedFallback.queryId),
      features: Object.keys(normalizeTwitterOperationFlags(value?.features)).length > 0 ? normalizeTwitterOperationFlags(value.features) : normalizedFallback.features,
      fieldToggles: Object.keys(normalizeTwitterOperationFlags(value?.fieldToggles)).length > 0 ? normalizeTwitterOperationFlags(value.fieldToggles) : normalizedFallback.fieldToggles
    };
  }
  function parseOperationFromBundleText(text, operationName) {
    if (!text || !operationName) return null;
    const esc = operationName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const reA = new RegExp(`queryId:"([A-Za-z0-9_-]+)"[^}]{0,400}operationName:"${esc}"`);
    const reB = new RegExp(`operationName:"${esc}"[^}]{0,400}queryId:"([A-Za-z0-9_-]+)"`);
    let queryId = null;
    let matchIndex = -1;
    const mA = text.match(reA);
    if (mA && typeof mA.index === "number") {
      queryId = mA[1];
      matchIndex = mA.index;
    } else {
      const mB = text.match(reB);
      if (mB && typeof mB.index === "number") {
        queryId = mB[1];
        matchIndex = mB.index;
      }
    }
    if (!queryId) return null;
    const winStart = Math.max(0, matchIndex - 500);
    const winEnd = Math.min(text.length, matchIndex + 1500);
    const win = text.slice(winStart, winEnd);
    const quotedKeys = (source) => source ? Array.from(source.matchAll(/"([^"]+)"/g)).map((m) => m[1]) : [];
    const flags = (keys) => Object.fromEntries((keys || []).filter((k) => typeof k === "string" && k).map((k) => [k, true]));
    return {
      queryId,
      features: flags(quotedKeys(win.match(/featureSwitches:\[([^\]]*)\]/)?.[1])),
      fieldToggles: flags(quotedKeys(win.match(/fieldToggles:\[([^\]]*)\]/)?.[1]))
    };
  }
  async function resolveTwitterOperationMetadata(page, operationName, fallback) {
    const parserSource = parseOperationFromBundleText.toString();
    const resolved = await ((__bb_static_arg_0, __bb_static_arg_1) => page.evaluate(() => {
      const __bb_value = async () => {
        const operationName2 = __bb_static_arg_0;
        const keysToFlags2 = (keys) => Object.fromEntries((keys || []).filter((k) => typeof k === "string" && k).map((key) => [key, true]));
        const normalizeFlags = (value) => {
          if (Array.isArray(value)) return keysToFlags2(value);
          if (!value || typeof value !== "object") return {};
          return Object.fromEntries(Object.entries(value).filter(([key, flag]) => typeof key === "string" && key && typeof flag === "boolean"));
        };
        const parseOperationFromBundleText2 = __bb_static_arg_1;
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5e3);
          try {
            const ghResp = await fetch("https://raw.githubusercontent.com/fa0311/twitter-openapi/refs/heads/main/src/config/placeholder.json", {
              signal: controller.signal
            });
            clearTimeout(timeout);
            if (ghResp.ok) {
              const data = await ghResp.json();
              const entry = data && data[operationName2];
              if (entry && entry.queryId) {
                return {
                  queryId: entry.queryId,
                  features: normalizeFlags(entry.features ?? entry.featureSwitches),
                  fieldToggles: normalizeFlags(entry.fieldToggles)
                };
              }
            }
          } catch {
            clearTimeout(timeout);
          }
        } catch {
        }
        try {
          const scripts = Array.from(document.scripts).map((s) => s.src).filter(Boolean).concat(performance.getEntriesByType("resource").map((r) => r.name).filter((r) => r.includes("client-web") && r.endsWith(".js")));
          const uniqueScripts = Array.from(new Set(scripts));
          const head = uniqueScripts.slice(0, 15);
          const tail = uniqueScripts.slice(-15);
          const candidates = Array.from(/* @__PURE__ */ new Set([...head, ...tail]));
          for (const scriptUrl of candidates) {
            try {
              const text = await (await fetch(scriptUrl)).text();
              const operation = parseOperationFromBundleText2(text, operationName2);
              if (operation) return operation;
            } catch {
            }
          }
        } catch {
        }
        return null;
      };
      return typeof __bb_value === "function" ? __bb_value() : __bb_value;
    }))(operationName, parseOperationFromBundleText);
    return sanitizeTwitterOperationMetadata(resolved, fallback);
  }
  function extractMedia(legacy) {
    const media = legacy?.extended_entities?.media || legacy?.entities?.media;
    if (!Array.isArray(media) || media.length === 0) {
      return {
        has_media: false,
        media_urls: [],
        media_posters: []
      };
    }
    const urls = [];
    const posters = [];
    for (const m of media) {
      if (!m) continue;
      if (m.type === "video" || m.type === "animated_gif") {
        const variants = m.video_info?.variants || [];
        const mp4 = variants.find((v) => v?.content_type === "video/mp4");
        const url = mp4?.url || m.media_url_https;
        if (url) {
          urls.push(url);
          posters.push(m.media_url_https || url);
        }
      } else {
        if (m.media_url_https) {
          urls.push(m.media_url_https);
          posters.push(m.media_url_https);
        }
      }
    }
    return {
      has_media: urls.length > 0,
      media_urls: urls,
      media_posters: posters
    };
  }
  function extractCard(tweet) {
    const cardLegacy = tweet?.card?.legacy;
    if (!cardLegacy) return null;
    const bindings = Array.isArray(cardLegacy.binding_values) ? cardLegacy.binding_values : [];
    const byKey = /* @__PURE__ */ new Map();
    for (const b of bindings) {
      if (b && typeof b.key === "string") byKey.set(b.key, b.value);
    }
    const str = (key) => {
      const v = byKey.get(key);
      return typeof v?.string_value === "string" && v.string_value.length > 0 ? v.string_value : void 0;
    };
    const img = (key) => {
      const v = byKey.get(key);
      const u = v?.image_value?.url;
      return typeof u === "string" && u.length > 0 ? u : void 0;
    };
    const title = str("title");
    const description = str("description");
    const domainBinding = str("domain");
    const cardUrlBinding = str("card_url");
    const image_url = img("thumbnail_image_large") || img("photo_image_full_size_large") || img("summary_photo_image_large");
    const urlEntities = Array.isArray(tweet?.legacy?.entities?.urls) ? tweet.legacy.entities.urls : [];
    const matchingEntity = cardUrlBinding ? urlEntities.find((entity) => entity?.url === cardUrlBinding || entity?.expanded_url === cardUrlBinding) : void 0;
    const matchedExpandedUrl = matchingEntity?.expanded_url;
    const url = typeof matchedExpandedUrl === "string" && matchedExpandedUrl.length > 0 ? matchedExpandedUrl : cardUrlBinding;
    let domain = domainBinding;
    if (!domain && url) {
      try {
        domain = new URL(url).hostname;
      } catch {
      }
    }
    if (!url && !title && !description) return null;
    const out = {
      name: cardLegacy.name
    };
    if (title) out.title = title;
    if (description) out.description = description;
    if (image_url) out.image_url = image_url;
    if (url) out.url = url;
    if (domain) out.domain = domain;
    return out;
  }
  function extractQuotedTweet(tweet) {
    const legacy = tweet?.legacy;
    if (!legacy?.is_quote_status) return null;
    const q = tweet?.quoted_status_result?.result ?? tweet?.legacy?.quoted_status_result?.result;
    if (!q) return null;
    const qTw = q.tweet || q;
    if (!qTw || typeof qTw !== "object") return null;
    const qLegacy = qTw.legacy && typeof qTw.legacy === "object" ? qTw.legacy : {};
    if (typeof qTw.rest_id !== "string" || !qTw.rest_id.trim()) return null;
    const qUser = qTw.core?.user_results?.result;
    const qLegacyScreenName = qUser?.legacy?.screen_name;
    const qCoreScreenName = qUser?.core?.screen_name;
    const qScreenName = typeof qLegacyScreenName === "string" && qLegacyScreenName.trim() ? qLegacyScreenName.trim() : typeof qCoreScreenName === "string" && qCoreScreenName.trim() ? qCoreScreenName.trim() : "";
    if (!SCREEN_NAME_PATTERN.test(qScreenName)) return null;
    const qLegacyDisplayName = qUser?.legacy?.name;
    const qCoreDisplayName = qUser?.core?.name;
    const qDisplayName = typeof qLegacyDisplayName === "string" ? qLegacyDisplayName : typeof qCoreDisplayName === "string" ? qCoreDisplayName : "";
    const qNoteText = qTw.note_tweet?.note_tweet_results?.result?.text;
    const qText = typeof qNoteText === "string" && qNoteText.length > 0 ? qNoteText : typeof qLegacy.full_text === "string" ? qLegacy.full_text : "";
    const qMedia = extractMedia(qLegacy);
    const qCard = extractCard(qTw);
    if (!qText && !qMedia.has_media && !qCard) return null;
    const out = {
      id: qTw.rest_id,
      author: qScreenName,
      name: qDisplayName,
      text: qText,
      created_at: typeof qLegacy.created_at === "string" ? qLegacy.created_at : "",
      url: `https://x.com/${qScreenName}/status/${qTw.rest_id}`,
      has_media: qMedia.has_media,
      media_urls: qMedia.media_urls,
      media_posters: qMedia.media_posters
    };
    if (qCard) out.card = qCard;
    return out;
  }
  function describeTwitterApiError(operation, status, extraHint) {
    const code = Number(status);
    const prefix = `HTTP ${status}: ${operation} fetch failed`;
    let suffix;
    if (code === 429) {
      suffix = "rate-limited by Twitter (session quota); retry after cooldown (typically 15-30 min)";
    } else if (code === 401) {
      suffix = "auth failed (cookie expired or invalidated); re-login required";
    } else if (code === 403) {
      suffix = "forbidden (cookie lacks scope, or resource is private)";
    } else if (code === 404) {
      suffix = "resource not found (deleted, suspended, or private)";
    } else if (code >= 500 && code < 600) {
      suffix = "Twitter server error; retry later";
    } else {
      suffix = "possibly queryId expired, schema change, or transient";
    }
    if (extraHint) suffix = `${suffix} (${extraHint})`;
    return `${prefix} \u2014 ${suffix}`;
  }

  // src/upstream/utils.js
  var TWITTER_BEARER_TOKEN = "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";
  var MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024;
  var ENGAGEMENT_WEIGHTS = Object.freeze({
    likes: 1,
    retweets: 3,
    replies: 2,
    bookmarks: 5,
    viewsLog: 0.5
  });
  function computeEngagementScore(row) {
    if (!row || typeof row !== "object") return 0;
    const num = (key) => {
      const raw = row[key];
      if (raw === void 0 || raw === null) return 0;
      const n = Number(raw);
      return Number.isFinite(n) ? Math.max(0, n) : 0;
    };
    const score = num("likes") * ENGAGEMENT_WEIGHTS.likes + num("retweets") * ENGAGEMENT_WEIGHTS.retweets + num("replies") * ENGAGEMENT_WEIGHTS.replies + num("bookmarks") * ENGAGEMENT_WEIGHTS.bookmarks + Math.log10(num("views") + 1) * ENGAGEMENT_WEIGHTS.viewsLog;
    return Math.round(score * 100) / 100;
  }
  function applyTopByEngagement(rows, topN) {
    if (!Array.isArray(rows) || rows.length === 0) return rows;
    const n = Number(topN);
    if (!Number.isFinite(n) || n <= 0) return rows;
    return rows.map((row, idx) => ({ row, idx, score: computeEngagementScore(row) })).sort((a, b) => b.score - a.score || a.idx - b.idx).slice(0, Math.floor(n)).map((entry) => entry.row);
  }

  // src/upstream/thread.js
  var TWEET_DETAIL_QUERY_ID = "nBS-WpgA6ZG0CyNHD517JQ";
  var FEATURES = {
    responsive_web_graphql_exclude_directive_enabled: true,
    verified_phone_label_enabled: false,
    creator_subscriptions_tweet_preview_api_enabled: true,
    responsive_web_graphql_timeline_navigation_enabled: true,
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
    longform_notetweets_consumption_enabled: true,
    longform_notetweets_rich_text_read_enabled: true,
    longform_notetweets_inline_media_enabled: true,
    freedom_of_speech_not_reach_fetch_enabled: true
  };
  var FIELD_TOGGLES = {
    withArticleRichContentState: true,
    withArticlePlainText: false
  };
  function buildTweetDetailUrl(tweetId, cursor) {
    const vars = {
      focalTweetId: tweetId,
      referrer: "tweet",
      with_rux_injections: false,
      includePromotedContent: false,
      rankingMode: "Recency",
      withCommunity: true,
      withQuickPromoteEligibilityTweetFields: true,
      withBirdwatchNotes: true,
      withVoice: true
    };
    if (cursor) vars.cursor = cursor;
    return `/i/api/graphql/${TWEET_DETAIL_QUERY_ID}/TweetDetail?variables=${encodeURIComponent(JSON.stringify(vars))}&features=${encodeURIComponent(JSON.stringify(FEATURES))}&fieldToggles=${encodeURIComponent(JSON.stringify(FIELD_TOGGLES))}`;
  }
  function extractTweet(r, seen) {
    if (!r) return null;
    const tw = r.tweet || r;
    const l = tw.legacy || {};
    if (!tw.rest_id || seen.has(tw.rest_id)) return null;
    seen.add(tw.rest_id);
    const u = tw.core?.user_results?.result;
    const noteText = tw.note_tweet?.note_tweet_results?.result?.text;
    const screenName = u?.legacy?.screen_name || u?.core?.screen_name || "unknown";
    const bio = u?.legacy?.description || "";
    return {
      id: tw.rest_id,
      author: screenName,
      bio,
      text: noteText || l.full_text || "",
      likes: l.favorite_count || 0,
      retweets: l.retweet_count || 0,
      in_reply_to: l.in_reply_to_status_id_str || void 0,
      created_at: l.created_at,
      url: `https://x.com/${screenName}/status/${tw.rest_id}`,
      ...extractMedia(l),
      card: extractCard(tw),
      quoted_tweet: extractQuotedTweet(tw)
    };
  }
  function parseTweetDetail(data, seen) {
    const tweets = [];
    let nextCursor = null;
    const instructions = data?.data?.threaded_conversation_with_injections_v2?.instructions || data?.data?.tweetResult?.result?.timeline?.instructions || [];
    for (const inst of instructions) {
      for (const entry of inst.entries || []) {
        const c = entry.content;
        if (c?.entryType === "TimelineTimelineCursor" || c?.__typename === "TimelineTimelineCursor") {
          if (c.cursorType === "Bottom" || c.cursorType === "ShowMore") nextCursor = c.value;
          continue;
        }
        if (entry.entryId?.startsWith("cursor-bottom-") || entry.entryId?.startsWith("cursor-showMore-")) {
          nextCursor = c?.itemContent?.value || c?.value || nextCursor;
          continue;
        }
        const tw = extractTweet(c?.itemContent?.tweet_results?.result, seen);
        if (tw) tweets.push(tw);
        for (const item of c?.items || []) {
          const nested = extractTweet(item.item?.itemContent?.tweet_results?.result, seen);
          if (nested) tweets.push(nested);
        }
      }
    }
    return {
      tweets,
      nextCursor
    };
  }
  cli({
    site: "twitter",
    name: "thread",
    access: "read",
    description: "Get a tweet thread (original + all replies)",
    domain: "x.com",
    strategy: Strategy.COOKIE,
    browser: true,
    args: [{
      name: "tweet-id",
      positional: true,
      type: "string",
      required: true,
      help: "Tweet numeric ID (e.g. 1234567890) or full status URL"
    }, {
      name: "limit",
      type: "int",
      default: 50
    }, {
      name: "top-by-engagement",
      type: "int",
      default: 0,
      help: "When set to N>0, re-rank the thread by weighted engagement (likes\xD71 + retweets\xD73 + replies\xD72 + bookmarks\xD75 + log10(views+1)\xD70.5) and return the top N. Default 0 keeps the conversation's structural ordering."
    }],
    columns: ["id", "author", "bio", "text", "likes", "retweets", "url", "has_media", "media_urls", "media_posters", "card", "quoted_tweet"],
    func: async (page, kwargs) => {
      let tweetId = kwargs["tweet-id"];
      const urlMatch = tweetId.match(/\/status\/(\d+)/);
      if (urlMatch) tweetId = urlMatch[1];
      const cookies = await page.getCookies({
        url: "https://x.com"
      });
      const ct0 = cookies.find((c) => c.name === "ct0")?.value || null;
      if (!ct0) throw new AuthRequiredError("x.com", "Not logged into x.com (no ct0 cookie)");
      const headers = JSON.stringify({
        "Authorization": `Bearer ${decodeURIComponent(TWITTER_BEARER_TOKEN)}`,
        "X-Csrf-Token": ct0,
        "X-Twitter-Auth-Type": "OAuth2Session",
        "X-Twitter-Active-User": "yes"
      });
      const allTweets = [];
      const seen = /* @__PURE__ */ new Set();
      let cursor = null;
      for (let i = 0; i < 5; i++) {
        const apiUrl = buildTweetDetailUrl(tweetId, cursor);
        const data = throwIfLoginWall(await ((__bb_static_arg_0, __bb_static_arg_1) => page.evaluate(() => {
          const __bb_value = async () => {
            async function fetchJsonOrLoginWall(input, init) {
              const r = await fetch(input, init);
              const contentType = r.headers.get("content-type") || "";
              const text = await r.text();
              const trimmed2 = text.replace(/^\s+/, "");
              const looksLikeHtml = contentType.toLowerCase().includes("text/html") || /^<(?:!doctype|html|head|body|title)(?:[\s>/]|$)/i.test(trimmed2);
              if (looksLikeHtml) {
                return {
                  __loginWall: true,
                  status: r.status,
                  url: r.url || (typeof input === "string" ? input : ""),
                  contentType,
                  bodyPreview: trimmed2.slice(0, 100)
                };
              }
              if (!r.ok) {
                return {
                  error: r.status
                };
              }
              try {
                return JSON.parse(text);
              } catch (err) {
                throw new Error("JSON parse failed (status=" + r.status + ", body[0..50]=" + JSON.stringify(trimmed2.slice(0, 50)) + "): " + (err && err.message ? err.message : String(err)));
              }
            }
            return await fetchJsonOrLoginWall(__bb_static_arg_0, {
              headers: __bb_static_arg_1,
              credentials: "include"
            });
          };
          return typeof __bb_value === "function" ? __bb_value() : __bb_value;
        }))(apiUrl, JSON.parse(headers)), {
          url: apiUrl
        });
        if (data?.error) {
          if (allTweets.length === 0) throw new CommandExecutionError(describeTwitterApiError("TweetDetail", data.error));
          break;
        }
        const {
          tweets,
          nextCursor
        } = parseTweetDetail(data, seen);
        allTweets.push(...tweets);
        if (!nextCursor || nextCursor === cursor) break;
        cursor = nextCursor;
      }
      const trimmed = allTweets.slice(0, kwargs.limit);
      return applyTopByEngagement(trimmed, kwargs["top-by-engagement"]);
    }
  });

  // src/shims/download.js
  var formatCookieHeader = () => "";
  async function downloadMedia(items) {
    return items.map((item, i) => ({ ...item, index: i + 1, status: "discovered", size: null }));
  }

  // src/upstream/download.js
  var USER_MEDIA_QUERY_ID = "9EovraBTXJYGSEQXZqlLmQ";
  var USER_BY_SCREEN_NAME_QUERY_ID = "IGgvgiOx4QZndDHuD3x9TQ";
  var MAX_PAGINATION_PAGES = 100;
  var USER_MEDIA_FEATURES = {
    rweb_video_screen_enabled: true,
    rweb_cashtags_enabled: true,
    profile_label_improvements_pcf_label_in_post_enabled: true,
    responsive_web_profile_redirect_enabled: true,
    rweb_tipjar_consumption_enabled: true,
    verified_phone_label_enabled: false,
    creator_subscriptions_tweet_preview_api_enabled: true,
    responsive_web_graphql_timeline_navigation_enabled: true,
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
    premium_content_api_read_enabled: false,
    communities_web_enable_tweet_community_results_fetch: true,
    c9s_tweet_anatomy_moderator_badge_enabled: true,
    responsive_web_grok_analyze_button_fetch_trends_enabled: false,
    responsive_web_grok_analyze_post_followups_enabled: true,
    rweb_cashtags_composer_attachment_enabled: true,
    responsive_web_jetfuel_frame: true,
    responsive_web_grok_share_attachment_enabled: true,
    responsive_web_grok_annotations_enabled: true,
    articles_preview_enabled: true,
    responsive_web_edit_tweet_api_enabled: true,
    rweb_conversational_replies_downvote_enabled: true,
    graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
    view_counts_everywhere_api_enabled: true,
    longform_notetweets_consumption_enabled: true,
    responsive_web_twitter_article_tweet_consumption_enabled: true,
    content_disclosure_indicator_enabled: true,
    content_disclosure_ai_generated_indicator_enabled: true,
    responsive_web_grok_show_grok_translated_post: false,
    responsive_web_grok_analysis_button_from_backend: true,
    post_ctas_fetch_enabled: false,
    freedom_of_speech_not_reach_fetch_enabled: true,
    standardized_nudges_misinfo: true,
    tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
    longform_notetweets_rich_text_read_enabled: true,
    longform_notetweets_inline_media_enabled: true,
    responsive_web_grok_image_annotation_enabled: true,
    responsive_web_grok_imagine_annotation_enabled: true,
    responsive_web_grok_community_note_auto_translation_is_enabled: false,
    responsive_web_enhance_cards_enabled: false
  };
  var USER_MEDIA_FIELD_TOGGLES = {
    withPayments: true,
    withAuxiliaryUserLabels: true,
    withArticleRichContentState: true,
    withArticlePlainText: true,
    withArticleSummaryText: true,
    withArticleVoiceOver: true,
    withGrokAnalyze: true,
    withDisallowedReplyControls: true
  };
  var USER_BY_SCREEN_NAME_FEATURES = {
    hidden_profile_subscriptions_enabled: true,
    profile_label_improvements_pcf_label_in_post_enabled: true,
    responsive_web_profile_redirect_enabled: true,
    rweb_tipjar_consumption_enabled: true,
    responsive_web_graphql_exclude_directive_enabled: true,
    verified_phone_label_enabled: false,
    subscriptions_verification_info_is_identity_verified_enabled: true,
    subscriptions_verification_info_verified_since_enabled: true,
    highlights_tweets_tab_ui_enabled: true,
    responsive_web_twitter_article_notes_tab_enabled: true,
    subscriptions_feature_can_gift_premium: true,
    creator_subscriptions_tweet_preview_api_enabled: true,
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
    responsive_web_graphql_timeline_navigation_enabled: true
  };
  var USER_BY_SCREEN_NAME_FIELD_TOGGLES = {
    withPayments: true,
    withAuxiliaryUserLabels: true
  };
  var USER_MEDIA_OPERATION = {
    queryId: USER_MEDIA_QUERY_ID,
    features: USER_MEDIA_FEATURES,
    fieldToggles: USER_MEDIA_FIELD_TOGGLES
  };
  var USER_BY_SCREEN_NAME_OPERATION = {
    queryId: USER_BY_SCREEN_NAME_QUERY_ID,
    features: USER_BY_SCREEN_NAME_FEATURES,
    fieldToggles: USER_BY_SCREEN_NAME_FIELD_TOGGLES
  };
  function requireLimit(value) {
    const limit = Number(value ?? 10);
    if (!Number.isInteger(limit) || limit < 1 || limit > 1e3) {
      throw new ArgumentError("--limit must be an integer between 1 and 1000");
    }
    return limit;
  }
  function nextUserMediaFetchCount(limit, downloadedCount) {
    const remaining = limit - downloadedCount;
    if (remaining <= 0) return 0;
    const requested = remaining + 10;
    if (requested > 100) return 100;
    return requested;
  }
  async function downloadTwitterMedia(items, options) {
    const rows = await downloadMedia(items, options);
    return rows.map((row, index) => {
      const item = items[index] || {};
      return {
        index: row.index,
        tweet_id: item.tweet_id || "",
        url: item.url || "",
        type: row.type,
        status: row.status,
        size: row.size
      };
    });
  }
  function normalizeUserMediaOperation(operation) {
    if (typeof operation === "string") {
      return {
        queryId: operation,
        features: USER_MEDIA_FEATURES,
        fieldToggles: USER_MEDIA_FIELD_TOGGLES
      };
    }
    return {
      queryId: operation?.queryId || USER_MEDIA_QUERY_ID,
      features: operation?.features || USER_MEDIA_FEATURES,
      fieldToggles: operation?.fieldToggles || USER_MEDIA_FIELD_TOGGLES
    };
  }
  function normalizeUserByScreenNameOperation(operation) {
    if (typeof operation === "string") {
      return {
        queryId: operation,
        features: USER_BY_SCREEN_NAME_FEATURES,
        fieldToggles: USER_BY_SCREEN_NAME_FIELD_TOGGLES
      };
    }
    return {
      queryId: operation?.queryId || USER_BY_SCREEN_NAME_QUERY_ID,
      features: operation?.features || USER_BY_SCREEN_NAME_FEATURES,
      fieldToggles: operation?.fieldToggles || USER_BY_SCREEN_NAME_FIELD_TOGGLES
    };
  }
  function appendGraphqlParams(path, variables, operation) {
    const fieldToggles = operation.fieldToggles || {};
    const params = [`variables=${encodeURIComponent(JSON.stringify(variables))}`, `features=${encodeURIComponent(JSON.stringify(operation.features || {}))}`];
    if (Object.keys(fieldToggles).length > 0) {
      params.push(`fieldToggles=${encodeURIComponent(JSON.stringify(fieldToggles))}`);
    }
    return `${path}?${params.join("&")}`;
  }
  function buildUserMediaUrl(operation, userId, count, cursor) {
    const normalized = normalizeUserMediaOperation(operation);
    const vars = {
      userId,
      count,
      includePromotedContent: false,
      withClientEventToken: false,
      withBirdwatchNotes: false,
      withVoice: true
    };
    if (cursor) vars.cursor = cursor;
    return appendGraphqlParams(`/i/api/graphql/${normalized.queryId}/UserMedia`, vars, normalized);
  }
  function buildUserByScreenNameUrl(operation, screenName) {
    const normalized = normalizeUserByScreenNameOperation(operation);
    const vars = {
      screen_name: screenName,
      withSafetyModeUserFields: true
    };
    return appendGraphqlParams(`/i/api/graphql/${normalized.queryId}/UserByScreenName`, vars, normalized);
  }
  function classifyMediaUrl(url) {
    if (!url) return "unknown";
    if (/video\.twimg\.com|\.mp4(\?|$)|\.m3u8(\?|$)/.test(url)) return "video";
    return "image";
  }
  function requireObjectPayload(value, context) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new CommandExecutionError(`Twitter ${context} returned malformed payload`);
    }
    return value;
  }
  function throwGraphqlFetchError(context, status, message) {
    if (status === 401 || status === 403) {
      throw new AuthRequiredError("x.com", `Twitter ${context} requires an authenticated x.com session`);
    }
    if (status === 404) {
      throw new EmptyResultError(`twitter download ${context}`, message || "Twitter returned not found");
    }
    const statusText = status ? `HTTP ${status}` : "fetch failed";
    throw new CommandExecutionError(`Twitter ${context} fetch failed: ${statusText}${message ? ` - ${message}` : ""}`);
  }
  function requireFetchPayload(value, context) {
    const result = requireObjectPayload(unwrapBrowserResult(value), context);
    if (result.ok === true) {
      return result.payload;
    }
    if (result.ok === false) {
      throwGraphqlFetchError(context, Number(result.status) || 0, typeof result.error === "string" ? result.error : "");
    }
    throw new CommandExecutionError(`Twitter ${context} returned malformed fetch result`);
  }
  function requireUserMediaPayload(data) {
    const payload = requireObjectPayload(data, "UserMedia");
    if (Array.isArray(payload.errors) && payload.errors.length > 0) {
      throw new CommandExecutionError(`Twitter UserMedia returned GraphQL errors: ${JSON.stringify(payload.errors).slice(0, 200)}`);
    }
    const result = payload.data?.user?.result;
    if (!result || typeof result !== "object") {
      throw new CommandExecutionError("Twitter UserMedia returned malformed user result");
    }
    const instructions = result.timeline_v2?.timeline?.instructions || result.timeline?.timeline?.instructions;
    if (!Array.isArray(instructions)) {
      throw new CommandExecutionError("Twitter UserMedia returned malformed timeline instructions");
    }
    return payload;
  }
  function parseUserMedia(data, seen) {
    const items = [];
    let nextCursor = null;
    const result = requireUserMediaPayload(data).data.user.result;
    const instructionSets = [result.timeline_v2?.timeline?.instructions, result.timeline?.timeline?.instructions].filter(Array.isArray);
    const instructions = instructionSets.flat();
    const visit = (value) => {
      if (!value || typeof value !== "object") return;
      if (value.type === "TimelinePinEntry") return;
      if (value.tweet_results?.result) {
        const raw = value.tweet_results.result;
        const tw = raw.__typename === "TweetWithVisibilityResults" && raw.tweet ? raw.tweet : raw.tweet || raw;
        const tweetId = typeof tw.rest_id === "string" || typeof tw.rest_id === "number" ? String(tw.rest_id) : "";
        if (!tweetId) {
          throw new CommandExecutionError("Twitter UserMedia returned a tweet without rest_id");
        }
        if (!seen.has(tweetId)) {
          seen.add(tweetId);
          const {
            media_urls
          } = extractMedia(tw.legacy || {});
          for (const url of media_urls) {
            items.push({
              tweet_id: tweetId,
              url,
              type: classifyMediaUrl(url)
            });
          }
        }
      }
      if ((value.entryType === "TimelineTimelineCursor" || value.__typename === "TimelineTimelineCursor") && (value.cursorType === "Bottom" || value.cursorType === "ShowMore") && value.value) {
        nextCursor = value.value;
      }
      if (Array.isArray(value)) {
        for (const item of value) visit(item);
        return;
      }
      for (const child of Object.values(value)) {
        if (child && typeof child === "object") visit(child);
      }
    };
    visit(instructions);
    return {
      items,
      nextCursor
    };
  }
  cli({
    site: "twitter",
    name: "download",
    access: "read",
    description: "Download Twitter/X media (images and videos). Provide either <username> to fetch every media item from their profile via the GraphQL UserMedia endpoint with cursor pagination, or --tweet-url to download a single tweet.",
    domain: "x.com",
    strategy: Strategy.COOKIE,
    browser: true,
    args: [{
      name: "username",
      positional: true,
      help: "Twitter username (with or without @) to scan their profile media. Either <username> or --tweet-url is required."
    }, {
      name: "tweet-url",
      help: "Single tweet URL to download. Use this OR <username>, not both required at once."
    }, {
      name: "limit",
      type: "int",
      default: 10,
      help: "Maximum number of media items to download when scanning a profile (default 10). Ignored when --tweet-url is used."
    }, {
      name: "output",
      default: "./twitter-downloads",
      help: "Output directory (default ./twitter-downloads). A per-source subdir is created inside."
    }],
    columns: ["index", "tweet_id", "url", "type", "status", "size"],
    func: async (page, kwargs) => {
      try {
        const rawUsername = String(kwargs.username ?? "").trim();
        const tweetUrl = String(kwargs["tweet-url"] ?? "").trim();
        const output = kwargs.output;
        if (!rawUsername && !tweetUrl) {
          throw new ArgumentError("twitter download requires either <username> or --tweet-url");
        }
        if (rawUsername && tweetUrl) {
          throw new ArgumentError("Use either <username> or --tweet-url, not both");
        }
        if (tweetUrl) {
          return downloadSingleTweet(page, tweetUrl, output);
        }
        const limit = requireLimit(kwargs.limit);
        const username = normalizeTwitterScreenName(rawUsername);
        if (!username) {
          throw new ArgumentError("twitter download username must be a valid Twitter/X handle", "Example: opencli twitter download @jack --limit 20");
        }
        return downloadUserMedia(page, username, limit, output);
      } catch (err) {
        if (err instanceof CliError) throw err;
        throw new CommandExecutionError(`twitter download failed: ${err?.message ?? String(err)}`);
      }
    }
  });
  async function downloadUserMedia(page, username, limit, output) {
    await page.goto(`https://x.com/${username}`);
    await page.wait({
      selector: '[data-testid="primaryColumn"]'
    });
    const cookies = await page.getCookies({
      url: "https://x.com"
    });
    const ct0 = cookies.find((c) => c.name === "ct0")?.value || null;
    if (!ct0) throw new AuthRequiredError("x.com", "Not logged into x.com (no ct0 cookie)");
    const userMediaOperation = await resolveTwitterOperationMetadata(page, "UserMedia", USER_MEDIA_OPERATION);
    const userByScreenNameOperation = await resolveTwitterOperationMetadata(page, "UserByScreenName", USER_BY_SCREEN_NAME_OPERATION);
    const headers = JSON.stringify({
      "Authorization": `Bearer ${decodeURIComponent(TWITTER_BEARER_TOKEN)}`,
      "X-Csrf-Token": ct0,
      "X-Twitter-Auth-Type": "OAuth2Session",
      "X-Twitter-Active-User": "yes"
    });
    const ubsUrl = buildUserByScreenNameUrl(userByScreenNameOperation, username);
    const userLookup = requireFetchPayload(await ((__bb_static_arg_0, __bb_static_arg_1) => page.evaluate(() => {
      const __bb_value = async () => {
        try {
          const resp = await fetch(__bb_static_arg_0, {
            headers: __bb_static_arg_1,
            credentials: "include"
          });
          if (!resp.ok) return {
            ok: false,
            status: resp.status
          };
          const payload = await resp.json();
          return {
            ok: true,
            payload
          };
        } catch (err) {
          return {
            ok: false,
            error: err?.message ?? String(err)
          };
        }
      };
      return typeof __bb_value === "function" ? __bb_value() : __bb_value;
    }))(ubsUrl, JSON.parse(headers)));
    const normalizedUserLookup = normalizeTwitterGraphqlPayload(userLookup);
    if (Array.isArray(normalizedUserLookup?.errors) && normalizedUserLookup.errors.length > 0) {
      throw new CommandExecutionError(`Twitter UserByScreenName returned GraphQL errors: ${JSON.stringify(normalizedUserLookup.errors).slice(0, 200)}`);
    }
    const userId = normalizedUserLookup?.data?.user?.result?.rest_id;
    if (!userId) throw new EmptyResultError(`twitter download @${username}`, `Could not resolve @${username}`);
    const seen = /* @__PURE__ */ new Set();
    const all = [];
    let cursor = null;
    let hasMorePages = false;
    for (let i = 0; i < MAX_PAGINATION_PAGES && all.length < limit; i++) {
      const fetchCount = nextUserMediaFetchCount(limit, all.length);
      if (fetchCount === 0) break;
      const url = buildUserMediaUrl(userMediaOperation, userId, fetchCount, cursor);
      const data = normalizeTwitterGraphqlPayload(requireFetchPayload(await ((__bb_static_arg_0, __bb_static_arg_1) => page.evaluate(() => {
        const __bb_value = async () => {
          try {
            const r = await fetch(__bb_static_arg_0, {
              headers: __bb_static_arg_1,
              credentials: "include"
            });
            if (!r.ok) return {
              ok: false,
              status: r.status
            };
            return {
              ok: true,
              payload: await r.json()
            };
          } catch (err) {
            return {
              ok: false,
              error: err?.message ?? String(err)
            };
          }
        };
        return typeof __bb_value === "function" ? __bb_value() : __bb_value;
      }))(url, JSON.parse(headers))));
      const {
        items,
        nextCursor
      } = parseUserMedia(data, seen);
      all.push(...items);
      hasMorePages = Boolean(nextCursor);
      if (!nextCursor) break;
      if (nextCursor === cursor) {
        throw new CommandExecutionError("Twitter UserMedia pagination returned the same cursor twice");
      }
      cursor = nextCursor;
    }
    if (all.length === 0) throw new EmptyResultError(`@${username} has no media`, "Account may be private, suspended, or have no media posts");
    if (all.length < limit && hasMorePages) {
      throw new CommandExecutionError(`Twitter UserMedia pagination reached the ${MAX_PAGINATION_PAGES}-page safety cap before collecting ${limit} media items`);
    }
    const trimmed = all.slice(0, limit);
    return downloadTwitterMedia(trimmed, {
      output,
      subdir: username,
      cookies: formatCookieHeader(cookies),
      browserCookies: cookies,
      filenamePrefix: username,
      ytdlpExtraArgs: ["--merge-output-format", "mp4"]
    });
  }
  async function downloadSingleTweet(page, tweetUrl, output) {
    const target = parseTweetUrl(tweetUrl);
    const rows = await commands.thread.func(page, { "tweet-id": target.id, limit: 1, "top-by-engagement": 0 });
    const tweet = rows.find((r) => String(r.id) === String(target.id));
    if (!tweet) throw new CommandExecutionError("TARGET_TWEET_NOT_FOUND_IN_DETAIL");
    const urls = [...new Set(tweet.media_urls || [])];
    if (!urls.length) throw new EmptyResultError("twitter download " + target.id, "No media found in the target tweet");
    return downloadTwitterMedia(urls.map((url) => ({ tweet_id: target.id, url, type: classifyMediaUrl(url) })), { output, subdir: "tweets" });
  }

  // src/runtime.js
  async function runRead(name, args) {
    const def = commands[name];
    if (!def) return { ok: false, failure: { code: "UNKNOWN_READ_COMMAND" } };
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const trace = [], captures = [];
    let filter = null, drain = 0;
    const originalFetch = window.fetch, originalOpen = XMLHttpRequest.prototype.open, originalSend = XMLHttpRequest.prototype.send;
    const quota = (resp) => Object.fromEntries(["x-rate-limit-reset", "x-rate-limit-remaining", "x-rate-limit-limit", "retry-after"].map((k) => [k, resp.headers.get(k)]).filter(([, v]) => v !== null));
    const safeOperation = (url) => {
      try {
        const p = new URL(url, location.href).pathname;
        return p.includes("/graphql/") ? p.split("/").at(-1) : p;
      } catch {
        return "invalid_url";
      }
    };
    const matches = (url) => filter && (url.includes(filter) || url.includes(filter.replace(/^\//, "").replace(/\?$/, "")));
    const wrappedFetch = async function(input, init) {
      const url = typeof input === "string" ? input : input.url;
      const resp = await originalFetch.call(window, input, init);
      if (String(url).includes("/i/api/")) trace.push({ operation: safeOperation(url), status: resp.status, rate: quota(resp) });
      if (matches(url)) try {
        const data = await resp.clone().json();
        captures.push({ url, data });
      } catch {
      }
      return resp;
    };
    const install = (pattern) => {
      filter = pattern;
      captures.length = 0;
      drain = 0;
      XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        this.__bbReadUrl = String(url);
        return originalOpen.call(this, method, url, ...rest);
      };
      XMLHttpRequest.prototype.send = function(...a) {
        this.addEventListener("load", () => {
          if (matches(this.__bbReadUrl)) try {
            captures.push({ url: this.__bbReadUrl, data: JSON.parse(this.responseText) });
          } catch {
          }
        });
        return originalSend.apply(this, a);
      };
    };
    const page = {
      async evaluate(code, ...values) {
        if (typeof code !== "function") throw new Error("STATIC_COMPILATION_REQUIRED");
        return await code(...values);
      },
      async getCookies() {
        const s = document.cookie.split(";").map((x) => x.trim()).find((x) => x.startsWith("ct0="));
        return s ? [{ name: "ct0", value: s.slice(4) }] : [];
      },
      async goto(url) {
        const u = new URL(url, location.href);
        if (u.origin !== location.origin) throw new Error("CROSS_ORIGIN_NAVIGATION_NOT_SUPPORTED");
        if (location.pathname + location.search !== u.pathname + u.search) {
          history.pushState({}, "", u.pathname + u.search);
          window.dispatchEvent(new PopStateEvent("popstate", { state: {} }));
          await sleep(1500);
        }
      },
      async wait(v) {
        if (typeof v === "number") return sleep(v * 1e3);
        if (v?.selector) {
          const end = Date.now() + 12e3;
          while (Date.now() < end) {
            if (document.querySelector(v.selector)) return;
            await sleep(100);
          }
          throw new Error("SELECTOR_TIMEOUT " + v.selector);
        }
      },
      async installInterceptor(pattern) {
        install(pattern);
      },
      async waitForCapture(seconds) {
        const end = Date.now() + seconds * 1e3;
        while (Date.now() < end) {
          if (captures.length > drain) return;
          await sleep(100);
        }
        throw new Error("CAPTURE_TIMEOUT " + filter);
      },
      async getInterceptedRequests() {
        const result = captures.slice(drain);
        drain = captures.length;
        return result;
      },
      async autoScroll({ times = 1, delayMs = 1e3 } = {}) {
        for (let i = 0; i < times; i++) {
          const el = document.scrollingElement || document.documentElement;
          el.scrollTop += window.innerHeight * 2;
          await sleep(delayMs);
        }
      }
    };
    window.fetch = wrappedFetch;
    try {
      const kwargs = {};
      for (const spec of def.args || []) {
        let v = args[spec.name] ?? spec.default;
        if (v !== void 0 && v !== null) {
          if (spec.type === "int") v = Number(v);
          else if (spec.type === "bool" || typeof spec.default === "boolean") v = v === true || v === "true";
          kwargs[spec.name] = v;
        } else if (spec.required) throw new Error("MISSING_ARGUMENT " + spec.name);
      }
      if (kwargs["output-file"] || kwargs["resume-file"]) throw new Error("LOCAL_ARCHIVE_FLAGS_REQUIRE_EXTERNAL_RUNNER");
      const data = await def.func(page, kwargs);
      const failed = trace.find((t) => t.status >= 400);
      if (failed) return { ok: false, failure: { code: "HTTP_" + failed.status, operation: failed.operation, rate: failed.rate }, partial_data: data, trace };
      return { ok: true, data, trace, implementation: "private_bb_browser_port", revision: "static-port05-json-args", operation: name };
    } catch (e) {
      return { ok: false, failure: { code: e.name || "ERROR", message: e.message || String(e) }, ...e.partial ? { partial_data: e.partial } : {}, trace };
    } finally {
      window.fetch = originalFetch;
      XMLHttpRequest.prototype.open = originalOpen;
      XMLHttpRequest.prototype.send = originalSend;
    }
  }
  return __toCommonJS(stdin_exports);
})();

return XRead.runRead("download",args);
}
