/* @meta
{
  "name": "twitter/read-lists",
  "description": "Private BB read adapter: Get Twitter/X lists for the logged-in user (owned + subscribed)",
  "domain": "x.com",
  "readOnly": true,
  "args": {
    "request": {
      "required": false,
      "description": "JSON object containing original OpenCLI argument names and values; avoids BB global flag collisions"
    }
  },
  "example": "bb-browser site twitter/read-lists --json"
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
  var EmptyResultError = class extends CliError {
    constructor(subject, message) {
      super(message || subject);
      this.subject = subject;
    }
  };

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

  // src/upstream/lists.js
  var LISTS_QUERY_ID = "78UbkyXwXBD98IgUWXOy9g";
  var OPERATION_NAME = "ListsManagementPageTimeline";
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
  function buildUrl(queryId) {
    return `/i/api/graphql/${queryId}/${OPERATION_NAME}?features=${encodeURIComponent(JSON.stringify(FEATURES))}`;
  }
  function extractListEntry(entry, seen) {
    const list = entry?.content?.itemContent?.list || entry?.content?.list || entry?.item?.itemContent?.list;
    if (!list) return null;
    const id = list.id_str || list.id || "";
    if (!id || seen.has(id)) return null;
    seen.add(id);
    const mode = typeof list.mode === "string" && /private/i.test(list.mode) ? "private" : "public";
    return {
      id: String(id),
      name: list.name || "",
      members: String(list.member_count ?? 0),
      followers: String(list.subscriber_count ?? 0),
      mode
    };
  }
  var OWNED_SUBSCRIBED_ENTRY_PREFIX = "owned-subscribed-list-module-";
  function isOwnedSubscribedEntry(entry) {
    return typeof entry?.entryId === "string" && entry.entryId.startsWith(OWNED_SUBSCRIBED_ENTRY_PREFIX);
  }
  function getListsManagementInstructions(data) {
    const instructions = data?.data?.viewer?.list_management_timeline?.timeline?.instructions || data?.data?.viewer_v2?.user_results?.result?.list_management_timeline?.timeline?.instructions || data?.data?.list_management_timeline?.timeline?.instructions || data?.data?.data?.viewer?.list_management_timeline?.timeline?.instructions || data?.data?.data?.viewer_v2?.user_results?.result?.list_management_timeline?.timeline?.instructions || data?.data?.data?.list_management_timeline?.timeline?.instructions;
    return Array.isArray(instructions) ? instructions : null;
  }
  function parseListsManagement(data, seen) {
    const lists = [];
    const instructions = getListsManagementInstructions(data) || [];
    for (const inst of instructions) {
      for (const entry of inst.entries || []) {
        if (!isOwnedSubscribedEntry(entry)) continue;
        const direct = extractListEntry(entry, seen);
        if (direct) {
          lists.push(direct);
          continue;
        }
        for (const item of entry?.content?.items || []) {
          const nested = extractListEntry(item, seen);
          if (nested) lists.push(nested);
        }
      }
    }
    return lists;
  }
  var command = cli({
    site: "twitter",
    name: "lists",
    access: "read",
    description: "Get Twitter/X lists for the logged-in user (owned + subscribed)",
    domain: "x.com",
    strategy: Strategy.COOKIE,
    browser: true,
    args: [{
      name: "limit",
      type: "int",
      default: 50,
      help: "Maximum number of lists to return (default 50)."
    }],
    columns: ["id", "name", "members", "followers", "mode"],
    func: async (page, kwargs) => {
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
              const data2 = await ghResp.json();
              const entry = data2["ListsManagementPageTimeline"];
              if (entry && entry.queryId) return entry.queryId;
            }
          } catch {
          }
          try {
            const scripts = performance.getEntriesByType("resource").filter((r) => r.name.includes("client-web") && r.name.endsWith(".js")).map((r) => r.name);
            for (const scriptUrl of scripts.slice(0, 15)) {
              try {
                const text = await (await fetch(scriptUrl)).text();
                const re = /queryId:"([A-Za-z0-9_-]+)"[^}]{0,200}operationName:"ListsManagementPageTimeline"/;
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
      const queryId = unwrap(queryIdRaw) || LISTS_QUERY_ID;
      const headers = JSON.stringify({
        "Authorization": `Bearer ${decodeURIComponent(TWITTER_BEARER_TOKEN)}`,
        "X-Csrf-Token": ct0,
        "X-Twitter-Auth-Type": "OAuth2Session",
        "X-Twitter-Active-User": "yes"
      });
      const apiUrl = buildUrl(queryId);
      const data = await ((__bb_static_arg_0, __bb_static_arg_1) => page.evaluate(() => {
        const __bb_value = async () => {
          const r = await fetch(__bb_static_arg_0, {
            headers: __bb_static_arg_1,
            credentials: "include"
          });
          return r.ok ? await r.json() : {
            error: r.status
          };
        };
        return typeof __bb_value === "function" ? __bb_value() : __bb_value;
      }))(apiUrl, JSON.parse(headers));
      if (data?.error) {
        throw new CommandExecutionError(describeTwitterApiError("ListsManagementPageTimeline", data.error));
      }
      const seen = /* @__PURE__ */ new Set();
      if (!getListsManagementInstructions(data)) {
        throw new CommandExecutionError("Twitter lists returned an unexpected payload shape");
      }
      const lists = parseListsManagement(data, seen);
      if (lists.length === 0) {
        throw new EmptyResultError("twitter lists", "No owned or subscribed lists found");
      }
      return lists.slice(0, limit);
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

return XRead.runRead("lists",args);
}
