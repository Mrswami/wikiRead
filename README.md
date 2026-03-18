# 📖 wikiRead

**wikiRead** is a native-feeling, open-learning Wikipedia reader built specifically for Android power users who leverage **Termux**. It intercepts Wikipedia URLs shared from your browser or the official Wikipedia app, immediately spinning up a local Flask server to render a beautiful, distraction-free "listening" UI straight to your browser.

## 🚀 How It Works (The Magic)

Behind the scenes, wikiRead turns your local Termux environment into a powerful micro-backend:

1. **The Interception (`termux-url-opener`)**: When you share a Wikipedia URL to Termux, our custom `termux-url-opener` shell script intercepts it. It reliably parses the URL (even if the Wikipedia app appends extra text) and ensures safe execution formatting. 
2. **The Server (`app.py` & `parser.py`)**: The bash script quietly launches a lightweight Python **Flask web server** in the background on port `5000`. This Flask server acts as the central engine.
3. **Clean HTML Extraction**: Instead of trying to parse messy, bloated desktop Wikipedia HTML, the Flask server pings the **Wikipedia REST API**, which returns incredibly fast, clean HTML broken out by sections. We strip away references, see-also sections, and citations, retaining only the text you actually care about—and its accompanying images.
4. **The UI Delivery**: The bash script immediately launches your default Android browser pointing to `localhost:5000/read?url=...` 
5. **The Web Speech API Integration**: Once the page loads, the heavy lifting of Text-to-Speech is passed entirely to the JavaScript running in your browser, utilizing the native **Web Speech API**. This brings incredible native-app features:
   - **Zero Latency**: Instant play, pause, and stop.
   - **Word-by-Word Highlighting**: The DOM tracks the audio output and visually highlights the exact word being spoken.
   - **OS Lock-Screen Integration**: Through the **Media Session API**, your Wikipedia thumbnail, abstract title, and audio controls are seamlessly piped right to your Android Lock Screen.

## 🎨 The 'Dark Studio' Design System
The UI was built ground-up utilizing a custom, mobile-first design system called **Dark Studio**. It uses premium glassmorphism effects, a sophisticated dark color palette, smooth CSS animations, and highly readable typography combinations (`Inter` for UI, `Lora` for body mechanics). 

## 🛠 Features

- **Tap-To-Listen**: Tap any paragraph in the article, and it is instantly queued and read aloud.
- ⚡ **Concept Capture**: wikiRead extracts the top 2-3 paragraphs to form a quick TL;DR summary at the top of the interface. 
- **Pro Audio Settings Modal**: Change voice speeds (0.5x to 2.0x), adjust pitch, and implement custom text-normalization (like expanding `#1` to "number one" and ignoring colon/semicolon breath pauses).
- **Embedded Images**: Clean inline scaling and extraction of article images.
- **Hidden Hamburger Menu**: Slides out gracefully to preserve maximum screen real estate for the article contents.

## ⚙️ Installation Instructions (For Termux)

Run these commands inside your Android Termux app to install:

```bash
# 1. Update and install dependencies
pkg update && pkg upgrade -y
pkg install python git termux-api -y

# 2. Clone the repo
cd ~
git clone https://github.com/Mrswami/wikiRead.git
cd wikiRead

# 3. Install Python requirements
pip install -r requirements.txt

# 4. Link the custom URL opener
mkdir -p ~/bin
cp termux-url-opener ~/bin/termux-url-opener
chmod +x ~/bin/termux-url-opener
```

## 🔐 Security & Privacy
Since this entire stack (Flask server + TTS Engine) runs **strictly locally via `localhost`** on your device, absolutely no tracking, cross-site leakages, or remote audio generation are occurring. Your reading habits and queries do not leave your own hardware.

### 💡 Known Nuances: The Wikipedia App Account
If you are physically **logged into a Wikipedia account** on the native Android Wikipedia app, the links it shares can sometimes behave slightly differently or append session/tracking parameters to the URL (e.g. `?wprov=sfti1`). 
- **The wikiRead parser strictly strips these query tags and anchor fragments away.** It completely sanitizes the URL to just the raw article name before sending the request to the Wikipedia REST API.
- This ensures that your local requests remain completely anonymous and server errors (like `500 Internal Server Error`) are prevented from bad formatting. 

Enjoy learning.
