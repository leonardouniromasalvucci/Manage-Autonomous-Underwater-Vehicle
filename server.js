var express = require('express');
var session = require('express-session');
var bodyParser = require('body-parser');
var request = require('request');
var app = express();
var https = require('https');
var fs = require('fs');
var md5 = require('md5');

var options = {
  key: fs.readFileSync('privateKey.key'),
  cert: fs.readFileSync('certificate.crt')
};
var server = https.createServer(options, app);
var io = require('socket.io').listen(server);
var amqp = require('amqplib/callback_api');

app.use(session({ secret: "secret_key", saveUninitialized:false, resave:false}));

app.set('views', __dirname + '/views');
app.use('/static', express.static('leaflet'))
app.engine('html', require('ejs').renderFile);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

const cassandra = require('cassandra-driver');
const client = new cassandra.Client({ contactPoints: ['localhost'] });
client.connect(function (err) {
  if(err){
    console.log(err);
  }
});

var conn;
amqp.connect('amqp://172.17.0.4',function(err, newconn){
  if(err){
    console.log(err);
  }
  conn = newconn;
});


function encrypt(text){
  return md5(text);
}

//var pass = encrypt("1234");
//const query = "CREATE KEYSPACE auv WITH replication = {'class':'SimpleStrategy', 'replication_factor' : 3}";
//const query = "USE auv";
//const query = "CREATE TABLE auv.login (user text, password text,  PRIMARY KEY(user, password))";
//const query = "INSERT INTO auv.login(user,password) VALUES ('root','"+pass+"')";
//const query = "create table auv.missione (user text,insertion_time timestamp,device text,data text,moves text, def_lat text, def_long text,PRIMARY KEY (user,insertion_time)) WITH CLUSTERING ORDER BY (insertion_time ASC);";
//const query = "INSERT INTO auv.missione(user,insertion_time,device,data,moves, def_lat, def_long) VALUES ('root',dateof(now()),'d002','12-12-34','evf','22','34')";
//"INSERT INTO auv.missione(priority, user, data, device, moves, def_lat, def_long) VALUES ("+num+" ,'"+data.user+"','"+data.data+"','"+data.device+"','"+data.moves+"','45.48878','13.489859')";
/*client.execute(query, function (err, result) {
   console.log(err);
});*/

class Move {
    constructor(type,user,latitude,longitude,date){
       this.type = type;
       this.user = user;
       this.latitude = latitude;
       this.longitude = longitude;
       this.date = date;
    }
}
class user {
    constructor(name,ip){
       this.name = name;
       this.ip = ip;
    }
}

io.sockets.on('connect', function(socket){
    //console.log("connected: %s", socket.id );
   
    socket.on('disconnect', function(data){
     // console.log('Disconnected: %s' ,socket.id);
    });

    socket.on('get_mosse', function(data){
      const query = "INSERT INTO auv.missione(user,insertion_time,device,data,moves, def_lat, def_long) VALUES ('"+data.user+"',dateof(now()),'"+data.device+"','"+data.data+"','"+data.moves+"','45.48878','13.489859')"
      client.execute(query, function (err, result) {
        if(err){
          //console.log("1");
          socket.emit('valid', 1);
        }else{
          //console.log("0");
          socket.emit('valid', 0);
        }
      });
    });

    socket.on('get_mosse_pop', function(data){      
      var device = data;
      const query = "SELECT user,device,data,def_lat,def_long FROM auv.missione";
      client.execute(query, function (err, result) {
        if(!err){
          var res = result.rows;
          socket.emit('result_mosse', res);        
        }
      });
    });

    socket.on('get_device', function(data){
      const query = "SELECT user,device,data,def_lat,def_long FROM auv.missione";
      client.execute(query, function (err, result) {
        if(!err){
          var res = result.rows;
          socket.emit('result_device', res);        
        }
      });
    });
    
    socket.on('get_missione', function(data){      
      const query = "SELECT * FROM auv.missione";
      client.execute(query, function (err, result) {
        if(!err){
          var res = result.rows;
          socket.emit('res_missione', res);        
        }
      });
    });
});

app.get('/',function(req,res){
	if(req.session.email) {
	    res.redirect('/select');
	}else {
	    res.render('index.html');
	}
});

app.get('/error',function(req,res){
    res.render('error.html');
});

app.get('/err_log',function(req,res){
    res.render('index_err.html');
});

app.get('/db',function(req,res){
  res.render('gui_db.html');
});

app.post('/login',function(req,res){
  req.session.email = req.body.email;
  //var pass = req.body.password;
  var pass_de = encrypt(req.body.password);
  console.log(pass_de);
  //console.log(pass_de);
  const query = "SELECT * FROM auv.login WHERE user='"+req.body.email+"' AND password='"+pass_de+"'";
  client.execute(query, function (err, result) {
    if(result.rowLength==1){
        conn.createChannel(function(err, ch) {
        	if(err){
               res.status(500).redirect('/error');
        	}
          var ex = 'topic_lg';
          ch.assertExchange(ex, 'topic', {durable: false});
          ch.publish(ex, 'logtxt', new Buffer(JSON.stringify(new user(req.body.email,req.body.ip))));
          ch.close();  
        });
        res.redirect('/select');
    }else{
        res.redirect('/err_log');
    }   
  });
});

app.post('/get_dev_map',function(req,res){
    req.session.device = req.body.Selll;
    req.session.lat = req.body.lat;
    req.session.long = req.body.long;
    res.redirect('/map');
});

app.get('/logout',function(req,res){
    req.session.destroy(function(err) {
        if(err){
          res.redirect('/error');
        }else{
          res.redirect('/');
        }
    });
});

app.get('/add_device',function(req,res){
  res.redirect('/device');  
});

app.get('/device',function(req,res){
  if(req.session.email) {
        res.render('new_device.html',  {email: req.session.email});
    } else {
        res.write('<h1>Ops, effettua il login.</h1>');
        res.write('<a href="/">Login</a>');
        res.end();
    }
});
app.post('/get_map',function(req,res){
    req.session.device = req.body.device;
    req.session.lat = req.body.lat;
    req.session.long = req.body.long;
    res.redirect('/map');
});

app.get('/map',function(req,res){
  if(req.session.email) {
      res.render('full.html',  {email: req.session.email, device: req.session.device, lat: req.session.lat, long: req.session.long});
  } else {
      res.write('<h1>Ops, effettua il login.</h1>');
      res.write('<a href="/">Login</a>');
      res.end();
  }
});

app.get('/select',function(req,res){
  if(req.session.email) {
		res.render('select.html',  {email: req.session.email});
	} else {
		res.write('<h1>Ops, effettua il login.</h1>');
		res.write('<a href="/">Login</a>');
		res.end();
	}
});

var PORT = 3000;
server.listen(PORT);
console.log("Server in ascolto sulla porta " + PORT);