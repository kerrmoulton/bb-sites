/* @meta
{
  "name": "twitter/read-device-follow",
  "description": "Private BB read adapter: Read the /i/timeline device-follow notification stream (tweets aggregated under a bell-icon \"new posts from @userA and N others\" notification)",
  "domain": "x.com",
  "readOnly": true,
  "args": {
    "request": {
      "required": false,
      "description": "JSON object containing original OpenCLI argument names and values; avoids BB global flag collisions"
    }
  },
  "example": "bb-browser site twitter/read-device-follow --json"
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

  // src/shims/registry.js
  var commands = {};
  function cli(def) {
    if (def.access !== "read") throw new Error("WRITE_ADAPTER_FORBIDDEN");
    commands[def.name] = def;
  }
  var Strategy = { COOKIE: "cookie", INTERCEPT: "intercept", PUBLIC: "public" };

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

  // src/upstream/device-follow.js
  var DEVICE_FOLLOW_PATH = "/i/api/2/notifications/device_follow.json";
  var MAX_LIMIT = 200;
  function parseLimit(value) {
    if (value === void 0 || value === null || value === "") return 20;
    const limit = Number(value);
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
      throw new ArgumentError(`--limit must be an integer between 1 and ${MAX_LIMIT}`);
    }
    return limit;
  }
  function buildDeviceFollowUrl(count) {
    const params = new URLSearchParams({
      include_profile_interstitial_type: "1",
      include_blocking: "1",
      include_blocked_by: "1",
      include_followed_by: "1",
      include_want_retweets: "1",
      include_mute_edge: "1",
      include_can_dm: "1",
      include_can_media_tag: "1",
      include_ext_has_nft_avatar: "1",
      include_ext_is_blue_verified: "1",
      include_ext_verified_type: "1",
      skip_status: "1",
      cards_platform: "Web-12",
      include_cards: "1",
      include_ext_alt_text: "true",
      include_quote_count: "true",
      include_reply_count: "1",
      tweet_mode: "extended",
      include_ext_views: "true",
      count: String(count)
    });
    return `${DEVICE_FOLLOW_PATH}?${params.toString()}`;
  }
  function extractEntries(timeline) {
    if (!timeline || !Array.isArray(timeline.instructions)) return null;
    const out = [];
    for (const inst of timeline.instructions) {
      const entries = inst?.addEntries?.entries;
      if (Array.isArray(entries)) out.push(...entries);
    }
    return out;
  }
  function joinEntryToTweet(entry, tweets, users) {
    const tweetId = entry?.content?.item?.content?.tweet?.id;
    if (!tweetId) return null;
    const tw = tweets?.[tweetId];
    if (!tw) return null;
    const user = users?.[tw.user_id_str] || null;
    if (typeof user?.screen_name !== "string" || !user.screen_name) return null;
    return {
      tweetId,
      tweet: tw,
      user
    };
  }
  function shapeRow({
    tweetId,
    tweet,
    user
  }) {
    const screenName = user.screen_name;
    return {
      id: tweetId,
      author: screenName,
      text: tweet?.full_text || tweet?.text || "",
      likes: tweet?.favorite_count ?? 0,
      retweets: tweet?.retweet_count ?? 0,
      replies: tweet?.reply_count ?? 0,
      // The legacy v1.1 endpoint does not return view counts even with
      // include_ext_views=true; surface null rather than a 0 sentinel
      // that would lie about real engagement (typed-errors §3).
      views: null,
      created_at: tweet?.created_at || "",
      url: `https://x.com/${screenName}/status/${tweetId}`
    };
  }
  function parseDeviceFollow(payload, seen) {
    if (!payload?.globalObjects || typeof payload.globalObjects !== "object") return null;
    const tweets = payload?.globalObjects?.tweets || {};
    const users = payload?.globalObjects?.users || {};
    if (typeof tweets !== "object" || typeof users !== "object") return null;
    const entries = extractEntries(payload?.timeline);
    if (!entries) return null;
    const rows = [];
    let unmatchedTweetEntries = 0;
    let malformedEntries = 0;
    for (const entry of entries) {
      const hasTweetEntry = Boolean(entry?.content?.item?.content?.tweet?.id);
      if (!hasTweetEntry) {
        malformedEntries++;
        continue;
      }
      const joined = joinEntryToTweet(entry, tweets, users);
      if (!joined) {
        unmatchedTweetEntries++;
        continue;
      }
      if (seen.has(joined.tweetId)) continue;
      seen.add(joined.tweetId);
      rows.push(shapeRow(joined));
    }
    return {
      rows,
      entryCount: entries.length,
      unmatchedTweetEntries,
      malformedEntries
    };
  }
  cli({
    site: "twitter",
    name: "device-follow",
    access: "read",
    description: 'Read the /i/timeline device-follow notification stream (tweets aggregated under a bell-icon "new posts from @userA and N others" notification)',
    domain: "x.com",
    strategy: Strategy.COOKIE,
    browser: true,
    args: [{
      name: "limit",
      type: "int",
      default: 20,
      help: `Maximum number of tweets to return (1-${MAX_LIMIT}, default 20)`
    }, {
      name: "top-by-engagement",
      type: "int",
      default: 0,
      help: "When set to N>0, re-rank by weighted engagement and return the top N. Default 0 keeps upstream ordering."
    }],
    columns: ["id", "author", "text", "likes", "retweets", "replies", "views", "created_at", "url"],
    func: async (page, kwargs) => {
      const limit = parseLimit(kwargs.limit);
      const cookies = await page.getCookies({
        url: "https://x.com"
      });
      const ct0 = cookies.find((c) => c.name === "ct0")?.value || null;
      if (!ct0) throw new AuthRequiredError("x.com", "Not logged into x.com (no ct0 cookie)");
      const apiUrl = buildDeviceFollowUrl(limit);
      const headers = JSON.stringify({
        Authorization: `Bearer ${decodeURIComponent(TWITTER_BEARER_TOKEN)}`,
        "X-Csrf-Token": ct0,
        "X-Twitter-Auth-Type": "OAuth2Session",
        "X-Twitter-Active-User": "yes"
      });
      const data = await ((__bb_static_arg_0, __bb_static_arg_1) => page.evaluate(() => {
        const __bb_value = async () => {
          try {
            const r = await fetch(__bb_static_arg_0, {
              method: "GET",
              headers: __bb_static_arg_1,
              credentials: "include"
            });
            if (!r.ok) return {
              error: r.status
            };
            try {
              return await r.json();
            } catch (e) {
              return {
                errorKind: "non_json",
                detail: String(e && e.message || e)
              };
            }
          } catch (e) {
            return {
              errorKind: "exception",
              detail: String(e && e.message || e)
            };
          }
        };
        return typeof __bb_value === "function" ? __bb_value() : __bb_value;
      }))(apiUrl, JSON.parse(headers));
      if (data?.errorKind === "non_json") {
        throw new CommandExecutionError(`Twitter device-follow returned non-JSON response: ${data.detail || "unknown parse error"}`);
      }
      if (data?.errorKind === "exception") {
        throw new CommandExecutionError(`Twitter device-follow fetch failed: ${data.detail || "unknown error"}`);
      }
      if (data?.error) {
        if (data.error === 401 || data.error === 403) {
          throw new AuthRequiredError("x.com", `Twitter device-follow returned HTTP ${data.error}`);
        }
        throw new CommandExecutionError(describeTwitterApiError("device_follow", data.error));
      }
      const parsed = parseDeviceFollow(data, /* @__PURE__ */ new Set());
      if (!parsed) {
        throw new CommandExecutionError("Twitter device-follow response was missing the expected timeline/globalObjects shape.");
      }
      if (parsed.malformedEntries > 0 || parsed.unmatchedTweetEntries > 0) {
        throw new CommandExecutionError("Twitter device-follow entries could not be joined to tweet/user objects.");
      }
      if (parsed.rows.length === 0) {
        throw new EmptyResultError("twitter device-follow", "No device-follow notification tweets found.");
      }
      const rows = parsed.rows;
      const trimmed = rows.slice(0, limit);
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

return XRead.runRead("device-follow",args);
}
