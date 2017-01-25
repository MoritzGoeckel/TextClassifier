//The classifier depends on redis
const redis = require("redis"); 

//Import the classifier
const VocabularyClassifier = require("./Includes/VocabularyClassifier.js");

//Create a redis client
const client = redis.createClient();

//Wait until redis is connected
client.on('connect', function() {
    client.select(1, function(err, res){ 

        //Create a instance of the Classifier
        classifier = new VocabularyClassifier(client);

        //Train the classifier with labeled data
        classifier.trainLabel("german", "dies ist ein deutscher text text", function(){

            //Train it again with different labeld data
            classifier.trainLabel("english", "this is an english text", function(){
                
                //Classify a new text
                classifier.classifyText(["german", "english"], "dies ist", function(result, reduced){
                    
                    //Output the result for every word
                    console.log(JSON.stringify(result, null, 3));
                    
                    //Output the result for the entire text
                    console.log(reduced);
                    
                    //Output the trained labels
                    classifier.getLabels(function(result)
                    {
                        console.log(result);

                        //Remove the labels to free the redis database
                        classifier.removeLabel("german");
                        classifier.removeLabel("english");
                    })

                });
            });
        });        
    });
});