"""Explicit local approval; credentials never enter URLs or browser storage."""
import re
import secrets
import time
import threading

class Pairing:
    def __init__(self):
        self.items={};self.tokens={};self.lock=threading.Lock()
    def request(self,origin):
        if not re.fullmatch(r'chrome-extension://[a-p]{32}',origin):raise ValueError('非有效扩展来源')
        with self.lock:
            self.items={k:v for k,v in self.items.items() if v['expires']>time.time()}
            if len(self.items)>=16:raise ValueError('配对请求过多')
            for k,v in self.items.items():
                if v['origin']==origin:return {'id':k,'origin':origin}
            key=secrets.token_urlsafe(32)
            approved=next((token for token,owner in self.tokens.items() if owner==origin),None)
            self.items[key]={'origin':origin,'expires':time.time()+600,'token':approved}
            return {'id':key,'origin':origin}
    def pending(self):
        with self.lock:return [{'id':k,'origin':v['origin']} for k,v in self.items.items() if v['expires']>time.time() and not v['token']]
    def approve(self,key):
        with self.lock:
            v=self.items.get(key)
            if not v or v['expires']<=time.time():raise ValueError('配对已过期')
            if not v['token']:
                v['token']=secrets.token_urlsafe(32);self.tokens[v['token']]=v['origin']
    def poll(self,key,origin):
        with self.lock:
            v=self.items.get(key)
            return v['token'] if v and v['origin']==origin and v['expires']>time.time() else None
    def valid(self,token,origin):
        with self.lock:return bool(token) and self.tokens.get(token)==origin
    def connected(self):
        with self.lock:
            return [{'origin': origin} for origin in sorted(set(self.tokens.values()))]
    def revoke(self,origin):
        if not re.fullmatch(r'chrome-extension://[a-p]{32}',str(origin)):
            raise ValueError('非有效扩展来源')
        with self.lock:
            self.tokens={key:value for key,value in self.tokens.items() if value!=origin}
            self.items={key:value for key,value in self.items.items() if value['origin']!=origin}
    def reject(self,key):
        with self.lock:
            item=self.items.get(key)
            if not item or item['token']:
                raise ValueError('请求已变化，请刷新后再处理')
            del self.items[key]
