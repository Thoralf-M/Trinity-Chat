const { asTransactionObject } = require('@iota/transaction-converter');
const { trytesToAscii } = require('@iota/converter')
const units = require('@iota/unit-converter')
const zmq = require("zeromq")
const Discord = require('discord.js');
const config = require('dotenv').config().parsed

const hook = new Discord.WebhookClient(config.webhookid, config.webhooktoken);

let tcpNodes = ["tcp://perma-1.iota.partners:5556"]
let txs = []
let bundles = []
let cacheSize = 50

async function run() {
  const sock = new zmq.Subscriber
  for (node of tcpNodes) {
    sock.connect(node)
  }
  sock.subscribe("trytes")
  //for old IRI
  sock.subscribe("tx_trytes")

  for await (const msg of sock) {
    const data = msg.toString().split(' ')

    //use data so not all txs needs to be converted
    if (data[1].slice(2592, 2619) == 'TRINITY99999999999999999999') {
      const txObj = asTransactionObject(data[1])

      //filter old txs based on timestamp (even though it's not enforced) and use only tail txs
      if (txObj.timestamp < Date.now() / 1000 - 60 && txObj.attachmentTimestamp < Date.now() - 60000 || txObj.currentIndex != 0) {
        continue
      }
      //filter same txs/bundles
      if (txs.indexOf(txObj.hash) == -1 || bundles.indexOf(txObj.bundle) == -1) {
        //save in arrays to check
        txs.push(txObj.hash)
        bundles.push(txObj.bundle)
        //keep size
        if (txs.length > cacheSize) {
          txs.shift();
          bundles.shift();
        }

        let hookDesription = `[Value](https://thetangle.org/transaction/${txObj.hash}): ${unit(txObj.value)}`
        let tryteMessage = removeNines(txObj.signatureMessageFragment)
        if (tryteMessage != '') {
          hookDesription += "\nMessage: "+trytesToAscii(tryteMessage)
        }

        //send embed to discord
        const embed = new Discord.MessageEmbed()
          .setColor("#17b6d6")
          .setDescription(hookDesription);
        hook.send(embed);
      }
    }

  }
}

run()

function removeNines(trytes) {
  let endposition = trytes.length;
  if (trytes.length % 2 != 0) {
    trytes = trytes.slice(0, -1)
  }
  for (let j = 0; j < trytes.length; j += 2) {
    if (trytes.slice(j, j + 2) == '99') {
      endposition = j;
      break;
    }
  }
  return trytes.slice(0, endposition)
}

function unit(value) {
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
