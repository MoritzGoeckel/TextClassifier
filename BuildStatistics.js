const Data = require("./Includes/data.js");
const Syncer = require("./Includes/Syncer.js");

const redis = require("redis");

const merkmale = Data.merkmale;

const client = redis.createClient();

client.on('connect', function() {
    client.select(1, function(err, res){ 
        if(err != null)
            console.log(err)
        else{

            let syncer = new Syncer(function(){
                console.log(merkmale);
            });

            for(let m = 0; m < merkmale.length; m++)
                for(let s in merkmale[m].seiten)
                {
                    let listName = merkmale[m].name + "_" + merkmale[m].seiten[s];
                    merkmale[m].comments = 0;

                    syncer.waitForOne();

                    client.LLEN(listName, function(err, res){
                        if(err != null)
                            console.log(err);

                        merkmale[m].comments += parseInt(res);
                        console.log(listName + " " + res);

                        syncer.oneDone();
                    });
                }
        }
    });
});