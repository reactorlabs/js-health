var request = require("request")

module.exports = {

    help : function() {

    },

    download : function(apiTokens) {
        apiTokens_ = apiTokens;
        console.log("Initialized with " + apiTokens_.length + " Github API tokens...");
        // load the projects now
        APIFullRequest(
            "http://api.github.com/repos/nborracha/titanium_mobile/commits",
            //"http://www.seznam.cz",
            (response, result) => {
                console.log(result.length);
            },
            (error, response, result) => {
                console.log(error);
            }
        );
    }
};

// when asking for commits I can do since to only get those I am interested in



var apiTokens_ = null;
var apiTokenIndex_ = 0;

/** Since the github  */
function APIFullRequest(url, onDone, onError, per_page = 100) {
    var result = [];
    let cont = (response, body) => {
        // append the results to the result, in place
        Array.prototype.push.apply(result, body);
        // determine if there is more to call
        let link = response.headers.link;
        if (link !== undefined) {
            // we are only interested in the first link
            link = link.split(", ")[0].split("; ");
            if (link[1] === "rel=\"next\"") {
                newUrl = link[0].substr(1).split(">")[0];
                APIRequest(newUrl, cont, onError);
                return;
            }
        }
        onDone(response, result);
    };
    // set the per-page limit
    url = url + "?per_page=" + per_page;
    APIRequest(
        url,
        cont,
        onError
    );

    //response.headers["link"]





}

function APIRequest(url, onDone, onError) {
    // rotate the api tokens to circumvent the 5000 requests per hour github limit
    let token = apiTokens[apiTokenIndex_++];
    if (apiTokenIndex_ == apiTokens.length)
        apiTokenIndex_ = 0;
    // create the request
    let options = {
        url : url,
        json : true,
        headers : {
            "Authorization" : "token " + token,
            "User-Agent" : "js-health"
        } 
    };
    // call request, async
    request(options, (error, response, body) => {
        if (error || response.statusCode != 200) {
            console.log(url + " -- error");
            onError(error, response, body);
        } else {
            console.log(url + " -- ok");
            onDone(response, body);
        }
    });
}




