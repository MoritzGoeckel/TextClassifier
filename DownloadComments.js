const DownloadQueue = require('./Includes/DownloadQueue.js');
const redis = require("redis");

const token = "?access_token=829794167161240|f3f1697d5230b58304a9d0dc2bbf788e";
const baseUrl = "https://graph.facebook.com/";

const Data = require("./Includes/data.js");

//Executing

const merkmale = Data.merkmale;

let que = new DownloadQueue(5);
let commentCount = 0;

client = redis.createClient();
client.on('connect', function() {
    client.select(1, function(err, res){ 
        if(err != null)
            console.log(err)
        else{

            //Main code
            /*client.keys('*', function (err, keys) {
                console.log(keys);
            });*/

            for(let m = 0; m < merkmale.length; m++)
                for(let s in merkmale[m].seiten)
                    downloadPages(baseUrl + merkmale[0].seiten[s] + "/posts" + token, gotPostsPage, {label:merkmale[m].name, page:merkmale[m].seiten[s]});
        }
    });
});

function gotPostsPage(posts, callbackArg, getPreviousPage, getNextPage){

    if(posts != undefined)
        for(let i in posts)
        {
            if(posts[i].message != "" && posts[i].message != " " && posts[i].message != null && posts[i].message != undefined)
                client.lpush(callbackArg.label + "_" + callbackArg.page, posts[i].message, function(err, reply){if(err != null) console.log(err);});

            downloadPages(baseUrl + posts[i].id + "/comments" + token, gotCommentsPage, callbackArg);
        }
    else
        console.log("Posts undefined :(");

    //console.log(getPreviousPage);
    //console.log(getNextPage);

    if(getNextPage != undefined)
        getNextPage();
}

function gotCommentsPage(comments, callbackArg, getPreviousPage, getNextPage)
{
    if(comments != undefined)
    {
        console.log((commentCount += comments.length / 1000) + "K comments");
        console.log(que.getOpenConnections() + "c " + que.getQueueLength() + "L");
        
        for(let i in comments)
        {
            if(comments[i].message != "" && comments[i].message != " " && comments[i].message != null && comments[i].message != undefined)        
                client.lpush(callbackArg.label + "_" + callbackArg.page, comments[i].message, function(err, reply){if(err != null) console.log(err);});
        }
    }
    else
        console.log("Comments undefined :(");

    //console.log(getPreviousPage);
    //console.log(getNextPage);

    if(getNextPage != undefined)
        getNextPage();
}

//Supporting function

function downloadPages(url, callback, callbackArg)
{   
    que.enqueDownload(url, function(respUrl, error, response, body){  

        if(error != null)
            console.log(error);

        let res;
        try {
            res = JSON.parse(body);
        }catch(e){
            console.log("JSON ERROR: ");
            console.log(e);
            console.log("Body:");
            console.log(body);
            console.log("Response:");
            console.log(response);
            callback([], callbackArg, undefined, undefined);
        }

        if(res != undefined)
        {
            let getNextPage;
            let getPreviousPage;

            if(res.paging != undefined)
            {
                if(res.paging.previous != undefined)
                {
                    getPreviousPage = function(){downloadPages(res.paging.previous, callback, callbackArg);};
                }

                if(res.paging.next != undefined){
                    getNextPage = function(){downloadPages(res.paging.next, callback, callbackArg);};
                }
            }

            callback(res.data, callbackArg, getPreviousPage, getNextPage);
        }
    });
}