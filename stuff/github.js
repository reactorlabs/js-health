const fs = require("fs");
const request = require("request");

let tokensFile = "github-tokens.json"; // file containing github API Tokens that can be used by the downloader

module.exports = {

    ParseArguments : (args) => {
        for (let i = 0; i < args.length; ++i) {
            if (args[i].startsWith("--github-tokens=")) {
                tokensFile = args[i].substr(16);
            } else {
                continue;
            }
            args.splice(i, 1);
        }
        console.log("github.tokensFile = " + tokensFile);
    },

    /** Loads the api tokens from given file.
     */
    LoadTokensSync : () => {
        tokens = JSON.parse(fs.readFileSync(tokensFile));
        console.log("loaded " + tokens.length + " Github API tokens");
        return tokens.length;
    },

    Request : (url, callback, json = true, retries = 10) => {
        let options = {
            url : "http://api.github.com/" + url,
            json : json,
            headers : {
                "Authorization" : "token " + GetNextToken(),
                "User-Agent" : "js-health"
            } 
        };
        // call request, async
        request(options, (err, response, body) => {
            // first see if we should retry the request  && error.code == "ETIMEDOUT"
            if (err) {
                if (retries > 0) 
                    return module.exports.Request(url, onDone, json, retries - 1);
                else
                    callback(err);
            }
            // if not proceed as normally
            if (response.statusCode != 200)
                err = response.statusCode;
            // callback
            callback(err, body, response);
        });
    }
}

function GetNextToken() {
    let result = tokens[ti++];
    if (ti == tokens.length)
        ti = 0;
    return result;
}

let tokens = [];
let ti = 0;