import json
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from eval_corpus import cases
from evaluate import percentile, prompt, translate, validate_endpoint


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_POST(self):
        self.rfile.read(int(self.headers["Content-Length"]))
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.end_headers()
        events = [{"choices": [{"delta": {"content": "Bonjour é"}}]},
                  {"choices": [{"delta": {}, "finish_reason": "length" if self.server.truncated else "stop"}]}]
        for event in events:
            self.wfile.write(("data: " + json.dumps(event, ensure_ascii=False) + "\n\n").encode())
        self.wfile.write(b"data: [DONE]\n\n")


class EvaluationTests(unittest.TestCase):
    def test_corpus_balanced_unique_nonempty(self):
        corpus = cases()
        self.assertEqual(len(corpus), 100)
        self.assertEqual(len({c["id"] for c in corpus}), 100)
        self.assertEqual(sum(c["targetLanguage"] == "fr" for c in corpus), 50)
        self.assertTrue(all(c["text"] and c["reference"] and c["origin"] == "synthetic" for c in corpus))

    def test_remote_endpoint_policy(self):
        self.assertEqual(validate_endpoint("http://127.0.0.1:8001/v1/"), "http://127.0.0.1:8001/v1")
        for bad in ("http://example.com/v1", "https://user:secret@example.com/v1", "https://example.com/v1?key=secret"):
            with self.assertRaises(ValueError):
                validate_endpoint(bad)

    def test_prompt_and_percentiles(self):
        self.assertIn("into French", prompt("hello", "fr"))
        self.assertIsNone(percentile([], .95))
        self.assertEqual(percentile([3, 1, 2], .5), 2)

    def test_stream_unicode_and_truncation(self):
        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            case = {"id": "test", "text": "Hello", "targetLanguage": "fr", "mustPreserve": []}
            endpoint = f"http://127.0.0.1:{server.server_port}"
            server.truncated = False
            good = translate(case, endpoint, "test-fixture", {})
            self.assertTrue(good["success"])
            self.assertEqual(good["output"], "Bonjour é")
            server.truncated = True
            bad = translate(case, endpoint, "test-fixture", {})
            self.assertFalse(bad["success"])
            self.assertEqual(bad["error"], "incomplete-generation")
        finally:
            server.shutdown()
            server.server_close()


if __name__ == "__main__":
    unittest.main()
