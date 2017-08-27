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
		CLI : ["inquirer",
			"update-notifier"],
		CLS : ["angular",
			"body-parser",
			"connect",
			"express",
			"jade"],
		DOM : ["angular",
			"bootstrap",
			"d3",
			"ejs",
			"express",
			"font-awesome",
			"jquery",
			"less",
			"method-override",
			"postcss",
			"react",
			"react-dom",
			"react-router",
			"url-loader"],
		LIB : ["async",
			"babel-loader",
			"babel-runtime",
			"bluebird",
			"body-parser",
			"chalk",
			"commander",
			"d3",
			"debug",
			"es6-promise",
			"express",
			"fs-extra",
			"gulp-util",
			"history",
			"lodash",
			"minimatch",
			"mkdirp",
			"moment",
			"prop-types",
			"qs",
			"react",
			"react-redux",
			"request",
			"source-map",
			"underscore",
			"underscore.string",
			"validator",
			"winston",
			"xtend"],
		NJS : ["chalk",
			"cheerio",
			"chokidar",
			"colors",
			"connect",
			"cookie-parser",
			"commander",
			"inquirer",
			"express",
			"express-session",
			"formidable",
			"fs-extra",
			"glob",
			"grunt",
			"gulp",
			"gulp-util",
			"method-override",
			"minimatch",
			"minimist",
			"mkdirp",
			"mongodb",
			"mongoose",
			"morgan",
			"nodemailer",
			"passport-local",
			"compression",
			"object-assign",
			"optimist",
			"passport",
			"redis",
			"redux-thunk",
			"request",
			"resolve",
			"rimraf",
			"semver",
			"serve-favicon",
			"socket.io",
			"socket.io-client",
			"source-map-support",
			"through2",
			"uglify-js",
			"webpack",
			"winston",
			"ws",
			"yargs",
			"yeoman-generator"]		
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

	var uncategorized = [];
	
	for (let p of ps) {
		var dom_score = p.labels.DOM;
		var lib_score = p.labels.LIB;
		var njs_score = p.labels.NJS;
		var cli_score = p.labels.CLI;
		var cls_score = p.labels.CLS;

		if (dom_score === 0 && njs_score === 0 && cli_score === 0 && cls_score === 0 && lib_score === 0) {
			uncategorized.push(p);
		}
		else {
			console.log(p.url);
			console.log("  DOM deps: ".concat(dom_score));
			console.log("  LIB deps: ".concat(lib_score));
			console.log("  NJS deps: ".concat(njs_score));
			console.log("  CLI deps: ".concat(cli_score));
			console.log("  CLS deps: ".concat(cls_score));

		}
	}
	
	console.log("\n");
	console.log("Total projects: ".concat(ps.length));
	console.log("Uncategorized projects (no labeled dependencies): ".concat(uncategorized.length))
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
