const express = require('express');
const path = require('path');
const ipfsClient = require('ipfs-http-client');
const crypto = require('crypto');
const fs = require('fs');
const csvWriter = require('csv-write-stream');
const csv = require('csvtojson');
const mongo = require('mongodb');


const app = express();

app.use('/public', express.static(path.join(__dirname, 'static')));
app.use(express.urlencoded({extended: false}));
app.use(express.json());

app.listen(process.env.PORT || 3000);
console.log('Node server running on port 3000');

var MongoClient = mongo.MongoClient;
//var url = "mongodb://localhost:27017/mydb";
var url = process.env.MONGODB_URI;
/*
MongoClient.connect(url, function(err, db) {
    if (err) throw err;
    var dbo = db.db("cluster");
    dbo.collection("details").drop(function(err, delOK) {
      if (err) throw err;
      if (delOK) console.log("Collection deleted");
      db.close();
    });
  });


MongoClient.connect(url, function(err, db) {
  if (err) throw err;
  console.log("Database created!");
  var dbo = db.db("cluster");
  dbo.createCollection("details", function(err, res) {
    if (err) throw err;
    console.log("Collection created!");
    db.close();
  });
});
*/


const ipfs = new ipfsClient("https://ipfs.infura.io:5001");

app.get('/', async (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'index.html'));    
});


app.post('/', async (req, res) => {
    
    key = crypto.randomBytes(24);
    var iv = crypto.randomBytes(16);

    var cipher = encryptMessage(req.body.message, key, iv);
    console.log("ciphertext-", cipher)

    const { path } = await ipfs.add(cipher);
    console.log("ipfs path -", path);
    
    const date_time = req.body.dateTime.split("T");
    const dateDue = date_time[0].split("-");
    const timeDue = date_time[1].split(":");
    console.log("date-due - ", dateDue);
    console.log("time-due - ", timeDue);
    

    const timestamp = Date.UTC(parseInt(dateDue[0]), parseInt(dateDue[1]) - 1, parseInt(dateDue[2]), parseInt(timeDue[0]), parseInt(timeDue[1]), 0, 0);
    
 
    MongoClient.connect(url, async function(err, db) {
        if (err) throw err;
        var dbo = db.db("cluster");
        var entries = dbo.collection('details');
        var counter = await entries.countDocuments();
        count = counter;
        console.log("counter_mongo", counter);


        var myobj = { sequence: counter, ipfsPath: path, key: key.toString('hex'), iv: iv.toString('hex'),
                    timestamp: timestamp, release_time: req.body.dateTime};
        dbo.collection("details").insertOne(myobj, function(err, result) {
          if (err) throw err;
          console.log("1 document inserted");
          res.send("An encrypted version of the message was successfully logged at index  " + counter + " <br> (remember this, to access the message in future)" + "<br/>" + "IPFS hash - " + "https://cloudflare-ipfs.com/ipfs/" + path);
          //console.log(res);
          db.close();
        });
    });

});

app.get('/view', async (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'view.html'));
});

app.post('/view', async (req, res) => {
    
    let index = req.body.index;
    index = parseInt(index, 10);
    

   //var count;
   MongoClient.connect(url, async function(err, db) {
    if (err) throw err;
    var dbo = db.db("cluster");
    var entries = dbo.collection('details');
    var counter = await entries.countDocuments();
    //count = counter;
    console.log("counter_mongo", counter);
    //db.close();
   //});

   //console.log("count - ", count)
   if (index >= counter) {
    res.send("Sorry, no message is stored at this index")
   }
   else {

    var now = new Date;
    var currentTimestamp = Date.UTC(now.getUTCFullYear(),now.getUTCMonth(), now.getUTCDate() , 
                    now.getUTCHours(), now.getUTCMinutes(), 0, 0);


    //MongoClient.connect(url, function(err, db) {
        //if (err) throw err;
        //var dbo = db.db("cluster");
        console.log("index - ", index);
        
        //console.log("typr_of_index", typeof(index));
       
        dbo.collection("details").find({"sequence": index}).toArray(async function(err, result) {
        if (err) throw err;
        console.log("result_mongodb", result[0]);

        //console.log("result timestamp", result[0].timestamp);
        if (currentTimestamp > result[0].timestamp) {
            let cipher = "";
            let message = "";
            for await (const chunk of ipfs.cat(result[0].ipfsPath)) {
                cipher = chunk.toString();
            }
    
            message = decryptMessage(cipher, Buffer.from(result[0].key, 'hex'), Buffer.from(result[0].iv, 'hex'));
                res.send(message);
        }
        else {
            res.send("Can view the message only after " + result[0].release_time + " (24-hour UTC)");
        }
        });
        db.close();
    }
      });

 
});


function encryptMessage(message, key, iv) {
    var algorithm = 'aes-192-cbc';
    var cipher = crypto.createCipheriv(algorithm, key, iv);
    var encrypted = cipher.update(message, 'utf8', 'hex') + cipher.final('hex');
    return encrypted;
}

function decryptMessage(cipher, key, iv) {
    var algorithm = 'aes-192-cbc';
    var decipher = crypto.createDecipheriv(algorithm, key, iv);
    var decrypted = decipher.update(cipher, 'hex', 'utf8') + decipher.final('utf8'); //deciphered text
    return decrypted;
}
