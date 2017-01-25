const Data = require("./Includes/data.js");
const Syncer = require("./Includes/Syncer.js");

const redis = require("redis");

var allowedSigns = "1234567890ßqwertzuiopüasdfghjklöäyxcvbnm";

const merkmale = Data.merkmale;
const client = redis.createClient();

function getScoresForWord(word, callback)
{
    let results = {word:word};
    for(let m = 0; m < merkmale.length; m++) //Iterate merkmale
    {
        client.hget("wighted_"+ merkmale[m].name, word, function(err, res){
                if(err != null){
                    console.log(err);
                    results[merkmale[m].name] = NaN;
                }

                results[merkmale[m].name] = res;
                if(Object.keys(results).length - 1 >= merkmale.length)
                    callback(results);
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

        let usedWord = "";
        for(let c in word)
            if(allowedSigns.indexOf(word[c]) != -1)
                usedWord += word[c];

        if(usedWord != undefined && usedWord != null && usedWord != "" && usedWord != " ")
        {
            //Do something with used words
            getScoresForWord(usedWord, function(result){
                scores.push(result);
                if(scores.length == words.length)
                    callback(scores);
            });
        }
        else
        {
            scores.push({"word":word, "usedWord":usedWord, "error":"invalid_word"});
            if(scores.length == words.length)
                callback(scores);
        }
    }
}

function reduceResult(result){
    let reduced = {};
    for(let w in result)
    {
        for(let k in result[w])
        {
            if(k != "word" && k != "error" && k != "used_word")
            {
                if(reduced[k] == undefined)
                    reduced[k] = 1; //0
                
                reduced[k] *= result[w][k];
            }
        }
    }

    let sorted = [];
    for(let k in reduced)
    {
        sorted.push({category:k, score:reduced[k]});
    }
    sorted.sort(function(a, b){return b.score - a.score});

    return sorted;
}

client.on('connect', function() {
    client.select(1, function(err, res){ 
        if(err != null)
            console.log(err)
        else
        {
            getQueryScore("cdu", function(result){
                console.log(result);
                console.log("");
                let reduced = reduceResult(result);
                console.log(reduced);
                console.log(" ");
            });
        } // no error connecting
    });
});