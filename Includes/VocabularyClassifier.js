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

        let getScoresForWord = function(word, labelWights, callback)
        {
            let results = [];
            for(let m = 0; m < labels.length; m++) //Iterate label
            {
                theBase.redis.zscore("wordcount_" + labels[m], word, function(err, res){
                    if(err != null){
                        console.log(err);
                        results.push({label:labels[m], score:NaN});
                    }
                    else
                        results.push({label:labels[m], score:res / labelWights[m]});

                    //When finished
                    if(results.length >= labels.length)
                    {
                        let avg = 0;
                        let avgEntries = 0;

                        let min = 100000000;
                        for(let r in results)
                        {
                            if(results[r].score != NaN && results[r].score != null)
                            {
                                //Avg
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
            } //Iterate label
        };

        let getQueryScore = function(query, callback){
            let scores = [];
            let normalizedQuery = theBase.normalizeText(query);

            let wightsDone = 0;

            let labelWights = new Array(labels.length);
            for(let l in labels)
            {
                theBase.redis.get("totalwordcount_" + labels[l], function(err, res)
                {
                    if(err != null)
                        console.log(err);

                    labelWights[l] = parseFloat(res);
                    wightsDone++;

                    //Done taking all the wights
                    if(wightsDone >= labelWights.length)
                    {
                        for(let i in normalizedQuery)
                        {
                            getScoresForWord(normalizedQuery[i].word, labelWights, function(result){
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
                            reduced[r] = {label:words[w].result[r].label, score:1}; //0
                        
                        if(words[w].result[r].label != reduced[r].label)
                            throw new Error(words[w].result[r].label + "!=" + reduced[r].label);

                        if(words[w].result[r].score != null && words[w].result[r].score != undefined && words[w].result[r].score != NaN && words[w].result[r].min != 100000000 &&  words[w].result[r].avg != 0)
                            reduced[r].score = reduceMethod(parseFloat(reduced[r].score), words[w].result[r]); 
                    }
            }

            reduced.sort(function(a, b){return b.score - a.score});
            return reduced;
        };

        //The actual execution
        getQueryScore(text, function(result){
            let additionReduced = reduceResult(result, function(oldScore, obj){
                return oldScore + (parseFloat(obj.avgNormalizedScore) / parseFloat(obj.avg)); //Gewichte seltene worte höher
            });
            callback(result, additionReduced);
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
}