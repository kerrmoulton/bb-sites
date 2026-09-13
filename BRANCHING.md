# Fork 分支约定

- `main`：上游 `epiral/bb-sites/main` 的镜像，不放本 fork 的开发提交。
- `develop`：本 fork 默认开发和安装分支，汇总自己的改动与经过检查的上游更新。
- `feat/*` / `fix/*`：单项改动，验证后合入 `develop`。

本次建立顺序：从X改进之前的main（f0cdfbf）建立develop → 合并YouTube分支 → 合并本次X提交 → 将main同步到上游 → 把同步后的main合入develop。

当前 `develop` 包含原 YouTube 字幕 API 修改（25324e9）、增强 X 只读套件（6c51425），以及合并时最新上游main。原feature分支和提交历史保留。YouTube源文件按原分支合并；这次分支整合未重新做YouTube实网稳定性测试。

## 安装与更新

```sh
git clone -b develop https://github.com/kerrmoulton/bb-sites.git
cd bb-sites
python3 tools/install.py
```

安装20个X只读适配器、YouTube字幕适配器和 `bb-xread` 入口。更新时在 `develop` 执行 `git pull --ff-only`，再运行安装器。旧文件先备份，浏览器登录态不迁移。

已有本fork checkout从main切换：

```sh
git fetch origin
git switch develop
git pull --ff-only
python3 tools/install.py
```

X增强命令使用 `bb-xread` 或 `twitter/read-*`；YouTube保留 `youtube/transcript` 名字，需先在BB浏览器打开目标视频并使用已有YouTube登录态。

## 同步上游main

在工作区干净时执行，所有push均明确指向自己的fork：

```sh
git fetch upstream
git switch main
git merge --ff-only upstream/main
git push origin main
git switch develop
```

main若意外出现自己的提交，`--ff-only`会停止。先将改动保存在feature/develop，再处理main，避免丢失工作。不要将develop合回main。

## 定期把上游改进整合到develop

```sh
git switch develop
git pull --ff-only origin develop
git merge main
cd tools/x-read
npm ci
npm run build
npm test
python3 -m unittest discover -s tests -p '*_test.py'
cd ../..
```

检查冲突与生成文件差异；有必要的构建变化应提交，然后 `git push origin develop`、`python3 tools/install.py`。保留合并历史，不对共享develop反复rebase或强推。

这里规定的是同步流程，并未建立定时任务或自动轮询。main和上游只在最近一次同步时保持一致，需要后续再次同步才能获得新提交。GitHub默认分支设为develop；操作Sync fork或新建PR时要确认目标分支，不要把自己的开发提交丢掉。

## 本次整合验证

X适配器17项与安装/输出7项测试通过；YouTube文件与原feature分支逐字一致，函数语法检查通过，未重做实网字幕测试。上游新增 `test/stage3-envelope-pilots.test.mjs` 需要单独配置 `PINIX_EDGE_REPO`，当前本机缺少这个外部测试环境，未运行通过。
