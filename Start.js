var request = require('request');
var redis = require("redis");

var token = "?access_token=829794167161240|f3f1697d5230b58304a9d0dc2bbf788e";
var baseUrl = "https://graph.facebook.com/";

var merkmale = [
    {"name":"afd", "seiten":["alternativefuerde", "AfDNuernberg", "afdrheinlandpfalz", "AfD.Thueringen", "AfDfuerNRW", "SachsenAnhalt.AfD", "AfD.BW", "AfD.Schleswig.Holstein.de", "AfDSaar"]},
    {"name":"spd", "seiten":["sigmar.gabriel", "SPD", "spdbw", "spdbundestagsfraktion", "spdhamburg", "spdstuttgart", "SPDStuttgartOst", "SPD.Berlin", "spdnds"]},
    {"name":"cdu", "seiten":["AngelaMerkel", "CDU", "cduberlin", "CDU.BW", "cduhessen", "CDUnrw", "cducsubundestagsfraktion", "cdusaar", "cdush", "cduhamburg"]},
    {"name":"gruene", "seiten":["Cem", "B90DieGruenen", "diegruenen", "diegruenensteiermark", "Buendnis90DieGruenenBerlin", "diegruenenwien", "gruene.leopoldstadt", "diegrazergruenen", "GRUENEsalzburg", "DieGruenenTirol", "gruenekaernten", "Gruene.im.Bundestag"]},
    {"name":"linke", "seiten":["linkspartei", "sahra.wagenknecht", "gregor.gysi", "DIELINKE.Berlin", "dielinke.nrw", "dielinke.brandenburg", "DIELINKE.Potsdam", "Hundestrasse14", "DieLinkeHessen", "dielinkebw", "DIELINKE.Bayern", "linksfraktion", "DIELINKE.Niedersachsen", "DIELINKE.ApoldaWeimar"]},
    {"name":"fdp", "seiten":["FDP", "fdp.dieliberalen", "fdpbw", "fdpnrw", "fdprlp"]},
    {"name":"christentum", "seiten":["Jesus-täglich-erleben-245097428843878", "Jesus-lebt-164528340324604", "Jesus.Die.Einzige.Hoffnung"]},
    {"name":"islam", "seiten":["IslamDerSchluesselZumParadies", "islamfaktenoffiziell"]},
    {"name":"antifa", "seiten":["Antifaschistisches-Aktionsbündnis-Stuttgart-und-Region-260705110668693"]},
    {"name":"npd", "seiten":["npd.de", "npd.sachsen", "afdnpd", "npdnrw", "npdmup"]},
 ];

var thePage = "SPD";

//Executing

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

            downloadPages(baseUrl + thePage + "/posts" + token, gotPostsPage);
        }
    });
});



//downloadPages(baseUrl + "adidas" + "/posts" + token, gotPostsPage);
//downloadPages(baseUrl + "182162001806727_10155244874798888" + "/comments" + token, gotCommentsPage);

function gotPostsPage(posts, getPreviousPage, getNextPage){
    console.log(posts.length);

    for(let i in posts)
    {
        if(posts[i].message != "" && posts[i].message != " " && posts[i].message != null && posts[i].message != undefined)
            client.lpush(thePage, posts[i].message, function(err, reply){if(err != null) console.log(err);});

        downloadPages(baseUrl + posts[i].id + "/comments" + token, gotCommentsPage);
    }

    console.log(getPreviousPage);
    console.log(getNextPage);

    if(getNextPage != undefined)
        getNextPage();
}

function gotCommentsPage(comments, getPreviousPage, getNextPage)
{
    console.log(comments.length);

    for(let i in comments)
    {
        if(comments[i].message != "" && comments[i].message != " " && comments[i].message != null && comments[i].message != undefined)        
            client.lpush(thePage, comments[i].message, function(err, reply){if(err != null) console.log(err);});
    }

    console.log(getPreviousPage);
    console.log(getNextPage);

    if(getNextPage != undefined)
        getNextPage();
}

//Supporting function

function downloadPages(url, callback)
{   
    request(url, function(error, response, body){
        
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
            callback([], undefined, undefined);
        }

        if(res != undefined)
        {
            let getNextPage;
            let getPreviousPage;

            if(res.paging != undefined)
            {
                if(res.paging.previous != undefined)
                {
                    getPreviousPage = function(){downloadPages(res.paging.previous, callback);};
                }

                if(res.paging.next != undefined){
                    getNextPage = function(){downloadPages(res.paging.next, callback);};
                }
            }

            callback(res.data, getPreviousPage, getNextPage);
        }
    });
}