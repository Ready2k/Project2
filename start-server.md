# Start Local Server

## Option 1: Python (if you have Python installed)
```bash
# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000
```
Then open: http://localhost:8000

## Option 2: Node.js (if you have Node.js installed)
```bash
# Install serve globally (one time)
npm install -g serve

# Start server
serve . -p 8000
```
Then open: http://localhost:8000

## Option 3: PHP (if you have PHP installed)
```bash
php -S localhost:8000
```
Then open: http://localhost:8000

## Option 4: Just open the HTML file directly
You can also try opening the HTML file directly in your browser:
- Right-click on `index.html` → "Open with" → Your browser
- Or drag and drop `index.html` into your browser window

Note: Some features might not work when opening files directly due to CORS restrictions.