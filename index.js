const express = require('express');
const app = express();
const path = require('path');
const http = require('http').Server(app);
const io = require('socket.io')(http);
const converter = require('@iota/converter')
const txconverter = require('@iota/transaction-converter');
const units = require('@iota/unit-converter')

app.use(express.static(path.join(__dirname, 'js')));
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

io.on('test', function (socket) {
  socket.on('chat message', function (msg) {
    io.emit('test', msg);
  });
  io.emit('test', 'Neuer Client verbunden')
});

const zmq = require('zeromq')
const sock = new zmq.Subscriber

sock.connect('tcp://trinity.iota-tangle.io:5556')
sock.connect('tcp://db.iota.partners:5556')
sock.connect('tcp://perma-1.iota.partners:5556')
sock.connect('tcp://nodes.tangled.it:5556')
// sock.connect('tcp://zmq.devnet.iota.org:5556')
sock.subscribe('tx')

run()
const maxmessages = 30
const messages = []
let hashes = []
async function run(){
  for await (const [topic, msg] of sock) {
    // console.log("received a message related to:", topic.toString())
    const data = topic.toString().split(' ') // Split to get topic & data
  switch (
  data[0] // Use index 0 to match topic
  ) {
    case 'tx_trytes':
      if (data[1].slice(2592, 2619) == 'TRINITY99999999999999999999') {
        console.log("tag: " + data[1].slice(2592, 2619))
        const txobj = txconverter.asTransactionObject(data[1])
        if (hashes.indexOf(txobj.hash) != -1) {
          console.log("Already known");
        } else {
          var timestamp = Date.now()
          if (txobj.currentIndex == 0 && txobj.signatureMessageFragment != '9'.repeat(2187) && txobj.attachmentTimestamp > timestamp - 100000) {
            let signature = converter.trytesToAscii(txobj.signatureMessageFragment.slice(0, -1))
            const pattern = /[^\x19-\xFF]*/g
            signature = signature.replace(pattern, "");
            var value = unit(txobj.value)
            const result = [signature, txobj.hash, parseInt(txobj.attachmentTimestamp.toString().slice(0, 10)), value, txobj.bundle]
            hashes.push(txobj.hash)
            io.emit('tx', result)
            messages.push(result);
            if (messages.length > maxmessages) {
              messages.shift();
            }
          }
        }
      }
      break;
  }
  }
}

function unit(param) {
  var value = param
  function round(v, r) { value = (Math.round(units.convertUnits(v, 'i', r) * 100) / 100) + " " + r }
  if (value < 1000) {
    value += ' i'
  } else if (value > 999 && value < 100000) {
    round(value, "Ki")
  } else if (value > 99999 && value < 1000000000) {
    round(value, "Mi")
  } else if (value > 999999999 && value < 1000000000000) {
    round(value, "Gi")
  } else if (value > 999999999999 && value < 1000000000000000) {
    round(value, "Ti")
  } else if (value > 999999999999999) {
    round(value, "Pi")
  }
  return value
}

io.on('connection', socket => {
  for (var i = 0, len = messages.length; i < len; i++) {
    io.emit('tx', messages[i])
  }
  console.log(socket.request.connection.remoteAddress + ' connected');
  socket.on('disconnect', () => { console.log(socket.request.connection.remoteAddress + ' disconnected'); });
});

io.on('test', data => {
  console.log(data);
})

http.listen(80, '0.0.0.0', () => {
  console.log('listening on *:80');
}) 
