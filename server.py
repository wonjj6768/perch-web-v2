"""
Perch Web - 개발 서버
로컬 개발용 HTTPS/HTTP 서버

사용법:
    python server.py          # HTTPS (localhost:8000)
    python server.py --http   # HTTP (localhost:8000)
"""

import argparse
import http.server
import logging
import os
import ssl
import sys
from pathlib import Path
from typing import Optional, Tuple

# ============================================
# 설정
# ============================================

DEFAULT_PORT = 8000
SSL_DIR = ".ssl"
CERT_FILE = "cert.pem"
KEY_FILE = "key.pem"

MIME_TYPES = {
    ".wasm": "application/wasm",
    ".json": "application/json",
    ".js": "application/javascript",
    ".mjs": "application/javascript",
    ".css": "text/css",
    ".html": "text/html",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".webp": "image/webp",
    ".onnx": "application/octet-stream",
}

# ============================================
# 로깅
# ============================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


# ============================================
# SSL 인증서
# ============================================


def create_self_signed_cert(base_dir: Path) -> Tuple[Optional[str], Optional[str]]:
    """자체 서명 인증서 생성/로드"""
    try:
        from OpenSSL import crypto
    except ImportError:
        logger.warning("pyOpenSSL 미설치 (pip install pyopenssl)")
        return None, None

    cert_dir = base_dir / SSL_DIR
    cert_dir.mkdir(exist_ok=True)
    cert_file = cert_dir / CERT_FILE
    key_file = cert_dir / KEY_FILE

    if cert_file.exists() and key_file.exists():
        return str(cert_file), str(key_file)

    # 1년 유효 인증서 생성
    key = crypto.PKey()
    key.generate_key(crypto.TYPE_RSA, 2048)

    cert = crypto.X509()
    cert.get_subject().CN = "localhost"
    cert.set_serial_number(1000)
    cert.gmtime_adj_notBefore(0)
    cert.gmtime_adj_notAfter(365 * 24 * 60 * 60)
    cert.set_issuer(cert.get_subject())
    cert.set_pubkey(key)
    cert.sign(key, "sha256")

    with open(cert_file, "wb") as f:
        f.write(crypto.dump_certificate(crypto.FILETYPE_PEM, cert))

    with open(key_file, "wb") as f:
        f.write(crypto.dump_privatekey(crypto.FILETYPE_PEM, key))

    logger.info(f"인증서 생성 완료: {cert_dir}")
    return str(cert_file), str(key_file)


# ============================================
# 핸들러
# ============================================


class CORSRequestHandler(http.server.SimpleHTTPRequestHandler):
    """CORS 및 보안 헤더 설정"""

    def __init__(self, *args, directory: Optional[str] = None, **kwargs):
        self.directory = directory
        super().__init__(*args, directory=directory, **kwargs)

    def end_headers(self) -> None:
        # CORS
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

        # SharedArrayBuffer (ONNX Runtime)
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")

        # 캐시 설정
        if self.path.endswith(".onnx"):
            self.send_header("Cache-Control", "public, max-age=31536000, immutable")
        else:
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")

        super().end_headers()

    def guess_type(self, path: str) -> str:
        ext = os.path.splitext(path)[1].lower()
        if ext in MIME_TYPES:
            return MIME_TYPES[ext]
        return super().guess_type(path)

    def do_OPTIONS(self) -> None:
        self.send_response(200)
        self.end_headers()

    def log_message(self, format: str, *args) -> None:
        logger.info(f"{self.address_string()} - {format % args}")


# ============================================
# 서버
# ============================================


class DevServer:
    def __init__(self, port: int = DEFAULT_PORT, use_https: bool = True):
        self.port = port
        self.use_https = use_https
        self.base_dir = Path(__file__).parent
        self.web_dir = self.base_dir / "web"
        self.server = None

    def validate(self) -> bool:
        if not self.web_dir.exists():
            logger.error(f"디렉토리 없음: {self.web_dir}")
            return False
        return True

    def setup_ssl(self) -> Optional[ssl.SSLContext]:
        if not self.use_https:
            return None

        cert_file, key_file = create_self_signed_cert(self.base_dir)
        if not cert_file or not key_file:
            logger.warning("HTTP 모드로 전환")
            return None

        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain(cert_file, key_file)
        return context

    def run(self) -> None:
        if not self.validate():
            sys.exit(1)

        os.chdir(self.web_dir)

        handler = lambda *args, **kwargs: CORSRequestHandler(
            *args, directory=str(self.web_dir), **kwargs
        )

        self.server = http.server.HTTPServer(("", self.port), handler)
        protocol = "http"

        ssl_context = self.setup_ssl()
        if ssl_context:
            self.server.socket = ssl_context.wrap_socket(
                self.server.socket, server_side=True
            )
            protocol = "https"

        self._print_banner(protocol)

        try:
            self.server.serve_forever()
        except KeyboardInterrupt:
            self.server.shutdown()
            print("\n서버 종료")

    def _print_banner(self, protocol: str) -> None:
        print("\nPerch Web 개발 서버")
        print(f"주소: {protocol}://localhost:{self.port}")
        print("종료: Ctrl+C\n")

        if protocol == "https":
            print("주의: 자체 서명 인증서 사용됨")


# ============================================
# 메인
# ============================================


def main():
    parser = argparse.ArgumentParser(description="Perch Web 개발 서버")
    parser.add_argument("--port", "-p", type=int, default=DEFAULT_PORT, help="포트")
    parser.add_argument("--http", action="store_true", help="HTTP 강제 사용")

    args = parser.parse_args()

    server = DevServer(port=args.port, use_https=not args.http)
    server.run()


if __name__ == "__main__":
    main()

