# X read adapter sources and modifications

This fork adds the `twitter/read-*` suite. It does not replace the BB Browser CLI or its browser transport.

The read adapter sources in `src/upstream/` are derived from OpenCLI, snapshot `8271afc67e8504bda94c147f446ee29775d08274`:
https://github.com/jackwener/OpenCLI/tree/8271afc67e8504bda94c147f446ee29775d08274/clis/twitter

OpenCLI licenses this code under Apache-2.0. The license text is retained in `OPENCLI-LICENSE.txt`; the generated `twitter/read-*.js` files include an attribution pointer. This notice does not relicense the entire bb-sites repository. `twitter/_helper.js` remains the existing bb-sites helper, unchanged.

Modified on 2026-09-13:

- Statically converted browser-evaluation strings to functions to comply with X CSP. `src/runtime.js` maps page operations to the existing BB browser context, restores temporary interceptors, and keeps credentials inside that context.
- Added a single JSON request argument to avoid collisions with BB's global CLI options. Structured `failure` envelopes retain partial data even when BB's CLI exits zero.
- Updated bookmark folder operation/query fallback; replaced follower DOM scraping with the read-only Followers API and live query/transaction discovery; retained modern user/relationship field handling.
- Added cursor/no-progress guards for search and home timeline.
- Replaced notification capture/navigation with direct read-only NotificationsTimeline requests, using the observed schema and checking its presence.
- Changed media downloading to URL discovery only; single-tweet media uses TweetDetail and checks the target ID. No cookie export or binary downloader is included.
- Added a separate browser whoami adapter, filesystem-denying compatibility shims, and the local Python file-output/validation driver and installer.

The installed OpenCLI 1.8.7 used in the local benchmark differed from this source snapshot in following/followers. The port was tested as an explicitly repaired implementation, not represented as unmodified upstream code. Large parts of the parsers are shared with OpenCLI, so matching output is not independent proof of data completeness.

The fork contains code, synthetic tests and documentation only. Local benchmark responses, browser/account information, logs and installation backups are not part of the committed suite.
