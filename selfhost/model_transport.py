"""Hard wall-clock model request deadline; no credentials in command arguments/logs."""
import contextvars
import functools
import json
import multiprocessing
import time
import urllib.request

_deadline = contextvars.ContextVar('model_deadline', default=None)


def model_budget(seconds):
    def decorate(fn):
        @functools.wraps(fn)
        def wrapped(*args, **kwargs):
            old = _deadline.get()
            limit = time.monotonic() + seconds
            token = _deadline.set(min(old, limit) if old else limit)
            try:
                return fn(*args, **kwargs)
            finally:
                _deadline.reset(token)
        return wrapped
    return decorate


def remaining_seconds(cap):
    deadline = _deadline.get()
    remaining = min(cap, deadline-time.monotonic()) if deadline else cap
    if remaining <= 0:
        raise TimeoutError('模型等待已超时')
    return remaining


def _fetch(connection, url, data, headers, timeout):
    try:
        request = urllib.request.Request(url, data=data, headers=headers)
        with urllib.request.urlopen(request, timeout=timeout) as response:
            raw = response.read(2_000_001)
        if len(raw) > 2_000_000:
            raise ValueError('response too large')
        connection.send(('ok', json.loads(raw)))
    except Exception:
        connection.send(('error', None))
    finally:
        connection.close()


def request_json(url, data, headers, timeout=60):
    timeout = remaining_seconds(timeout)
    end = time.monotonic() + timeout
    ctx = multiprocessing.get_context('spawn')
    receiver, sender = ctx.Pipe(duplex=False)
    process = ctx.Process(target=_fetch, args=(sender, url, data, headers, timeout), daemon=True)
    process.start()
    sender.close()
    try:
        if not receiver.poll(max(0, end-time.monotonic())):
            raise TimeoutError('模型等待已超时；未自动重试')
        state, result = receiver.recv()
        if state != 'ok':
            raise RuntimeError('模型请求失败')
        return result
    finally:
        receiver.close()
        if process.is_alive():
            process.terminate()
        process.join(1)
        if process.is_alive():
            process.kill(); process.join(1)
