
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import os

# Directory containing this script
BASE_DIR = Path(__file__).resolve().parent

class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        # Serve index.html for all encoded game URLs
        if self.path.startswith("/0/"):
            self.path = "/index.html"

        return super().do_GET()


if __name__ == "__main__":
    os.chdir(BASE_DIR)

    server = ThreadingHTTPServer(
        ("localhost", 8000),
        Handler
    )

    print("Server running at http://localhost:8000")
    print("Press Ctrl+C to stop")

    server.serve_forever()
