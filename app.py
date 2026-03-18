from flask import Flask, render_template, request, jsonify
import os
from dotenv import load_dotenv
import google.generativeai as genai
from parser import parse_wikipedia

load_dotenv()

# Configure Google Gemini
gemini_key = os.environ.get("GEMINI_API_KEY")
if gemini_key:
    genai.configure(api_key=gemini_key)

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

@app.route('/api/summarize', methods=['POST'])
def summarize():
    if not gemini_key:
        return jsonify({"status": "error", "message": "Google Gemini API key not found in .env file."}), 401

    data = request.get_json()
    text = data.get('text', '').strip()
    
    if not text:
        return jsonify({"status": "error", "message": "No article text provided for summarization."}), 400

    prompt = (
        "You are an expert synthesizer. Read the following article content and provide:\n"
        "1. Exactly 3 general bullet points summarizing it.\n"
        "2. A heuristic or mnemonic to help memorize it (or a highly creative third option to aid memory).\n"
        "Output ONLY the bullet points and the mnemonic, keep it very concise and punchy.\n\n"
        f"Article:\n{text[:15000]}" # Limiting text just in case of massive articles
    )

    try:
        model = genai.GenerativeModel('gemini-1.5-flash-latest')
        response = model.generate_content(prompt)
        
        # Split output into an array of paragraphs so it's easily consumed by the UI TTS loop
        paragraphs = [p.strip() for p in response.text.split('\n\n') if p.strip()]
        
        return jsonify({"status": "ok", "summary": paragraphs})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == '__main__':
    # Run on all interfaces so the phone can reach it on the LAN
    app.run(host='0.0.0.0', port=5000, debug=False)
