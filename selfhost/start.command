#!/bin/zsh
set -eu
cd "${0:A:h}"
if ! command -v python3 >/dev/null 2>&1; then
  print '需要 Python 3.10 或更新版本。请从 https://www.python.org/downloads/ 安装后再试。'
  read '?按回车关闭窗口。'
  exit 1
fi
python3 launch.py || { read '?启动未完成，请阅读上方提示。按回车关闭。'; exit 1; }
