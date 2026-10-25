"""Portable single-user configuration. Never include credentials in diagnostics."""
import json
import os
from pathlib import Path


class ConfigError(ValueError):
    pass


def config_path():
    return Path(os.environ.get('SHU_CONFIG', str(Path.home() / '.config/shu-reader/config.json'))).expanduser()


def read_settings():
    path = config_path()
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding='utf-8'))
        if not isinstance(data, dict):
            raise ValueError()
        return data
    except (OSError, ValueError):
        raise ConfigError('本地配置无法读取，请运行 python3 selfhost.py doctor 检查。') from None


def _secret(env_name, field):
    value = os.environ.get(env_name)
    if value is None:
        settings = read_settings()
        file_name = os.environ.get('SHU_WEREAD_KEY_FILE') if field == 'weread_key_file' else None
        file_name = file_name or settings.get(field)
        if not file_name:
            return ''
        try:
            path = Path(file_name).expanduser()
            if not path.is_absolute():
                path = config_path().parent / path
            if path.stat().st_size > 8192:
                raise ValueError()
            value = path.read_text(encoding='utf-8').strip()
        except (OSError, ValueError, TypeError):
            raise ConfigError('授权文件无法读取，请重新配置；未显示文件内容。') from None
    if not isinstance(value, str) or len(value) > 8192 or any(c.isspace() for c in value):
        raise ConfigError('授权内容格式不正确，请重新配置；不要填入说明文字。')
    return value


def weread_key():
    return _secret('SHU_WEREAD_API_KEY', 'weread_key_file')


def model_config():
    settings = read_settings()
    model = os.environ.get('SHU_MODEL') or settings.get('model') or 'gpt-4.1-mini'
    if not isinstance(model, str) or not model.strip() or len(model) > 150:
        raise ConfigError('模型名称格式不正确。')
    return {'key': _secret('OPENAI_API_KEY', 'openai_key_file'), 'model': model,
            'timeout_seconds': 60}


def initialize(path, weread, model_key, model):
    """Interactive caller provides secrets; refuse overwrites and symlinks."""
    path = Path(path).expanduser().absolute()
    for value in (weread, model_key):
        if not isinstance(value, str) or not value or len(value) > 8192 or any(c.isspace() for c in value):
            raise ConfigError('Key 不能为空或包含空白字符，未写入配置。')
    if not isinstance(model, str) or not model.strip() or len(model) > 150:
        raise ConfigError('模型名称格式不正确，未写入配置。')
    files = [path.parent / 'weread-key', path.parent / 'openai-key', path]
    if any(p.exists() or p.is_symlink() for p in files):
        raise ConfigError('配置或授权文件已存在；不会覆盖。可用 SHU_CONFIG 指定另一个独立目录。')
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    contents = [weread, model_key, json.dumps({'weread_key_file': 'weread-key',
                'openai_key_file': 'openai-key', 'model': model.strip()}, ensure_ascii=False, indent=2)]
    try:
        for target, content in zip(files, contents):
            fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(fd, 'w', encoding='utf-8') as stream:
                stream.write(content + '\n')
    except OSError:
        raise ConfigError('配置未完整写入，请检查目录权限；已存在的文件不会覆盖。') from None
    return path
