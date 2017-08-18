const { lstatSync, readdirSync } = require('fs');
const { join } = require('path');
const isDirectory = source => lstatSync(source).isDirectory();
const utils = require("./utils.js");

module.exports = {
	help: function() {},
	siftProjects: function() {
		let path = process.argv[3];
		let num = Number.parseInt(process.argv[4]);
		let projects = utils.listProjects(path, num);
		for (let p of projects) {
			utils.analyzeProjectTools(p);
			utils.analyzeProjectDependencies(p);
			utils.addMetaData(p);
			labelProject(p);
		};
		getResults(projects);

	},
	getUrl: function(path) {
		
	},
}

function labelProject(p) {
	p.labels = {};

	const labels = {
		GUI : ["express", "react"],
		NJS : ["chalk", "request", "mkdirp", "commander"],
		CLI : []
	};

	for (let l in labels) {
		p.labels[l] = 0;
		for (let dep of labels[l]) {
			if (p.dependencies[dep]) {
				p.labels[l] = p.labels[l] + 1;
			}
			else {
				// do nothing	
			}
		}

	}
};

function getResults(ps) {
	var GUIs = { total: 0, urls: [] };
	var NJSs = { total: 0, urls: [] };
	
	for (let p of ps) {
		if (p.labels.GUI) {
			GUIs.total = GUIs.total + 1;
			GUIs.urls.push(p.url);
		};
		if (p.labels.NJS) {
			NJSs.total = NJSs.total + 1;
			NJSs.urls.push(p.url);
		};
	}

	console.log("Total GUI projects: ".concat(GUIs.total));
	console.log("Total NJS projects: ".concat(NJSs.total));
	console.log("\n");
	console.log("GUI projects: ".concat(GUIs.urls).split(",").join("\n"));
	console.log("\n");
	console.log("NJS projects: ".concat(NJSs.urls).split(",").join("\n"));
};


/*
var chalk       = require('chalk');
var clear       = require('clear');
var CLI         = require('clui');
var figlet      = require('figlet');
var fs          = require('fs');

var root = "../../js_files/";
var files = [];
var no_package_file_list = []
var node_js_GUI = []

clear();
console.log(
  chalk.yellow(
    figlet.textSync('JS TBD', { horizontalLayout: 'full' })
  )
);

function getFileDir(callback) {
  var info = [
    {
      name: 'root_dir',
      type: 'input',
      value: 'default',
      message: 'Enter file directory or press Return for default:',
      // Maybe leave this in for later... to specify a different directory
      /* Who likes options? We don't.
      validate: function( value ) {
        if (value.length) {
	  root = value;
          return true;
        } else {
          return true;
        }
      }
      */

/*
    },
  ];
  //inquirer.prompt(info).then(callback);
}



function getFolders(path) {
	files = readdirSync(path).map(name => join(path, name)).filter(isDirectory);
	checkPackage(files);
}

/*

function checkPackage(dirs) {
	var i = 0;
	while (i < dirs.length) {
		fname = dirs[i].concat("/package.json");
		if (fs.existsSync(fname)) {
			package_JSON_sorter(dirs[i], fname);
			console.log(fname);
		}
		else {
			no_package_file_list.push(dirs[i]);
			console.log("TODO does not exist")
		}
		i = i+1;
	}
	console.log(node_js_GUI);
	//console.log(no_package_file_list);
}

function package_JSON_sorter(dname, file) {
	var obj = JSON.parse(fs.readFileSync(file, 'utf8'));
	var deps = obj['dependencies'];
	if (deps != undefined) {
		if (deps['jquery'] != undefined) {
			// package.json file + jquery = high likelihood of node.js GUI
			node_js_GUI.push(dname);
			return;
		}
		
		else {
			// TODO doesn't have jquery
		}
	}
	else {
		console.log("todo -- doesn't have 'dependencies' key");
	}
}

getFileDir(getFolders());
*/


//getFileDir(function(){
//});
