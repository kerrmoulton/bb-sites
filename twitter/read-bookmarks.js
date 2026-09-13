/* @meta
{
  "name": "twitter/read-bookmarks",
  "description": "Private BB read adapter: Fetch your Twitter/X bookmarks (the logged-in user's saved tweets, newest first)",
  "domain": "x.com",
  "readOnly": true,
  "args": {
    "request": {
      "required": false,
      "description": "JSON object containing original OpenCLI argument names and values; avoids BB global flag collisions"
    }
  },
  "example": "bb-browser site twitter/read-bookmarks --json"
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

  // src/shims/fs.js
  var nope = () => {
    throw new Error("LOCAL_FILE_IO_REQUIRES_EXTERNAL_RUNNER");
  };
  var existsSync = () => false;
  var statSync = nope;
  var readFileSync = nope;
  var writeFileSync = nope;
  var appendFileSync = nope;
  var mkdirSync = nope;
  var renameSync = nope;
  var rmSync = nope;
  var mkdtempSync = nope;
  var unlinkSync = nope;
  var fs_default = { existsSync, statSync, readFileSync, writeFileSync, appendFileSync, mkdirSync, renameSync, rmSync, mkdtempSync, unlinkSync };

  // src/shims/path.js
  var resolve = (...parts) => parts.join("/");
  var join = resolve;
  var extname = (s) => s.match(/\.[^/.]+$/)?.[0] || "";
  var dirname = (s) => s.split("/").slice(0, -1).join("/");
  var basename = (s) => s.split("/").at(-1);
  var path_default = { resolve, join, extname, dirname, basename };

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

  // src/upstream/archive.js
  var DEFAULT_MAX_PAGINATION_PAGES = 100;
  var HARD_MAX_PAGINATION_PAGES = 1e5;
  function resolveOptionalFilePath(raw, label) {
    if (raw === void 0 || raw === null || raw === "")
      return "";
    const value = String(raw).trim();
    if (!value)
      throw new ArgumentError(`${label} cannot be empty`);
    return path_default.resolve(value);
  }
  function ensureParentDir(filePath) {
    if (!filePath)
      return;
    fs_default.mkdirSync(path_default.dirname(filePath), { recursive: true });
  }
  function removeFile(filePath) {
    if (!filePath)
      return;
    try {
      fs_default.rmSync(filePath, { force: true });
    } catch {
    }
  }
  function loadJsonlArchiveState(filePath) {
    const seen = /* @__PURE__ */ new Set();
    let count = 0;
    if (!filePath || !fs_default.existsSync(filePath))
      return { seen, count };
    const text = fs_default.readFileSync(filePath, "utf8");
    for (const [index, line] of text.split("\n").entries()) {
      const trimmed = line.trim();
      if (!trimmed)
        continue;
      try {
        const row = JSON.parse(trimmed);
        if (!row?.id)
          throw new Error("missing id");
        const id = String(row.id);
        if (seen.has(id))
          throw new Error(`duplicate id ${id}`);
        seen.add(id);
        count += 1;
      } catch (error) {
        throw new CommandExecutionError(`Invalid JSONL record in ${filePath} at line ${index + 1}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return { seen, count };
  }
  function appendJsonlRows(filePath, rows) {
    if (!filePath || !Array.isArray(rows) || rows.length === 0)
      return;
    ensureParentDir(filePath);
    const text = rows.map((row) => JSON.stringify(row).replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029")).join("\n") + "\n";
    fs_default.appendFileSync(filePath, text, "utf8");
  }
  function removeResumeFile(filePath) {
    removeFile(filePath);
  }
  function resolveMaxPages(kwargs, fetchAll) {
    const raw = kwargs["max-pages"];
    if (raw === void 0 || raw === null || raw === "") {
      return fetchAll ? HARD_MAX_PAGINATION_PAGES : DEFAULT_MAX_PAGINATION_PAGES;
    }
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 1 || value > HARD_MAX_PAGINATION_PAGES) {
      throw new ArgumentError(`--max-pages must be an integer between 1 and ${HARD_MAX_PAGINATION_PAGES}`);
    }
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

  // src/upstream/bookmarks.js
  var BOOKMARKS_QUERY_ID = "Fy0QMy4q_aZCpkO0PnyLYw";
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
    articles_preview_enabled: true,
    responsive_web_edit_tweet_api_enabled: true,
    graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
    view_counts_everywhere_api_enabled: true,
    longform_notetweets_consumption_enabled: true,
    responsive_web_twitter_article_tweet_consumption_enabled: true,
    tweet_awards_web_tipping_enabled: false,
    content_disclosure_indicator_enabled: true,
    content_disclosure_ai_generated_indicator_enabled: true,
    freedom_of_speech_not_reach_fetch_enabled: true,
    standardized_nudges_misinfo: true,
    tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
    longform_notetweets_rich_text_read_enabled: true,
    longform_notetweets_inline_media_enabled: false,
    responsive_web_enhance_cards_enabled: false
  };
  function buildBookmarksUrl(count, cursor) {
    const vars = {
      count,
      includePromotedContent: false
    };
    if (cursor) vars.cursor = cursor;
    return `/i/api/graphql/${BOOKMARKS_QUERY_ID}/Bookmarks?variables=${encodeURIComponent(JSON.stringify(vars))}&features=${encodeURIComponent(JSON.stringify(FEATURES))}`;
  }
  function extractBookmarkTweet(result, seen) {
    if (!result) return null;
    const tw = result.tweet || result;
    const legacy = tw.legacy || {};
    if (!tw.rest_id || seen.has(tw.rest_id)) return null;
    seen.add(tw.rest_id);
    const user = tw.core?.user_results?.result;
    const screenName = user?.legacy?.screen_name || user?.core?.screen_name || "unknown";
    const displayName = user?.legacy?.name || user?.core?.name || "";
    const noteText = tw.note_tweet?.note_tweet_results?.result?.text;
    return {
      id: tw.rest_id,
      author: screenName,
      name: displayName,
      text: noteText || legacy.full_text || "",
      likes: legacy.favorite_count || 0,
      retweets: legacy.retweet_count || 0,
      bookmarks: legacy.bookmark_count || 0,
      created_at: legacy.created_at || "",
      url: `https://x.com/${screenName}/status/${tw.rest_id}`,
      ...extractMedia(legacy)
    };
  }
  function parseBookmarks(data, seen) {
    const tweets = [];
    let nextCursor = null;
    const instructions = data?.data?.bookmark_timeline_v2?.timeline?.instructions || data?.data?.bookmark_timeline?.timeline?.instructions || [];
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
        const direct = extractBookmarkTweet(content?.itemContent?.tweet_results?.result, seen);
        if (direct) {
          tweets.push(direct);
          continue;
        }
        for (const item of content?.items || []) {
          const nested = extractBookmarkTweet(item.item?.itemContent?.tweet_results?.result, seen);
          if (nested) tweets.push(nested);
        }
      }
    }
    return {
      tweets,
      nextCursor
    };
  }
  function readResumeFile(filePath, expected = null) {
    if (!filePath || !fs_default.existsSync(filePath)) return null;
    let parsed;
    try {
      parsed = JSON.parse(fs_default.readFileSync(filePath, "utf8"));
    } catch (error) {
      throw new CommandExecutionError(`Could not parse Twitter bookmarks resume file ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
    const count = parsed?.count;
    const cursor = parsed?.cursor == null ? null : String(parsed.cursor);
    const outputFile = parsed?.outputFile ? path_default.resolve(String(parsed.outputFile)) : null;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || !Number.isInteger(count) || count < 0 || parsed.cursor != null && typeof parsed.cursor !== "string" || cursor !== null && !cursor.trim()) {
      throw new CommandExecutionError(`Twitter bookmarks resume file ${filePath} has an invalid shape`);
    }
    if (expected) {
      if (parsed.source !== expected.source) throw new ArgumentError(`Resume file source mismatch: expected ${expected.source}, found ${parsed.source || "unknown"}`);
      if (outputFile !== expected.outputFile) throw new ArgumentError(`Resume file output mismatch: expected ${expected.outputFile || "in-memory mode"}, found ${outputFile || "in-memory mode"}`);
      if (!expected.outputFile && !Array.isArray(parsed.tweets)) throw new CommandExecutionError(`Twitter bookmarks resume file ${filePath} is missing in-memory tweets`);
      if (!expected.outputFile && parsed.tweets.length !== count) throw new CommandExecutionError(`Twitter bookmarks resume file ${filePath} count does not match its in-memory tweets`);
      if (parsed.complete) throw new CommandExecutionError(`Twitter bookmarks resume file ${filePath} is already marked complete`);
    }
    return {
      cursor,
      count,
      tweets: Array.isArray(parsed.tweets) ? parsed.tweets : [],
      complete: Boolean(parsed.complete),
      source: parsed.source || null,
      outputFile,
      updatedAt: parsed.updatedAt || null
    };
  }
  function writeResumeFile(filePath, payload) {
    if (!filePath) return;
    ensureParentDir(filePath);
    const temporaryPath = `${filePath}.tmp-${process.pid}`;
    try {
      fs_default.writeFileSync(temporaryPath, JSON.stringify(payload, null, 2) + "\n");
      fs_default.renameSync(temporaryPath, filePath);
    } catch (error) {
      try {
        fs_default.rmSync(temporaryPath, {
          force: true
        });
      } catch {
      }
      throw new CommandExecutionError(`Could not persist Twitter bookmarks resume state: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  cli({
    site: "twitter",
    name: "bookmarks",
    access: "read",
    description: "Fetch your Twitter/X bookmarks (the logged-in user's saved tweets, newest first)",
    domain: "x.com",
    strategy: Strategy.COOKIE,
    browser: true,
    args: [{
      name: "limit",
      type: "int",
      default: 20,
      help: "Maximum number of bookmarks to return (default 20). Ignored when --all is set."
    }, {
      name: "all",
      type: "bool",
      default: false,
      help: "Fetch all bookmark pages until exhausted. Prefer --output-file for large archives."
    }, {
      name: "resume-file",
      type: "string",
      help: "Resume file for long-running all-pages bookmark syncs."
    }, {
      name: "output-file",
      type: "string",
      help: "Write all-page results to JSONL. Requires --all and --resume-file."
    }, {
      name: "max-pages",
      type: "int",
      help: `Optional pagination safety cap (default ${DEFAULT_MAX_PAGINATION_PAGES}; raised automatically with --all).`
    }, {
      name: "top-by-engagement",
      type: "int",
      default: 0,
      help: "When set to N>0, re-rank the bookmarks by weighted engagement (likes\xD71 + retweets\xD73 + replies\xD72 + bookmarks\xD75 + log10(views+1)\xD70.5) and return the top N. Default 0 keeps the API's native (saved-time) ordering. Incompatible with --output-file."
    }],
    columns: ["id", "author", "text", "likes", "retweets", "bookmarks", "created_at", "url", "has_media", "media_urls", "media_posters"],
    func: async (page, kwargs) => {
      const fetchAll = Boolean(kwargs.all);
      const limit = fetchAll ? Number.POSITIVE_INFINITY : kwargs.limit || 20;
      const resumeFile = resolveOptionalFilePath(kwargs["resume-file"], "--resume-file");
      const outputFile = resolveOptionalFilePath(kwargs["output-file"], "--output-file");
      const useOutputFile = Boolean(fetchAll && outputFile);
      const maxPages = resolveMaxPages(kwargs, fetchAll);
      const topByEngagement = Number(kwargs["top-by-engagement"] || 0);
      if (useOutputFile && topByEngagement > 0) {
        throw new ArgumentError("--top-by-engagement cannot be combined with --output-file");
      }
      if (outputFile && !fetchAll) {
        throw new ArgumentError("--output-file requires --all");
      }
      if (resumeFile && !fetchAll) {
        throw new ArgumentError("--resume-file requires --all");
      }
      if (outputFile && !resumeFile) {
        throw new ArgumentError("--output-file requires --resume-file so partial archives remain resumable");
      }
      const cookies = await page.getCookies({
        url: "https://x.com"
      });
      const ct0 = cookies.find((c) => c.name === "ct0")?.value || null;
      if (!ct0) throw new AuthRequiredError("x.com", "Not logged into x.com (no ct0 cookie)");
      const queryId = await resolveTwitterQueryId(page, "Bookmarks", BOOKMARKS_QUERY_ID);
      const headers = JSON.stringify({
        "Authorization": `Bearer ${decodeURIComponent(TWITTER_BEARER_TOKEN)}`,
        "X-Csrf-Token": ct0,
        "X-Twitter-Auth-Type": "OAuth2Session",
        "X-Twitter-Active-User": "yes"
      });
      const resumed = fetchAll ? readResumeFile(resumeFile, {
        source: "bookmarks",
        outputFile: useOutputFile ? outputFile : null
      }) : null;
      if (useOutputFile && resumed && resumed.count > 0 && !fs_default.existsSync(outputFile)) {
        throw new CommandExecutionError(`Twitter bookmarks output file is missing for resume state: ${outputFile}`);
      }
      if (useOutputFile && !resumed && fs_default.existsSync(outputFile)) {
        throw new ArgumentError(`Refusing to overwrite existing Twitter bookmarks output file: ${outputFile}`);
      }
      const allTweets = useOutputFile ? [] : resumed?.tweets ? [...resumed.tweets] : [];
      const jsonlState = useOutputFile ? loadJsonlArchiveState(outputFile) : null;
      const seen = useOutputFile ? jsonlState.seen : new Set(allTweets.map((tweet) => tweet?.id).filter(Boolean));
      if (useOutputFile && resumed && jsonlState.count !== resumed.count) {
        throw new CommandExecutionError(`Twitter bookmarks output file has ${jsonlState.count} record(s), expected resume count ${resumed.count}`);
      }
      let outputCount = useOutputFile ? jsonlState.count : 0;
      let cursor = resumed?.cursor || null;
      let pages = 0;
      let exhausted = false;
      while (pages < maxPages && (fetchAll || allTweets.length < limit)) {
        pages += 1;
        const currentCount = useOutputFile ? outputCount : allTweets.length;
        const remaining = fetchAll ? 100 : limit - currentCount + 10;
        const fetchCount = Math.min(100, remaining);
        const apiUrl = buildBookmarksUrl(fetchCount, cursor).replace(BOOKMARKS_QUERY_ID, queryId);
        const data = unwrapBrowserResult(await ((__bb_static_arg_0, __bb_static_arg_1) => page.evaluate(() => {
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
        }))(apiUrl, JSON.parse(headers)));
        if (data?.error) {
          if ((useOutputFile ? outputCount : allTweets.length) === 0) throw new CommandExecutionError(describeTwitterApiError("Bookmarks", data.error));
          break;
        }
        const hasInstructions = Array.isArray(data?.data?.bookmark_timeline_v2?.timeline?.instructions) || Array.isArray(data?.data?.bookmark_timeline?.timeline?.instructions);
        if (!hasInstructions) {
          throw new CommandExecutionError("twitter_bookmarks_protocol_error: missing Bookmarks timeline instructions");
        }
        const {
          tweets,
          nextCursor
        } = parseBookmarks(data, seen);
        if (useOutputFile) {
          appendJsonlRows(outputFile, tweets);
          outputCount += tweets.length;
        } else {
          allTweets.push(...tweets);
        }
        const pageComplete = !nextCursor;
        writeResumeFile(resumeFile, {
          cursor: pageComplete ? null : nextCursor,
          count: useOutputFile ? outputCount : allTweets.length,
          tweets: useOutputFile ? void 0 : allTweets,
          updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
          complete: pageComplete,
          source: "bookmarks",
          outputFile: useOutputFile ? outputFile : null
        });
        if (pageComplete) {
          exhausted = true;
          break;
        }
        if (nextCursor === cursor) {
          throw new CommandExecutionError("twitter_bookmarks_repeated_cursor: archive completion cannot be proven; resume state was retained");
        }
        cursor = nextCursor;
      }
      const finalCount = useOutputFile ? outputCount : allTweets.length;
      if (finalCount === 0) {
        throw new EmptyResultError("twitter bookmarks", "No bookmarks found for the logged-in account");
      }
      if (exhausted) removeResumeFile(resumeFile);
      if (useOutputFile) {
        return {
          outputFile,
          count: outputCount,
          source: "bookmarks",
          complete: exhausted,
          pages,
          ...exhausted ? {} : {
            cursor,
            resumeFile: resumeFile || null
          }
        };
      }
      if (fetchAll && !exhausted) {
        throw new CommandExecutionError(`twitter_bookmarks_archive_incomplete: stopped after ${pages} page(s); completion cannot be proven`, resumeFile ? `Resume with --resume-file ${resumeFile}` : "Rerun with --resume-file to preserve continuation state.");
      }
      const trimmed = fetchAll ? allTweets : allTweets.slice(0, limit);
      return applyTopByEngagement(trimmed, topByEngagement);
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

return XRead.runRead("bookmarks",args);
}
