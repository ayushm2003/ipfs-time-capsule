const express = require('express');
const path = require('path');
const ipfsClient = require('ipfs-http-client');
const crypto = require('crypto');

const app = express();

app.use('/public', express.static(path.join(__dirname, 'static')));
app.use(express.urlencoded({extended: false}));
app.use(express.json());

app.listen(process.env.PORT || 3000);
console.log('Node server running on port 3000');

const ipfs = new ipfsClient("https://ipfs.infura.io:5001");
let counter = 0;
let data = {};

app.get('/', async (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'index.html'));    
});


app.post('/', async (req, res) => {
    
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
    

    let details = {
        "ipfsPath": path,
        "key": key,
        "iv": iv,
        "timestamp": timestamp,
		"release_time": req.body.dateTime
    };
    data[counter] = details;
    counter += 1;
    console.log(data);

    res.send("An encrypted version of the message was successfully logged at index  " + (counter-1) + " <br> (remember this, to access the message in future)" + "<br/>" + "IPFS hash - " + "https://cloudflare-ipfs.com/ipfs/" + data[counter-1].ipfsPath);

});

app.get('/view', async (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'view.html'));
});

app.post('/view', async (req, res) => {
    
    let index = req.body.index;

	if (index >= counter) {
		res.send("Sorry, no message is stored at this index")
	}
   else {
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
        res.send("Can view the message only after " + data[index].release_time + " UTC");
    }
	
   }
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
