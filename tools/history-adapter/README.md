# X 单页历史适配器

本目录只包含 `twitter/history-page` 的浏览器数据接口源码、构建、安装器和测试。

- 输入JSON：username、user_id、mode、page_size、cursor；search额外query，detail额外tweet_id。
- mode：profile / tweets / replies / search / detail，均为只读查询。
- 返回：ok、posts/related_posts、next_cursor、http_status、rate_limit、raw_response及明确错误。
- 凭据仅在浏览器内使用；不在返回值或日志中导出。

安装：仓库根目录 `python3 tools/install.py`；检查：加`--check`。
构建：`node tools/history-adapter/build.mjs`；测试：`node tools/history-adapter/test_page.cjs`。
构建依赖复用tools/x-read的esbuild。生成文件在twitter/history-page.js，安装到~/.bb-browser/sites/twitter/history-page.js。

SQLite、限速、断点续传、后台worker、增量和导出属于独立的 [bb-xarchive](https://github.com/kerrmoulton/bb-xarchive) 工具。两者通过 `bb-browser site twitter/history-page '<JSON>' --json` 交互，不相互导入源码。BB Sites安装器不再写入归档工具的Python文件或启动命令。

2026-09-13已实测：跨调用游标、GET时间线、POST回复/搜索、GET详情。长文返回能否完整取决于X接口可见性，私有GraphQL可能变化；上层应处理错误、限流及覆盖缺口。
