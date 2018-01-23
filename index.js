const child_process = require("child_process");
const path = require("path");
const fs = require("fs");
const readline = require('readline');
const async = require("async");

const ghtorrent = require("./stuff/ghtorrent.js");
const filter = require("./stuff/filter.js");
const downloader = require("./stuff/downloader.js");
const downloader_runner = require("./stuff/downloader_runner.js");
const verifier = require("./stuff/verifier.js");


function main() {
    if (process.argv.length <= 2) {
        console.log("Invalid usage, specify the action");
        console.log("see README.md");
        process.exit(-1);
    }

    let action = process.argv[2];
    switch (action) {
        case "ghtorrent":
            ghtorrent.DownloadGhTorrent();
            break;
        case "filter":
            filter.Filter();
            return;
        case "download":
            downloader.Download();
            return;
        case "run_download":
            downloader_runner.Run();
    	    return;
        case "verify":
	    verifier.Verify();
  	    return;
        default:
            console.log("Invalid action name " + action);
            console.log("see README.md");
            process.exit(-1);
    }
    console.log("Done.");
    process.exit();
}

main();
