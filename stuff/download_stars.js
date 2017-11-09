const child_process = require("child_process");
const path = require("path");
const fs = require("fs");
const readline = require('readline');
const async = require("async");
const utils = require("./utils.js");

module.exports = {
    help: function() {
        console.log("")
        console.log("topStars OUTPUT NUM LANG")
        console.log("    Downloads top NUM projects ordered by number of stars from github,")
        console.log("    using the given LANGUAGE into the OUTPUT directory. The directory")
        console.log("    is created if it does not exist. The projects are stored in")
        console.log("    subfolders corresponding to the project rank. Github metadata are")
        console.log("    are stored in the OUTPUT folder for each project, the name of the")
        console.log("    corresponds to project's subfolder.")
    },

    download: function(apiTokens) {
        if (process.argv.length !== 6) {
            module.exports.help();
            console.log("Invalid number of arguments for topStars action");
            process.exit(-1);
        }
        let output = process.argv[3];
        let numProjects = Number.parseInt(process.argv[4]);
        let language = process.argv[5];
        console.log("Downloading top " + numProjects + " projects...");
        let stars = undefined;
        let projects = {};
        let tidx = 0;
        let page = 11;
        let url = "";
        let pid = 0;
        while (pid < numProjects) {
            if (page === 11) {
                url = "https://api.github.com/search/repositories?q=language:" + language;
                if (stars !== undefined) 
                    url = url + "+stars:<=" + stars;
                url = url + "&sort=stars&order=desc&per_page=100";
                page = 1;
                ++tidx;
                if (tidx == apiTokens.length)
                    tidx = 0;
            }
            let cmd = "curl -s -H \"Authorization: token " + apiTokens[tidx] + "\" \"" + url + "&page=" + page + "\"";
            let response = child_process.execSync(cmd)
            let json = JSON.parse(response);
            for (let project of json.items) {
                if (projects[project.url] === undefined) {
                    projects[project.url] = true;
                    stars = project.stargazers_count;
                    console.log(project.url);
                    let downloadTo = output + "/" + pid;
                    if (utils.isDir(downloadTo))
                        utils.rm(downloadTo, "-rf")
                    child_process.execSync("GIT_TERMINAL_PROMPT=0 git clone " + project.clone_url + " " + downloadTo)
                    fs.writeFileSync(downloadTo + ".json", JSON.stringify(project));
                    ++pid;
                }
                if (pid >= numProjects)
                    return;
            }
            page = page + 1;
        }
    }
}
