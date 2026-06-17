const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const PIXEL_SIZE = 10;
const GRID_OPACITY_LIGHT = 'rgba(0, 0, 0, 0.05)';
const GRID_OPACITY_DARK = 'rgba(255, 255, 255, 0.04)';

const boardSocket = new WebSocket('ws://' + window.location.host + '/ws/board/');
const chatSocket = new WebSocket('ws://' + window.location.host + '/ws/chat/');

let pixelMap = {};
let hoverPixel = null;

let zoom = 1.0;
const ZOOM_SPEED = 1.2;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 10.0;
let panX = 0;
let panY = 0;

let isDragging = false;
let dragStart = { x: 0, y: 0 };
let panStart = { x: 0, y: 0 };
let hasMoved = false;
const DRAG_THRESHOLD = 5;

let isErasing = false;

canvas.style.transformOrigin = '0 0';
canvas.style.imageRendering = 'pixelated';
canvas.style.setProperty('-ms-interpolation-mode', 'nearest-neighbor');

applyTransform();

function applyTransform() {
    if (Math.abs(zoom - 1.0) < 0.05) {
        zoom = 1.0;
        panX = 0;
        panY = 0;
    }

    canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
    document.getElementById('zoom-level').innerText = `${Math.round(zoom * 100)}%`;
}

const eraserBtn = document.getElementById('eraser-btn');
if (eraserBtn) {
    eraserBtn.addEventListener('click', () => {
        isErasing = !isErasing;
        if (isErasing) {
            eraserBtn.style.backgroundColor = 'var(--primary-color)';
            eraserBtn.style.color = '#fff';
        } else {
            eraserBtn.style.backgroundColor = 'transparent';
            eraserBtn.style.color = 'var(--text-main)';
        }
    });
}

const colorPicker = document.getElementById('color-picker');
if (colorPicker) {
    colorPicker.addEventListener('input', () => {
        isErasing = false;
        if (eraserBtn) {
            eraserBtn.style.backgroundColor = 'transparent';
            eraserBtn.style.color = 'var(--text-main)';
        }
    });
}

document.getElementById('zoom-in').addEventListener('click', () => {
    zoom = Math.min(MAX_ZOOM, zoom * ZOOM_SPEED);
    applyTransform();
});

document.getElementById('zoom-out').addEventListener('click', () => {
    let nextZoom = zoom / ZOOM_SPEED;
    if (zoom > 1.0 && nextZoom < 1.0) {
        zoom = 1.0;
    } else {
        zoom = Math.max(MIN_ZOOM, nextZoom);
    }
    applyTransform();
});

function drawGrid() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    ctx.strokeStyle = isDark ? GRID_OPACITY_DARK : GRID_OPACITY_LIGHT;
    ctx.lineWidth = 0.5;

    for (let x = 0; x <= canvas.width; x += PIXEL_SIZE) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    for (let y = 0; y <= canvas.height; y += PIXEL_SIZE) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
}

