/* @meta
{
  "name": "twitter/read-article",
  "description": "Private BB read adapter: Fetch a Twitter Article (long-form content) and export as Markdown",
  "domain": "x.com",
  "readOnly": true,
  "args": {
    "request": {
      "required": false,
      "description": "JSON object containing original OpenCLI argument names and values; avoids BB global flag collisions"
    }
  },
  "example": "bb-browser site twitter/read-article --json"
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
  var AuthRequiredError = class extends CliError {
    constructor(site, message) {
      super(message || site);
    }
  };
  var CommandExecutionError = class extends CliError {
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
  function sanitizeQueryId(resolved, fallbackId) {
    return typeof resolved === "string" && QUERY_ID_PATTERN.test(resolved) ? resolved : fallbackId;
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

  // src/upstream/article.js
  var TWEET_RESULT_BY_REST_ID_QUERY_ID = "7xflPyRiUxGVbJd4uWmbfg";
  function isPlainObject(value) {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
  }
  cli({
    site: "twitter",
    name: "article",
    access: "read",
    description: "Fetch a Twitter Article (long-form content) and export as Markdown",
    domain: "x.com",
    strategy: Strategy.COOKIE,
    browser: true,
    args: [{
      name: "tweet-id",
      type: "string",
      positional: true,
      required: true,
      help: "Tweet ID or URL containing the article"
    }],
    columns: ["title", "author", "content", "url"],
    func: async (page, kwargs) => {
      let tweetId = kwargs["tweet-id"];
      const isArticleUrl = /\/article\/\d+/.test(tweetId);
      const urlMatch = tweetId.match(/\/(?:status|article)\/(\d+)/);
      if (urlMatch) tweetId = urlMatch[1];
      if (isArticleUrl) {
        await page.goto(`https://x.com/i/article/${tweetId}`);
        await page.wait(3);
        const resolvedId = await page.evaluate(() => {
          const __bb_value = (function() {
            var links = document.querySelectorAll('a[href*="/status/"]');
            for (var i = 0; i < links.length; i++) {
              var m = links[i].href.match(/\/status\/(\d+)/);
              if (m) return m[1];
            }
            var og = document.querySelector('meta[property="og:url"]');
            if (og && og.content) {
              var m2 = og.content.match(/\/status\/(\d+)/);
              if (m2) return m2[1];
            }
            return null;
          })();
          return typeof __bb_value === "function" ? __bb_value() : __bb_value;
        });
        const resolvedTweetId = unwrapBrowserResult(resolvedId);
        if (!resolvedTweetId || typeof resolvedTweetId !== "string") {
          throw new CommandExecutionError(`Could not resolve article ${tweetId} to a tweet ID. The article page may not contain a linked tweet.`);
        }
        tweetId = resolvedTweetId;
      }
      await page.goto(`https://x.com/i/status/${tweetId}`);
      await page.wait(3);
      const cookies = await page.getCookies({
        url: "https://x.com"
      });
      const ct0 = cookies.find((c) => c.name === "ct0")?.value || null;
      if (!ct0) throw new AuthRequiredError("x.com", "Not logged into x.com (no ct0 cookie)");
      const queryId = await resolveTwitterQueryId(page, "TweetResultByRestId", TWEET_RESULT_BY_REST_ID_QUERY_ID);
      const rawResult = unwrapBrowserResult(await ((__bb_static_arg_0, __bb_static_arg_1, __bb_static_arg_2, __bb_static_arg_3) => page.evaluate(() => {
        const __bb_value = async () => {
          const tweetId2 = __bb_static_arg_0;
          const ct02 = __bb_static_arg_1;
          const bearer = __bb_static_arg_2;
          const headers = {
            "Authorization": "Bearer " + decodeURIComponent(bearer),
            "X-Csrf-Token": ct02,
            "X-Twitter-Auth-Type": "OAuth2Session",
            "X-Twitter-Active-User": "yes"
          };
          const variables = JSON.stringify({
            tweetId: tweetId2,
            withCommunity: false,
            includePromotedContent: false,
            withVoice: false
          });
          const features = JSON.stringify({
            longform_notetweets_consumption_enabled: true,
            responsive_web_twitter_article_tweet_consumption_enabled: true,
            longform_notetweets_rich_text_read_enabled: true,
            longform_notetweets_inline_media_enabled: true,
            articles_preview_enabled: true,
            responsive_web_graphql_exclude_directive_enabled: true,
            verified_phone_label_enabled: false
          });
          const fieldToggles = JSON.stringify({
            withArticleRichContentState: true,
            withArticlePlainText: true
          });
          const url = "/i/api/graphql/" + __bb_static_arg_3 + "/TweetResultByRestId?variables=" + encodeURIComponent(variables) + "&features=" + encodeURIComponent(features) + "&fieldToggles=" + encodeURIComponent(fieldToggles);
          let resp;
          try {
            resp = await fetch(url, {
              headers,
              credentials: "include"
            });
          } catch (error) {
            return {
              error: "Twitter article request failed: " + String(error && error.message || error)
            };
          }
          if (!resp.ok) return {
            httpStatus: resp.status
          };
          let d;
          try {
            d = await resp.json();
          } catch {
            return {
              error: "Twitter API response was not valid JSON",
              hint: "You may be logged out or the request was blocked"
            };
          }
          if (!d || typeof d !== "object" || Array.isArray(d)) {
            return {
              error: "Twitter API response payload was malformed"
            };
          }
          const result = d?.data?.tweetResult?.result;
          if (!result) {
            if (Array.isArray(d.errors) && d.errors.length > 0) {
              return {
                error: "Twitter TweetResultByRestId returned GraphQL errors: " + JSON.stringify(d.errors).slice(0, 200)
              };
            }
            return {
              error: "Article not found"
            };
          }
          if (!result || typeof result !== "object" || Array.isArray(result)) {
            return {
              error: "Twitter API response tweet result was malformed"
            };
          }
          const tw = result.tweet || result;
          if (!tw || typeof tw !== "object" || Array.isArray(tw)) {
            return {
              error: "Twitter API response tweet result was malformed"
            };
          }
          const legacy = tw.legacy || {};
          const user = tw.core?.user_results?.result;
          const returnedTweetId = tw.rest_id || legacy.id_str;
          if (typeof returnedTweetId !== "string" || returnedTweetId !== tweetId2) {
            return {
              error: "Twitter API response did not match requested tweet " + tweetId2
            };
          }
          const screenName = user?.legacy?.screen_name || user?.core?.screen_name || "";
          if (typeof screenName !== "string" || !/^[A-Za-z0-9_]{1,15}$/.test(screenName)) {
            return {
              error: "Twitter API response did not include a valid author screen name for tweet " + tweetId2
            };
          }
          const articleResults = tw.article?.article_results?.result;
          if (!articleResults) {
            const noteText = tw.note_tweet?.note_tweet_results?.result?.text;
            if (noteText) {
              return [{
                title: "(Note Tweet)",
                author: screenName,
                content: noteText,
                url: "https://x.com/" + screenName + "/status/" + tweetId2
              }];
            }
            return {
              error: "Tweet " + tweetId2 + " has no article content"
            };
          }
          if (!articleResults || typeof articleResults !== "object" || Array.isArray(articleResults)) {
            return {
              error: "Twitter API response article result was malformed"
            };
          }
          const title = articleResults.title || "(Untitled)";
          const contentState = articleResults.content_state || {};
          if (!contentState || typeof contentState !== "object" || Array.isArray(contentState)) {
            return {
              error: "Twitter API response article content was malformed"
            };
          }
          const blocks = contentState.blocks || [];
          if (!Array.isArray(blocks)) {
            return {
              error: "Twitter API response article blocks were malformed"
            };
          }
          const rawEntityMap = contentState.entityMap || {};
          const entityByKey = {};
          if (Array.isArray(rawEntityMap)) {
            for (const entry of rawEntityMap) {
              if (entry && entry.key != null && entry.value) {
                entityByKey[String(entry.key)] = entry.value;
              }
            }
          } else {
            for (const [key, entry] of Object.entries(rawEntityMap)) {
              entityByKey[String(key)] = entry?.value || entry;
            }
          }
          const mediaEntities = articleResults.media_entities || [];
          const mediaUrlById = {};
          for (const me of Object.values(mediaEntities)) {
            const url2 = me?.media_info?.original_img_url;
            if (typeof url2 === "string" && me?.media_id != null) {
              mediaUrlById[String(me.media_id)] = url2;
            }
          }
          const parts = [];
          let orderedCounter = 0;
          for (const block of blocks) {
            if (!block || typeof block !== "object" || Array.isArray(block)) continue;
            const blockType = block.type || "unstyled";
            if (blockType === "atomic") {
              const entityKey = block.entityRanges?.[0]?.key;
              const entity = entityKey == null ? null : entityByKey[String(entityKey)];
              if (entity?.type === "MEDIA") {
                const mediaId = entity.data?.mediaItems?.[0]?.mediaId;
                const imgUrl = mediaId == null ? null : mediaUrlById[String(mediaId)];
                const caption = String(entity.data?.caption || "Image").replaceAll("]", "&#93;");
                if (imgUrl) parts.push("![" + caption + "](" + imgUrl + ")");
              }
              continue;
            }
            const text = block.text || "";
            if (!text) continue;
            if (blockType !== "ordered-list-item") orderedCounter = 0;
            if (blockType === "header-one") parts.push("# " + text);
            else if (blockType === "header-two") parts.push("## " + text);
            else if (blockType === "header-three") parts.push("### " + text);
            else if (blockType === "blockquote") parts.push("> " + text);
            else if (blockType === "unordered-list-item") parts.push("- " + text);
            else if (blockType === "ordered-list-item") {
              orderedCounter++;
              parts.push(orderedCounter + ". " + text);
            } else if (blockType === "code-block") parts.push("```\n" + text + "\n```");
            else parts.push(text);
          }
          return [{
            title,
            author: screenName,
            content: parts.join("\n\n") || legacy.full_text || "",
            url: "https://x.com/" + screenName + "/status/" + tweetId2
          }];
        };
        return typeof __bb_value === "function" ? __bb_value() : __bb_value;
      }))(tweetId, ct0, TWITTER_BEARER_TOKEN, queryId));
      if (!Array.isArray(rawResult) && !isPlainObject(rawResult)) {
        throw new CommandExecutionError("Twitter article response payload is malformed");
      }
      if (rawResult?.httpStatus) {
        const message = describeTwitterApiError("TweetResultByRestId", rawResult.httpStatus);
        if (rawResult.httpStatus === 401 || rawResult.httpStatus === 403) {
          throw new AuthRequiredError("x.com", message);
        }
        throw new CommandExecutionError(message);
      }
      if (rawResult?.error) {
        throw new CommandExecutionError(rawResult.error + (rawResult.hint ? ` (${rawResult.hint})` : ""));
      }
      if (!Array.isArray(rawResult)) {
        throw new CommandExecutionError("Twitter article response payload is malformed");
      }
      return rawResult;
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

return XRead.runRead("article",args);
}
