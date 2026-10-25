# SHU 枢点 · 阅读花园

从此刻的心情选书，在微信读书的文字旁展开陪读。

**[项目展示](https://roselyu365.github.io/recommendation-agent-frontend/) · [开始体验](https://roselyu365.github.io/recommendation-agent-frontend/get-started.html) · [下载自用预览版](https://github.com/roselyu365/recommendation-agent-frontend/releases/tag/v0.4.0-preview.1)**

## 想体验真实功能？

1. 下载Release中的 `shu-reader-0.4.0-preview.zip`，完整解压。
2. 安装Python 3.10+。Mac打开 `start.command`，Windows打开 `start.bat`；或在解压目录终端运行 `python3 launch.py`（Windows可用 `py -3 launch.py`）。
3. 在本机终端配置**自己的**微信读书Skills Key和OpenAI API Key。密钥不在网页填写，输入不回显。模型费用由自己的API账号承担。
4. Chrome加载解压目录里的 `copy-event-probe`，按自动打开的本机引导页完成连接。
5. 同步自己的书架，打开微信读书网页版，选一段文字后点击插件，使用看懂、批注与自由提问。

**完整步骤与排障：[INSTALL.md](https://github.com/roselyu365/recommendation-agent-frontend/blob/gh-pages/INSTALL.md)**

## 源码在哪里？

当前可安装预览版源码位于 [`gh-pages/selfhost`](https://github.com/roselyu365/recommendation-agent-frontend/tree/gh-pages/selfhost)。Release ZIP包含同一批运行源码，不依赖作者的其他仓库或账号。

默认分支的 `src/` 是较早的React原型，不是当前安装入口。不要按照旧React开发步骤启动本版。

## 当前范围

- 自己的微信读书书架、封面、部分进度与阅读链接。
- 场景适配推荐仍为13本固定资料，其中3本可生成完整卡片；不是全库推荐。
- 桌面Chrome一次点击取文、可编辑原文、主动模型陪读；背景采用两条预审材料。
- 本机批注查看、搜索、导出与确认删除；不同用户请用独立Chrome资料夹。

这是自用预览版，尚未完成第二位用户从零安装的真实授权验收。Windows入口尚未实机验收，手机App暂不支持。自动检查不能代替真实账号验收。

## 数据与许可

发布物不包含作者Key、私人书架、笔记、进度、浏览器资料或模型日志。不要在Issue、聊天或GitHub中上传密钥。
程序只在本机保存授权；明确点击模型功能后才发送相应选段至OpenAI。
正式代码许可证仍待确定；第三方封面、引文与作品内容不因预览发布而获得自由再分发许可，详见 [`MATERIALS.md`](https://github.com/roselyu365/recommendation-agent-frontend/blob/gh-pages/selfhost/MATERIALS.md)。
