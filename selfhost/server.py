"""Local single-user reading demo. OCR stays local; explicit text requests use the configured model."""
import base64
import json
import os
from pathlib import Path
import secrets
import subprocess
import threading
import sys
from urllib.parse import urlsplit,parse_qs
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT))
from pairing import Pairing
from explain_jobs import ExplainJobs
PORT = 8769
ORIGIN = f"http://127.0.0.1:{PORT}"
TOKEN = secrets.token_urlsafe(32)
ENGINE = Path('/private/tmp/reader-highlight-spike/recognize')
SAMPLES = Path('/private/tmp/reader-highlight-spike')
LOCK = threading.Lock()
PAIRS=Pairing()
LATEST={}
API_LOCK=threading.Lock()
LIBRARY=None
EXPLAIN_JOBS=ExplainJobs()

def library():
    global LIBRARY
    if LIBRARY is None:
        from library_service import LibraryService
        LIBRARY=LibraryService()
    return LIBRARY

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args): pass

    def allowed(self):
        origin = self.headers.get('Origin', '')
        return self.headers.get('Host') == f'127.0.0.1:{PORT}' and (
            origin == ORIGIN or origin.startswith('chrome-extension://') or
            (not origin and self.headers.get('Sec-Fetch-Mode')=='navigate' and self.headers.get('Sec-Fetch-Dest')=='document' and urlsplit(self.path).path in ('/','/experience.html','/pair.html','/setup.html')) or
            (not origin and self.headers.get('Sec-Fetch-Site') in ('same-origin', 'none')))

    def local(self):
        return self.headers.get('Sec-Fetch-Site')=='same-origin' and self.headers.get('Origin',ORIGIN)==ORIGIN

    def authenticated(self):
        auth=self.headers.get('Authorization','')
        return secrets.compare_digest(auth,'Bearer '+TOKEN) or (auth.startswith('Bearer ') and PAIRS.valid(auth[7:],self.headers.get('Origin','')))

    def payload(self):
        if self.headers.get('Content-Type')!='application/json':raise ValueError('需要JSON请求')
        length=int(self.headers.get('Content-Length','0'))
        if not 0<length<12_000_000:raise ValueError('请求大小不允许')
        data=json.loads(self.rfile.read(length))
        if not isinstance(data,dict):raise ValueError('请求格式不正确')
        return data

    def respond(self, code, body, mime='application/json'):
        data = body if isinstance(body, bytes) else json.dumps(body, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header('Content-Type', mime)
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'no-referrer')
        if self.allowed():
            self.send_header('Access-Control-Allow-Origin', self.headers.get('Origin', ORIGIN))
            self.send_header('Vary', 'Origin')
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        if not self.allowed(): return self.respond(403, {'error':'来源不允许'})
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', self.headers.get('Origin', ORIGIN))
        self.send_header('Access-Control-Allow-Methods','POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers','Content-Type, Authorization')
        self.end_headers()

    def do_GET(self):
        if not self.allowed(): return self.respond(403, {'error':'仅本机访问'})
        path=urlsplit(self.path).path
        if path=='/health':
            return self.respond(200,{'application':'shu-reader','version':'0.4.0'})
        if path=='/api/explain-result':
            if not self.authenticated():return self.respond(403,{'error':'请先配对'})
            owner=(self.headers.get('Origin',''),self.headers.get('Authorization',''))
            return self.respond(200,EXPLAIN_JOBS.poll(parse_qs(urlsplit(self.path).query).get('id',[''])[0],owner))
        if path=='/pair/poll':
            key=parse_qs(urlsplit(self.path).query).get('id',[''])[0]
            token=PAIRS.poll(key,self.headers.get('Origin',''))
            return self.respond(200,{'token':token,'status':'paired' if token else 'pending'})
        if path=='/pair/pending':
            if not self.local() or not self.authenticated():return self.respond(403,{})
            return self.respond(200,{'requests':PAIRS.pending()})
        if path=='/pair/connections':
            if not self.local() or not self.authenticated():return self.respond(403,{})
            return self.respond(200,{'connections':PAIRS.connected()})
        if path in ('/api/shelf','/api/status','/api/capture'):
            if not self.authenticated():return self.respond(403,{'error':'请先配对'})
            if path=='/api/capture':return self.respond(200,LATEST)
            try:return self.respond(200,library().shelf() if path=='/api/shelf' else library().status())
            except Exception:return self.respond(503,{'error':'书架服务尚未就绪'})
        if self.path == '/session':
            if self.headers.get('Sec-Fetch-Site') != 'same-origin' or self.headers.get('Origin', ORIGIN) != ORIGIN:
                return self.respond(403, {'error':'请在本机测试页配对'})
            return self.respond(200, {'token':TOKEN})
        if self.path == '/':
            return self.respond(200,(ROOT/'workbench.html').read_bytes(),'text/html; charset=utf-8')
        if self.path == '/workbench.js':
            return self.respond(200,(ROOT/'workbench.js').read_bytes(),'text/javascript; charset=utf-8')
        assets={'/experience.html':'text/html; charset=utf-8','/experience.js':'text/javascript; charset=utf-8','/experience.css':'text/css; charset=utf-8','/pair.html':'text/html; charset=utf-8','/pair.js':'text/javascript; charset=utf-8'}
        assets.update({'/setup.html':'text/html; charset=utf-8','/setup.js':'text/javascript; charset=utf-8','/setup.css':'text/css; charset=utf-8'})
        if path=='/art/reading-garden-v3.jpg':
            return self.respond(200,(ROOT/'art/reading-garden-v3.jpg').read_bytes(),'image/jpeg')
        if self.path in assets and (ROOT/self.path[1:]).is_file():
            return self.respond(200,(ROOT/self.path[1:]).read_bytes(),assets[self.path])
        if self.path.startswith('/sample/'):
            if self.headers.get('Sec-Fetch-Site') != 'same-origin': return self.respond(403, {})
            name=self.path[len('/sample/'):]
            if name in ('actual-selection.png','multiline.png','long.png','light.png','occluded.png','none.png'):
                path=SAMPLES/name
                if path.is_file():
                    raw=path.read_bytes()
                    return self.respond(200,raw,'image/jpeg' if raw.startswith(b'\xff\xd8\xff') else 'image/png')
        return self.respond(404, {'error':'没有此资源'})

    def do_POST(self):
        if not self.allowed():return self.respond(403,{'error':'来源不允许'})
        if self.path=='/connection/status':
            origin=self.headers.get('Origin','')
            if not origin.startswith('chrome-extension://'):return self.respond(403,{})
            paired=self.authenticated()
            approved=any(item['origin']==origin for item in PAIRS.connected())
            return self.respond(200,{'service':True,'paired':paired,'approved':approved})
        if self.path=='/pair/request':
            try:return self.respond(200,PAIRS.request(self.headers.get('Origin','')))
            except ValueError as e:return self.respond(400,{'error':str(e)})
        if self.path=='/pair/poll':
            try:
                key=self.payload().get('id','')
                if not isinstance(key,str):raise ValueError()
                token=PAIRS.poll(key,self.headers.get('Origin',''))
                return self.respond(200,{'token':token,'status':'paired' if token else 'pending'})
            except (ValueError,TypeError):return self.respond(400,{'error':'配对请求格式不正确'})
        if not self.authenticated():
            return self.respond(403, {'error':'请在本机测试页获取配对码'})
        if self.path=='/pair/disconnect':
            origin=self.headers.get('Origin','')
            if not origin.startswith('chrome-extension://'):return self.respond(403,{})
            PAIRS.revoke(origin)
            return self.respond(200,{'disconnected':True})
        if self.path in ('/pair/revoke','/pair/reject'):
            if not self.local():return self.respond(403,{})
            try:
                data=self.payload()
                if self.path=='/pair/revoke':PAIRS.revoke(data.get('origin'))
                else:PAIRS.reject(data.get('id'))
                return self.respond(200,{'updated':True})
            except (TypeError,ValueError):return self.respond(400,{'error':'连接请求已变化或格式错误，请刷新后重试'})
        if self.path=='/api/explain-result':
            try:
                key=self.payload().get('id','')
                if not isinstance(key,str):raise ValueError()
                owner=(self.headers.get('Origin',''),self.headers.get('Authorization',''))
                return self.respond(200,EXPLAIN_JOBS.poll(key,owner))
            except (ValueError,TypeError):return self.respond(400,{'error':'任务格式不正确'})
        if self.path=='/api/explain-start':
            try:
                data=self.payload()
                text=data.get('text','');question=data.get('question','');mode=data.get('mode','')
                if not isinstance(text,str) or not 1<=len(text.strip())<=5000:raise ValueError()
                if mode not in ('understand','question') or not isinstance(question,str) or len(question)>1500:raise ValueError()
                if mode=='question' and not question.strip():raise ValueError()
            except (ValueError,TypeError):return self.respond(400,{'error':'原文或问题格式不正确'})
            if not API_LOCK.acquire(blocking=False):return self.respond(429,{'error':'上一项操作还在进行，请稍后再试'})
            def work():
                try:return library().explain(text,str(data.get('book_title',''))[:200],mode,question)
                finally:API_LOCK.release()
            try:
                owner=(self.headers.get('Origin',''),self.headers.get('Authorization',''))
                job=EXPLAIN_JOBS.start(owner,work)
            except Exception:
                API_LOCK.release()
                return self.respond(503,{'error':'任务暂时无法启动'})
            return self.respond(202,{'job':job,'status':'pending'})
        if self.path=='/pair/approve':
            if not self.local():return self.respond(403,{})
            try:PAIRS.approve(self.payload().get('id'));return self.respond(200,{'approved':True})
            except ValueError as e:return self.respond(400,{'error':str(e)})
        if self.path in ('/api/shelf-sync','/api/recommend','/api/explain'):
            try:data=self.payload()
            except (ValueError,TypeError):return self.respond(400,{'error':'请求格式错误'})
            if not API_LOCK.acquire(blocking=False):return self.respond(429,{'error':'上一项操作还在进行，请稍后再试'})
            try:
                svc=library()
                if self.path=='/api/shelf-sync':result=svc.sync_shelf()
                elif self.path=='/api/recommend':result=svc.recommend(data.get('query',''))
                else:result=svc.explain(data.get('text',''),data.get('book_title',''),data.get('mode','understand'),data.get('question',''))
                return self.respond(200,result)
            except Exception as e:
                from library_service import LibraryError
                return self.respond(503,{'error':str(e) if isinstance(e,LibraryError) else '服务暂时无法完成，未返回模拟结果'})
            finally:API_LOCK.release()
        if self.path=='/api/capture':
            try:
                data=self.payload();text=data.get('text','')
                if not isinstance(text,str) or len(text)>12000:raise ValueError()
                LATEST.clear();LATEST.update({'text':text,'book_title':str(data.get('book_title',''))[:200],'source':'user-corrected-extension'})
                return self.respond(200,{'saved':True})
            except (ValueError,TypeError):return self.respond(400,{'error':'原文格式不正确'})
        if self.path != '/recognize': return self.respond(404, {})
        if self.headers.get('Content-Type') != 'application/json': return self.respond(415, {})
        try:
            length=int(self.headers.get('Content-Length','0'))
            if not 0<length<12_000_000: return self.respond(413, {'error':'截图过大'})
            payload=json.loads(self.rfile.read(length))
            image=payload['image']
            if not isinstance(image,str) or not image.startswith(('data:image/png;base64,','data:image/jpeg;base64,')): raise ValueError()
            raw=base64.b64decode(image.split(',',1)[1],validate=True)
            if not raw.startswith((b'\x89PNG\r\n\x1a\n',b'\xff\xd8\xff')): raise ValueError()
        except (ValueError, KeyError, TypeError): return self.respond(400, {'error':'截图格式不正确'})
        if not LOCK.acquire(blocking=False): return self.respond(429, {'error':'正在识别另一张截图，请稍后重试'})
        try:
            result=subprocess.run([str(ENGINE)],input=raw,capture_output=True,timeout=35)
            if result.returncode: return self.respond(503, {'error':'本机识别未完成，未返回替代文字'})
            output=json.loads(result.stdout)
            if self.headers.get('Origin','').startswith('chrome-extension://'):
                LATEST.clear();LATEST.update({'text':output.get('text',''),'book_title':str(payload.get('book_title',''))[:200],'status':output.get('status'),'source':'extension-ocr'})
            return self.respond(200,output)
        except (OSError,ValueError,subprocess.TimeoutExpired):
            return self.respond(503, {'error':'本机识别服务不可用或超时'})
        finally: LOCK.release()

if __name__ == '__main__':
    # Clipboard companion does not need the optional screenshot OCR executable.
    print(f'实验测试页：{ORIGIN}（仅本机；截图不上传云端）',flush=True)
    ThreadingHTTPServer(('127.0.0.1',PORT),Handler).serve_forever()
