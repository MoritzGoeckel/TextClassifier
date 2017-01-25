const Data = require("./Includes/data.js");
const redis = require("redis");

const merkmale = Data.merkmale;

const client = redis.createClient();

client.on('connect', function() {
    client.select(1, function(err, res){ 
        if(err != null)
            console.log(err)
        else
        {
            for(let m = 0; m < merkmale.length; m++) //Iterate merkmale
            {
                client.zrangebyscore("words_" + merkmale[m].name, "-inf", "+inf", 'withscores', function(err, res){
                    let count = 0;
                    for(let r = 0; r < res.length; r += 2)
                    {
                        //count += res[r]; //Value
                        count += parseInt(res[r + 1]); //Score
                    }
                    
                    console.log("words_" + merkmale[m].name);
                    console.log("Count: " + count);

                    for(let r = 0; r < res.length; r += 2)
                    {
                        client.hset("wighted_"+ merkmale[m].name, res[r], parseInt(res[r + 1]) / count, function(err, res){
                            if(err != null)
                                console.log(err);
                        });
                    }
                });

            } //Iterate merkmale
        } // no error connecting
    });
});