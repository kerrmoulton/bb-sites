/* @meta
{
  "name": "twitter/read-search",
  "description": "Private BB read adapter: Search Twitter/X for tweets, with optional --from / --has / --exclude / --product filters mapped to X's search operators",
  "domain": "x.com",
  "readOnly": true,
  "args": {
    "request": {
      "required": false,
      "description": "JSON object containing original OpenCLI argument names and values; avoids BB global flag collisions"
    }
  },
  "example": "bb-browser site twitter/read-search --json"
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

  // src/upstream/search.js
  var HAS_CHOICES = Object.freeze(["media", "images", "videos", "links", "replies"]);
  var EXCLUDE_CHOICES = Object.freeze(["replies", "retweets", "media", "links"]);
  var PRODUCT_CHOICES = Object.freeze(["top", "live", "photos", "videos"]);
  var PRODUCT_TO_F_PARAM = Object.freeze({
    top: "top",
    live: "live",
    photos: "image",
    videos: "video"
  });
  var PRODUCT_TO_GRAPHQL_PRODUCT = Object.freeze({
    top: "Top",
    live: "Latest",
    photos: "Photos",
    videos: "Videos"
  });
  var MAX_PAGINATION_PAGES = 100;
  var SEARCH_TIMELINE_OPERATION = {
    queryId: "Yw6L66Pw54NHKuq4Dp7b4Q",
    features: {
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
    },
    fieldToggles: {
      withPayments: true,
      withAuxiliaryUserLabels: true,
      withArticleRichContentState: true,
      withArticlePlainText: true,
      withArticleSummaryText: true,
      withArticleVoiceOver: true,
      withGrokAnalyze: true,
      withDisallowedReplyControls: true
    }
  };
  var FROM_USER_PATTERN = /^[A-Za-z0-9_]{1,15}$/;
  var EXCLUDE_TO_OPERATOR = Object.freeze({
    replies: "-filter:replies",
    // `retweets` is a CLI-friendly alias for X's actual `-filter:nativeretweets`.
    retweets: "-filter:nativeretweets",
    media: "-filter:media",
    links: "-filter:links"
  });
  function buildSearchQuery(rawQuery, kwargs) {
    const parts = [String(rawQuery ?? "").trim()];
    if (kwargs.from) {
      const fromUser = String(kwargs.from).trim().replace(/^@+/, "");
      if (fromUser && !FROM_USER_PATTERN.test(fromUser)) {
        throw new ArgumentError(`Invalid --from username: ${JSON.stringify(kwargs.from)}`, "Use a Twitter/X handle with 1-15 letters, numbers, or underscores; omit @ or pass @handle.");
      }
      if (fromUser) parts.push(`from:${fromUser}`);
    }
    if (kwargs.has) {
      parts.push(`filter:${kwargs.has}`);
    }
    if (kwargs.exclude) {
      const op = EXCLUDE_TO_OPERATOR[kwargs.exclude];
      if (op) parts.push(op);
    }
    return parts.filter(Boolean).join(" ");
  }
  function resolveSearchProduct(kwargs) {
    const product = kwargs.product || (kwargs.filter === "live" ? "live" : "top");
    return PRODUCT_TO_GRAPHQL_PRODUCT[product] || "Top";
  }
  function normalizeOperation(operation) {
    if (typeof operation === "string") {
      return {
        queryId: operation,
        features: SEARCH_TIMELINE_OPERATION.features,
        fieldToggles: SEARCH_TIMELINE_OPERATION.fieldToggles
      };
    }
    return {
      queryId: operation?.queryId || SEARCH_TIMELINE_OPERATION.queryId,
      features: operation?.features || SEARCH_TIMELINE_OPERATION.features,
      fieldToggles: operation?.fieldToggles || SEARCH_TIMELINE_OPERATION.fieldToggles
    };
  }
  function buildSearchTimelineRequest(operation, rawQuery, product, count, cursor) {
    const normalized = normalizeOperation(operation);
    const vars = {
      rawQuery,
      count,
      querySource: "typed_query",
      product
    };
    if (cursor) vars.cursor = cursor;
    return [`/i/api/graphql/${normalized.queryId}/SearchTimeline`, {
      variables: vars,
      features: normalized.features,
      fieldToggles: normalized.fieldToggles
    }];
  }
  function unwrapTweetResult(result) {
    if (!result) return null;
    if (result.__typename === "TweetWithVisibilityResults" && result.tweet) return result.tweet;
    if (result.tweet) return result.tweet;
    return result;
  }
  function tweetToRow(result, seen) {
    const tweet = unwrapTweetResult(result);
    if (!tweet?.rest_id || seen.has(tweet.rest_id)) return null;
    seen.add(tweet.rest_id);
    const tweetUser = tweet.core?.user_results?.result;
    const bio = tweetUser?.legacy?.description || "";
    return {
      id: tweet.rest_id,
      author: tweetUser?.core?.screen_name || tweetUser?.legacy?.screen_name || "",
      bio,
      text: tweet.note_tweet?.note_tweet_results?.result?.text || tweet.legacy?.full_text || "",
      created_at: tweet.legacy?.created_at || "",
      likes: tweet.legacy?.favorite_count || 0,
      views: tweet.views?.count || "0",
      url: `https://x.com/i/status/${tweet.rest_id}`,
      ...extractMedia(tweet.legacy),
      card: extractCard(tweet),
      quoted_tweet: extractQuotedTweet(tweet)
    };
  }
  function parseSearchTimeline(data, seen) {
    const rows = [];
    let nextCursor = null;
    const instructions = data?.data?.search_by_raw_query?.search_timeline?.timeline?.instructions || [];
    const visit = (value) => {
      if (!value || typeof value !== "object") return;
      if (value.tweet_results?.result) {
        const row = tweetToRow(value.tweet_results.result, seen);
        if (row) rows.push(row);
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
      rows,
      nextCursor
    };
  }
  cli({
    site: "twitter",
    name: "search",
    access: "read",
    description: "Search Twitter/X for tweets, with optional --from / --has / --exclude / --product filters mapped to X's search operators",
    domain: "x.com",
    strategy: Strategy.COOKIE,
    browser: true,
    args: [{
      name: "query",
      type: "string",
      required: true,
      positional: true,
      help: 'Search query. Raw X operators (e.g. "exact phrase", #tag, OR, lang:en, since:YYYY-MM-DD, from:, since:) are passed through unchanged.'
    }, {
      name: "filter",
      type: "string",
      default: "top",
      choices: ["top", "live"],
      help: "Legacy alias for --product. Kept for backwards compatibility; if --product is set it wins."
    }, {
      name: "product",
      type: "string",
      choices: PRODUCT_CHOICES,
      help: "Which X search tab to read: top (default), live (Latest), photos, videos. Maps to the f= URL param."
    }, {
      name: "from",
      type: "string",
      help: "Restrict to tweets authored by <user>. Leading @ is stripped. Equivalent to appending `from:<user>` to the query."
    }, {
      name: "has",
      type: "string",
      choices: HAS_CHOICES,
      help: "Restrict to tweets that have media|images|videos|links|replies. Maps to X's `filter:<has>` operator."
    }, {
      name: "exclude",
      type: "string",
      choices: EXCLUDE_CHOICES,
      help: "Exclude tweets matching <type>: replies|retweets|media|links. Maps to X's `-filter:<x>` operator (retweets \u2192 -filter:nativeretweets)."
    }, {
      name: "limit",
      type: "int",
      default: 15,
      help: "Maximum number of tweets to return (default 15). Result count after server-side filtering."
    }, {
      name: "top-by-engagement",
      type: "int",
      default: 0,
      help: "When set to N>0, re-rank the results by weighted engagement (likes\xD71 + retweets\xD73 + replies\xD72 + bookmarks\xD75 + log10(views+1)\xD70.5) and return the top N. Default 0 keeps X's native ordering."
    }],
    columns: ["id", "author", "bio", "text", "created_at", "likes", "views", "url", "has_media", "media_urls", "media_posters", "card", "quoted_tweet"],
    func: async (page, kwargs) => {
      const finalQuery = buildSearchQuery(kwargs.query, kwargs);
      if (!finalQuery) {
        throw new ArgumentError("twitter search query is empty", "Provide a non-empty <query>, or use at least one of --from / --has / --exclude.");
      }
      if (!Number.isInteger(Number(kwargs.limit)) || Number(kwargs.limit) <= 0) {
        throw new ArgumentError("twitter search --limit must be a positive integer", "Example: opencli twitter search opencli --limit 15");
      }
      const cookies = await page.getCookies({
        url: "https://x.com"
      });
      const ct0 = cookies.find((c) => c.name === "ct0")?.value || null;
      if (!ct0) throw new AuthRequiredError("x.com", "Not logged into x.com (no ct0 cookie)");
      await page.goto("https://x.com/home", {
        waitUntil: "load",
        settleMs: 1e3
      });
      const operation = await resolveTwitterOperationMetadata(page, "SearchTimeline", SEARCH_TIMELINE_OPERATION);
      const headers = JSON.stringify({
        "Authorization": `Bearer ${decodeURIComponent(TWITTER_BEARER_TOKEN)}`,
        "X-Csrf-Token": ct0,
        "X-Twitter-Auth-Type": "OAuth2Session",
        "X-Twitter-Active-User": "yes",
        "Content-Type": "application/json"
      });
      const product = resolveSearchProduct(kwargs);
      const results = [];
      const seen = /* @__PURE__ */ new Set();
      let cursor = null;
      const visitedCursors = /* @__PURE__ */ new Set();
      let emptyPages = 0;
      for (let i = 0; i < MAX_PAGINATION_PAGES && results.length < kwargs.limit; i++) {
        if (i > 0) await page.wait(0.5);
        const fetchCount = Number(kwargs.limit) - results.length + 10;
        const [requestUrl, requestPayload] = buildSearchTimelineRequest(operation, finalQuery, product, fetchCount, cursor);
        const requestBody = JSON.stringify(requestPayload);
        const data = normalizeTwitterGraphqlPayload(await ((__bb_static_arg_0, __bb_static_arg_1, __bb_static_arg_2) => page.evaluate(() => {
          const __bb_value = async () => {
            const options = {
              method: "POST",
              headers: __bb_static_arg_0,
              credentials: "include"
            };
            options["body"] = __bb_static_arg_1;
            const r = await fetch(__bb_static_arg_2, {
              ...options
            });
            return r.ok ? await r.json() : {
              error: r.status
            };
          };
          return typeof __bb_value === "function" ? __bb_value() : __bb_value;
        }))(JSON.parse(headers), requestBody, requestUrl));
        if (data?.error) {
          if (results.length === 0) throw new CommandExecutionError(describeTwitterApiError("SearchTimeline", data.error));
          break;
        }
        const {
          rows,
          nextCursor
        } = parseSearchTimeline(data, seen);
        results.push(...rows);
        emptyPages = rows.length ? 0 : emptyPages + 1;
        if (!nextCursor) break;
        if (nextCursor === cursor || visitedCursors.has(nextCursor) || emptyPages >= 2) {
          const error = new CommandExecutionError(emptyPages >= 2 ? "SEARCH_NO_PROGRESS: two pages added no new IDs" : "SEARCH_CURSOR_LOOP");
          error.partial = results.slice(0, kwargs.limit);
          throw error;
        }
        visitedCursors.add(nextCursor);
        cursor = nextCursor;
      }
      const trimmed = results.slice(0, kwargs.limit);
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

return XRead.runRead("search",args);
}
