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

            //end of the software, print result
            let syncer = new Syncer(function(){
                for(let i in merkmale)
                    console.log(merkmale[i].name + ": " + (merkmale[i].comments / 1000) + "K");
            });

            //Iterate merkmale
            for(let m = 0; m < merkmale.length; m++)
                for(let s in merkmale[m].seiten) //Iterate sites of merkmale
                {
                    //Db list name
                    let listName = merkmale[m].name + "_" + merkmale[m].seiten[s];
                    merkmale[m].comments = 0; //init the counting

                    //Get the length of the list
                    syncer.waitForOne();
                    client.LLEN(listName, function(err, res){
                        if(err != null)
                            console.log(err);

                        merkmale[m].comments += parseInt(res); //incr the counter
                        //console.log(listName + " " + res);

                        syncer.oneDone();
                    });
                }
        }
    });
});