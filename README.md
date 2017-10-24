# Vocabulary Classifier
Supervised learning for text classification based on vocabulary analysis for NodeJS. It depends on redis and is supposed to handle huge amounts of data for training.

## API
``` Javascript
new VocabularyClassifier(redisClient)
.normalizeText(text)
.trainLabel(labelName, text, callback)
.classifyText(labelsArray, text, callback)
.removeLabel(labelName, callback)
.getLabelWordCount(labelName, callback)
.getLabels(callback)
```

## Usage
``` Javascript
//The classifier depends on redis
const redis = require("redis"); 

//Import the classifier
const VocabularyClassifier = require("./VocabularyClassifier.js"); 

//Create a redis client
const client = redis.createClient();

//Create a instance of the Classifier
let classifier = new VocabularyClassifier(client);

//Wait until redis is connected
client.on('connect', function() {

    //Train the classifier with labeled data
    classifier.trainLabel("german", "dies ist ein deutscher text text", function(){

        //Train it again with different labeld data
        classifier.trainLabel("english", "this is an english text", function(){

            //Classify a new text
            classifier.classifyText(["german", "english"], "dies ist", function(wordForWord, reduced){
                
                //Output the result for every word
                console.log(JSON.stringify(wordForWord, null, 3));
                
                //Output the result for the entire text
                console.log(reduced);
                // > [ { label: 'german', score: 0.875 },
                //     { label: 'english', score: 0.125 } ]

                //Output the trained labels
                classifier.getLabels(function(result){
                    console.log(result);
                    // > [ 'english', 'german' ]

                    //Remove the labels to free the redis database
                    classifier.removeLabel("german");
                    classifier.removeLabel("english");
                });

            });
        });
    });
});
```

## Example result of .classifyText(...)
The word for word result
``` Javascript
[
   {
      "word": "text",
      "result": [
         {
            "label": "german",
            "partOfLanguage": 0.3333333333333333,
            "score": 0.625
         },
         {
            "label": "english",
            "partOfLanguage": 0.2,
            "score": 0.375
         }
      ]
   },
   ...
]
```

The overall text result. This text is obviously german. 
``` Javascript
[ { label: 'german', score: 0.875 },
  { label: 'english', score: 0.125 } ]
```

##Dependencies
* redis
