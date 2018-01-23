const fs = require("fs");
const child_process = require("child_process");
const LineByLineReader = require("line-by-line");
const async = require("async");



let Q = null;

let blacklist = null;
let outputFile = null;

let totalClosed = 0;
let totalErrors = 0;
let totalBlacklisted = 0;


module.exports = {
    Run : () => {
	// take all arguments
	let args = process.argv.slice(3);
	// extract the blacklist argument
	for (let arg of args)
	    if (arg.startsWith("--blacklist=")) {
		blacklist = arg.substr(12);
		break;
	    }
	if (blacklist == null) {
	    console.log("blacklist not specified");
	    process.exit(-1);
	}
	outputFile = blacklist + ".tmpout";



	Q = new async.queue(RunDownloader);
	Q.drain = () => {
	    console.log("ALL DONE.");
	    process.exit();
	}
	Q.push({ args : args });
    }
    
      


    
}

function RunDownloader(args, callback) {
    console.log("Executing downloader...");
    // we start by running the downloader with given options
    let cmd = "node --stack-size=1024000000 index.js download " + args.args.join(" ") + " &> " + outputFile;
    console.log("  " + cmd);
    try {
	child_process.execSync(cmd, { shell: "/bin/bash" });
	child_process.execSync("rm " + outputFile);
	console.log("  no errors...");
    } catch (e) {
	//console.log(e);
	console.log("  failed, analyzing output information...")
	// if the spawned process has failed, analyze its output and try to restart it
	ExtractBlacklist(outputFile, (projects) => {
	    UpdateBlacklist(blacklist, projects);
	    Q.push(args);
	    callback();
	})
    }
}

/* Given the output filename, analyzes it and determines which projects should likely be blacklisted. When done, calls the callback function with an object containing the projects which have not been closed by the time of the fault, which are the likely candidates to be blacklisted. 
 */
function ExtractBlacklist(output, callback) {
    let projects = {};
    let errors = 0;
    let closed = 0;
    // analyze the output file line by line
    let reader = new LineByLineReader(output);
    reader.on("end", () => {
	totalClosed += closed;
	totalErrors += errors;
	totalBlacklisted += Object.keys(projects).length;
	console.log("closed projects " + closed + " (" + totalClosed + ")");
	console.log("errors          " + errors + " (" + totalErrors + ")");
	console.log("blacklisted     " + Object.keys(projects).length) + " (" + totalBlacklisted + ")";
	callback(projects);
    });
    reader.on("line", (line) => {
	if (line.startsWith("!")) {
	    ++errors;
	} else if (line.startsWith("+")) {
	    let name = line.substr(1);
	    projects[name] = true;
	} else if (line.startsWith("-")) {
	    let name = line.substr(1);
	    delete projects[name];
	    ++closed;
	}
	// ignore all other lines
    });
}

/** Updates the blacklisted information.
 */
function UpdateBlacklist(blacklist, update) {
    // read the existing blacklist
    let blacklisted = {};
    if (fs.existsSync(blacklist))
        blacklisted = JSON.parse(fs.readFileSync(blacklist));
    // append the newly blacklisted projects
    for (let name of Object.keys(update))
	blacklisted[name] = true;
    // save the new blacklist
    fs.writeFileSync(blacklist, JSON.stringify(blacklisted));
}



