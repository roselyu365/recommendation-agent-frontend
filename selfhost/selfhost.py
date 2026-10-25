"""Local setup / offline doctor / launch. No third-party Python dependencies."""
import argparse
import errno
import getpass
import json
import socket
import sys
from pathlib import Path
from local_config import ConfigError, config_path, initialize, model_config, weread_key

ROOT = Path(__file__).resolve().parent


def doctor():
    checks = []
    def check(name, ok, detail):
        checks.append({'name': name, 'ok': bool(ok), 'detail': detail})
    check('Python', sys.version_info >= (3, 10), '需要 Python 3.10 或更新版本')
    for name, load in [('微信读书授权', weread_key), ('模型授权', lambda: model_config()['key'])]:
        try:
            present = bool(load())
            check(name, present, '已配置（未联网验证）' if present else '缺少配置；运行 init')
        except ConfigError as error:
            check(name, False, str(error))
    try:
        for filename, key in [('data/book-profiles.json', 'books'), ('data/card-materials.json', 'cards')]:
            data = json.loads((ROOT / filename).read_text(encoding='utf-8'))
            if not isinstance(data.get(key), list) or not data[key]:
                raise ValueError()
        check('推荐资料', True, '内置有限样本，不是用户全书架或全库推荐')
    except (OSError, ValueError):
        check('推荐资料', False, '发行包缺少有效资料文件')
    manifest = ROOT / 'copy-event-probe/manifest.json'
    check('插件源码', manifest.is_file(), 'Chrome 加载 copy-event-probe 文件夹')
    with socket.socket() as connection:
        connection.settimeout(.2)
        try:
            result=connection.connect_ex(('127.0.0.1', 8769))
        except OSError:
            result=None
    available = False if result==0 else True if result in (errno.ECONNREFUSED,10061) else None
    detail='8769 已被占用：确认是自己的阅读服务，勿重复启动' if available is False else '8769 当前可用' if available else '端口检查受限或未完成，不能判断是否可用'
    check('本机端口', available is not None, detail)
    ready = all(item['ok'] for item in checks)
    return {'checks': checks, 'ready': ready, 'port_available': available,
            'can_start': ready and available is True,
            'network_verified': False, 'note': '离线检查不调用模型、不读取书架，也不证明授权有效。'}


def main():
    parser = argparse.ArgumentParser(description='SHU 阅读花园：开源自用准备工具')
    parser.add_argument('command', choices=('init', 'doctor', 'start'))
    args = parser.parse_args()
    try:
        if args.command == 'init':
            print('密钥只存本机，不会显示输入；模型请求会产生你的账号费用。')
            weread = getpass.getpass('微信读书 Key：').strip()
            key = getpass.getpass('OpenAI API Key：').strip()
            model = input('模型名称 [gpt-4.1-mini]：').strip() or 'gpt-4.1-mini'
            initialize(config_path(), weread, key, model)
            print('配置已保存（文件仅当前用户可读写）。下一步：python3 selfhost.py doctor')
        elif args.command == 'doctor':
            result = doctor()
            print(json.dumps(result, ensure_ascii=False, indent=2))
            return 0 if result['ready'] else 1
        else:
            if sys.version_info < (3, 10):
                raise ConfigError('需要 Python 3.10 或更新版本。')
            from server import Handler, ThreadingHTTPServer
            try:
                server = ThreadingHTTPServer(('127.0.0.1', 8769), Handler)
            except OSError:
                raise ConfigError('无法占用 8769 端口。若已启动阅读服务，请直接打开本机入口；不会终止其他进程。') from None
            print('阅读花园：http://127.0.0.1:8769/experience.html', flush=True)
            print('仅本机单用户。停止服务会清空书架快照和插件配对。按 Ctrl+C 停止。', flush=True)
            try:
                server.serve_forever()
            except KeyboardInterrupt:
                pass
            finally:
                server.server_close()
        return 0
    except (ConfigError, EOFError, KeyboardInterrupt) as error:
        print(str(error) if isinstance(error, ConfigError) else '操作已取消，未展示密钥。', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
