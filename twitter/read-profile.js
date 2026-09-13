/* @meta
{
  "name": "twitter/read-profile",
  "description": "Private BB read adapter: Fetch a Twitter user profile — bio, stats, etc. (defaults to the logged-in user when no username is given)",
  "domain": "x.com",
  "readOnly": true,
  "args": {
    "request": {
      "required": false,
      "description": "JSON object containing original OpenCLI argument names and values; avoids BB global flag collisions"
    }
  },
  "example": "bb-browser site twitter/read-profile --json"
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

  // src/upstream/shared.js
  var QUERY_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
  var SCREEN_NAME_PATTERN = /^[A-Za-z0-9_]{1,15}$/;
  var SCREEN_NAME_HOSTS = /* @__PURE__ */ new Set(["x.com", "twitter.com", "mobile.twitter.com"]);
  var RESERVED_SCREEN_NAME_PATHS = /* @__PURE__ */ new Set(["compose", "explore", "help", "home", "i", "intent", "jobs", "login", "logout", "messages", "notifications", "privacy", "search", "settings", "signup", "tos"]);
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

  // src/upstream/profile.js
  var USER_BY_SCREEN_NAME_QUERY_ID = "IGgvgiOx4QZndDHuD3x9TQ";
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
  var USER_BY_SCREEN_NAME_OPERATION = {
    queryId: USER_BY_SCREEN_NAME_QUERY_ID,
    features: USER_BY_SCREEN_NAME_FEATURES
  };
  function isPlainObject(value) {
    return value != null && typeof value === "object" && !Array.isArray(value);
  }
  function stringField(value) {
    return typeof value === "string" ? value : "";
  }
  function countField(...values) {
    for (const value of values) {
      if (typeof value === "number" && Number.isFinite(value)) return value;
    }
    return 0;
  }
  function mapTwitterProfileResult(result, screenName) {
    if (!isPlainObject(result)) {
      throw new CommandExecutionError(`Twitter profile response for @${screenName} is malformed`);
    }
    const hasLegacy = isPlainObject(result.legacy);
    const hasCore = isPlainObject(result.core);
    if (!hasLegacy && !hasCore) {
      throw new CommandExecutionError(`Twitter profile response for @${screenName} is missing profile fields`);
    }
    const legacy = hasLegacy ? result.legacy : {};
    const core = hasCore ? result.core : {};
    if (!stringField(core.screen_name) && !stringField(legacy.screen_name) && !stringField(core.name) && !stringField(legacy.name) && !stringField(core.created_at) && !stringField(legacy.created_at)) {
      throw new CommandExecutionError(`Twitter profile response for @${screenName} is missing profile identity fields`);
    }
    const location2 = isPlainObject(result.location) ? result.location : {};
    const expandedUrl = stringField(result.website?.url) || stringField(legacy.entities?.url?.urls?.[0]?.expanded_url);
    return [{
      screen_name: stringField(core.screen_name) || stringField(legacy.screen_name) || screenName,
      name: stringField(core.name) || stringField(legacy.name),
      bio: stringField(result.profile_bio?.description) || stringField(legacy.description),
      location: stringField(location2.location) || stringField(legacy.location),
      url: stringField(expandedUrl),
      followers: countField(result.relationship_counts?.followers, legacy.followers_count, legacy.normal_followers_count),
      following: countField(result.relationship_counts?.following, legacy.friends_count),
      tweets: countField(result.tweet_counts?.tweets, legacy.statuses_count),
      likes: countField(result.action_counts?.favorites_count, legacy.favourites_count),
      verified: Boolean(result.is_blue_verified || result.verification?.verified || legacy.verified),
      created_at: stringField(core.created_at) || stringField(legacy.created_at)
    }];
  }
  cli({
    site: "twitter",
    name: "profile",
    access: "read",
    description: "Fetch a Twitter user profile \u2014 bio, stats, etc. (defaults to the logged-in user when no username is given)",
    domain: "x.com",
    strategy: Strategy.COOKIE,
    browser: true,
    args: [{
      name: "username",
      type: "string",
      positional: true,
      help: "Twitter screen name (with or without @). Defaults to the logged-in user when omitted."
    }],
    columns: ["screen_name", "name", "bio", "location", "url", "followers", "following", "tweets", "likes", "verified", "created_at"],
    func: async (page, kwargs) => {
      const rawUsername = String(kwargs.username ?? "").trim();
      let username = normalizeTwitterScreenName(rawUsername);
      if (rawUsername && !username) {
        throw new ArgumentError("twitter profile username must be a valid Twitter/X handle", "Example: opencli twitter profile @jack");
      }
      if (!username) {
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
        username = normalizeTwitterScreenName(href);
        if (!username) throw new AuthRequiredError("x.com", "Could not detect logged-in user. Are you logged in?");
      }
      await page.goto(`https://x.com/${username}`);
      await page.wait(3);
      const cookies = await page.getCookies({
        url: "https://x.com"
      });
      const ct0 = cookies.find((c) => c.name === "ct0")?.value || null;
      if (!ct0) throw new AuthRequiredError("x.com", "Not logged into x.com (no ct0 cookie)");
      const resolvedOperation = await resolveTwitterOperationMetadata(page, "UserByScreenName", USER_BY_SCREEN_NAME_OPERATION);
      const operation = {
        queryId: resolvedOperation.queryId,
        features: resolvedOperation.features
      };
      const rawResult = unwrapBrowserResult(await ((__bb_static_arg_0, __bb_static_arg_1, __bb_static_arg_2, __bb_static_arg_3) => page.evaluate(() => {
        const __bb_value = async () => {
          const screenName = __bb_static_arg_0;
          const ct02 = __bb_static_arg_1;
          const operation2 = __bb_static_arg_2;
          const bearer = __bb_static_arg_3;
          const headers = {
            "Authorization": "Bearer " + decodeURIComponent(bearer),
            "X-Csrf-Token": ct02,
            "X-Twitter-Auth-Type": "OAuth2Session",
            "X-Twitter-Active-User": "yes"
          };
          const variables = JSON.stringify({
            screen_name: screenName,
            withSafetyModeUserFields: true
          });
          const features = JSON.stringify(operation2.features || {});
          const url = "/i/api/graphql/" + operation2.queryId + "/UserByScreenName?variables=" + encodeURIComponent(variables) + "&features=" + encodeURIComponent(features);
          let resp;
          try {
            resp = await fetch(url, {
              headers,
              credentials: "include"
            });
          } catch (error) {
            return {
              ok: false,
              error: "Twitter profile request failed: " + String(error && error.message || error)
            };
          }
          if (!resp.ok) {
            return {
              ok: false,
              auth: resp.status === 401 || resp.status === 403,
              httpStatus: resp.status,
              error: "HTTP " + resp.status,
              hint: "User may not exist, auth may be required, or queryId expired"
            };
          }
          let d;
          try {
            d = await resp.json();
          } catch (error) {
            return {
              ok: false,
              error: "Twitter profile response was not JSON: " + String(error && error.message || error)
            };
          }
          const result = d.data?.user?.result;
          if (!result) return {
            ok: false,
            notFound: true,
            error: "User @" + screenName + " not found"
          };
          return {
            ok: true,
            result
          };
        };
        return typeof __bb_value === "function" ? __bb_value() : __bb_value;
      }))(username, ct0, operation, TWITTER_BEARER_TOKEN));
      if (!isPlainObject(rawResult)) {
        throw new CommandExecutionError("Twitter profile response payload is malformed");
      }
      if (!rawResult.ok) {
        const message = typeof rawResult.httpStatus === "number" ? describeTwitterApiError("UserByScreenName", rawResult.httpStatus, rawResult.hint) : rawResult.error + (rawResult.hint ? ` (${rawResult.hint})` : "");
        if (rawResult.auth) {
          throw new AuthRequiredError("x.com", message);
        }
        if (rawResult.notFound) {
          throw new EmptyResultError("twitter profile", message);
        }
        throw new CommandExecutionError(message);
      }
      return mapTwitterProfileResult(rawResult.result, username);
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

return XRead.runRead("profile",args);
}
