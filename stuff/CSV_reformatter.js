var fs = require("fs")
var csv_parser = require("csv-parse")

// hardcoded because I can
// var input = "/mnt/data/ghtorrent/mysql-2017-09-01/projects.csv"
var input = process.argv[2];
var output = "js-projects-formatted.csv"


// gets the project url from the parsed CSV record
function projectUrl(record) {
    // get rid of the https://api.github.com/repos/
    return record[1].substring(29)
}

// gets the id of the language, or undefined if the language is not supported
function projectLanguage(record) {
    return languages[record[5]];
}

// returns 1 if the project is deleted, 0 otherwise (not using booleans because they produce longer output:)
function isDeleted(record) {
    return record[8] == 1 ? 1 : 0;
}

// returns 1 if the project is a fork, 0 otherwise
function isForked(record) {
    return record[7] != "\\N" ? 1 : 0;
}

// returns the timestamp in seconds when the project was created
// TODO this needs checking would be my guess
function projectCreatedAt(record) {
    var dateString = record[6];
    var patt = new RegExp(/(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
    var groups = dateString.match(patt);
    var year = groups[1];
    var month = groups[2];
    var day = groups[3];
    var hour = groups[4];
    var min = groups[5];
    var sec = groups[6];
    return Date.UTC(year, month, day, hour, min, sec) / 1000;
//    return new Date(record[6]).getTime() / 1000
}

/* Storing languages as integers shoudl be cheaper memory-wise. Just list there languages you are interested in and given them unique ids. 
 */
var languages = {
    "JavaScript" : 0,
    "TypeScript" : 1,
    "CoffeeScript": 2,
}


// some bookkeeping
var totalProjects = 0;
var errors = 0;
var langProjects = 0;
var deletedProjects = 0;
var duplicateProjects = 0;
var forkedProjects = 0;
var validProjects = 0;
var seenProjects = {};



// create the parser, specify escape character so that it would correctly parse the projects...
var parser = csv_parser({escape : '\\' })

// specify what to do when there are new records
parser.on("readable", function() {
    while (record = parser.read()) {
        // just check that we have parsed the line correctly
        if (record.length != 11) {
            console.log("ERROR: " + record[0]);
            ++errors;
        }
        // some debugging to see that the script still does stuff
        if (++totalProjects % 100000 == 0)
            console.log("processed: " + totalProjects);
        try {
            // only use projects from the selected language
            let lang = projectLanguage(record);
            if (lang == undefined)
                continue;
            ++langProjects;
            // if the project is deleted, ignore it
            if (isDeleted(record)) {
                ++deletedProjects;
                continue;
            }
            // get the other properties of the project
            let url = projectUrl(record);
            let createdAt = projectCreatedAt(record);
            let isFork = isForked(record);
            // get the project to see if there are duplicates
            let p = seenProjects[url];
            // we have seen it
            if (p != undefined) {
                ++duplicateProjects;
                // do not update the project info is the already seen project is younger
                if (p.createdAt > createdAt)
                    continue;
            } else {
                ++validProjects;
                if (isFork)
                    ++forkedProjects;
            }
            // update the project info
            seenProjects[url] = { createdAt : createdAt, lang: lang, fork: isFork };
        } catch (e) {
            console.log("ERROR: " + e);
            ++errors;
        }
    }
})

// determine what happens when the entire input csv is parsed
parser.on("finish", function() {
    // some debug printing
    console.log("total rows: " + totalProjects);
    console.log("errors:     " + errors);
    console.log("lang projects: " + langProjects);
    console.log("deleted projects: " + deletedProjects);
    console.log("duplicatProjects: " + duplicateProjects);
    console.log("forked projects: " + forkedProjects);
    console.log("valid projects: " + validProjects);
    // let's write the projects out
    ostream = fs.createWriteStream(output);
    for (let url in seenProjects) {
        let p = seenProjects[url];
        ostream.write(url + "," + p.lang + "," + p.fork + "," + p.createdAt + "\n");
    }
    // and we are done
    ostream.end();
    // do not exit or something because the whole thing above is async
});

// create input stream for the input CSV file
var istream = fs.createReadStream(input)
// and pipe it to the parser
istream.pipe(parser)
