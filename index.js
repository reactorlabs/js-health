const child_process = require("child_process");
const path = require("path");
const fs = require("fs");
const readline = require('readline');
const async = require("async");
const utils = require("./stuff/utils.js");
const download_stars = require("./stuff/download_stars.js");
const test_runner = require("./stuff/test_runner.js");
const sift = require("./stuff/type_sorter.js");
const filter = require("./stuff/projects_filter.js");
const downloader = require("./stuff/downloader.js");



function main() {
    if (process.argv.length <= 2) {
        console.log("Invalid usage, specify the action");
        console.log("see README.md");
        process.exit(-1);
    }

    let action = process.argv[2];
    switch (action) {
        case "filter":
            filter.filter();
            return;
        case "download":
            downloader.Download();
            return;
    	case "downloadTestProjects":
	        test_runner.downloadTestProjects(apiTokens);
	    case "git_js":
	        download_all.git_js(apiTokens);
	        return;
        case "topStars":
            download_stars.download(apiTokens);
            break;
        case "testable":
            test_runner.analyzeProjects();
            break;
        case "runTests":
            test_runner.runTests(false);
            break;
	    case "timeTests":
	        test_runner.timeTests();
        case "help":
            help();
            break;
        case "sift":
            sift.siftProjects();
            break;
        case "dev-freqs":
            utils.devFreqs();
            break;
        default:
            console.log("Invalid action name " + action);
            console.log("see README.md");
            process.exit(-1);
    }

    console.log("Done.");
    process.exit();
}

main();
