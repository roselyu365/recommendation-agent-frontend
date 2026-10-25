"""Memory-only, owner-bound jobs for explicit companion requests."""
import secrets
import threading
import time
from library_service import LibraryError

class ExplainJobs:
    def __init__(self, timeout=95, clock=time.monotonic):
        self.timeout=timeout
        self.clock=clock
        self.items={}
        self.threads={}
        self.lock=threading.Lock()

    def start(self,owner,work):
        with self.lock:
            for key in list(self.items):
                if self.items[key]["expires"]<self.clock():
                    self.items.pop(key)
                    self.threads.pop(key,None)
            if len(self.items)>=32:raise ValueError("任务较多，请稍后重试")
            key=secrets.token_urlsafe(24)
            self.items[key]={"owner":owner,"expires":self.clock()+900,"deadline":self.clock()+self.timeout,"response":{"status":"pending"}}
            def run():
                try:response={"status":"done","result":work()}
                except LibraryError as error:response={"status":"failed","error":str(error)}
                except Exception:response={"status":"failed","error":"本次解析未完成或未通过内容检查，请稍后重试。"}
                with self.lock:
                    if key in self.items:
                        item=self.items[key]
                        self._expire(item)
                        if item['response']['status']=='pending':item['response']=response
            thread=threading.Thread(target=run,daemon=True)
            self.threads[key]=thread
            thread.start()
        return key

    def poll(self,key,owner):
        with self.lock:
            item=self.items.get(key)
            if not item or item["owner"]!=owner or item["expires"]<self.clock():
                return {"status":"missing"}
            self._expire(item)
            return item["response"]

    def _expire(self,item):
        if item['response']['status']=='pending' and self.clock()>=item['deadline']:
            item['response']={'status':'failed','error':'等待已超时，已停止本次等待；未自动重试，请稍后再试。'}
