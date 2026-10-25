"""Interactive launcher for the downloaded single-user preview."""
import argparse
import json
from pathlib import Path
import socket
import subprocess
import sys
import time
import urllib.request
import webbrowser
from local_config import ConfigError, model_config, weread_key

ROOT=Path(__file__).resolve().parent
URL='http://127.0.0.1:8769/setup.html'


def running_reader():
    try:
        request=urllib.request.Request('http://127.0.0.1:8769/health',headers={'Sec-Fetch-Site':'same-origin'})
        with urllib.request.urlopen(request,timeout=.5) as response:
            data=json.loads(response.read(2000))
        return data.get('application')=='shu-reader' and data.get('version')=='0.4.0'
    except Exception:
        return False


def configured():
    try:return bool(weread_key() and model_config()['key'])
    except ConfigError:return False


def main():
    parser=argparse.ArgumentParser(description='启动阅读花园；首次使用在本机配置自己的Key')
    parser.add_argument('--no-browser',action='store_true')
    args=parser.parse_args()
    if sys.version_info<(3,10):
        print('需要Python 3.10或更新版本，请从python.org安装。',flush=True)
        return 1
    if running_reader():
        print('阅读花园已在运行：'+URL,flush=True)
        if not args.no_browser:webbrowser.open(URL)
        return 0
    # Probe availability before asking for keys; never stop another process.
    with socket.socket() as probe:
        try:probe.bind(('127.0.0.1',8769))
        except OSError:
            print('8769端口被其他服务或旧版占用。请先确认并关闭原阅读服务，再重新启动；不会自动结束进程。',flush=True)
            return 1
    if not configured():
        print('首次使用：请在本机终端输入自己的微信读书Key与OpenAI API Key。输入不会显示，也不会上传到展示页。',flush=True)
        result=subprocess.run([sys.executable,str(ROOT/'selfhost.py'),'init'])
        if result.returncode:return result.returncode
    process=subprocess.Popen([sys.executable,str(ROOT/'selfhost.py'),'start'],cwd=ROOT)
    try:
        end=time.monotonic()+8
        while process.poll() is None and time.monotonic()<end:
            if running_reader():
                print('已就绪。请保持此窗口运行；按Ctrl+C停止。',flush=True)
                if not args.no_browser:webbrowser.open(URL)
                return process.wait()
            time.sleep(.2)
        print('服务未在预期时间内就绪，请查看上方提示；没有调用模型。',flush=True)
        return 1
    except KeyboardInterrupt:
        return 0
    finally:
        if process.poll() is None:
            process.terminate()
            process.wait(timeout=5)


if __name__=='__main__':
    sys.exit(main())
