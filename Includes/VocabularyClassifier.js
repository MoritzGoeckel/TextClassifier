module.exports = class VocabularyClassifier{
    constructor(redis, combinations)
    {
        this.redis = redis;
        this.allowedSigns = "ßqwertzuiopüasdfghjklöäyxcvbnm";
        this.wordCombinationsCount = combinations;
    }

    normalizeText(text)
    {
        text = text.toLowerCase();
        
        let normalizedWordsArray = [];
        let words = text.split(" ");
        for(let w in words)
        {
            let word = words[w];

            let normalizeWord = "";
            for(let c in word)
                if(this.allowedSigns.indexOf(word[c]) != -1)
                    normalizeWord += word[c];

            if(normalizeWord != undefined && normalizeWord != null && normalizeWord != "" && normalizeWord != " ")
                normalizedWordsArray.push(normalizeWord);
        }

        let wordCombinations = [];
        for(let i = 0; i < normalizedWordsArray.length; i++)
        {
            for(let b = 1; b <= this.wordCombinationsCount; b++)
            {
                if(b + i <= normalizedWordsArray.length)
                {
                    let word = "";
                    for(let c = 0; c < b; c++)
                    {
                        if(c == 0)
                            word += normalizedWordsArray[c + i];
                        else
                            word += " " + normalizedWordsArray[c + i];
                    }
                    wordCombinations.push(word);
                }
            }
        }

        let dict = {};
        for(let i in wordCombinations){
            if(dict[wordCombinations[i]] == undefined)
                dict[wordCombinations[i]] = 1;
            else
                dict[wordCombinations[i]]++;
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
                theBase.redis.zscore("wordcount_" + labels[m].label, word, function(err, count){
                    if(err != null){
                        console.log(err);
                        results.push({label:labels[m].label, partOfLanguage:NaN});
                    }
                    else
                        results.push({label:labels[m].label, partOfLanguage:count / labelTotalCounts[m]});

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
                theBase.redis.get("totalwordcount_" + labels[l].label, function(err, res)
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
        let theBase = this;
        this.redis.keys("totalwordcount_*", function(err, res){
            if(err != null)
                console.log(err);
            
            let output = [];
            for(let i in res)
            {
                theBase.redis.get(res[i], function(err2, res2){
                    output.push({"label":res[i].replace("totalwordcount_", ""), "words":res2});
                    if(output.length >= res.length)
                        callback(output);
                });
            }
        });
    }
}
