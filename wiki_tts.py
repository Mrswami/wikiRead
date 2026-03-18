import sys
import subprocess
import requests
from bs4 import BeautifulSoup
import tty
import termios
import os

def fetch_wikipedia_content(url):
    try:
        response = requests.get(url)
        response.raise_for_status()
        return response.text
    except requests.RequestException as e:
        print(f"Error fetching URL: {e}")
        return None

def parse_article(html):
    soup = BeautifulSoup(html, 'html.parser')
    
    # Get title
    title_elem = soup.find('h1', id='firstHeading')
    title = title_elem.text if title_elem else "Unknown Title"
    
    # Get main content
    content_div = soup.find('div', class_='mw-parser-output')
    if not content_div:
        return title, [{"title": "Content", "text": "Could not parse content."}]

    sections = []
    current_section = {"title": "Introduction", "text": ""}
    
    for element in content_div.find_all(['h2', 'h3', 'p']):
        if element.name in ['h2', 'h3']:
            # Ignore empty headers or ones like "Contents"
            headline = element.find('span', class_='mw-headline')
            if headline:
                header_text = headline.text.strip()
                if header_text not in ["See also", "References", "Further reading", "External links"]:
                    if current_section["text"].strip():
                        sections.append(current_section)
                    current_section = {"title": header_text, "text": ""}
        elif element.name == 'p':
            text = element.text.strip()
            if text:
                current_section["text"] += text + " "
                
    if current_section["text"].strip():
        sections.append(current_section)
        
    return title, sections

def speak_text(text):
    # Use termux-tts-speak to read the text in the background
    # We use Popen so it runs asynchronously, allowing us to capture keypresses
    process = subprocess.Popen(['termux-tts-speak', text])
    return process

def stop_speaking():
    # termux-tts-speak doesn't easily stop via process termination if already handed off to Android TTS
    # A workaround in Termux is often calling it with an empty string or a space, but let's try Popen.kill() just in case.
    # Additionally calling termux-tts-speak with a space might halt current playback.
    subprocess.run(['termux-tts-speak', ' '], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def getch():
    """Read a single character from standard input without echoing."""
    fd = sys.stdin.fileno()
    old_settings = termios.tcgetattr(fd)
    try:
        tty.setraw(sys.stdin.fileno())
        ch = sys.stdin.read(1)
    finally:
        termios.tcsetattr(fd, termios.TCSADRAIN, old_settings)
    return ch

def main():
    if len(sys.argv) < 2:
        print("Usage: python wiki_tts.py <wikipedia_url>")
        sys.exit(1)
        
    url = sys.argv[1]
    print(f"Fetching {url}...")
    
    html = fetch_wikipedia_content(url)
    if not html:
        sys.exit(1)
        
    print("Parsing article...")
    title, sections = parse_article(html)
    
    print(f"\n--- {title} ---")
    print("\nControls:")
    print(" [n] Next section")
    print(" [p] Previous section")
    print(" [r] Repeat section")
    print(" [q] Quit\n")
    
    current_idx = 0
    total_sections = len(sections)
    
    while current_idx < total_sections:
        section = sections[current_idx]
        print(f"\n[{current_idx + 1}/{total_sections}] {section['title']}")
        
        # Stop any ongoing speech
        stop_speaking()
        
        # Start speaking current section
        speak_text(f"{section['title']}. {section['text']}")
        
        # Wait for user input
        action = getch().lower()
        
        if action == 'q':
            stop_speaking()
            print("\nExiting...")
            break
        elif action == 'n':
            current_idx += 1
        elif action == 'p':
            if current_idx > 0:
                current_idx -= 1
        elif action == 'r':
            pass # Stays on current_idx to repeat
        else:
            print(f"\nUnknown command: {action}. Use n, p, r, or q.")

if __name__ == "__main__":
    main()
