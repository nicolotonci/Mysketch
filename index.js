var express = require('express');
var app = express();
var path  = require("path");
const http = require('http');
const url = require('url');
const WebSocket = require('ws');
const jsonfile = require('jsonfile');

app.get('/', function(req, res, next) {

  const crypto = require("crypto");
  const id = crypto.randomBytes(16).toString("hex");

  res.redirect('/'+id );
});

app.get('/info', function(req, res, next){
  res.sendFile(path.join(__dirname+'/info.html'));
})

app.get('/:id', function(req, res) {
  //res.send('ID pagina: ' + req.params.id);
  res.sendFile(path.join(__dirname+'/index.html'))
});

app.use(express.static('static'))

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

var sessions = {};

wss.on('connection', function connection(ws, req) {
  const key = req.url.toString().substr(1);
  console.log(key);
  if (!sessions[key]){
    var obj = {clients : new Array(), primitives : new Array(), undone : new Array()}
    jsonfile.readFile('storage/' + key + '.sketch', function(err, readObj){
      if (readObj)
        obj.primitives = readObj;

    })
    sessions[key] = obj;
  }

  if (sessions[key].primitives.length > 0)
    ws.send(JSON.stringify({cmd : 'digest', data : sessions[key].primitives}));

  sessions[key].clients.push(ws);

  ws.on('message', function incoming(data) {
    if (data === "__ping__"){
      ws.send("__pong__");
      return;
    }
    // Broadcast to everyone else.
    sessions[key].clients.forEach(function(client) {
      if (client !== ws) // controllo se il client è lo stesso che ha inviato il messaggio
        if (client.readyState === WebSocket.OPEN)
          client.send(data);
          else {
            sessions[key].clients.shift(sessions[key].clients.indexOf(client));
          }
    });
    // salvo nel file le modifiche
    var dataObj = JSON.parse(data);
    switch (dataObj.cmd){
      case 'add':
        sessions[key].primitives.push(dataObj.data);
        sessions[key].undone.length = 0;
        jsonfile.writeFile('storage/' + key + '.sketch', sessions[key].primitives);
        break;
      case 'undo':
        sessions[key].undone.push(sessions[key].primitives.pop());
        jsonfile.writeFile('storage/' + key + '.sketch', sessions[key].primitives);
        break;
      case 'redo':
        sessions[key].primitives.push(sessions[key].undone.pop())
        jsonfile.writeFile('storage/' + key + '.sketch', sessions[key].primitives);
        break;
    }
  });
});


// codice websocket server

server.listen(8080);
