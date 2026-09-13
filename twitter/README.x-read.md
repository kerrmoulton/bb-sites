# X 只读适配器：此 fork 的增强版

这套代码来自本机实际修复和对比实验，安装到 BB 的私有站点目录。不需要 OpenCLI、Browser Bridge 或修改 BB Browser 核心；需要 BB Browser 自己的已登录 X 浏览器会话。

## 安装

```sh
npm install -g bb-browser
git clone -b develop https://github.com/kerrmoulton/bb-sites.git
cd bb-sites
python3 tools/install.py
~/.local/bin/bb-xread tweets follow_clues --limit 20
```

已经安装 BB Browser 时可跳过第一行。Python 3.9+、Git 是安装前提；构建依赖不是安装前提，仓库包含构建好的适配器。Windows 可直接运行安装后的 `python <用户目录>/.bb-browser/x-read/xread.py ...`；本轮实测平台是 macOS，Windows 未验收。

develop安装器部署20个 `read-*.js`、YouTube字幕适配器、现有 `_helper.js` 和本地读取入口。更新已有文件前备份到 `~/.bb-browser/x-read-backups/`，并记录来源/哈希。不会复制登录态或修改 Chrome 配置。账号需要登录时请在 BB 浏览器手动登录 X。

后续更新自己的增强版：

```sh
cd bb-sites
git pull --ff-only
python3 tools/install.py
python3 tools/install.py --check
```

`bb-browser site update` 更新社区目录；本安装器写入私有 `~/.bb-browser/sites/`，因此社区更新不会覆盖这些文件。**调用增强版请使用 `bb-xread` 或 `twitter/read-*`。** 原来 `twitter/tweets` 等旧名字及返回结构保持原样；尤其旧 `twitter/following` 是主页关注流，增强版 `read-following` 是某用户的关注名单。

## 使用

如果 `~/.local/bin` 在PATH中，可直接写 `bb-xread`：

```sh
bb-xread profile follow_clues
bb-xread tweets follow_clues --limit 50
bb-xread search '#AI' --from follow_clues --product live --limit 3
bb-xread search 'from:follow_clues' --product photos --has images --exclude replies --limit 3
bb-xread collection follow_clues --until 2026-09-12T00:00:00Z --limit 100
bb-xread followers follow_clues --limit 5
bb-xread following follow_clues --limit 5
bb-xread bookmarks --limit 20
bb-xread bookmark-folders
bb-xread bookmark-folder FOLDER_ID --limit 20
bb-xread timeline --type following --limit 20
bb-xread download follow_clues --limit 1
bb-xread --help
```

`collection --until` 表示必须向过去翻到的下界，输出包含 `posts` 和 `receipt`，可能包含越过下界的一条旧帖。需要过去24小时精确结果时还应按 `created_at` 本地过滤。时间边界与固定条数不是同一覆盖保证。

直接执行BB命令时，站点参数必须放进一个JSON位置参数：

```sh
bb-browser site twitter/read-tweets '{"username":"follow_clues","limit":20}' --json > tweets.json
```

不要把适配器的 `--limit` / `--filter` 直接加到BB命令上，BB的全局参数解析会消费它们。`bb-xread` 自动处理转换。

## 能力

| 范围 | 命令 |
|---|---|
| 当前身份、用户资料 | whoami、profile |
| 用户帖子、时间边界采集 | tweets、collection |
| 搜索、hashtag、日期、图片/视频过滤 | search |
| 线程、回复、长文 | thread、article |
| 关注与关注者名单 | following、followers |
| 推荐/关注主页、趋势 | timeline、trending |
| 自建/订阅列表、列表帖子 | lists、list-tweets |
| 收藏、收藏夹及内容 | bookmarks、bookmark-folders、bookmark-folder |
| 喜欢、通知、device-follow聚合流 | likes、notifications、device-follow |
| 媒体URL发现 | download |

没有添加或执行发帖、点赞、收藏写入、关注等账号修改命令。

## 输出、失败与已知边界

- 入口先捕获到普通文件，再检查完整JSON、`ok`、数据结构和重复ID，避免BB大JSON管道截断及exit0误判。默认原始输出在 `~/.bb-browser/x-read/outputs/`，可用 `--save-raw NEW_FILE.json` 或 `BB_XREAD_OUTPUT_DIR` 更改。不会覆盖已有输出。
- 失败保留 `failure` 和可用的 `partial_data`；429退出75、空结果错误退出66、登录缺失退出77。没有自动重试或绕过配额。原始文件及summary同时保留。
- `limit`通常表示最多条数，短结果不能自动证明完整。搜索/主页连续空页或循环游标会明确中止，不把无限翻空页算成功。
- `download`只返回媒体地址和 `status: discovered`，没有二进制下载。收藏/喜欢的 `--resume-file` / `--output-file` 在浏览器适配器中明确拒绝，需外部归档层。它们不是SQLite缓存。
- 本机主对比：20条×5、50条×1两边完整且共同字段一致；预期非空的39次主测试修复版39次、OpenCLI35次得到数据。开发期间CSP、参数包装、通知超时、媒体DOM及真实429失败均单独留存，没有计作首次成功。此仓库不上传账号数据或原始日志。
- 通知最终3次HTTP200有效空结果，非空通知用离线fixture验证；收藏/收藏夹/喜欢/个人列表等非空实网样本不足。Following主页流观察到无新增页错误，非空流未验收。
- 未验证跨周无人值守、headless、Windows或100–300用户规模。两边解析逻辑大量共源，一致性不是独立全量真值。

## 修改与测试

所有浏览器适配器在 `twitter/read-*.js`，维护源码在 `tools/x-read/src/`。只修改源码后重建：

```sh
cd tools/x-read
npm ci
npm run build
npm test
python3 -m unittest discover -s tests -p '*_test.py'
```

`build.mjs`静态打包源代码并更新安装清单，不会触碰正在使用的浏览器。原始OpenCLI字符串eval已在实验中转换为函数，构建不依赖动态Function或CSP例外。源码和许可说明见[NOTICE](../tools/x-read/NOTICE.md)。修改后请运行安装器更新已安装的私有副本。
