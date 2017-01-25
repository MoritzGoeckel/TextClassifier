const Data = require("./Includes/data.js");
const redis = require("redis");

var allowedSigns = "1234567890ßqwertzuiopüasdfghjklöäyxcvbnm";

const merkmale = Data.merkmale;
const client = redis.createClient();

function getScoresForWord(word, callback)
{
    let results = [];
    for(let m = 0; m < merkmale.length; m++) //Iterate merkmale
    {
        client.hget("wighted_"+ merkmale[m].name, word, function(err, res){
                if(err != null){
                    console.log(err);
                    results.push({category:merkmale[m].name, score:NaN});
                }
                else
                    results.push({category:merkmale[m].name, score:res});

                //When finished
                if(results.length >= merkmale.length)
                {
                    let avg = 0;
                    let avgEntries = 0;

                    let min = 100000000;
                    for(let r in results)
                    {
                        //Avg
                        if(results[r].score != NaN && results[r].score != null)
                        {
                            avg += parseFloat(results[r].score);
                            avgEntries++;

                            //Min
                            if(parseFloat(results[r].score) < min)
                                min = parseFloat(results[r].score);
                        }
                    }

                    avg /= avgEntries;

                    for(let r in results)
                    {
                        if(avgEntries != 0)
                        {
                            results[r].avg = avg;
                            results[r].avgNormalizedScore = results[r].score - avg;
                            results[r].minNormalizedScore = results[r].score - min;
                            results[r].min = min;
                        }
                    }

                    callback(results);
                }
            });
    } //Iterate merkmale
}

function getQueryScore(query, callback){
    let scores = [];
    
    query = query.toLowerCase();
    let words = query.split(" ");

    for(let w in words)
    {
        //Check if word is okay and incr it at the words list of the merkmal
        let word = words[w];

        let normalized = "";
        for(let c in word)
            if(allowedSigns.indexOf(word[c]) != -1)
                normalized += word[c];
        
        if(normalized != undefined && normalized != null && normalized != "" && normalized != " ")
        {
            //Do something with used words
            getScoresForWord(normalized, function(result){
                scores.push({word:word, normalized:normalized, result:result});
                if(scores.length == words.length)
                    callback(scores);
            });
        }
        else
        {
            scores.push({"word":word, "normalized":normalized, "error":"invalid_word"});
            if(scores.length == words.length)
                callback(scores);
        }
    }
}

function reduceResult(words, reduceMethod){

    let reduced;
    for(let w in words)
        if(words[w].result != undefined)
        {
            reduced = new Array(words[w].result.length);
            break;
        }

    for(let w in words)
    {
        if(words[w].result != undefined)
            for(let r in words[w].result)
            {
                if(reduced[r] == undefined)
                    reduced[r] = {category:words[w].result[r].category, score:1}; //0
                
                if(words[w].result[r].category != reduced[r].category)
                    throw new Error(words[w].result[r].category + "!=" + reduced[r].category);

                if(words[w].result[r].score != null && words[w].result[r].score != undefined && words[w].result[r].score != NaN && words[w].result[r].min != 100000000 &&  words[w].result[r].avg != 0)
                    reduced[r].score = reduceMethod(parseFloat(reduced[r].score), words[w].result[r]); 
            }
    }

    reduced.sort(function(a, b){return b.score - a.score});
    return reduced;
}

client.on('connect', function() {
    client.select(1, function(err, res){ 
        if(err != null)
            console.log(err)
        else
        {
            let msg = "Rechtsruck Strasse";
            
            getQueryScore(msg, function(result){
                console.log(JSON.stringify(result, null, 3));
                console.log("");

                let reducedAddition = reduceResult(result, function(oldScore, obj){
                    return oldScore + (parseFloat(obj.avgNormalizedScore) / parseFloat(obj.avg)); //Gewichte seltene worte höher
                });

                console.log(reducedAddition);
                console.log(" ");
                
            });
        } // no error connecting
    });
});