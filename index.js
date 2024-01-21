import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Server } from 'socket.io';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import cors from 'cors';

const db = await open({
    filename: 'chats.db',
    driver: sqlite3.Database
});

await db.exec(`
    CREATE TABLE IF NOT EXISTS messages(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_offset TEXT UNIQUE,
        content TEXT 
        );
    `);

const app = express();
const server = createServer(app);
const io = new Server(server, { connectionStateRecovery: {}});
const port = 3000;

app.use(express.static("public"));
app.use(cors());

const __dirname = dirname(fileURLToPath(import.meta.url));


app.get("/", (req, res) => {
    res.sendFile(join(__dirname, 'index.html'));
});

io.on('connection', async (socket) => {
    console.log('A user connected.');
    socket.on('disconnect', () => {
        console.log('A user disconnected.')
    })

    socket.on('chat msg', async (msg, clientOffset, callback) => {
        let result;
        try{
            result = await db.run(`INSERT INTO messages(content, client_offset) VALUES (?, ?)`, msg, clientOffset);
        } catch(e){
            if(e.errno == 19){
                /* msg already inserted */
                callback()
            }else{

            }
            return;
        }
        console.log(`Message: ${msg}`);
        io.emit('chat msg', msg, result.lastID);

        callback();
    });

    if(!socket.recovered){
        try{
            await db.each(`SELECT id, content FROM messages WHERE id > ?`, 
                [socket.handshake.auth.serverOffset || 0], 
                (_err, row) => {
                    socket.emit('chat msg', row.content, row.id);
                }
            );
        } catch(e){

        }
    }
});

server.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});