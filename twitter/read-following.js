/* @meta
{
  "name": "twitter/read-following",
  "description": "Private BB read adapter: Get accounts a Twitter/X user is following (defaults to the logged-in user when no user is given)",
  "domain": "x.com",
  "readOnly": true,
  "args": {
    "request": {
      "required": false,
      "description": "JSON object containing original OpenCLI argument names and values; avoids BB global flag collisions"
    }
  },
  "example": "bb-browser site twitter/read-following --json"
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

  // src/upstream/shared.js
  var QUERY_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
  var SCREEN_NAME_PATTERN = /^[A-Za-z0-9_]{1,15}$/;
  var SCREEN_NAME_HOSTS = /* @__PURE__ */ new Set(["x.com", "twitter.com", "mobile.twitter.com"]);
  var USER_BY_SCREEN_NAME_FEATURES = {
    hidden_profile_subscriptions_enabled: true,
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
  var RESERVED_SCREEN_NAME_PATHS = /* @__PURE__ */ new Set(["compose", "explore", "help", "home", "i", "intent", "jobs", "login", "logout", "messages", "notifications", "privacy", "search", "settings", "signup", "tos"]);
  function sanitizeQueryId(resolved, fallbackId) {
    return typeof resolved === "string" && QUERY_ID_PATTERN.test(resolved) ? resolved : fallbackId;
  }
  function buildUserByScreenNameQueryUrl(queryId, screenName) {
    const variables = JSON.stringify({
      screen_name: screenName,
      withSafetyModeUserFields: true
    });
    const features = JSON.stringify(USER_BY_SCREEN_NAME_FEATURES);
    return `/i/api/graphql/${queryId}/UserByScreenName?variables=${encodeURIComponent(variables)}&features=${encodeURIComponent(features)}`;
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
  function isEmptyObject(value) {
    return value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0;
  }
  function looksLikePrivateTwitterTimeline(data) {
    const result = data?.data?.user?.result;
    if (!result || typeof result !== "object") return false;
    return Boolean(isEmptyObject(result.timeline) || isEmptyObject(result.timeline_v2?.timeline));
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
  async function resolveTwitterQueryId(page, operationName, fallbackId) {
    const operation = await resolveTwitterOperationMetadata(page, operationName, fallbackId);
    return operation.queryId;
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

  // src/upstream/following.js
  var FOLLOWING_QUERY_ID = "F42cDX8PDFxkbjjq6JrM2w";
  var USER_BY_SCREEN_NAME_QUERY_ID = "IGgvgiOx4QZndDHuD3x9TQ";
  var MAX_PAGINATION_PAGES = 100;
  var FEATURES = {
    rweb_video_screen_enabled: false,
    profile_label_improvements_pcf_label_in_post_enabled: true,
    responsive_web_profile_redirect_enabled: false,
    rweb_tipjar_consumption_enabled: false,
    verified_phone_label_enabled: false,
    creator_subscriptions_tweet_preview_api_enabled: true,
    responsive_web_graphql_timeline_navigation_enabled: true,
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
    premium_content_api_read_enabled: false,
    communities_web_enable_tweet_community_results_fetch: true,
    c9s_tweet_anatomy_moderator_badge_enabled: true,
    responsive_web_grok_analyze_button_fetch_trends_enabled: false,
    responsive_web_grok_analyze_post_followups_enabled: true,
    responsive_web_jetfuel_frame: true,
    responsive_web_grok_share_attachment_enabled: true,
    responsive_web_grok_annotations_enabled: true,
    articles_preview_enabled: true,
    responsive_web_edit_tweet_api_enabled: true,
    graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
    view_counts_everywhere_api_enabled: true,
    longform_notetweets_consumption_enabled: true,
    responsive_web_twitter_article_tweet_consumption_enabled: true,
    tweet_awards_web_tipping_enabled: false,
    content_disclosure_indicator_enabled: true,
    content_disclosure_ai_generated_indicator_enabled: true,
    responsive_web_grok_show_grok_translated_post: false,
    responsive_web_grok_analysis_button_from_backend: true,
    post_ctas_fetch_enabled: false,
    freedom_of_speech_not_reach_fetch_enabled: true,
    standardized_nudges_misinfo: true,
    tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
    longform_notetweets_rich_text_read_enabled: true,
    longform_notetweets_inline_media_enabled: false,
    responsive_web_grok_image_annotation_enabled: true,
    responsive_web_grok_imagine_annotation_enabled: true,
    responsive_web_grok_community_note_auto_translation_is_enabled: false,
    responsive_web_enhance_cards_enabled: false
  };
  function buildFollowingUrl(queryId, userId, count, cursor) {
    const vars = {
      userId,
      count,
      includePromotedContent: false,
      withClientEventToken: false,
      withBirdwatchNotes: false,
      withVoice: true,
      withV2Timeline: true
    };
    if (cursor) vars.cursor = cursor;
    return `/i/api/graphql/${queryId}/Following?variables=${encodeURIComponent(JSON.stringify(vars))}&features=${encodeURIComponent(JSON.stringify(FEATURES))}`;
  }
  function extractUser(result) {
    if (!result || result.__typename !== "User") return null;
    const core = result.core || {};
    const legacy = result.legacy || {};
    const screenName = core.screen_name || legacy.screen_name || "";
    if (!screenName) {
      throw new CommandExecutionError("Malformed Twitter following user: missing screen_name");
    }
    return {
      screen_name: screenName,
      name: core.name || legacy.name || "",
      bio: legacy.description || result.profile_bio?.description || "",
      followers: result.relationship_counts?.followers ?? legacy.followers_count ?? legacy.normal_followers_count ?? 0
    };
  }
  function parseFollowing(data) {
    const users = [];
    let nextCursor = null;
    const instructions = data?.data?.user?.result?.timeline_v2?.timeline?.instructions || data?.data?.user?.result?.timeline?.timeline?.instructions || [];
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
        if (entry.entryId?.startsWith("user-")) {
          const user = extractUser(content?.itemContent?.user_results?.result);
          if (user) users.push(user);
        }
      }
    }
    return {
      users,
      nextCursor
    };
  }
  function normalizeScreenName(value) {
    return normalizeTwitterScreenName(value);
  }
  cli({
    site: "twitter",
    name: "following",
    access: "read",
    description: "Get accounts a Twitter/X user is following (defaults to the logged-in user when no user is given)",
    domain: "x.com",
    strategy: Strategy.COOKIE,
    browser: true,
    args: [{
      name: "user",
      positional: true,
      type: "string",
      required: false,
      help: "Twitter/X handle (with or without @). Omit to fetch the accounts the currently logged-in user follows."
    }, {
      name: "limit",
      type: "int",
      default: 50,
      help: "Maximum number of following rows to return (default 50). Must be a positive integer."
    }],
    columns: ["screen_name", "name", "bio", "followers"],
    func: async (page, kwargs) => {
      const limit = kwargs.limit === void 0 || kwargs.limit === null ? 50 : Number(kwargs.limit);
      if (!Number.isInteger(limit) || limit <= 0) {
        throw new ArgumentError("twitter following --limit must be a positive integer", "Example: opencli twitter following @elonmusk --limit 200");
      }
      const rawUser = String(kwargs.user ?? "").trim();
      let targetUser = normalizeScreenName(rawUser);
      if (rawUser && !targetUser) {
        throw new ArgumentError("twitter following user must be a valid Twitter/X handle", "Example: opencli twitter following @elonmusk --limit 200");
      }
      const cookies = await page.getCookies({
        url: "https://x.com"
      });
      const ct0 = cookies.find((c) => c.name === "ct0")?.value || null;
      if (!ct0) throw new AuthRequiredError("x.com", "Not logged into x.com (no ct0 cookie)");
      if (!targetUser) {
        await page.goto("https://x.com/home");
        await page.wait({
          selector: '[data-testid="primaryColumn"]'
        });
        const href = unwrapBrowserResult(await page.evaluate(() => {
          const __bb_value = () => {
            const link = document.querySelector('a[data-testid="AppTabBar_Profile_Link"]');
            return link ? link.getAttribute("href") : null;
          };
          return typeof __bb_value === "function" ? __bb_value() : __bb_value;
        }));
        if (!href || typeof href !== "string") throw new AuthRequiredError("x.com", "Could not detect logged-in user. Are you logged in?");
        targetUser = normalizeScreenName(href);
        if (!targetUser) throw new AuthRequiredError("x.com", "Could not detect logged-in user. Are you logged in?");
      }
      if (!targetUser) {
        throw new ArgumentError("twitter following user cannot be empty", "Example: opencli twitter following @elonmusk --limit 200");
      }
      const followingQueryId = await resolveTwitterQueryId(page, "Following", FOLLOWING_QUERY_ID);
      const userByScreenNameQueryId = await resolveTwitterQueryId(page, "UserByScreenName", USER_BY_SCREEN_NAME_QUERY_ID);
      const headers = {
        "Authorization": `Bearer ${decodeURIComponent(TWITTER_BEARER_TOKEN)}`,
        "X-Csrf-Token": ct0,
        "X-Twitter-Auth-Type": "OAuth2Session",
        "X-Twitter-Active-User": "yes"
      };
      const userLookup = unwrapBrowserResult(await page.evaluate(async (url, headers2) => {
        const resp = await fetch(url, {
          headers: headers2,
          credentials: "include"
        });
        if (!resp.ok) return {
          error: resp.status
        };
        const d = await resp.json();
        return {
          userId: d.data?.user?.result?.rest_id || null
        };
      }, buildUserByScreenNameQueryUrl(userByScreenNameQueryId, targetUser), headers));
      if (userLookup?.error === 401 || userLookup?.error === 403) {
        throw new AuthRequiredError("x.com", `Twitter user lookup failed (HTTP ${userLookup.error})`);
      }
      if (userLookup?.error) {
        throw new CommandExecutionError(`HTTP ${userLookup.error}: Failed to resolve Twitter user @${targetUser}`);
      }
      const userId = userLookup?.userId || null;
      if (!userId) throw new CommandExecutionError(`Could not find user @${targetUser}`);
      const allUsers = [];
      const seen = /* @__PURE__ */ new Set();
      let cursor = null;
      let lastRawResponse = null;
      for (let i = 0; i < MAX_PAGINATION_PAGES && allUsers.length < limit; i++) {
        const fetchCount = Math.min(50, limit - allUsers.length + 10);
        const apiUrl = buildFollowingUrl(followingQueryId, userId, fetchCount, cursor);
        const data = unwrapBrowserResult(await page.evaluate(async (url, headers2) => {
          const r = await fetch(url, {
            headers: headers2,
            credentials: "include"
          });
          return r.ok ? await r.json() : {
            error: r.status
          };
        }, apiUrl, headers));
        if (data?.error) {
          if (data.error === 401 || data.error === 403) throw new AuthRequiredError("x.com", `Twitter following request failed (HTTP ${data.error})`);
          throw new CommandExecutionError(describeTwitterApiError("Following", data.error));
        }
        lastRawResponse = data;
        const {
          users,
          nextCursor
        } = parseFollowing(data);
        for (const u of users) {
          if (!seen.has(u.screen_name)) {
            seen.add(u.screen_name);
            allUsers.push(u);
          }
        }
        if (!nextCursor || nextCursor === cursor) break;
        cursor = nextCursor;
      }
      if (allUsers.length === 0) {
        if (looksLikePrivateTwitterTimeline(lastRawResponse)) {
          throw new EmptyResultError("twitter following", `No following data returned for @${targetUser} (the target account may have set their following list to private)`);
        }
        throw new EmptyResultError("twitter following", `No following accounts found for @${targetUser}`);
      }
      return allUsers.slice(0, limit);
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

return XRead.runRead("following",args);
}
