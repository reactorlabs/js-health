const fs = require("fs");
const request = require("request");

module.exports = {
    /** Loads the api tokens from given file.
     */
    LoadTokensSync : (filename) => {
        tokens = JSON.parse(fs.readFileSync(filename));
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