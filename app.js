const express = require('express');
const path = require('path');
const moment = require('moment');
const ipfsClient = require('ipfs-http-client');
const crypto = require('crypto');
const ejs = require('ejs');
const fs = require('fs');

const app = express();

app.use('/public', express.static(path.join(__dirname, 'static')));
app.use(express.urlencoded({extended: false}));
app.use(express.json());
app.set('view engine', 'ejs');

app.listen(8080);
console.log('Node server running on port 3000');

const ipfs = new ipfsClient("https://ipfs.infura.io:5001");
let counter = 0;
let data = {};

app.get('/', async (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'index.html'));    
});


var content = fs.readFileSync('./static/index.html', 'utf-8');
var compiled = ejs.compile(content);

app.post('/', async (req, res) => {
    //message.push(req.body.message)
    let currentDate = new Date();
    
    console.log(req.body);

    key = crypto.randomBytes(24);
    console.log(Buffer.from(key))
    var iv = crypto.randomBytes(16);
    var cipher = encryptMessage(req.body.message, Buffer.from(key), iv);
    console.log("ciphertext-", cipher)

    const { path } = await ipfs.add(cipher);
    console.log("ipfs path -", path);
    
    const date_time = req.body.dateTime.split("T");
    const dateDue = date_time[0].split("-");
    const timeDue = date_time[1].split(":");
    console.log("date-due - ", dateDue);
    console.log("time-due - ", timeDue);
    

    const timestamp = Date.UTC(parseInt(dateDue[0]), parseInt(dateDue[1]) - 1, parseInt(dateDue[2]), parseInt(timeDue[0]), parseInt(timeDue[1]), 0, 0);
    
    //let details = [req.body.message, parseInt(req.body.time), moment().unix(), path];
    let details = {
        "timeDue": req.body.time,
        "currentTime": moment().unix(),
        "ipfsPath": path,
        "key": key,
        "iv": iv,
        "timestamp": timestamp
    };
    data[counter] = details;
    counter += 1;
    console.log(data);
    //ejs shit
    //var renderHtml = ejs.render("index.html", {value: (counter-1)});
    //res.end(compiled({value : (counter-1)}));
    res.send("An encrypted version of the message was successfully logged at index  " + (counter-1) + "  (remember this, to access the message in future)" + "<br/>" + "IPFS " + "<a href=`https://cloudflare-ipfs.com/ipfs/QmTEmfX67jVokFFsBV8q4K1mLxA4kBjWLtcHv94PSSs4qN`>path</a>" + "- " + data[counter-1].ipfsPath);
    
    //res.render(content, {value:(counter-1)})
});

app.get('/view', async (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'view.html'));
});

app.post('/view', async (req, res) => {
    
    let index = req.body.index;
   
   var now = new Date;
   var currentTimestamp = Date.UTC(now.getUTCFullYear(),now.getUTCMonth(), now.getUTCDate() , 
                    now.getUTCHours(), now.getUTCMinutes(), 0, 0);

    if (currentTimestamp > data[index].timestamp) {
        let cipher = "";
        let message = "";
        for await (const chunk of ipfs.cat(data[index].ipfsPath)) {
            cipher = chunk.toString();
        }

        message = decryptMessage(cipher, Buffer.from(data[index].key), data[index].iv);
        res.send(message);
    }
    else{
        res.send("cannot view the message yet");
    }

    //commented for test purposes
    /*
    if (difference < (data[index].timeDue * 3600)) {
        res.send("cannot view the message yet");
    }
    else {
        //res.send(data[index][0]);
        res.send(ipfs.cat(cid))

        let message = "";
        for await (const chunk of ipfs.cat(data[index][3])) {
            message = chunk.toString();
        }
        res.send(message)
    }*/
    /*
    let cipher = "";
    let message = "";
    for await (const chunk of ipfs.cat(data[index].ipfsPath)) {
        cipher = chunk.toString();
    }

    message = decryptMessage(cipher, Buffer.from(data[index].key), data[index].iv)
    res.send(message)*/
});


function encryptMessage(message, key, iv) {
    var algorithm = 'aes-192-cbc';
    var cipher = crypto.createCipheriv(algorithm, key, iv);
    var encrypted = cipher.update(message, 'utf8', 'hex') + cipher.final('hex');
    return encrypted;
}

function decryptMessage(cipher, key, iv) {
    var algorithm = 'aes-192-cbc';
    let iv1 = Buffer.from(iv, 'hex');
    var decipher = crypto.createDecipheriv(algorithm, key, iv);
    var decrypted = decipher.update(cipher, 'hex', 'utf8') + decipher.final('utf8'); //deciphered text
    return decrypted;
}
