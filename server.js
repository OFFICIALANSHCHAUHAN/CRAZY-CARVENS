const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

// Serve static assets from root directory
app.use(express.static(__dirname));

// Serve index.html on root GET requests
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const players = {};
const PLAYER_COLORS = ['#66fcf1', '#ff007f', '#00ff88', '#ffaa00', '#9d00ff', '#00d4ff', '#ff3366', '#a6e22e'];

io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    players[socket.id] = {
        id: socket.id,
        name: `Explorer_${socket.id.substring(0, 4)}`,
        color: PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)],
        x: 60,
        y: 380,
        vx: 0,
        vy: 0,
        facing: 'right',
        lives: 3,
        isFlying: false,
        level: 0
    };

    // Send existing player list to new connection
    socket.emit('currentPlayers', players);
    
    // Broadcast new player to all existing sockets
    socket.broadcast.emit('newPlayer', players[socket.id]);

    // Handle custom username registration
    socket.on('setUsername', (username) => {
        if (players[socket.id] && username && username.trim() !== '') {
            players[socket.id].name = username.trim().substring(0, 15);
            io.emit('playerUpdated', players[socket.id]);
        }
    });

    // Handle high-frequency movement updates
    socket.on('playerUpdate', (data) => {
        if (players[socket.id]) {
            Object.assign(players[socket.id], data);
            socket.broadcast.emit('playerMoved', players[socket.id]);
        }
    });

    // ADMIN COMMAND: Set hearts for target player, all players, or single player
    socket.on('adminSetLives', ({ targetId, lives }) => {
        const amount = parseInt(lives, 10);
        if (isNaN(amount)) return;

        if (targetId === 'all') {
            Object.keys(players).forEach(id => {
                players[id].lives = amount;
            });
            io.emit('livesUpdated', { id: 'all', lives: amount });
        } else if (players[targetId]) {
            players[targetId].lives = amount;
            io.emit('livesUpdated', { id: targetId, lives: amount });
        }
    });

    // ADMIN COMMAND: Warp level for target player, all players, or single player
    socket.on('adminChangeLevel', ({ targetId, levelIdx }) => {
        const targetLvl = parseInt(levelIdx, 10);
        if (isNaN(targetLvl)) return;

        if (targetId === 'all') {
            io.emit('forceLevelChange', { levelIdx: targetLvl });
        } else if (players[targetId]) {
            io.to(targetId).emit('forceLevelChange', { levelIdx: targetLvl });
        }
    });

    // Handle Disconnections
    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🎮 Crystal Caverns Server running on port ${PORT}`);
});
