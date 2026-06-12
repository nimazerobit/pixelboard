const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const PIXEL_SIZE = 10;
const GRID_OPACITY_LIGHT = 'rgba(0, 0, 0, 0.05)';
const GRID_OPACITY_DARK = 'rgba(255, 255, 255, 0.04)';

const boardSocket = new WebSocket('ws://' + window.location.host + '/ws/board/');
const chatSocket = new WebSocket('ws://' + window.location.host + '/ws/chat/');

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

let pixelMap = {};

function paintPixel(x, y, color) {
    pixelMap[`${x},${y}`] = color;
    ctx.fillStyle = color;
    ctx.fillRect(x * PIXEL_SIZE, y * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    ctx.strokeStyle = isDark ? GRID_OPACITY_DARK : GRID_OPACITY_LIGHT;
    ctx.strokeRect(x * PIXEL_SIZE, y * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
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
    }
};

function handlePaintClick(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = Math.floor(((clientX - rect.left) * scaleX) / PIXEL_SIZE);
    const y = Math.floor(((clientY - rect.top) * scaleY) / PIXEL_SIZE);
    const color = document.getElementById('color-picker').value;

    if (x >= 0 && x < (canvas.width / PIXEL_SIZE) && y >= 0 && y < (canvas.height / PIXEL_SIZE)) {
        boardSocket.send(JSON.stringify({ 'action': 'paint', 'x': x, 'y': y, 'color': color }));
    }
}

canvas.addEventListener('click', function (e) {
    handlePaintClick(e.clientX, e.clientY);
});

canvas.addEventListener('touchstart', function (e) {
    if (e.touches.length === 1) {
        handlePaintClick(e.touches[0].clientX, e.touches[0].clientY);
        e.preventDefault();
    }
}, { passive: false });

const chatBox = document.getElementById('chat-box');

function appendChatMessage(username, message) {
    const newMsg = document.createElement('div');
    newMsg.className = 'chat-message';
    newMsg.innerHTML = `<strong>${username}:</strong> ${message}`;
    chatBox.appendChild(newMsg);
    chatBox.scrollTop = chatBox.scrollHeight;
}

chatSocket.onmessage = function (e) {
    const data = JSON.parse(e.data);
    if (data.action === 'init') {
        chatBox.innerHTML = '';
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
