/* @meta
{
  "name": "twitter/history-page",
  "description": "One read-only X history page with cursor and rate metadata",
  "domain": "x.com",
  "readOnly": true,
  "args": {
    "request": {
      "required": true,
      "description": "JSON request"
    }
  }
}
*/
async function(args){
var HistoryPage = (() => {
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

  // bb-sites/tools/history-adapter/page.js
  var page_exports = {};
  __export(page_exports, {
    VERSION: () => VERSION,
    parsePage: () => parsePage,
    row: () => row,
    run: () => run
  });

  // bb-sites/tools/x-read/src/upstream/shared.js
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

  // bb-sites/tools/x-read/src/upstream/utils.js
  var TWITTER_BEARER_TOKEN = "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";
  var MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024;
  var ENGAGEMENT_WEIGHTS = Object.freeze({
    likes: 1,
    retweets: 3,
    replies: 2,
    bookmarks: 5,
    viewsLog: 0.5
  });

  // bb-sites/tools/x-read/src/upstream/user-timeline.js
  var USER_TWEETS_QUERY_ID = "lrMzG9qPQHpqJdP3AbM-bQ";
  var USER_BY_SCREEN_NAME_QUERY_ID = "IGgvgiOx4QZndDHuD3x9TQ";
  var MAX_USER_TWEETS_PAGES = 100;
  var USER_TWEETS_PAGE_SIZE = 100;
  var MAX_USER_TWEETS_LIMIT = MAX_USER_TWEETS_PAGES * USER_TWEETS_PAGE_SIZE;
  var USER_TWEETS_FEATURES = {
    rweb_video_screen_enabled: true,
    rweb_cashtags_enabled: true,
    payments_enabled: false,
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
    longform_notetweets_inline_media_enabled: true,
    responsive_web_grok_image_annotation_enabled: true,
    responsive_web_grok_imagine_annotation_enabled: true,
    responsive_web_grok_community_note_auto_translation_is_enabled: false,
    responsive_web_enhance_cards_enabled: false
  };
  var USER_TWEETS_FIELD_TOGGLES = {
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
  function normalizeUserTweetsOperation(operation) {
    if (typeof operation === "string") {
      return {
        queryId: operation,
        features: USER_TWEETS_FEATURES,
        fieldToggles: USER_TWEETS_FIELD_TOGGLES
      };
    }
    return {
      queryId: operation?.queryId || USER_TWEETS_QUERY_ID,
      features: operation?.features || USER_TWEETS_FEATURES,
      fieldToggles: operation?.fieldToggles || USER_TWEETS_FIELD_TOGGLES
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
  function buildUserTweetsUrl(operation, userId, count, cursor) {
    const normalized = normalizeUserTweetsOperation(operation);
    const vars = {
      userId,
      count,
      includePromotedContent: false,
      withQuickPromoteEligibilityTweetFields: true,
      withVoice: true
    };
    if (cursor) vars.cursor = cursor;
    return appendGraphqlParams(`/i/api/graphql/${normalized.queryId}/UserTweets`, vars, normalized);
  }
  function buildUserByScreenNameUrl(operation, screenName) {
    const normalized = normalizeUserByScreenNameOperation(operation);
    const vars = {
      screen_name: screenName,
      withSafetyModeUserFields: true
    };
    return appendGraphqlParams(`/i/api/graphql/${normalized.queryId}/UserByScreenName`, vars, normalized);
  }

  // bb-sites/tools/history-adapter/page.js
  var VERSION = "history-page-3";
  var unwrap = (t) => t?.tweet || t;
  function row(result) {
    const t = unwrap(result), l = t?.legacy, u = t?.core?.user_results?.result;
    if (!t?.rest_id || !l) return null;
    const author = u?.core?.screen_name || u?.legacy?.screen_name || "";
    const note = t.note_tweet?.note_tweet_results?.result?.text, plain = note || l.full_text || "", weighted = [...plain].reduce((n, c) => n + (c.codePointAt(0) > 4352 ? 2 : 1), 0);
    const article = t.article?.article_results?.result;
    const articleText = article?.plain_text || article?.content_state?.blocks?.map((b) => b.text || "").join("\n") || null;
    return { id: String(t.rest_id), author_id: String(u?.rest_id || l.user_id_str || ""), author, text: plain, text_quality: note ? "note" : "timeline", needs_detail: !note && weighted >= 240 || !!t.article, article_text: articleText, created_at: l.created_at || "", url: `https://x.com/${author || "i"}/status/${t.rest_id}`, type: l.retweeted_status_result ? "repost" : l.in_reply_to_status_id_str ? "reply" : l.is_quote_status ? "quote" : "post", reply_to_id: l.in_reply_to_status_id_str || null, quote_id: l.quoted_status_id_str || null, repost_id: unwrap(l.retweeted_status_result?.result)?.rest_id || null, likes: l.favorite_count || 0, reposts: l.retweet_count || 0, replies: l.reply_count || 0, views: t.views?.count || null, ...extractMedia(l), quoted_tweet: extractQuotedTweet(t), card: extractCard(t), article: t.article || null, urls: l.entities?.urls || [], edit_control: t.edit_control || null };
  }
  function parsePage(raw, mode) {
    const user = raw?.data?.user?.result;
    const instructions = mode === "search" ? raw?.data?.search_by_raw_query?.search_timeline?.timeline?.instructions : user?.timeline_v2?.timeline?.instructions || user?.timeline?.timeline?.instructions;
    if (!Array.isArray(instructions)) return { ok: false, code: "SCHEMA_CHANGED", user_type: user?.__typename };
    const rows = /* @__PURE__ */ new Map(), related = /* @__PURE__ */ new Map();
    let next = null, terminated = false;
    const skipped = [];
    function visit(v, pinned = false, entryId = null) {
      if (!v || typeof v !== "object") return;
      if (v.type === "TimelineTerminateTimeline" && v.direction === "Bottom") terminated = true;
      pinned = pinned || v.type === "TimelinePinEntry";
      entryId = v.entryId || entryId;
      if (v.promotedMetadata) return;
      if (["Bottom", "ShowMore"].includes(v.cursorType) && typeof v.value === "string") next = v.value;
      if (v.tweet_results) {
        const t = unwrap(v.tweet_results.result), r = row(t);
        if (r) {
          const prior = rows.get(r.id);
          rows.set(r.id, { ...r, is_pinned: pinned || prior?.is_pinned || false, entry_id: entryId });
          for (const sub of [t.quoted_status_result?.result, t.legacy?.retweeted_status_result?.result]) {
            const rel = row(sub);
            if (rel) related.set(rel.id, rel);
          }
        } else skipped.push({ entry_id: entryId, type: t?.__typename || "unknown" });
        return;
      }
      for (const c of Object.values(v)) if (c && typeof c === "object") visit(c, pinned, entryId);
    }
    visit(instructions);
    return { ok: true, posts: [...rows.values()], related_posts: [...related.values()], next_cursor: next, has_next: !!next, end_reason: next ? null : terminated ? "server_terminated" : "no_cursor", skipped };
  }
  async function run(args) {
    const mode = args.mode || "tweets", name = String(args.username || "").replace(/^@/, "");
    if (!/^[A-Za-z0-9_]{1,15}$/.test(name) || !["profile", "tweets", "replies", "search", "detail"].includes(mode)) return { ok: false, failure: { code: "INVALID_REQUEST" } };
    const count = Number(args.page_size ?? 20);
    if (!Number.isInteger(count) || count < 1 || count > 100) return { ok: false, failure: { code: "INVALID_PAGE_SIZE" } };
    if (mode !== "profile" && !/^\d+$/.test(String(args.user_id || ""))) return { ok: false, failure: { code: "USER_ID_REQUIRED" } };
    if (mode === "detail" && !/^\d+$/.test(String(args.tweet_id || ""))) return { ok: false, failure: { code: "TWEET_ID_REQUIRED" } };
    if (mode === "search" && !args.query) return { ok: false, failure: { code: "QUERY_REQUIRED" } };
    if (location.hostname !== "x.com") return { ok: false, failure: { code: "WRONG_ORIGIN" } };
    const ct = document.cookie.split(";").map((x) => x.trim()).find((x) => x.startsWith("ct0="))?.slice(4);
    if (!ct) return { ok: false, failure: { code: "AUTH_REQUIRED" } };
    const operation = { profile: "UserByScreenName", tweets: "UserTweets", replies: "UserTweetsAndReplies", search: "SearchTimeline", detail: "TweetResultByRestId" }[mode];
    const page = { evaluate: async (fn, ...a) => fn(...a) };
    const cache = window.__bbHistoryMetadata || (window.__bbHistoryMetadata = {});
    let op = cache[operation]?.op;
    if (!op || Date.now() - cache[operation].at > 36e5) {
      const fallback = { queryId: { profile: "IGgvgiOx4QZndDHuD3x9TQ", tweets: "lrMzG9qPQHpqJdP3AbM-bQ", replies: "qUpkZU6eN8MbtQb7rC_pYg", search: "Yw6L66Pw54NHKuq4Dp7b4Q", detail: "7xflPyRiUxGVbJd4uWmbfg" }[mode] };
      op = await resolveTwitterOperationMetadata(page, operation, fallback);
      cache[operation] = { op, at: Date.now() };
    }
    let url, init = { headers: { Authorization: `Bearer ${decodeURIComponent(TWITTER_BEARER_TOKEN)}`, "X-Csrf-Token": ct, "X-Twitter-Auth-Type": "OAuth2Session", "X-Twitter-Active-User": "yes", "Content-Type": "application/json" }, credentials: "include" };
    if (mode === "profile") url = buildUserByScreenNameUrl(op, name);
    else if (mode === "detail") {
      const params = new URLSearchParams({ variables: JSON.stringify({ tweetId: String(args.tweet_id), withCommunity: false, includePromotedContent: false, withVoice: false }), features: JSON.stringify({ ...op.features, longform_notetweets_consumption_enabled: true, responsive_web_twitter_article_tweet_consumption_enabled: true, longform_notetweets_rich_text_read_enabled: true, longform_notetweets_inline_media_enabled: true, articles_preview_enabled: true }), fieldToggles: JSON.stringify({ ...op.fieldToggles, withArticleRichContentState: true, withArticlePlainText: true }) });
      url = `/i/api/graphql/${op.queryId}/TweetResultByRestId?${params}`;
    } else if (mode === "search") {
      url = `/i/api/graphql/${op.queryId}/SearchTimeline`;
      init.method = "POST";
      init.body = JSON.stringify({ variables: { rawQuery: args.query, count, product: "Latest", querySource: "typed_query", ...args.cursor ? { cursor: args.cursor } : {} }, features: op.features, fieldToggles: op.fieldToggles });
    } else {
      url = buildUserTweetsUrl(op, String(args.user_id), count, args.cursor).replace("/UserTweets?", `/${operation}?`);
      if (mode === "replies") {
        const u = new URL(url, location.origin), v = JSON.parse(u.searchParams.get("variables"));
        v.withCommunity = true;
        u.searchParams.set("variables", JSON.stringify(v));
        init.method = "POST";
        init.body = JSON.stringify({ variables: v, features: op.features, fieldToggles: op.fieldToggles });
        url = u.pathname;
      }
    }
    let response, raw, bodyLength = 0;
    try {
      response = await fetch(url, init);
    } catch (e) {
      return { ok: false, failure: { code: "NETWORK_ERROR", message: String(e) }, operation, adapter_version: VERSION };
    }
    try {
      const body = await response.text();
      bodyLength = body.length;
      raw = JSON.parse(body);
    } catch {
    }
    const rate = Object.fromEntries(["x-rate-limit-remaining", "x-rate-limit-reset", "x-rate-limit-limit", "retry-after"].map((k) => [k, response.headers.get(k)]).filter(([, v]) => v !== null));
    const meta = { operation, request_method: init.method || "GET", http_status: response.status, rate_limit: rate, adapter_version: VERSION, raw_response: raw ?? null, response_bytes: bodyLength, content_type: response.headers.get("content-type"), fetched_at: (/* @__PURE__ */ new Date()).toISOString() };
    if (raw == null) {
      delete cache[operation];
      return { ...meta, ok: false, failure: { code: response.ok ? "INVALID_JSON" : "HTTP_" + response.status } };
    }
    if (!response.ok || raw.errors?.length) {
      delete cache[operation];
      return { ...meta, ok: false, failure: { code: !response.ok ? "HTTP_" + response.status : "GRAPHQL_ERROR", errors: raw.errors || [] } };
    }
    if (mode === "profile") {
      const u = raw?.data?.user?.result;
      if (!u?.rest_id) return { ...meta, ok: false, failure: { code: "USER_UNAVAILABLE" } };
      return { ...meta, ok: true, user: { id: String(u.rest_id), username: u.core?.screen_name || u.legacy?.screen_name || name, name: u.core?.name || u.legacy?.name, bio: u.profile_bio?.description || u.legacy?.description, created_at: u.core?.created_at || u.legacy?.created_at, posts_count: u.tweet_counts?.tweets ?? u.legacy?.statuses_count } };
    }
    if (mode === "detail") {
      const r = row(raw?.data?.tweetResult?.result);
      if (!r || r.id !== String(args.tweet_id)) return { ...meta, ok: false, failure: { code: "DETAIL_UNAVAILABLE" } };
      return { ...meta, ok: true, user_id: String(args.user_id), cursor_in: null, next_cursor: null, posts: [{ ...r, text_quality: "detail", needs_detail: false }], related_posts: [] };
    }
    const parsed = parsePage(raw, mode);
    if (!parsed.ok) return { ...meta, ok: false, failure: { code: parsed.code, user_type: parsed.user_type } };
    return { ...meta, ...parsed, user_id: String(args.user_id), cursor_in: args.cursor || null };
  }
  return __toCommonJS(page_exports);
})();

try{return await HistoryPage.run(JSON.parse(args.request));}catch(e){return {ok:false,failure:{code:"ADAPTER_EXCEPTION",message:e.message}};}
}
