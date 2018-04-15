var amqp = require('amqplib/callback_api');
var fs = require('fs');

amqp.connect('amqp://172.17.0.4', function(err, conn) {
  conn.createChannel(function(err, ch) {
    var ex = 'topic_lg';

    ch.assertExchange(ex, 'topic', {durable: false});

    ch.assertQueue('', {exclusive: true}, function(err, q) {
      console.log(' [*] In attesa di messaggi. Per uscire CTRL+C');
      ch.bindQueue(q.queue, ex, 'logtxt');
     
      ch.consume(q.queue, function(msg) {
        var r = msg;            
        var res = JSON.parse(r.content);
        var d = new Date(); 
        console.log(" Messaggio: %s", msg.content.toString());
        fs.appendFile("log.txt", + d.getDate()+"/"+(d.getMonth()+1)+"/"+d.getFullYear()+"  "+ d.getHours()+":"+d.getMinutes()+":"+d.getSeconds()+"   "+res.name+"       "+res.ip+"\n", function(err) {
          if(err) { 
             return console.log(err); 
          }
          console.log("Messaggio salvato correttamente!");
        }); 
      }, {noAck: true});
    });
  });
});

