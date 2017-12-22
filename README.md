# Installing `node.js`

Currently, we are using version `8.9.3`, in order to install this on Debian derivatives, do the following:

    curl -sL https://deb.nodesource.com/setup_8.x | sudo -E bash -
    sudo apt-get install -y nodejs

> TODO do something about npm too I guess, can anyone who runs this on a new machine check this? 

# Building

Simply run `npm install` in the repository root to install all dependencies. 

# Language Support

The bulk of the stages share a common language settings file which must be specified using the `--language=` command line argument. Its value must correspond to an existing filename in the `languages` directory (w/o the `.js` extension). This file will then be loaded in the stage and language specific functions from that file will be used to provide the support for the language. 

If you need to adapt the script to a new language, create a new language file and fill in the desired functionality. Looking at the code of teh `languages/JavaScript.js` file is a good start. 

# Getting the Repositories

Currently, we use [ghtorrent](http://http://ghtorrent.org/) as the source of projects to download. For your convenience a script exists that downloads selected ghtorrent snapshot and extracts the projects information from it. 

First check out the date of the snapshot you want to use, such as `2017-12-01` and then run the following:

    npm run ghtorrent -- NAME OUTDIR [--discard-data]

Where `NAME` is the date of the snapshot in the `yyyy-mm-dd` form and `OUTDIR` is the output directory where the results should be downloaded. If `--discard-data` is present, then the snapshot will be deleted after the step. 

The script downloads the snapshot, extracts the `projects.csv` from it in the `OUTDIR/NAME` directory and if selected, deletes the snapshot, keeping only the extracted projects. 

> There is a plan to remove this step and download projects directly from github, which we can do using the [`/repositories`](https://developer.github.com/v3/repos/#list-all-public-repositories) API path. However, the annoying thing is that the results of this search do not give us the language of the project and therefore we would essentially have to do a request per project to get only projects of certain languages, which is a lot of API hours. 


# Filtering projects

Once we have the `projects.csv` file, we must filter projects of only the language(s) we are interested in. This is done in the filter step, which can be executed as follows:

    npm run filter -- INPUT OUTPUT --language=LANG [--no-forks]

where `INPUT` is absolute path to the `projects.csv` extracted from ghtorreent, `OUTPUT` is absolute path to a file that would contain only the filtered projects. To specify which language specification should be used, pass the language name to the `--language` argument. The optional `--noforks` argument filters out any forked projects if used.

> To remove duplicates, all of the projects must be kept in memory and therefore more than default heap size must be used. The npm script currently sets the memory to 8G, which seems to be enough for JavaScript. 

# Downloading the repositories and their snapshots

First, the initial data must be downloaded. In our setting this means getting all Github projects for the specified language one by one and analyzing all their commits, saving the snapshots along the way. Note that depending on your language, this step might take *a lot* of time and require a lot of network bandwidth and disk space. This task is also IO bound so downloading the repositories on a fast SSD drive is highly recommended. 

    npm run download -- INPUT OPTIONS --language=LANG

where `INPUT` is the input file containing all projects to be downloaded and analyzed, `LANG` is the language specification to be used and `OPTIONS` are any of the following:

- `--out-dir` specifies the output directory
- `--verbose` displays a summary statistics each 10 seconds
- `--skip-existing` makes sure that projects which have already been analyzed will not be reanalyzed again (ignoring whether they have changed since the analysis or not)
- `--tmp-dir=` - specifies the temporary directory which is used to clone the projects
- `--clear-tmp-dir` - clears the contents of the tmp dir before start (useful for restarting failed runs)
- `--github-tokens=` - specifies the JSON file containing github tokens that should be used by the downloader when fetching the metadata
- `--first=` - specifies index of the first project to be downloaded
- `--stride=` - specifies the stride length for distributed computations
- `--max-pq=` - number of file names prefetched from the input at a time
- `--max-w=` - specifies the number of packages that can be prefetched and the number of packages that can be in the waiting queue for analysis
- `--max-workers=` - specifies the number of projects that can be processed in paralllel

The downloader creates the following folders in the output directory:

- `projects` which contains for each successfully analyzed project a JSON file containing the information about the project (mostly github metadata, latest main branch commit, etc.). Projects are stored by their full names (user/repo).
- `commits` contains commits from all files, for each commit contains its date, author, commit message, parents and changes to *all* files. Commits are stored by their hash. 
- `snapshots` contains all unique versions of files that were observed in the projects and commits. Stored by their hashes.

In order to limit number of files per folder, all three are split into subfolders by various prefixes from the full names or hashes (3 letters from full names, 2/2 letters from hashes). 

The downloader provides statistics for the following values:  # of project names prefetched `PQ`, number of projects being downloaded `D`, number of projects waiting to be analyzed `W`, number of projects being currently analyzed `A`, # of projects finished `P` (of which errors `Pe`), # of commits seen `C` (without duplicate commits `Cu`), number of file versions observed for all files `S`, of which tracked (`St`), tracked files w/o duplicates `Su` (as percentage of `St`).

For the download `D`, waiting `W` and analysis `A` stages, list of current projects with the time since entering the stage is also reported. 

> `npm run download_ginger -- OPTS` and `npm run download_orange -- OPTS` provides shortcuts to hardcoded arguments for downloading entire JavaScript repositories on both `ginger` and `orange` machines. Expects path to temporary folders and first project. 





# Language Specific Tasks

## JavaScript

### Downloading registry of NPM packages

To download the NPM registry (a JSON file containing information about each NPM package), run the following:

    npm run download_npm_registry -- OUTPUT

where `OUTPUT` is path to the file where you want the registry to be stored. 