function paintPixel(x, y, color) {
    pixelMap[`${x},${y}`] = color;
    ctx.fillStyle = color;
    ctx.fillRect(x * PIXEL_SIZE, y * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    ctx.strokeStyle = isDark ? GRID_OPACITY_DARK : GRID_OPACITY_LIGHT;
    ctx.strokeRect(x * PIXEL_SIZE, y * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
}

function drawHoverPixel(x, y) {
    redrawAll();

    const drawX = x * PIXEL_SIZE;
    const drawY = y * PIXEL_SIZE;

    const hex = document.getElementById('color-picker').value;

    const r = parseInt(hex.substr(1, 2), 16);
    const g = parseInt(hex.substr(3, 2), 16);
    const b = parseInt(hex.substr(5, 2), 16);
    const strokeColor = `rgba(${r}, ${g}, ${b}, 0.6)`;

    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = strokeColor;
    ctx.strokeRect(drawX + 1, drawY + 1, PIXEL_SIZE - 2, PIXEL_SIZE - 2);
    ctx.restore();
}

function redrawAll() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    Object.keys(pixelMap).forEach(key => {
        const [x, y] = key.split(',').map(Number);
        paintPixel(x, y, pixelMap[key]);
    });
    drawGrid();
}

document.addEventListener('themeChanged', redrawAll);

boardSocket.onmessage = function (e) {
    const data = JSON.parse(e.data);
    if (data.action === 'init') {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        data.pixels.forEach(p => {
            paintPixel(p.x, p.y, p.color);
        });
        drawGrid();
    } else if (data.error) {
        document.getElementById('error-msg').innerText = data.error;
        setTimeout(() => { document.getElementById('error-msg').innerText = ''; }, 3000);
    } else if (data.action === 'paint') {
        paintPixel(data.x, data.y, data.color);
    } else if (data.action === 'delete') {
        delete pixelMap[`${data.x},${data.y}`];
        redrawAll();
    }
};

function handlePaintClick(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor(((clientX - rect.left) * scaleX) / PIXEL_SIZE);
    const y = Math.floor(((clientY - rect.top) * scaleY) / PIXEL_SIZE);

    if (x >= 0 && x < (canvas.width / PIXEL_SIZE) && y >= 0 && y < (canvas.height / PIXEL_SIZE)) {
        if (isErasing) {
            const key = `${x},${y}`;
            if (pixelMap[key]) {
                boardSocket.send(JSON.stringify({ 'action': 'erase', 'x': x, 'y': y }));
            }
        } else {
            const color = document.getElementById('color-picker').value;
            boardSocket.send(JSON.stringify({ 'action': 'paint', 'x': x, 'y': y, 'color': color }));
        }
    }
}

function startDrag(clientX, clientY) {
    isDragging = true;
    hasMoved = false;
    dragStart = { x: clientX, y: clientY };
    panStart = { x: panX, y: panY };
}

function moveDrag(clientX, clientY) {
    if (!isDragging) return;
    const dx = clientX - dragStart.x;
    const dy = clientY - dragStart.y;

    if (Math.hypot(dx, dy) > DRAG_THRESHOLD) {
        hasMoved = true;
    }

    if (hasMoved) {
        panX = panStart.x + dx;
        panY = panStart.y + dy;
        applyTransform();
    }
}

function endDrag(clientX, clientY) {
    if (!isDragging) return;
    isDragging = false;
    if (!hasMoved) {
        handlePaintClick(clientX, clientY);
    }
}

canvas.addEventListener('mousedown', function (e) {
    startDrag(e.clientX, e.clientY);
});

canvas.addEventListener('mousemove', function (e) {
    if (isDragging) {
        moveDrag(e.clientX, e.clientY);
    } else {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const x = Math.floor(((e.clientX - rect.left) * scaleX) / PIXEL_SIZE);
        const y = Math.floor(((e.clientY - rect.top) * scaleY) / PIXEL_SIZE);

        if (x >= 0 && x < (canvas.width / PIXEL_SIZE) && y >= 0 && y < (canvas.height / PIXEL_SIZE)) {
            if (!hoverPixel || hoverPixel.x !== x || hoverPixel.y !== y) {
                hoverPixel = { x, y };
                drawHoverPixel(x, y);
            }
        } else if (hoverPixel) {
            hoverPixel = null;
            redrawAll();
        }
    }
});

canvas.addEventListener('mouseup', function (e) {
    endDrag(e.clientX, e.clientY);
});

canvas.addEventListener('mouseleave', function () {
    isDragging = false;
    if (hoverPixel) {
        hoverPixel = null;
        redrawAll();
    }
});

canvas.addEventListener('touchstart', function (e) {
    if (e.touches.length === 1) {
        startDrag(e.touches[0].clientX, e.touches[0].clientY);
        e.preventDefault();
    }
}, { passive: false });

canvas.addEventListener('touchmove', function (e) {
    if (e.touches.length === 1 && isDragging) {
        moveDrag(e.touches[0].clientX, e.touches[0].clientY);
        e.preventDefault();
    }
}, { passive: false });

canvas.addEventListener('touchend', function (e) {
    if (e.changedTouches.length === 1) {
        endDrag(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
    }
});

const chatBox = document.getElementById('chat-box');

function appendChatMessage(username, message) {
    if (!chatBox) return;
    const newMsg = document.createElement('div');
    newMsg.className = 'chat-message';
    newMsg.innerHTML = `<strong>${username}:</strong> ${message}`;
    chatBox.appendChild(newMsg);
    chatBox.scrollTop = chatBox.scrollHeight;
}

chatSocket.onmessage = function (e) {
    const data = JSON.parse(e.data);
    if (data.action === 'init') {
        if (chatBox) chatBox.innerHTML = '';
        data.chats.forEach(c => appendChatMessage(c.username, c.message));
    } else if (data.error) {
        alert(data.error);
    } else if (data.action === 'chat') {
        appendChatMessage(data.username, data.message);
    }
};

const chatInput = document.getElementById('chat-input');
const chatSend = document.getElementById('chat-send');

function sendChat() {
    if (!chatInput) return;
    const message = chatInput.value.trim();
    if (message) {
        chatSocket.send(JSON.stringify({ 'action': 'chat', 'message': message }));
        chatInput.value = '';
    }
}

if (chatSend) chatSend.onclick = sendChat;
if (chatInput) {
    chatInput.addEventListener("keypress", function (e) {
        if (e.key === "Enter") {
            e.preventDefault();
            sendChat();
        }
    });
}
