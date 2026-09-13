/* @meta
{
  "name": "twitter/read-list-tweets",
  "description": "Private BB read adapter: Fetch tweets from a Twitter/X list timeline",
  "domain": "x.com",
  "readOnly": true,
  "args": {
    "request": {
      "required": false,
      "description": "JSON object containing original OpenCLI argument names and values; avoids BB global flag collisions"
    }
  },
  "example": "bb-browser site twitter/read-list-tweets --json"
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
  var AuthRequiredError = class extends CliError {
    constructor(site, message) {
      super(message || site);
    }
  };
  var CommandExecutionError = class extends CliError {
  };

  // src/shims/utils.js
  function throwIfLoginWall(value) {
    if (value?.__loginWall) throw new Error("LOGIN_WALL_OR_CHALLENGE");
    return value;
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

  // src/upstream/shared.js
  var SCREEN_NAME_PATTERN = /^[A-Za-z0-9_]{1,15}$/;
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

  // src/upstream/list-tweets.js
  var LIST_TWEETS_QUERY_ID = "RlZzktZY_9wJynoepm8ZsA";
  var OPERATION_NAME = "ListLatestTweetsTimeline";
  var MAX_PAGINATION_PAGES = 100;
  var FEATURES = {
    rweb_video_screen_enabled: false,
    profile_label_improvements_pcf_label_in_post_enabled: true,
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
    responsive_web_jetfuel_frame: false,
    responsive_web_grok_share_attachment_enabled: true,
    articles_preview_enabled: true,
    responsive_web_edit_tweet_api_enabled: true,
    graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
    view_counts_everywhere_api_enabled: true,
    longform_notetweets_consumption_enabled: true,
    responsive_web_twitter_article_tweet_consumption_enabled: true,
    tweet_awards_web_tipping_enabled: false,
    responsive_web_grok_show_grok_translated_post: false,
    responsive_web_grok_analysis_button_from_backend: false,
    creator_subscriptions_quote_tweet_preview_enabled: false,
    freedom_of_speech_not_reach_fetch_enabled: true,
    standardized_nudges_misinfo: true,
    tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
    longform_notetweets_rich_text_read_enabled: true,
    longform_notetweets_inline_media_enabled: true,
    responsive_web_grok_image_annotation_enabled: true,
    responsive_web_enhance_cards_enabled: false
  };
  function buildUrl(queryId, listId, count, cursor) {
    const vars = {
      listId: String(listId),
      count
    };
    if (cursor) vars.cursor = cursor;
    return `/i/api/graphql/${queryId}/${OPERATION_NAME}?variables=${encodeURIComponent(JSON.stringify(vars))}&features=${encodeURIComponent(JSON.stringify(FEATURES))}`;
  }
  function extractTimelineTweet(result, seen) {
    if (!result) return null;
    const tw = result.tweet || result;
    const legacy = tw.legacy || {};
    if (!tw.rest_id || seen.has(tw.rest_id)) return null;
    seen.add(tw.rest_id);
    const user = tw.core?.user_results?.result;
    const screenName = user?.legacy?.screen_name || user?.core?.screen_name || "unknown";
    const displayName = user?.legacy?.name || user?.core?.name || "";
    const bio = user?.legacy?.description || "";
    const noteText = tw.note_tweet?.note_tweet_results?.result?.text;
    return {
      id: tw.rest_id,
      author: screenName,
      name: displayName,
      bio,
      text: noteText || legacy.full_text || "",
      likes: legacy.favorite_count || 0,
      retweets: legacy.retweet_count || 0,
      replies: legacy.reply_count || 0,
      created_at: legacy.created_at || "",
      url: `https://x.com/${screenName}/status/${tw.rest_id}`,
      ...extractMedia(legacy),
      card: extractCard(tw),
      quoted_tweet: extractQuotedTweet(tw)
    };
  }
  function parseListTimeline(data, seen) {
    const tweets = [];
    let nextCursor = null;
    const instructions = data?.data?.list?.tweets_timeline?.timeline?.instructions || [];
    for (const inst of instructions) {
      for (const entry of inst.entries || []) {
        const content = entry.content;
        if (content?.entryType === "TimelineTimelineCursor" || content?.__typename === "TimelineTimelineCursor") {
          if (content.cursorType === "Bottom" || content.cursorType === "ShowMore") nextCursor = content.value;
          continue;
        }
        if (entry.entryId?.startsWith("cursor-bottom-") || entry.entryId?.startsWith("cursor-showMore-")) {
          nextCursor = content?.value || content?.itemContent?.value || nextCursor;
          continue;
        }
        const direct = extractTimelineTweet(content?.itemContent?.tweet_results?.result, seen);
        if (direct) {
          tweets.push(direct);
          continue;
        }
        for (const item of content?.items || []) {
          const nested = extractTimelineTweet(item.item?.itemContent?.tweet_results?.result, seen);
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
    name: "list-tweets",
    access: "read",
    description: "Fetch tweets from a Twitter/X list timeline",
    domain: "x.com",
    strategy: Strategy.COOKIE,
    browser: true,
    args: [{
      name: "listId",
      positional: true,
      type: "string",
      required: true,
      help: "Numeric ID of a Twitter/X list (e.g. from `opencli twitter lists`)"
    }, {
      name: "limit",
      type: "int",
      default: 50
    }, {
      name: "top-by-engagement",
      type: "int",
      default: 0,
      help: "When set to N>0, re-rank the list timeline by weighted engagement (likes\xD71 + retweets\xD73 + replies\xD72 + bookmarks\xD75 + log10(views+1)\xD70.5) and return the top N. Default 0 keeps the list's native (recency) ordering."
    }],
    columns: ["id", "author", "bio", "text", "likes", "retweets", "replies", "created_at", "url", "has_media", "media_urls", "media_posters", "card", "quoted_tweet"],
    func: async (page, kwargs) => {
      const listId = String(kwargs.listId || "").trim();
      if (!listId || !/^\d+$/.test(listId)) {
        throw new CommandExecutionError(`Invalid listId: ${JSON.stringify(kwargs.listId)}. Expected a numeric ID (see \`opencli twitter lists\`).`);
      }
      const limit = kwargs.limit || 50;
      const cookies = await page.getCookies({
        url: "https://x.com"
      });
      const ct0 = cookies.find((c) => c.name === "ct0")?.value || null;
      if (!ct0) throw new AuthRequiredError("x.com", "Not logged into x.com (no ct0 cookie)");
      const unwrap = (v) => v && typeof v === "object" && "session" in v && "data" in v ? v.data : v;
      const queryIdRaw = await page.evaluate(() => {
        const __bb_value = async () => {
          try {
            const ghResp = await fetch("https://raw.githubusercontent.com/fa0311/twitter-openapi/refs/heads/main/src/config/placeholder.json");
            if (ghResp.ok) {
              const data = await ghResp.json();
              const entry = data["ListLatestTweetsTimeline"];
              if (entry && entry.queryId) return entry.queryId;
            }
          } catch {
          }
          try {
            const scripts = performance.getEntriesByType("resource").filter((r) => r.name.includes("client-web") && r.name.endsWith(".js")).map((r) => r.name);
            for (const scriptUrl of scripts.slice(0, 15)) {
              try {
                const text = await (await fetch(scriptUrl)).text();
                const re = /queryId:"([A-Za-z0-9_-]+)"[^}]{0,200}operationName:"ListLatestTweetsTimeline"/;
                const m = text.match(re);
                if (m) return m[1];
              } catch {
              }
            }
          } catch {
          }
          return null;
        };
        return typeof __bb_value === "function" ? __bb_value() : __bb_value;
      });
      const queryId = unwrap(queryIdRaw) || LIST_TWEETS_QUERY_ID;
      const headers = JSON.stringify({
        "Authorization": `Bearer ${decodeURIComponent(TWITTER_BEARER_TOKEN)}`,
        "X-Csrf-Token": ct0,
        "X-Twitter-Auth-Type": "OAuth2Session",
        "X-Twitter-Active-User": "yes"
      });
      const allTweets = [];
      const seen = /* @__PURE__ */ new Set();
      let cursor = null;
      for (let i = 0; i < MAX_PAGINATION_PAGES && allTweets.length < limit; i++) {
        const fetchCount = Math.min(100, limit - allTweets.length + 10);
        const apiUrl = buildUrl(queryId, listId, fetchCount, cursor);
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
          if (allTweets.length === 0) throw new CommandExecutionError(describeTwitterApiError("ListLatestTweetsTimeline", data.error, "list may be private"));
          break;
        }
        const {
          tweets,
          nextCursor
        } = parseListTimeline(data, seen);
        allTweets.push(...tweets);
        if (!nextCursor || nextCursor === cursor || tweets.length === 0) break;
        cursor = nextCursor;
      }
      const trimmed = allTweets.slice(0, limit);
      return applyTopByEngagement(trimmed, kwargs["top-by-engagement"]);
    }
  });

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

return XRead.runRead("list-tweets",args);
}
