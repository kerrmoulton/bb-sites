import { resolveTwitterQueryId } from './shared.js';
import { TWITTER_BEARER_TOKEN } from './utils.js';
import { AuthRequiredError, CommandExecutionError } from '@jackwener/opencli/errors';
import { cli, Strategy } from '@jackwener/opencli/registry';
cli({
  site: 'twitter',
  name: 'notifications',
  access: 'read',
  description: 'Get your Twitter/X notifications (the logged-in user\'s likes/replies/follows feed, newest first)',
  domain: 'x.com',
  strategy: Strategy.INTERCEPT,
  browser: true,
  args: [{
    name: 'limit',
    type: 'int',
    default: 20,
    help: 'Maximum number of notifications to return (default 20).'
  }],
  columns: ['id', 'action', 'author', 'text', 'url'],
  func: async (page, kwargs) => {
    const cookies=await page.getCookies();const ct0=cookies.find(c=>c.name==='ct0')?.value;
    if(!ct0)throw new AuthRequiredError('x.com','Not logged into x.com (no ct0 cookie)');
    const id=typeof findGraphQLQueryId==='function'?findGraphQLQueryId('NotificationsTimeline','lXkwcYxJtGMm63D8jTPtSA'):await resolveTwitterQueryId(page,'NotificationsTimeline','lXkwcYxJtGMm63D8jTPtSA');
    const raw=await page.evaluate(async()=>{
      const params=new URLSearchParams({variables:JSON.stringify({timeline_type:'All',count:kwargs.limit||20}),features:JSON.stringify({"rweb_video_screen_enabled": false, "rweb_cashtags_enabled": true, "profile_label_improvements_pcf_label_in_post_enabled": true, "responsive_web_profile_redirect_enabled": true, "rweb_tipjar_consumption_enabled": false, "verified_phone_label_enabled": false, "creator_subscriptions_tweet_preview_api_enabled": true, "responsive_web_graphql_timeline_navigation_enabled": true, "premium_content_api_read_enabled": false, "communities_web_enable_tweet_community_results_fetch": true, "c9s_tweet_anatomy_moderator_badge_enabled": true, "responsive_web_grok_analyze_button_fetch_trends_enabled": false, "responsive_web_grok_analyze_post_followups_enabled": true, "rweb_cashtags_composer_attachment_enabled": true, "responsive_web_jetfuel_frame": true, "rweb_sports_post_context_enabled": false, "responsive_web_grok_share_attachment_enabled": true, "responsive_web_grok_annotations_enabled": true, "articles_preview_enabled": true, "responsive_web_edit_tweet_api_enabled": true, "rweb_conversational_replies_downvote_enabled": false, "graphql_is_translatable_rweb_tweet_is_translatable_enabled": true, "view_counts_everywhere_api_enabled": true, "longform_notetweets_consumption_enabled": true, "responsive_web_twitter_article_tweet_consumption_enabled": true, "content_disclosure_indicator_enabled": true, "content_disclosure_ai_generated_indicator_enabled": true, "responsive_web_grok_show_grok_translated_post": true, "responsive_web_grok_analysis_button_from_backend": true, "post_ctas_fetch_enabled": false, "freedom_of_speech_not_reach_fetch_enabled": true, "standardized_nudges_misinfo": true, "tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled": true, "longform_notetweets_rich_text_read_enabled": true, "longform_notetweets_inline_media_enabled": false, "responsive_web_grok_image_annotation_enabled": true, "responsive_web_grok_imagine_annotation_enabled": true, "responsive_web_grok_community_note_auto_translation_is_enabled": true, "responsive_web_enhance_cards_enabled": false})});
      const response=await fetch('/i/api/graphql/'+id+'/NotificationsTimeline?'+params,{credentials:'include',headers:{Authorization:'Bearer '+decodeURIComponent(TWITTER_BEARER_TOKEN),'X-Csrf-Token':ct0,'X-Twitter-Auth-Type':'OAuth2Session','X-Twitter-Active-User':'yes'}});
      if(!response.ok)throw new CommandExecutionError('NotificationsTimeline HTTP '+response.status);
      return response.json();
    });
    const root=raw?.data;
    const instructions=root?.viewer?.timeline_response?.timeline?.instructions||root?.viewer_v2?.user_results?.result?.notification_timeline?.timeline?.instructions||root?.timeline?.instructions;
    if(!Array.isArray(instructions))throw new CommandExecutionError('NOTIFICATIONS_PROTOCOL_ERROR: missing timeline instructions');
    const requests=[raw];
    if (!requests || requests.length === 0) return [];
    let results = [];
    const seen = new Set();
    for (const req of requests) {
      try {
        // GraphQL response: { data: { viewer: ... } } (one level of .data)
        let instructions = [];
        if (req.data?.viewer?.timeline_response?.timeline?.instructions) {
          instructions = req.data.viewer.timeline_response.timeline.instructions;
        } else if (req.data?.viewer_v2?.user_results?.result?.notification_timeline?.timeline?.instructions) {
          instructions = req.data.viewer_v2.user_results.result.notification_timeline.timeline.instructions;
        } else if (req.data?.timeline?.instructions) {
          instructions = req.data.timeline.instructions;
        }
        let addEntries = instructions.find(i => i.type === 'TimelineAddEntries');
        if (!addEntries) {
          addEntries = instructions.find(i => i.entries && Array.isArray(i.entries));
        }
        if (!addEntries) continue;
        for (const entry of addEntries.entries) {
          if (!entry.entryId.startsWith('notification-')) {
            if (entry.content?.items) {
              for (const subItem of entry.content.items) {
                processNotificationItem(subItem.item?.itemContent, subItem.entryId);
              }
            }
            continue;
          }
          processNotificationItem(entry.content?.itemContent, entry.entryId);
        }
        function processNotificationItem(itemContent, entryId) {
          if (!itemContent) return;
          let item = itemContent?.notification_results?.result || itemContent?.tweet_results?.result || itemContent;
          let actionText = 'Notification';
          let author = '';
          let text = '';
          let urlStr = '';
          if (item.__typename === 'TimelineNotification') {
            text = item.rich_message?.text || item.message?.text || '';
            const fromUser = item.template?.from_users?.[0]?.user_results?.result;
            // Twitter moved screen_name from legacy to core
            author = fromUser?.core?.screen_name || fromUser?.legacy?.screen_name || '';
            urlStr = item.notification_url?.url || '';
            actionText = item.notification_icon || 'Activity';
            const targetTweet = item.template?.target_objects?.[0]?.tweet_results?.result;
            if (targetTweet) {
              const targetText = targetTweet.note_tweet?.note_tweet_results?.result?.text || targetTweet.legacy?.full_text || '';
              text += text && targetText ? ' | ' + targetText : targetText;
              if (!urlStr) {
                urlStr = `https://x.com/i/status/${targetTweet.rest_id}`;
              }
            }
          } else if (item.__typename === 'TweetNotification') {
            const tweet = item.tweet_result?.result;
            const tweetUser = tweet?.core?.user_results?.result;
            author = tweetUser?.core?.screen_name || tweetUser?.legacy?.screen_name || '';
            text = tweet?.note_tweet?.note_tweet_results?.result?.text || tweet?.legacy?.full_text || item.message?.text || '';
            actionText = 'Mention/Reply';
            urlStr = `https://x.com/i/status/${tweet?.rest_id}`;
          } else if (item.__typename === 'Tweet') {
            const tweetUser = item.core?.user_results?.result;
            author = tweetUser?.core?.screen_name || tweetUser?.legacy?.screen_name || '';
            text = item.note_tweet?.note_tweet_results?.result?.text || item.legacy?.full_text || '';
            actionText = 'Mention';
            urlStr = `https://x.com/i/status/${item.rest_id}`;
          }
          const id = item.id || item.rest_id || entryId;
          if (seen.has(id)) return;
          seen.add(id);
          results.push({
            id,
            action: actionText,
            author: author,
            text: text,
            url: urlStr || `https://x.com/notifications`
          });
        }
      } catch (e) {
        // ignore parsing errors for individual payloads
      }
    }
    return results.slice(0, kwargs.limit);
  }
});
