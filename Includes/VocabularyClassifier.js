module.exports = class VocabularyClassifier{
    constructor(redis)
    {
        this.redis = redis;
        this.allowedSigns = "ßqwertzuiopüasdfghjklöäyxcvbnm";
    }

    normalizeText(text)
    {
        let dict = {};
        text = text.toLowerCase();
        
        let words = text.split(" ");
        for(let w in words)
        {
            let word = words[w];

            let normalizeWord = "";
            for(let c in word)
                if(this.allowedSigns.indexOf(word[c]) != -1)
                    normalizeWord += word[c];

            if(normalizeWord != undefined && normalizeWord != null && normalizeWord != "" && normalizeWord != " ")
            {
                if(dict[normalizeWord] == undefined)
                    dict[normalizeWord] = 1;
                else
                    dict[normalizeWord]++;
            }
        }

        let outputArray = [];
        for(let k in dict)
            outputArray.push({word:k, count:dict[k]});
        
        return outputArray;
    }

    trainLabel(labelName, text, callback)
    {
        let updatesDone = 0;

        let totalWordsAdded = 0;
        let normalizedWords = this.normalizeText(text);
        for(let i in normalizedWords){
            totalWordsAdded += normalizedWords[i].count;
            this.redis.zincrby("wordcount_" + labelName, normalizedWords[i].count, normalizedWords[i].word, function(err, res){
                if(err != null)
                    console.log(err);
                
                updatesDone++;
                if(updatesDone >= normalizedWords.length)
                    callback();
            });
        }

        this.redis.incrby("totalwordcount_" + labelName, totalWordsAdded, function(err, res){
            if(err != null)
                console.log(err);
        });
    }

    classifyText(labels, text, callback)
    {
        let theBase = this;

        let getScoresForWord = function(word, labelTotalCounts, callback)
        {
            let results = [];
            for(let m = 0; m < labels.length; m++) //Iterate label
            {
                theBase.redis.zscore("wordcount_" + labels[m], word, function(err, count){
                    if(err != null){
                        console.log(err);
                        results.push({label:labels[m], partOfLanguage:NaN});
                    }
                    else
                        results.push({label:labels[m], partOfLanguage:count / labelTotalCounts[m]});

                    //When finished
                    if(results.length >= labels.length)
                    {
                        let sum = 0;
                        let entries = 0;

                        //let min = 100000000;
                        for(let r in results)
                        {
                            if(results[r].partOfLanguage != NaN && results[r].partOfLanguage != null)
                            {
                                sum += parseFloat(results[r].partOfLanguage);
                                entries++;
                            }
                        }

                        for(let r in results)
                        {
                            if(entries != 0 && sum != 0)
                                results[r].score = results[r].partOfLanguage / sum;
                            else
                                results[r].score = 0;
                        }

                        callback(results);
                    }
                });
            } //Iterate label
        };

        let getQueryScore = function(query, callback){
            let scores = [];
            let normalizedQuery = theBase.normalizeText(query);

            if(normalizedQuery.length == 0)
            {
                callback({"error":"nothing to analyse", "input":query});
                return;   
            }

            let wightsDone = 0;

            let labelTotalCounts = new Array(labels.length);
            for(let l in labels)
            {
                theBase.redis.get("totalwordcount_" + labels[l], function(err, res)
                {
                    if(err != null)
                        console.log(err);

                    labelTotalCounts[l] = parseFloat(res);
                    wightsDone++;

                    //Done taking all the wights
                    if(wightsDone >= labelTotalCounts.length)
                    {
                        for(let i in normalizedQuery)
                        {
                            getScoresForWord(normalizedQuery[i].word, labelTotalCounts, function(result){
                                scores.push({word:normalizedQuery[i].word, result:result});
                                if(scores.length == normalizedQuery.length)
                                    callback(scores);
                            });
                        }
                    }
                });
            }
        };

        let reduceResult = function(words, reduceMethod){
            let reduced;

            if(words.length == undefined)
                return [];

            for(let w in words)
                if(words[w].result != undefined)
                {
                    reduced = new Array(words[w].result.length);
                    break;
                }

            if(reduced == undefined)
                return [];

            for(let w in words)
            {
                for(let r in words[w].result)
                {
                    if(reduced[r] == undefined)
                        reduced[r] = {label:words[w].result[r].label, score:0}; 
                        //Change start the value if you want a multiply reduce
                    
                    if(words[w].result[r].label != reduced[r].label)
                        throw new Error(words[w].result[r].label + "!=" + reduced[r].label);

                    reduced[r].score += parseFloat(words[w].result[r].score); 
                    //Plus is the reduce method, you can change it to multiply if you want
                }
            }


            let sum = 0;
            for(let r in reduced)
                sum += reduced[r].score

            if(sum == 0)
                sum = 1;

            for(let r in reduced) //Normalize
                reduced[r].score /= sum;

            reduced.sort(function(a, b){return b.score - a.score});
            return reduced;
        };

        //The actual execution
        getQueryScore(text, function(result){
            callback(result, reduceResult(result));
        });
    }

    removeLabel(labelName, callback)
    {
        this.redis.del("totalwordcount_" + labelName, "wordcount_" + labelName, function(err, res){
            if(err != null)
                console.log(err);
            
            if(callback != undefined)
                callback();
        });
    }

    getLabelWordCount(labelName, callback)
    {
        this.redis.get("totalwordcount_" + labelName, function(err, res){
            if(err != null)
                console.log(err);
            
            callback(res);
        });
    }

    getLabels(callback)
    {
        this.redis.keys("totalwordcount_*", function(err, res){
            if(err != null)
                console.log(err);
            
            for(let i in res)
            {
                res[i] = res[i].replace("totalwordcount_", "");
            }

            callback(res);
        });
    }
}