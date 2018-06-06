const child_process = require("child_process");
const path = require("path");
const fs = require("fs");
const readline = require('readline');
const async = require("async");
const utils = require("./stuff/utils.js");
//const download_stars = require("./stuff/download_stars.js");
//const test_runner = require("./stuff/test_runner.js");
//const download_all = require("./stuff/download_all.js");
//const sift = require("./stuff/type_sorter.js");
const downloader_api = require("./stuff/downloader_api.js");
const filter = require("./stuff/projects_filter.js");
//const downloader = require("./stuff/downloader.js");

apiTokens = [
    "36df491663476ff4a13d53188253d43b5ef6d3c9",
    "38b337acfbf2bf1b3f463b3740043af40cccc203",
    "c74552cfd1b19711c1c055f90a4e08f86235e3d0",
    "ee746f6db8dbf93fbff7fafe271a31655be3e16f",
    "cb8b7cbf29474d699df19a00336b6c59e0f612f7",
    "92095b8c476f2a60094f0bde0796ff87a031a33d",
    "458d90ed712be7f75460ff25b4857a0f227a0490",
    "d3732a58fc25b6f28be2b8972f804bfeb228aa4d",
    "9c4c7852e18fd733a8cbe72dcd57e7eaa74eadf2",
    "5b3eecad3542f79f60a8d07d5b223b2ee5cfca69",
    "a7b6f8d11d54c790c1760b1a218c245b2695478f",
    "b0a73acba4b7c13709e34e48f9447139c8b5430f",
    "db30ea5d5d1f2faee9d1a83cc5a18869def7b533",
    "ed7b4743c569889f03aedaaa261b2c45cdaf3fa3",
    "0ef61a78d30a53117ae4216576cb7c232b0a7e9f",
    "bed58f3e8b3fbd28656be1d80569d9d36cd139d6",
    "6d1ae7b41590af63465c5ee35cc3b3e4b5ffb4bc",
    "cfb81b5dd3ea04fc7d05aa59b7b83639835e8f05",
    "308a5b847b2d451ce44af6d1ab06ea89d64cd94f",
    "60ae2dbdfcd0023ce41d67ef0a49805aae3c80b2",
    "a0a5e516fb26bbe639dd6674972741c2b2243a8c",
    "81589da5c47794358a3b0e07307f90a420595629",
    //"87e726374c61e399466dacf2d462c5f96205d0e5",
    "c44c3241c7ccb284a3d9661d65e8ceecffab4e5b",
    "a05a3989285f7c6fc463c77c35a86c6095e72945",
    "e0fb6a7a249566d695f3cc9ab7c148864497775d",
    "8a6eceeb42faeb861a451df1e01b031b4e5a593a"
];

let settings = {
    // details about the language being analyzed
    language : {
        // name of the language 
        name : "JavaScript",
        // extension of the language
        extension : ".js",
        // any file on the following path will be ignored when analysing
        excludePath : "node_modules",
        // these files will be included regardless their extension
        includeFiles : [
            "package.json"
        ]
    },
    
    // Path to the dump of the ghtorrent projects table
    ghTorrentProjects : "/mnt/data/ghtorrent/projects.csv",
    // if true, forked repositories will be filtered out in the filter phase
    ignoreForks : true,
    // Path to the file in which the filtered projects should be stored, or where the projects to be analyzed are read
    // TODO aka projectsFile
    filteredProjects : "/home/peta/rlabstest/projects.csv",
    
    outputDir : "/home/peta/rlabstest",
    
    // maximal number of concurrent API requests
    numApiWorkers : 1000,
    // maximal number of concurrent download requests (downloads do not use github API limits)
    numDownloadWorkers : 1000,

    // Array of public access git API tokens that will be rotated by the downloader.
    apiTokens : [
        "36df491663476ff4a13d53188253d43b5ef6d3c9",
        "38b337acfbf2bf1b3f463b3740043af40cccc203",
        "c74552cfd1b19711c1c055f90a4e08f86235e3d0",
        "ee746f6db8dbf93fbff7fafe271a31655be3e16f",
        "cb8b7cbf29474d699df19a00336b6c59e0f612f7",
        "92095b8c476f2a60094f0bde0796ff87a031a33d",
        "458d90ed712be7f75460ff25b4857a0f227a0490",
        "d3732a58fc25b6f28be2b8972f804bfeb228aa4d",
        "9c4c7852e18fd733a8cbe72dcd57e7eaa74eadf2",
        "5b3eecad3542f79f60a8d07d5b223b2ee5cfca69",
        "a7b6f8d11d54c790c1760b1a218c245b2695478f",
        "b0a73acba4b7c13709e34e48f9447139c8b5430f",
        "db30ea5d5d1f2faee9d1a83cc5a18869def7b533",
        "ed7b4743c569889f03aedaaa261b2c45cdaf3fa3",
        "0ef61a78d30a53117ae4216576cb7c232b0a7e9f",
        "bed58f3e8b3fbd28656be1d80569d9d36cd139d6",
        "6d1ae7b41590af63465c5ee35cc3b3e4b5ffb4bc",
        "cfb81b5dd3ea04fc7d05aa59b7b83639835e8f05",
        "308a5b847b2d451ce44af6d1ab06ea89d64cd94f",
        "60ae2dbdfcd0023ce41d67ef0a49805aae3c80b2",
        "a0a5e516fb26bbe639dd6674972741c2b2243a8c",
        "81589da5c47794358a3b0e07307f90a420595629",
        "c44c3241c7ccb284a3d9661d65e8ceecffab4e5b",
        "a05a3989285f7c6fc463c77c35a86c6095e72945",
        "e0fb6a7a249566d695f3cc9ab7c148864497775d",
        "8a6eceeb42faeb861a451df1e01b031b4e5a593a"
    ],


}


function help() {
    console.log("USAGE: node index.js ACTION ...")
    console.log("")
    console.log("Where ACTION is one of the following and ... is the extra arguments for the")
    console.log("selected action. NOTE that all paths must be absolute.")
    utils.help();
    download_stars.help();
    test_runner.help();
    download_all.help();

    // Add your own actions here
    console.log("")
    console.log("Example: node.js topStars /home/projects 10 JavaScripts")
    console.log("    (downloads top 10 JavaScript projects in /home/projects")
}

function main() {
    console.log("OH HAI CAN I HAZ NODE?")
    if (process.argv.length <= 2) {
        help();
        console.log("Invalid usage, specify the action");
        process.exit(-1);
    }

    let action = process.argv[2];
    switch (action) {
        case "filter":
            filter.filter(settings);
            return;
/*        case "download":
            downloader.Download();
            return;
        case "download-ginger":
            downloader.JSGinger();
            return;
        case "download-orange":
            downloader.JSOrange();
            return; */
        case "download":
            downloader_api.download(settings);
            return;
/*        case "git_js":
            download_all.git_js(apiTokens);
            return; */
/*        case "topStars":
            download_stars.download(apiTokens);
            break;
        case "testable":
            test_runner.analyzeProjects();
            break;
        case "runTests":
            test_runner.runTests();
            break; */
        case "help":
            help();
            break;
/*        case "sift":
            sift.siftProjects();
            break;
        case "dev-freqs":
            utils.devFreqs();
            break; */
        default:
            help();
            console.log("Invalid action name " + action);
            process.exit(-1);
    }

    console.log("KTHXBYE");
    process.exit();
}

main();
