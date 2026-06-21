# PixelBoard

A collaborative online pixel art board with real-time chat, built with Django and WebSocket.

## Quick Start

1. Clone the repo
```bash
git clone https://github.com/nimazerobit/pixelboard.git
cd pixelboard
```
2. Create virtual environment
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```
3. Install dependencies
```bash
pip install -r requirements.txt
```
4. Database & migrations
```bash
python manage.py migrate
python manage.py createsuperuser  # Optional: for admin access
```
5. Run the development server
```bash
python manage.py runserver
```
OR
```bash
daphne -b 0.0.0.0 -p 8000 pixelboard.asgi:application
```

## Key URLs

-   `/` — Main pixel board
-   `/register/` — User registration
-   `/login/` — Login
-   `/admin/` — Django admin
-   `ws/board/` — Canvas WebSocket
-   `ws/chat/` — Chat WebSocket
