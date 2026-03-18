from flask import Flask, render_template, request, jsonify
import subprocess
from parser import parse_wikipedia

app = Flask(__name__)

# Simple in-memory history (last 10 articles)
history = []

@app.route('/')
def index():
    return render_template('index.html', history=history)

@app.route('/read')
def read():
    url = request.args.get('url', '').strip()
    if not url:
        return render_template('index.html', error="No URL provided.", history=history)

    # Ensure it's a wikipedia URL
    if 'wikipedia.org' not in url:
        return render_template('index.html', error="Only Wikipedia URLs are supported.", history=history)

    article, error = parse_wikipedia(url)
    if error or not article:
        return render_template('index.html', error=f"Could not fetch article: {error}", history=history)

    # Track history (avoid duplicates)
    existing = next((h for h in history if h['url'] == url), None)
    if not existing:
        history.insert(0, {"title": article["title"], "url": url})
        if len(history) > 10:
            history.pop()

    return render_template('reader.html', article=article)

@app.route('/speak', methods=['POST'])
def speak():
    data = request.get_json()
    text = data.get('text', '').strip()
    if not text:
        return jsonify({"status": "error", "message": "No text provided"}), 400

    try:
        subprocess.Popen(['termux-tts-speak', text])
        return jsonify({"status": "ok"})
    except FileNotFoundError:
        # Fallback for testing on desktop (not in Termux)
        return jsonify({"status": "desktop", "message": "termux-tts-speak not available (desktop mode)"})

@app.route('/stop', methods=['POST'])
def stop():
    # Stop speech by speaking a space — Termux TTS quirk
    try:
        subprocess.run(['termux-tts-speak', ' '], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except FileNotFoundError:
        pass
    return jsonify({"status": "ok"})

if __name__ == '__main__':
    # Run on all interfaces so the phone can reach it on the LAN
    app.run(host='0.0.0.0', port=5000, debug=False)
