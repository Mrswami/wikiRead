import re
import requests
from bs4 import BeautifulSoup, Tag

SKIP_SECTIONS = {
    "See also", "References", "Further reading", "External links",
    "Notes", "Citations", "Bibliography", "Footnotes"
}

def _url_to_title(url):
    """Extract the Wikipedia article title from its URL to use in the REST API."""
    match = re.search(r'wikipedia\.org/wiki/(.+)', url)
    if match:
        return match.group(1).split('#')[0]  # Drop anchor fragments
    return None

def parse_wikipedia(url):
    """Fetch and parse a Wikipedia article using the REST v1 HTML API."""
    article_title = _url_to_title(url)
    if not article_title:
        return None, "Could not extract article title from URL."

    # Use the Wikipedia REST API which returns clean, well-structured HTML
    lang = "en"
    match = re.search(r'([\w-]+)\.wikipedia\.org', url)
    if match:
        lang = match.group(1)

    api_url = f"https://{lang}.wikipedia.org/api/rest_v1/page/html/{article_title}"
    headers = {
        "User-Agent": "wikiRead/1.0 (https://github.com/wikiRead; educational) python-requests/2.32",
        "Accept": "text/html; charset=utf-8"
    }

    try:
        response = requests.get(api_url, headers=headers, timeout=15)
        response.raise_for_status()
    except requests.RequestException as e:
        return None, str(e)

    soup = BeautifulSoup(response.text, 'html.parser')

    # Title — from <h1> or derive from article_title
    title_elem = soup.find('h1')
    title = title_elem.get_text().strip() if title_elem else article_title.replace('_', ' ')

    # Thumbnail — from the first figure with a real image in the article
    thumbnail = None
    for figure in soup.find_all('figure', limit=5):
        img = figure.find('img')
        if img:
            src = img.get('src', '')
            if src:
                thumbnail = 'https:' + src if src.startswith('//') else src
                break

    # Sections — the REST API wraps each section in a <section> tag
    sections = []
    raw_sections = soup.find_all('section')

    for sec in raw_sections:
        # Get heading text (h1/h2/h3 at start of section)
        heading_tag = sec.find(['h1', 'h2', 'h3'])
        if heading_tag:
            heading_text = heading_tag.get_text().strip()
            # Clean up [edit] buttons etc.
            heading_text = re.sub(r'\[edit\]', '', heading_text).strip()
        else:
            heading_text = "Introduction"

        # Skip junk and reference sections
        if heading_text in SKIP_SECTIONS:
            break

        # Extract paragraphs and images
        content_items = []
        for elem in sec.find_all(['p', 'figure']):
            if elem.name == 'p':
                text = elem.get_text().strip()
                # Filter empty, footnote-only, and very short paragraphs
                if text and len(text) > 40 and not text.startswith('^'):
                    content_items.append({"type": "text", "content": text})
            elif elem.name == 'figure':
                img = elem.find('img')
                if img:
                    src = img.get('src', '')
                    if src:
                        # Try to filter out tiny icons safely
                        width = img.get('width', '1000')
                        height = img.get('height', '1000')
                        try:
                            # Strip non-numeric characters like "px" if they exist
                            w = int(''.join(c for c in str(width) if c.isdigit()) or 0)
                            h = int(''.join(c for c in str(height) if c.isdigit()) or 0)
                            if w > 50 and h > 50:
                                cap_tag = elem.find('figcaption')
                                caption = cap_tag.get_text().strip() if cap_tag else ""
                                full_src = 'https:' + src if src.startswith('//') else src
                                content_items.append({"type": "image", "src": full_src, "caption": caption})
                        except ValueError:
                            pass

        if content_items:
            sections.append({"title": heading_text, "items": content_items})

    # Concept Capture: first 2–3 text paragraphs from the intro section
    summary = []
    if sections:
        # Extract only text items for the summary
        text_paras = [item["content"] for item in sections[0]["items"] if item["type"] == "text"]
        summary = text_paras[:3]

    return {
        "title": title,
        "thumbnail": thumbnail,
        "sections": sections,
        "summary": summary,
        "url": url  # Keep original URL (not API url) for "View on Wikipedia" link
    }, None
