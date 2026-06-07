#!/usr/bin/env python3
import http.server
import os, sys, socket

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
DIR = os.path.dirname(os.path.abspath(__file__))

class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=DIR, **kw)
    def do_GET(self):
        p = self.path.split('?')[0].rstrip('/')
        fp = os.path.join(DIR, p.lstrip('/'))
        if not p or p == '/' or '.' in p or os.path.isfile(fp):
            return super().do_GET()
        slug = p.lstrip('/')
        if slug:
            self.send_response(302)
            self.send_header('Location', '/viewer.html?slug=' + slug)
            self.end_headers()
            return
        return super().do_GET()

s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
s.bind(('0.0.0.0', PORT))
s.listen(5)
httpd = http.server.HTTPServer(('0.0.0.0', PORT), H, bind_and_activate=False)
httpd.socket = s
httpd.server_bind = lambda: None
httpd.server_activate()
print('Server on port', PORT)
sys.stdout.flush()
httpd.serve_forever()
