const child_process = require("child_process");
const mkdirp = require("mkdirp");

module.exports = {

    DownloadGhTorrent : () => {
        let args = process.argv.slice(3);
        if (args.length < 2) {
            console.log("Invalid number of arguments");
            console.log("see README.md");
            process.exit(-1);
        }
        let name = args[0]
        let outputDir = args[1];
        if (!outputDir.endsWith("/"))
            outputDir += "/";
        let discardData = false;
        for (let i = 2; i < args.length; ++i) {
            if (args[i] == "--discard-data") {
                discardData = true;
            } else {
                console.log("unknown argument: " + args[i]);
                console.log("see README.md");
                process.exit(-1);
            }
        }
        console.log("ghtorrent.name = " + name);
        console.log("ghtorrent.outputDir = " + outputDir);
        console.log("ghtorrent.keepData = " + discardData);
    
        mkdirp.sync(outputDir + name);
        console.log("downloading ghtorrent dump...")
        let dumpFile = outputDir + name + "/ghtorrent.tar.gz";
        child_process.execSync("curl -S http://ghtorrent-downloads.ewi.tudelft.nl/mysql/mysql-"+ name + ".tar.gz > " + dumpFile);
        console.log("extracting projects table...");
        child_process.execSync("tar --extract --to-stdout --file=" + dumpFile + " mysql-" + name + "/projects.csv > " + outputDir + name + "/projects.csv");
        if (discardData) {
            console.log("deleting the snapshot...");
            child_process.execSync("rm -f " + dumpFile);
        }
        console.log("DONE.");
    }
}