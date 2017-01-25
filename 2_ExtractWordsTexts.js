const Data = require("./Includes/data.js");
const redis = require("redis");

const merkmale = Data.merkmale;

const client = redis.createClient();

var allowedSigns = "1234567890ßqwertzuiopüasdfghjklöäyxcvbnm";

client.on('connect', function() {
    client.select(1, function(err, res){ 
        if(err != null)
            console.log(err)
        else
        {
            for(let m = 0; m < merkmale.length; m++) //Iterate merkmale
            {
                for(let s in merkmale[m].seiten) //Iterates sites of merkmale
                {
                    //Db list name
                    let listName = merkmale[m].name + "_" + merkmale[m].seiten[s];

                    //Get all comments of the site
                    let processChunk = function(id){
                        client.LRANGE(listName, id, id + 10000, function(err, comments){ //Iterate it partially
                            var updates = {};
                            
                            if(err != null)
                                console.log(err);
                            
                            if(comments.length == 0 || comments == null)
                            {
                                console.log(listName + " done");
                                return true;
                            }

                            //Iterate the comments
                            for(let c in comments)
                            {
                                //Split and iterate the words of the comment
                                let comment = comments[c];
                                comment = comment.toLowerCase();
                                
                                let words = comment.split(" ");
                                for(let w in words)
                                {
                                    //Check if word is okay and incr it at the words list of the merkmal
                                    let word = words[w];

                                    let usedWord = "";
                                    for(let c in word)
                                        if(allowedSigns.indexOf(word[c]) != -1)
                                            usedWord += word[c];

                                    if(usedWord != undefined && usedWord != null && usedWord != "" && usedWord != " ")
                                    {
                                        if(updates[usedWord] == undefined)
                                            updates[usedWord] = 1;
                                        else
                                            updates[usedWord]++;
                                    }
                                }
                            }

                            for(let k in updates){
                                client.zincrby("words_" + merkmale[m].name, updates[k], k, function(err, res)
                                {
                                    if(err != null)
                                        console.log(err);
                                });
                            }

                            console.log("10000 done " + listName);
                            return processChunk(id + 10000);
                        });
                    };

                    console.log("Starte seite: " + listName);
                    processChunk(0);
                } //Iterate seiten
            } //Iterate merkmale
        } // no error connecting
    });
});